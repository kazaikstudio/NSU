const primedUrls = new Set<string>();

const DEFAULT_BUDGET_MS = 4000;

// Buffers the very start of a track so playback begins instantly on click,
// while only downloading the first moments instead of the whole file.
// A budget timer stops additional buffering shortly after if the user hasn't
// started playing, keeping data usage low.
export function primeAudioStart(
  url: string,
  audio: HTMLAudioElement | null,
  opts: { budgetMs?: number } = {}
) {
  if (!audio || !url) return;

  if (primedUrls.has(url)) return;
  if (audio.readyState > 0 || audio.currentTime > 0 || !audio.paused) return;

  primedUrls.add(url);

  audio.preload = 'auto';

  // If the element is already actively fetching this exact URL, don't reassign
  // or call load() again — that aborts the in-flight fetch (surfacing as
  // AbortError on a later play()) and throws away the buffered start.
  const activeUrl = audio.currentSrc || audio.getAttribute('src');
  if (activeUrl !== url || audio.readyState === 0) {
    audio.src = url;
    audio.load();
  }
  audio.setAttribute('data-primed-url', url);

  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;

  window.setTimeout(() => {
    // Once play() has been requested the element is no longer paused, so an
    // in-use buffer is never discarded.
    if (audio.paused && audio.currentTime === 0) {
      // Forget the prime so a later hover re-primes this track instead of
      // leaving the click to restart the download from scratch.
      primedUrls.delete(url);
      audio.removeAttribute('data-primed-url');
      audio.preload = 'none';
      audio.load();
    }
  }, budgetMs);
}