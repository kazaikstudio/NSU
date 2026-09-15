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
  audio.src = url;
  audio.load();
  audio.setAttribute('data-primed-url', url);

  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;

  window.setTimeout(() => {
    if (audio.paused && audio.currentTime === 0) {
      audio.preload = 'none';
      audio.load();
    }
  }, budgetMs);
}