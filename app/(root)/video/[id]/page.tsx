import Link from "next/link";

type VideoDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = await params;
  const decodedId = encodeURIComponent(id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Full-Width Video Container */}
      <div className="w-full bg-black shadow-2xl border-y border-slate-800">
        <div className="mx-auto max-w-7xl">
          <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
            <iframe
              className="absolute inset-0 h-full w-full border-0"
              src={`https://www.youtube.com/embed/${decodedId}?autoplay=1&enablejsapi=1`}
              title="YouTube Video Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>

      {/* Below Video Section: Details & Action Buttons */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Video Playback
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Now playing ID <span className="font-mono text-slate-200">{id}</span>
            </p>
          </div>

          {/* Action & Download Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Download MP3 Audio */}
            <a
              href={`/api/youtube/download?id=${decodedId}&format=mp3`}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition shadow-lg shadow-emerald-950/30"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9-4v9H3v-9H1v9c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-9h-2z" />
              </svg>
              Audio (MP3)
            </a>

            {/* Download 720p Video */}
            <a
              href={`/api/youtube/download?id=${decodedId}&format=720p`}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition shadow-lg shadow-indigo-950/30"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9-4v9H3v-9H1v9c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-9h-2z" />
              </svg>
              Video (720p)
            </a>

            {/* Download 1080p Video */}
            <a
              href={`/api/youtube/download?id=${decodedId}&format=1080p`}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition shadow-lg shadow-blue-950/30"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9-4v9H3v-9H1v9c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-9h-2z" />
              </svg>
              Video (1080p)
            </a>

            {/* Watch on YouTube */}
            <a
              href={`https://www.youtube.com/watch?v=${decodedId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition shadow-lg shadow-red-950/30"
            >
              Watch on YouTube ↗
            </a>

            {/* Browse More Videos */}
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
            >
              Browse More
            </Link>
          </div>
        </div>

        {/* Back Button Row */}
        <div className="py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 border border-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
          >
            ← Back to videos
          </Link>
        </div>

        {/* Additional Info / Description Zone */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            About this video
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Streaming directly via YouTube embedded player. Select any download option above to fetch MP3 audio or MP4 video files.
          </p>
        </div>
      </div>
    </main>
  );
}
