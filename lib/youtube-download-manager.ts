export interface YoutubeDownloadJob {
  title: string;
  videoId: string;
  itag: number;
  extension: string;
  outputBitrate?: number;
  totalBytes?: number;
}

interface DownloadStatus {
  status: 'downloading' | 'done' | 'error';
  title: string;
  error?: string;
  progress?: number;
  paused?: boolean;
  downloadedBytes?: number;
  totalBytes?: number;
  sourceVideoId: string;
  sourceItag: number;
  sourceExtension: string;
  sourceOutputBitrate?: number;
}

let activeJob: YoutubeDownloadJob | null = null;
let activeController: AbortController | null = null;
let paused = false;
let cancelled = false;
let controlsInstalled = false;
let currentProgress = 0;
let currentDownloadedBytes = 0;
let currentTotalBytes: number | undefined;

function emit(status: DownloadStatus) {
  let previousEntries: Array<Record<string, unknown>> = [];
  try {
    const storedEntries = JSON.parse(window.localStorage.getItem('nsu-download-history') || '[]');
    if (Array.isArray(storedEntries)) previousEntries = storedEntries;
  } catch {
    // Ignore malformed history and continue with the current download.
  }
  const previousEntry = previousEntries.find((entry) => entry.title === status.title);
  const nextEntry = {
    id: previousEntry?.id || `${status.title}-${Date.now()}`,
    title: status.title,
    status: status.status,
    progress: status.progress ?? previousEntry?.progress,
    downloadedBytes: status.downloadedBytes ?? previousEntry?.downloadedBytes,
    totalBytes: status.totalBytes ?? previousEntry?.totalBytes,
    paused: status.paused ?? false,
    sourceVideoId: status.sourceVideoId,
    sourceItag: status.sourceItag,
    sourceExtension: status.sourceExtension,
    sourceOutputBitrate: status.sourceOutputBitrate,
    createdAt: previousEntry?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem('nsu-download-history', JSON.stringify([
    nextEntry,
    ...previousEntries.filter((entry) => entry.title !== status.title),
  ].slice(0, 12)));
  window.dispatchEvent(new CustomEvent('nsu-download-status', { detail: status }));
}

function waitUntilResumed() {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (!paused || cancelled) {
        resolve();
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

export function startYoutubeDownload(job: YoutubeDownloadJob) {
  if (activeJob) return;

  activeJob = job;
  paused = false;
  cancelled = false;
  currentProgress = 0;
  currentDownloadedBytes = 0;
  currentTotalBytes = job.totalBytes;
  void runDownload(job);
}

export function installYoutubeDownloadControls() {
  if (controlsInstalled || typeof window === 'undefined') return;
  controlsInstalled = true;
  window.addEventListener('nsu-download-control', (event) => {
    const detail = (event as CustomEvent<{ title?: string; action?: 'pause' | 'resume' | 'cancel' }>).detail;
    if (detail?.title && detail.action) {
      controlYoutubeDownload(detail.title, detail.action);
    }
  });
}

export function controlYoutubeDownload(title: string, action: 'pause' | 'resume' | 'cancel') {
  if (!activeJob || activeJob.title !== title) return;

  if (action === 'pause') {
    paused = true;
    emitStatus(true);
  } else if (action === 'resume') {
    paused = false;
    emitStatus(false);
  } else {
    cancelled = true;
    paused = false;
    activeController?.abort();
    activeJob = null;
  }
}

function emitStatus(isPaused: boolean) {
  if (!activeJob) return;
  emit({
    status: 'downloading',
    title: activeJob.title,
    paused: isPaused,
    progress: currentProgress,
    downloadedBytes: currentDownloadedBytes,
    totalBytes: currentTotalBytes,
    sourceVideoId: activeJob.videoId,
    sourceItag: activeJob.itag,
    sourceExtension: activeJob.extension,
    sourceOutputBitrate: activeJob.outputBitrate,
  });
}

async function runDownload(job: YoutubeDownloadJob) {
  try {
    activeController = new AbortController();
    const query = new URLSearchParams({
      id: job.videoId,
      itag: String(job.itag),
      output: job.extension,
      bitrate: String(job.outputBitrate || 192),
    });
    const response = await fetch(`/api/youtube/download?${query.toString()}`, {
      signal: activeController.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || response.statusText || 'Unable to download this video.');
    }

    const totalBytes = Number(response.headers.get('content-length')) || job.totalBytes;
    currentTotalBytes = totalBytes;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Unable to start download.');

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let lastProgress = 0;

    while (true) {
      await waitUntilResumed();
      if (cancelled) return;

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      downloadedBytes += value.length;
      currentDownloadedBytes = downloadedBytes;

      const progress = totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : undefined;
      if (typeof progress === 'number') currentProgress = progress;
      if (progress !== lastProgress || progress === undefined) {
        lastProgress = progress || lastProgress;
        emit({
          status: 'downloading',
          title: job.title,
          progress,
          paused: false,
          downloadedBytes,
          totalBytes,
          sourceVideoId: job.videoId,
          sourceItag: job.itag,
          sourceExtension: job.extension,
          sourceOutputBitrate: job.outputBitrate,
        });
      }
    }

    if (cancelled) return;
    const blob = new Blob(chunks as BlobPart[], { type: job.extension === 'mp3' ? 'audio/mpeg' : 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${job.title}.${job.extension}`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);

    emit({
      status: 'done',
      title: job.title,
      progress: 100,
      paused: false,
      downloadedBytes: blob.size,
      totalBytes: blob.size,
      sourceVideoId: job.videoId,
      sourceItag: job.itag,
      sourceExtension: job.extension,
      sourceOutputBitrate: job.outputBitrate,
    });
  } catch (error) {
    if (cancelled || (error instanceof Error && error.name === 'AbortError')) return;
    emit({
      status: 'error',
      title: job.title,
      error: error instanceof Error ? error.message : 'Unable to download this format.',
      sourceVideoId: job.videoId,
      sourceItag: job.itag,
      sourceExtension: job.extension,
      sourceOutputBitrate: job.outputBitrate,
    });
  } finally {
    activeController = null;
    activeJob = null;
    paused = false;
    cancelled = false;
    currentProgress = 0;
    currentDownloadedBytes = 0;
    currentTotalBytes = undefined;
  }
}
