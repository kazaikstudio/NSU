const primedUrls = new Set<string>();

const DEFAULT_BUDGET_MS = 4000;

// How close to the end of the file the buffer must be before we treat it as
// "well loaded" and keep it cached instead of discarding it at the budget.
const FULLY_BUFFERED_MARGIN_SEC = 16;

function isFullyBuffered(audio: HTMLAudioElement) {
  if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return false;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return false;

  const lastBuffered = audio.buffered.length
    ? audio.buffered.end(audio.buffered.length - 1)
    : 0;
  return lastBuffered >= audio.duration - FULLY_BUFFERED_MARGIN_SEC;
}

// Buffers a track so playback begins instantly on click. Once the file is
// (nearly) completely buffered it is kept warm in the element, so re-clicking
// the track plays instantly without re-downloading. Files that only got a
// partial buffer before the budget fires are released to keep data usage low.
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
      // A fully-buffered track stays cached so the next click starts instantly
      // without waiting on the network again.
      if (isFullyBuffered(audio)) return;

      // Forget the prime so a later hover re-primes this track instead of
      // leaving the click to restart the download from scratch.
      primedUrls.delete(url);
      audio.removeAttribute('data-primed-url');
      audio.preload = 'none';
      audio.load();
    }
  }, budgetMs);
}