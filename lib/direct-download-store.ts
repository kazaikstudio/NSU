type PartialPayload = {
  chunks: Uint8Array[];
  offsetBytes: number;
};

const STORE_KEY = '__nsuDirectPartials';

function getStore(): Map<string, PartialPayload> {
  if (typeof window === 'undefined') return new Map<string, PartialPayload>();
  const existing = (window as typeof window & { [STORE_KEY]?: Map<string, PartialPayload> })[STORE_KEY];
  if (existing instanceof Map) return existing;
  const store = new Map<string, PartialPayload>();
  (window as typeof window & { [STORE_KEY]: Map<string, PartialPayload> })[STORE_KEY] = store;
  return store;
}

export function getPartialDownload(sourceUrl: string): PartialPayload | null {
  return getStore().get(sourceUrl) ?? null;
}

export function getPartialChunks(sourceUrl: string): Uint8Array[] | null {
  return getStore().get(sourceUrl)?.chunks ?? null;
}

export function getPartialOffset(sourceUrl: string): number {
  return getStore().get(sourceUrl)?.offsetBytes ?? 0;
}

export function setPartialDownload(sourceUrl: string, chunks: Uint8Array[], offsetBytes: number): void {
  getStore().set(sourceUrl, { chunks, offsetBytes });
}

export function clearPartialDownload(sourceUrl: string): void {
  getStore().delete(sourceUrl);
}