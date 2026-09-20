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
    if (cancelled) return;
    activeController = new AbortController();
    if (cancelled) {
      activeController.abort();
      return;
    }
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

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Unable to start download.');

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let metaDone = false;
    let pythonPercent: number | undefined;
    let streamTotalBytes = 0;
    const metaBuffer: number[] = [];

    const emitStatus = (isPaused: boolean) => {
      emit({
        status: 'downloading',
        title: job.title,
        paused: isPaused,
        progress: currentProgress,
        downloadedBytes,
        totalBytes: streamTotalBytes || currentTotalBytes,
        sourceVideoId: job.videoId,
        sourceItag: job.itag,
        sourceExtension: job.extension,
        sourceOutputBitrate: job.outputBitrate,
      });
    };

    // Parses the leading NDJSON section (progress / error / done meta lines)
    // and returns any trailing file bytes once the "done" marker is seen.
    const feedMeta = (value: Uint8Array): Uint8Array | null => {
      for (let index = 0; index < value.length; index += 1) metaBuffer.push(value[index]);

      let newline = metaBuffer.indexOf(10);
      while (newline !== -1 && !metaDone) {
        const lineBytes = metaBuffer.splice(0, newline + 1);
        const text = new TextDecoder().decode(new Uint8Array(lineBytes)).trim();
        if (text) {
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(text) as Record<string, unknown>;
          } catch {
            payload = {};
          }
          if (payload.type === 'progress' && typeof payload.percent === 'number') {
            pythonPercent = payload.percent;
          } else if (payload.type === 'error') {
            throw new Error(typeof payload.message === 'string' && payload.message ? payload.message : 'The download failed.');
          } else if (payload.type === 'done') {
            metaDone = true;
            streamTotalBytes = typeof payload.size === 'number' ? payload.size : 0;
          }
        }
        newline = metaBuffer.indexOf(10);
      }

      if (metaDone && metaBuffer.length) {
        const remainder = new Uint8Array(metaBuffer);
        metaBuffer.length = 0;
        return remainder;
      }
      return metaDone ? new Uint8Array(0) : null;
    };

    while (true) {
      await waitUntilResumed();
      if (cancelled) return;

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      let nextProgress: number | undefined;
      if (!metaDone) {
        const trailing = feedMeta(value);
        if (trailing == null) {
          // Whole chunk was metadata; pythonPercent was just refreshed.
          nextProgress = pythonPercent;
        } else {
          if (trailing.length) {
            chunks.push(trailing);
            downloadedBytes += trailing.length;
          }
          nextProgress = computeStreamProgress(job, pythonPercent, streamTotalBytes, downloadedBytes);
        }
      } else {
        chunks.push(value);
        downloadedBytes += value.length;
        nextProgress = computeStreamProgress(job, pythonPercent, streamTotalBytes, downloadedBytes);
      }
      if (typeof nextProgress !== 'number') continue;

      currentDownloadedBytes = downloadedBytes;
      if (paused) {
        currentProgress = nextProgress;
        emitStatus(true);
        continue;
      }

      if (nextProgress !== currentProgress || downloadedBytes > 0) {
        currentProgress = nextProgress;
        emitStatus(false);
      }
    }

    if (!metaDone) {
      throw new Error('The download stream finished before it was complete.');
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

function computeStreamProgress(
  job: YoutubeDownloadJob,
  pythonPercent: number | undefined,
  streamTotalBytes: number,
  downloadedBytes: number,
): number | undefined {
  const total = streamTotalBytes || job.totalBytes || 0;
  if (typeof pythonPercent === 'number' && pythonPercent >= 0) {
    // The Python worker drives 0-100% of the real download; the file stream
    // completes the remaining span so the bar keeps moving to 100.
    return total > 0
      ? Math.min(100, Math.round(pythonPercent + (downloadedBytes / total) * (100 - pythonPercent)))
      : pythonPercent;
  }
  if (total > 0) {
    return Math.min(100, Math.round((downloadedBytes / total) * 100));
  }
  return undefined;
}
