import Link from "next/link";

type VideoDetailPageProps = {
  params: {
    id: string;
  };
};

export default function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = params;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      <div className="px-4 py-8">
        <div className="mb-6 flex items-center gap-3 text-sm text-slate-300">
          <Link href="/" className="rounded-full bg-slate-900/80 px-4 py-2 text-slate-200 hover:bg-slate-800 transition">
            ← Back to videos
          </Link>
          <span className="text-slate-500">Play video detail</span>
        </div>

        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="bg-black aspect-video">
            <iframe
              className="w-full h-full border-0"
              src={`https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&enablejsapi=1`}
              title="YouTube Video Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="p-6">
            <h1 className="text-xl font-semibold text-white">Video Detail</h1>
            <p className="mt-3 text-sm text-slate-400">
              Playing video ID <span className="font-mono text-slate-200">{id}</span>.
            </p>
            <p className="mt-4 text-sm text-slate-300">
              Use the back button to return to the video list.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
