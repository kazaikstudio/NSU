import { ID3Writer } from 'browser-id3-writer';
import { reportTrackCounts } from '@/lib/audio-counts';
import { buildAudioDownloadName, getAudioDownloadThumbnailUrl } from '@/lib/download';
import { registerClientDownload } from '@/lib/download-controls';

async function fetchCoverArt(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size) return null;
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
}

function looksLikeMp3(head: Uint8Array) {
  if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true;
  return head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
}

async function embedCoverArt(source: Blob, cover: ArrayBuffer, title: string, artist?: string) {
  const writer = new ID3Writer(await source.arrayBuffer());
  writer.setFrame('TIT2', title);
  if (artist) writer.setFrame('TPE1', [artist]);
  writer.setFrame('APIC', {
    type: 3,
    data: cover,
    description: 'Cover',
  });
  return writer.getBlob();
}

async function getDownloadRegion() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

  const position = await new Promise<GeolocationPosition | undefined>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(undefined), {
      enableHighAccuracy: false,
      timeout: 4000,
      maximumAge: 300000,
    });
  });
  if (!position) return undefined;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return undefined;

    const data = await response.json() as { address?: Record<string, string | undefined> };
    const addressText = Object.values(data.address || {}).filter(Boolean).join(' ').toLowerCase();
    if (addressText.includes('kampala')) return 'Kampala';
    if (/(northern|gulu|lira|kitgum|west nile|arua|karamoja|moroto)/.test(addressText)) return 'Northern';
    if (/(eastern|jinja|mbale|tororo|soroti|busia)/.test(addressText)) return 'Eastern';
    if (/(western|mbarara|kasese|fort portal|kabale|hoima)/.test(addressText)) return 'Western';
    if (/(central|wakiso|mukono|mpigi|masaka|masindi)/.test(addressText)) return 'Central';
  } catch {
    return undefined;
  }

  return undefined;
}

export interface TrackDownloadResult {
  trackDownloads?: number;
  artistTotalDownloads?: number;
}

export interface TrackDownloadOptions {
  url: string;
  title: string;
  artist?: string;
  fileName?: string;
  src?: string;
  onStatus?: (status: 'downloading' | 'done' | 'error', progress: number) => void;
}

// Downloads an audio file through the dashboard media endpoint, streams it to a
// client-side blob, and returns the server-recorded counts so every call site
// (rows, cards, full-screen player) keeps the shared counts registry in sync.
export async function downloadTrackFile(options: TrackDownloadOptions): Promise<TrackDownloadResult | undefined> {
  const { url, title, artist, fileName, src } = options;
  const resolvedFileName = fileName || buildAudioDownloadName(title, artist);

  window.dispatchEvent(new CustomEvent('nsu-download-status', {
    detail: { status: 'downloading', title, progress: 0, downloadedBytes: 0, fileName: resolvedFileName },
  }));
  options.onStatus?.('downloading', 0);

  const controller = new AbortController();
  const downloadControl = registerClientDownload(title, () => controller.abort());

  try {
    const region = await getDownloadRegion();
    const requestUrl = new URL(url, window.location.origin);
    if (region) requestUrl.searchParams.set('region', region);

    const response = await fetch(requestUrl, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    const responseContentType = response.headers.get('content-type') || '';
    if (/text\/html|text\/plain|application\/json/.test(responseContentType)) {
      throw new Error('Download failed: the server returned a text page instead of audio.');
    }

    const serverDownloadCount = Number(response.headers.get('X-NSU-Download-Count'));
    const serverArtistTotalDownloadCount = Number(response.headers.get('X-NSU-Artist-Download-Count'));
    const hasServerCounts = Number.isFinite(serverDownloadCount);

    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Download body is unavailable.');
    }

    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let lastProgress = 0;
    let checkedFirstChunk = false;
    let headBytes = new Uint8Array(0);

    // Simulated pacing so the UI shows movement even when the backend doesn't
    // report a content-length for the stream.
    let progressIndex = 0;
    const progressSteps = [12, 24, 38, 52, 68, 82, 92];
    let simulatedProgress = 0;
    const simulate = () => {
      simulatedProgress = total > 0 ? simulatedProgress : (progressSteps[progressIndex] ?? 94);
      progressIndex += 1;
      return simulatedProgress;
    };

    while (true) {
      await downloadControl.waitUntilResumed();
      if (downloadControl.isCancelled()) {
        controller.abort();
        return undefined;
      }

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (!checkedFirstChunk) {
        checkedFirstChunk = true;
        headBytes = new Uint8Array(value.subarray(0, 8));
        const head = Array.from(value.subarray(0, Math.min(value.length, 64)))
          .map((byte) => String.fromCharCode(byte))
          .join('');
        if (/^\s*(<|<!DOCTYPE|\{)/.test(head)) {
          controller.abort();
          throw new Error('Download failed: the response is not an audio file.');
        }
      }

      chunks.push(value);
      loaded += value.length;

      let nextProgress: number | null = null;
      if (total > 0) {
        const realProgress = Math.min(100, Math.round((loaded / total) * 100));
        if (realProgress !== lastProgress) nextProgress = realProgress;
      } else {
        nextProgress = simulate();
      }

      if (nextProgress !== null && nextProgress !== lastProgress) {
        lastProgress = nextProgress;
        options.onStatus?.('downloading', nextProgress);
        window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
          detail: { status: 'downloading', title, progress: nextProgress, downloadedBytes: loaded, totalBytes: total, fileName: resolvedFileName },
        }));
      }
    }

    const binaryData = chunks.map((chunk) => {
      const array = new Uint8Array(chunk.length);
      array.set(chunk);
      return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
    });
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const baseBlob = new Blob(binaryData, { type: contentType });
    let downloadBlob = baseBlob;

    if (looksLikeMp3(headBytes)) {
      const coverUrl = getAudioDownloadThumbnailUrl();
      const cover = await fetchCoverArt(coverUrl);
      if (cover) {
        try {
          downloadBlob = await embedCoverArt(baseBlob, cover, title, artist);
        } catch (error) {
          console.warn('Unable to embed cover art, downloading raw audio instead', error);
          downloadBlob = baseBlob;
        }
      }
    }

    const filename = resolvedFileName;
    const anchor = document.createElement('a');
    const objectUrl = URL.createObjectURL(downloadBlob);
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    const trackDownloads = hasServerCounts ? serverDownloadCount : undefined;
    const artistTotalDownloads = Number.isFinite(serverArtistTotalDownloadCount)
      ? serverArtistTotalDownloadCount
      : undefined;

    options.onStatus?.('done', 100);
    window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
      detail: { status: 'done', title, progress: 100, downloadedBytes: loaded, totalBytes: total || loaded, fileName: resolvedFileName },
    }));

    const result: TrackDownloadResult = { trackDownloads, artistTotalDownloads };
    if (src) {
      reportTrackCounts({
        src,
        ...(trackDownloads != null ? { downloadCount: trackDownloads } : {}),
        ...(artistTotalDownloads != null ? { artistTotalDownloads } : {}),
        ...(artist ? { artist } : {}),
      });
    }
    return result;
  } catch (error) {
    if (downloadControl.isCancelled() || (error instanceof Error && error.name === 'AbortError')) {
      return undefined;
    }
    console.error('Download failed:', error);
    options.onStatus?.('error', 0);
    window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
      detail: { status: 'error', title, progress: 0, fileName: resolvedFileName },
    }));
    return undefined;
  } finally {
    downloadControl.unregister();
  }
}

interface DownloadNoticePayload {
  status: 'downloading' | 'done' | 'error';
  title: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  fileName?: string;
}