export default function ArtistProfileLoading({
  title = 'Loading artist profile…',
  description = 'Fetching the latest details from the dashboard API.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-backnav px-6 text-primary">
      <div className="rounded-2xl border border-card1/15 bg-cardcl/80 p-8 text-center shadow-2xl shadow-card1/10 backdrop-blur-sm">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-navlink border-t-transparent" />
        <h1 className="text-2xl font-semibold text-primary">{title}</h1>
        <p className="mt-2 text-sm text-secondary">{description}</p>
      </div>
    </main>
  );
}


