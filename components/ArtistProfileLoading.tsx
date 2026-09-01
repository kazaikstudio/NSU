export default function ArtistProfileLoading({
  title,
  description = 'Fetching the latest details from the dashboard API.',
  artistName,
}: {
  title?: string;
  description?: string;
  artistName?: string;
}) {
  const heading = title || (artistName ? `${artistName}` : 'Loading page...');

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-6 py-10 text-primary">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-cardcl/70 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-400/20 via-fuchsia-500/10 to-indigo-500/20" />

        <div className="relative z-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 shadow-inner shadow-amber-400/20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
          </div>

          <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
            Loading profile
          </span>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{heading}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-secondary">{description}</p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-amber-300/80 animate-pulse [animation-delay:120ms]" />
            <span className="h-2 w-2 rounded-full bg-amber-200/70 animate-pulse [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </main>
  );
}


