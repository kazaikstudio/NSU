"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Switchbutton from "../../components/Switchbutton";
import DownloadModal from "../../components/DownloadModal";

type YouTubeVideo = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail: string;
  date: string;
  url: string;
  views?: number;
  type?: "official" | "short";
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";

const Home = () => {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"official" | "short">("official");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDownloadVideoId, setActiveDownloadVideoId] = useState<string | null>(null);
  const [downloadPosition, setDownloadPosition] = useState<{ x: number; y: number } | null>(null);
  const [downloadAnchor, setDownloadAnchor] = useState<HTMLElement | null>(null);

  const router = useRouter();
  const mainSearchRef = useRef<HTMLDivElement>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  const scrollToMainSearch = () => {
    if (mainSearchRef.current) {
      mainSearchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = mainSearchRef.current.querySelector("input");
      if (input) input.focus();
    }
  };

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

        const endpoint = `/api/youtube/videos?channelId=${CHANNEL_ID}`;
        console.log("Fetching from:", endpoint);

        const res = await fetch(endpoint);
        const textResponse = await res.text();

        let payload;
        try {
          payload = JSON.parse(textResponse);
        } catch (e) {
          console.error("API did not return valid JSON:", textResponse);
          throw new Error("API returned invalid JSON format (check server logs).");
        }

        if (!res.ok) {
          throw new Error(payload?.error ?? `Server error status: ${res.status}`);
        }

        const items = payload?.videos ?? [];
        const formatted = items.map((v: any) => {
          const fallbackIsShort =
            v.title?.toLowerCase().includes("#shorts") ||
            v.title?.toLowerCase().includes("#short") ||
            v.title?.toLowerCase().includes("short");

          return {
            ...v,
            date: v.date ? new Date(v.date).toLocaleDateString("en-GB") : "",
            type: v.type ?? (fallbackIsShort ? "short" : "official"),
          } as YouTubeVideo;
        });

        setVideos(formatted);
      } catch (err) {
        console.error("Fetch videos failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchVideos();
  }, []);

  const filteredVideos = videos.filter((video) => video.type === selectedCategory);
  const officialVideos = videos.filter((video) => video.type === "official");
  const marqueeItems = officialVideos.slice(0, 5);

  // Auto-slide effect for mobile screens (< 640px)
  useEffect(() => {
    const container = marqueeRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      if (window.innerWidth >= 640) return;

      const totalItems = marqueeItems.length || 5;
      if (totalItems <= 1) return;

      const cardWidth = container.firstElementChild?.clientWidth || container.clientWidth;
      const currentIndex = Math.round(container.scrollLeft / cardWidth);
      const nextIndex = (currentIndex + 1) % totalItems;

      container.scrollTo({
        left: nextIndex * cardWidth,
        behavior: "smooth",
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [marqueeItems.length]);

  const openPlayer = (videoId: string) => {
    router.push(`/video/${encodeURIComponent(videoId)}`);
  };

  const openDownloadModal = (e: React.MouseEvent<HTMLButtonElement>, videoId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveDownloadVideoId(videoId);
    setDownloadPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    setDownloadAnchor(e.currentTarget);
  };

  const closeDownloadModal = () => {
    setActiveDownloadVideoId(null);
    setDownloadPosition(null);
    setDownloadAnchor(null);
  };

  return (
    <main className="min-h-screen pb-28">
      <Switchbutton onScrollToSearch={scrollToMainSearch} />

      <div className="p-2 text-start text-primary">
        <div className="relative overflow-hidden rounded-lg bg-linear-to-r from-cardcl via-cardcl/90 to-rose-950/40 p-3 shadow-xl border border-card1/20 backdrop-blur-md">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/20 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
            <span className="font-bold text-Eltext tracking-tight text-xs sm:text-sm leading-tight">
              ✨ Where Stories Come to Life — Explore Our Latest Creations
            </span>
          </div>
        </div>
      </div>

      <div className="text-primary space-y-6">
        <div className="w-full px-2">
          <div
            ref={marqueeRef}
            className="flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-none sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full"
          >
            {marqueeItems.length
              ? marqueeItems.map((v, idx) => (
                  <div
                    key={`${v.id}-${idx}`}
                    onClick={() => openPlayer(v.id)}
                    className="group relative w-full shrink-0 snap-center h-52 sm:h-52 rounded-2xl overflow-hidden cursor-pointer bg-zinc-900 border border-zinc-800/80 shadow-md transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-950/20"
                  >
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-transparent opacity-90 transition-opacity group-hover:opacity-80" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <div className="flex flex-col min-w-0 pr-1">
                        <h3 className="text-white font-semibold text-base truncate leading-snug tracking-tight group-hover:text-violet-200 transition-colors">
                          {v.title}
                        </h3>
                        {v.date && (
                          <p className="text-zinc-400 text-xs truncate mt-0.5 font-medium">
                            {v.date}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-violet-600 group-hover:border-violet-500 group-hover:shadow-violet-600/40"
                      >
                        <svg className="w-4 h-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              : [1, 2, 3, 4, 5].map((_, idx) => (
                  <div
                    key={`placeholder-${idx}`}
                    className="w-full shrink-0 snap-center h-52 rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800"
                  />
                ))}
          </div>
        </div>

        <div className="w-full text-start px-2 space-y-3">
          {/* Header Section */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-lg border border-rose-500/20 shadow-sm">
                🔥
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-primary tracking-tight leading-tight">
                  Top 6 Most Viewed
                </h3>
                <p className="text-[11px] font-medium text-rose-400">
                  Trending & Most Played Visuals
                </p>
              </div>
            </div>
          </div>

          {/* Horizontal Scroll Cards Container */}
          <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-rose-600/30 px-1">
            {[...videos]
              .sort((a, b) => (b.views || 0) - (a.views || 0))
              .slice(0, 6)
              .map((video, index) => (
                <div
                  key={video.id || index}
                  onClick={() => openPlayer(video.id)}
                  className="group relative w-36 sm:w-40 h-42.5 shrink-0 rounded-2xl overflow-hidden cursor-pointer snap-start border border-white/10 bg-cardcl/60 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-rose-500/50 hover:shadow-rose-950/30"
                >
                  {/* Thumbnail Image */}
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />

                  {/* Top Badge: Rank or Short */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white border border-white/10 uppercase tracking-wide">
                      {video.type === "short" ? "⚡ Short" : `#${index + 1}`}
                    </span>
                  </div>

                  {/* Bottom Card Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 flex flex-col justify-end gap-1">
                    <h4
                      className="text-xs font-semibold text-white truncate group-hover:text-rose-300 transition-colors leading-snug"
                      title={video.title}
                    >
                      {video.title}
                    </h4>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 font-medium">
                        {video.date || "Noll Studio"}
                      </span>

                      {/* Minimalist Play Icon Pill */}
                      <div className="h-6 w-6 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow transition-all duration-300 group-hover:bg-rose-600 group-hover:border-rose-500 group-hover:scale-110">
                        <svg className="w-3 h-3 fill-current translate-x-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div ref={gridSectionRef} className="px-2 w-full shadow-xl overflow-hidden">
          <div className="w-full bg-cardcl/80 rounded-xl">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-black/20 p-1">
              <button
                type="button"
                onClick={() => handleCategoryChange("official")}
                className={`w-full justify-center px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 rounded-lg cursor-pointer ${
                  selectedCategory === "official"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                    : "text-secondry hover:text-primary hover:bg-white/5"
                }`}
              >
                <span>🎥</span>
                <span>Official Videos</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${selectedCategory === "official" ? "bg-white/20 text-white" : "bg-white/10 text-secondry"}`}>
                  {videos.filter((v) => v.type === "official").length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("short")}
                className={`w-full justify-center px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 rounded-lg cursor-pointer ${
                  selectedCategory === "short"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                    : "text-secondry hover:text-primary hover:bg-white/5"
                }`}
              >
                <span>⚡</span>
                <span>Shorts</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${selectedCategory === "short" ? "bg-white/20 text-white" : "bg-white/10 text-secondry"}`}>
                  {videos.filter((v) => v.type === "short").length}
                </span>
              </button>
            </div>
          </div>

          <div className="p-1 sm:p-1">
            <div className="flex flex-col gap-1">
              {loading ? (
                <p className="text-secondry col-span-full py-12 text-center">Loading videos from YouTube...</p>
              ) : error ? (
                <p className="text-red-400 col-span-full py-12 text-center">Error loading videos: {error}</p>
              ) : filteredVideos.length === 0 ? (
                <p className="text-secondry col-span-full py-12 text-center">No content matches your selection.</p>
              ) : (
                filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => openPlayer(video.id)}
                    className="group relative flex items-center justify-between gap-3 rounded-xl bg-white/10 p-2.5 transition-all duration-300 hover:border-card1/40 hover:bg-card1/10 cursor-pointer shadow-sm"
                  >
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-black">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-center min-w-0 pr-2">
                      <h4 className="text-sm sm:text-base font-semibold text-primary truncate group-hover:text-rose-400 transition-colors" title={video.title}>
                        {video.title}
                      </h4>
                      <span className="mt-0.5 text-xs text-secondry font-medium">
                        {video.date || "Noll Studio"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => openDownloadModal(e, video.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-card1/20 text-secondry hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
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
      </div>

      <DownloadModal
        open={Boolean(activeDownloadVideoId)}
        videoId={activeDownloadVideoId}
        position={downloadPosition}
        anchor={downloadAnchor}
        onClose={closeDownloadModal}
      />
    </main>
  );
};

export default Home;
