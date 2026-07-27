"use client";

import { useEffect, useState, useRef } from "react";
import Switchbutton from "../../components/Switchbutton";
import { Card } from "../../components/Hotcard";
import Player from "../../components/Player";

type YouTubeVideo = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  date: string;
  url: string;
};

const CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";

const Home = () => {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [downloadModal, setDownloadModal] = useState<{
    open: boolean;
    videoId?: string | null;
    streams?: Array<{ label: string; size?: string; url: string }>;
    message?: string;
  }>({ open: false });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Observer State & Ref for Floating Search Toggle
  const [isSearchInView, setIsSearchInView] = useState(true);
  const mainSearchRef = useRef<HTMLDivElement>(null);

  // Scroll back to main search bar and focus the input field
  const scrollToMainSearch = () => {
    if (mainSearchRef.current) {
      mainSearchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = mainSearchRef.current.querySelector("input");
      if (input) {
        input.focus();
      }
    }
  };

  useEffect(() => {
    const target = mainSearchRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSearchInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/youtube/videos?channelId=${CHANNEL_ID}`);
        const payload = (await res.json().catch(() => null)) as
          | { videos?: YouTubeVideo[]; error?: string }
          | null;

        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to fetch videos from server");
        }

        const items = payload?.videos ?? [];
        const formatted = items.map((v) => ({
          ...v,
          date: v.date ? new Date(v.date).toLocaleDateString("en-GB") : "",
        } as YouTubeVideo));

        setVideos(formatted);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchVideos();
  }, []);

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const marqueeItems = videos.slice(0, 5);
  const marqueeRepeat = marqueeItems.length ? 2 : 1;

  const openPlayer = (videoId: string) => setPlayingId(videoId);
  const closePlayer = () => setPlayingId(null);

  const openDownloadModal = async (videoId: string) => {
    setDownloadModal({ open: true, videoId, streams: [], message: "Loading download links..." });
    try {
      const res = await fetch(`/api/youtube/download?videoId=${encodeURIComponent(videoId)}`);
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setDownloadModal({
          open: true,
          videoId,
          streams: [],
          message: payload?.message ?? payload?.error ?? "Downloader currently unavailable.",
        });
        return;
      }

      const streams = payload?.streams ?? [];
      setDownloadModal({
        open: true,
        videoId,
        streams,
        message: streams.length === 0 ? (payload?.message ?? "No download streams found.") : undefined,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setDownloadModal({ open: true, videoId, streams: [], message: errorMessage });
    }
  };

  const closeDownloadModal = () => setDownloadModal({ open: false });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Floating Bottom Switchbutton with Scroll-to-Top trigger */}
      <Switchbutton
        showSearch={!isSearchInView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onScrollToSearch={scrollToMainSearch}
      />

      <div className="p-4 text-start">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950/40 p-6 shadow-xl border border-slate-700/50 backdrop-blur-md my-6">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-semibold text-rose-400 border border-rose-500/20 mb-2">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-rose-500 animate-pulse" />
                Fresh Uploads
              </span>
              <h3 className="text-base sm:text-2xl font-bold text-white tracking-tight">
                ✨ Where Stories Come to Life — Explore Our Latest Creations
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                Crafted right here at Noll Studio Uganda.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Animated Marquee Banner */}
        <div className="overflow-hidden w-full py-2">
          <div className="marquee-track flex w-max animate-[marquee_20s_linear_infinite] gap-4">
            {[...Array(marqueeRepeat)].flatMap((_, repeatIdx) =>
              marqueeItems.length
                ? marqueeItems.map((v, idx) => (
                    <Card
                      key={`${v.id}-${repeatIdx}-${idx}`}
                      card={{
                        title: v.title,
                        date: v.date,
                        imgUrl: v.thumbnail,
                        gradient: "from-pink-500 to-purple-600",
                      }}
                      onPlay={() => openPlayer(v.id)}
                      onDownload={() => openDownloadModal(v.id)}
                    />
                  ))
                : [1, 2, 3, 4, 5].map((_, idx) => (
                    <Card
                      key={`placeholder-${repeatIdx}-${idx}`}
                      card={{
                        title: loading ? "Loading..." : "No video",
                        date: "",
                        imgUrl: "/placeholder.jpg",
                        gradient: "from-pink-500 to-purple-600",
                      }}
                    />
                  ))
            )}
          </div>
        </div>

        {/* Header & Main Inline Search Bar */}
        <div className="mt-8 text-start">
          <div className="my-6 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 p-0.5 shadow-lg shadow-rose-900/20">
            <div className="rounded-[10px] bg-slate-950 p-5 sm:p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-2xl border border-rose-500/20">
                🎬
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-white leading-snug">
                  Press Play on Pure Creativity
                </p>
                <p className="text-xs sm:text-sm font-medium text-rose-400 mt-0.5">
                  • High Definition Visuals
                </p>
              </div>
            </div>
          </div>

          {/* Ref attached to observe scroll position and target jump target */}
          <div
            ref={mainSearchRef}
            className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-lg focus-within:border-slate-600 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search videos by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white placeholder-slate-400 outline-none text-sm"
            />
          </div>
        </div>

        {/* Main Grid Section */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pb-12">
          {loading ? (
            <p className="text-slate-400 col-span-full py-8 text-center">Loading videos from YouTube...</p>
          ) : error ? (
            <p className="text-red-400 col-span-full py-8 text-center">Error loading videos: {error}</p>
          ) : filteredVideos.length === 0 ? (
            <p className="text-slate-400 col-span-full py-8 text-center">No videos match your search.</p>
          ) : (
            filteredVideos.map((video) => (
              <div
                key={video.id}
                className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl group flex flex-col justify-between"
              >
                <div
                  className="h-44 bg-black relative overflow-hidden cursor-pointer"
                  onClick={() => openPlayer(video.id)}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-white truncate" title={video.title}>
                      {video.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">{video.date}</p>
                  </div>
                  <button
                    onClick={() => openDownloadModal(video.id)}
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
                    title="Download options"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9H13V5.5h-2V11H8.5l3.5 3.5 3.5-3.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Video Player Overlay */}
        {playingId && <Player videoId={playingId} onClose={closePlayer} />}

        {/* Download Modal */}
        {downloadModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Download Options</h3>
                <button
                  onClick={closeDownloadModal}
                  className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {downloadModal.streams && downloadModal.streams.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {downloadModal.streams.map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <div>
                        <div className="font-semibold text-sm text-white">{s.label}</div>
                        {s.size && <div className="text-xs text-slate-400">{s.size}</div>}
                      </div>
                      <a
                        href={s.url}
                        className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-4 py-2 rounded-lg text-white transition-colors"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-300 text-center py-4">
                  {downloadModal.message ?? "No download streams available."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Home;