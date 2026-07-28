"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Switchbutton from "../../components/Switchbutton";
import { Card } from "../../components/Hotcard";
import DownloadModal from "../../components/DownloadModal";

type YouTubeVideo = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  date: string;
  url: string;
  type?: "official" | "short";
};

const CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";

const Home = () => {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  
  // Modal State includes position tracking for row/card anchoring
  const [downloadModal, setDownloadModal] = useState<{
    open: boolean;
    videoId: string | null;
    position: { x: number; y: number } | null;
  }>({ open: false, videoId: null, position: null });

  const [searchQuery, setSearchQuery] = useState("");
  // Category state toggles strictly between "official" and "short"
  const [selectedCategory, setSelectedCategory] = useState<"official" | "short">("official");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();
  const mainSearchRef = useRef<HTMLDivElement>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);

  const scrollToMainSearch = () => {
    if (mainSearchRef.current) {
      mainSearchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = mainSearchRef.current.querySelector("input");
      if (input) input.focus();
    }
  };

  // Handler for category tabs that toggles genre and smoothly scrolls to grid
  const handleCategoryChange = (category: "official" | "short") => {
    setSelectedCategory(category);
    if (gridSectionRef.current) {
      gridSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
        const formatted = items.map((v) => {
          const fallbackIsShort =
            v.title.toLowerCase().includes("#shorts") ||
            v.title.toLowerCase().includes("#short") ||
            v.title.toLowerCase().includes("short");

          return {
            ...v,
            date: v.date ? new Date(v.date).toLocaleDateString("en-GB") : "",
            type: v.type ?? (fallbackIsShort ? "short" : "official"),
          } as YouTubeVideo;
        });

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

  // Filter logic
  const categoryVideos = videos.filter((video) => video.type === selectedCategory);
  const officialVideos = videos.filter((video) => video.type === "official");

  const filteredVideos = categoryVideos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const marqueeItems = officialVideos.slice(0, 5);
  const marqueeRepeat = marqueeItems.length ? 2 : 1;

  const openPlayer = (videoId: string) => {
    router.push(`/video/${encodeURIComponent(videoId)}`);
  };

  // Handler captures button click event to anchor modal position
  const openDownloadModal = (e: React.MouseEvent<HTMLButtonElement>, videoId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    setDownloadModal({
      open: true,
      videoId,
      position: {
        x: rect.left + rect.width / 2, // Horizontally centered on clicked button
        y: rect.bottom + 8,            // 8px below the button
      },
    });
  };

  const closeDownloadModal = () =>
    setDownloadModal({ open: false, videoId: null, position: null });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      <Switchbutton onScrollToSearch={scrollToMainSearch} />

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
                      onDownload={(e: React.MouseEvent<HTMLButtonElement>) => openDownloadModal(e, v.id)}
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

        {/* Header & Search */}
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

          {/* Search Input */}
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

        {/* Seamless Combined Container (Filters + Video Grid) */}
        <div ref={gridSectionRef} className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          {/* Top Filter Bar Header */}
          <div className="grid grid-cols-2 w-full bg-slate-950/80 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => handleCategoryChange("official")}
              className={`w-full justify-center px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "official"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <span>🎥</span> Official Videos (
              {videos.filter((v) => v.type === "official").length})
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("short")}
              className={`w-full justify-center px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "short"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <span>⚡</span> Shorts (
              {videos.filter((v) => v.type === "short").length})
            </button>
          </div>

          {/* Main Grid Section Inside the Box */}
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {loading ? (
                <p className="text-slate-400 col-span-full py-12 text-center">Loading videos from YouTube...</p>
              ) : error ? (
                <p className="text-red-400 col-span-full py-12 text-center">Error loading videos: {error}</p>
              ) : filteredVideos.length === 0 ? (
                <p className="text-slate-400 col-span-full py-12 text-center">No content matches your selection.</p>
              ) : (
                filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-lg transition-all duration-300 hover:border-slate-700 hover:shadow-2xl group flex flex-col justify-between"
                  >
                    {/* Thumbnail Container */}
                    <div
                      className={`bg-black relative overflow-hidden cursor-pointer ${
                        video.type === "short" ? "aspect-9/16 max-h-80" : "h-44"
                      }`}
                      onClick={() => openPlayer(video.id)}
                    >
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Badge Label */}
                      <div className="absolute top-3 left-3">
                        <span className="rounded-md bg-black/60 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-white border border-white/10 uppercase tracking-wider">
                          {video.type === "short" ? "⚡ Short" : "🎬 Official"}
                        </span>
                      </div>

                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white">
                          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Meta & Download Action */}
                    <div className="flex justify-between items-center p-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-white truncate" title={video.title}>
                          {video.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-400">{video.date}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => openDownloadModal(e, video.id)}
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0 cursor-pointer"
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
          </div>
        </div>

        {/* Modal dynamically anchored to click position */}
        <DownloadModal
          open={downloadModal.open}
          videoId={downloadModal.videoId}
          position={downloadModal.position}
          onClose={closeDownloadModal}
        />
      </div>
    </main>
  );
};

export default Home;