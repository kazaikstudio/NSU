import { clearPartialDownload, getPartialChunks, getPartialOffset, setPartialDownload } from './direct-download-store';

export type DirectUrlDownloadProgress = {
  downloadedBytes: number;
  totalBytes?: number;
  progress?: number;
  resumedBytes: number;
};

export type DirectUrlDownloadResult = {
  blob: Blob;
  totalBytes?: number;
  resumedBytes: number;
  contentType: string;
};

export const DIRECT_URL_API = '/api/download';

export async function startDirectUrlDownload(options: {
  sourceUrl: string;
  signal?: AbortSignal;
  onProgress: (state: DirectUrlDownloadProgress) => void;
}): Promise<DirectUrlDownloadResult> {
  const { sourceUrl, signal, onProgress } = options;

  const offset = getPartialOffset(sourceUrl);
  const hasPartial = offset > 0;
  const headers: Record<string, string> = {};
  if (hasPartial) headers['Range'] = `bytes=${offset}-`;

  const response = await fetch(`${DIRECT_URL_API}?url=${encodeURIComponent(sourceUrl)}`, {
    signal,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || 'Unable to download this file.');
  }

  const resumed = response.status === 206 && hasPartial;
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  let chunks: Uint8Array[] = [];
  let downloadedBytes = 0;
  let totalBytes: number | undefined;

  if (resumed) {
    chunks = getPartialChunks(sourceUrl) ?? [];
    totalBytes = offset + (Number(response.headers.get('content-length')) || 0);
    downloadedBytes = offset;
  } else {
    clearPartialDownload(sourceUrl);
    const contentLength = Number(response.headers.get('content-length')) || 0;
    if (contentLength > 0) totalBytes = contentLength;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Unable to start this download.');

  let lastProgress: number | undefined;

  const emitProgress = () => {
    const progress = totalBytes ? Math.min(100, Math.round((downloadedBytes / (totalBytes || 1)) * 100)) : undefined;
    if (!totalBytes || progress !== lastProgress) {
      lastProgress = progress;
      onProgress({ downloadedBytes, totalBytes, progress, resumedBytes: resumed ? offset : 0 });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    downloadedBytes += value.length;
    if (resumed) setPartialDownload(sourceUrl, chunks, downloadedBytes);
    emitProgress();
  }

  clearPartialDownload(sourceUrl);

  const blob = new Blob(chunks as BlobPart[], { type: contentType });
  return { blob, totalBytes: totalBytes ?? blob.size, resumedBytes: resumed ? offset : 0, contentType };
}