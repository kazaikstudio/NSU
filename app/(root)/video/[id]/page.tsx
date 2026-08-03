"use client";

import { use, useState } from "react";
import Link from "next/link";
import DownloadModal from "@/components/DownloadModal";

function parseYouTubeId(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1);
    }
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") ?? url.pathname.split("/").pop() ?? "";
    }
  } catch {
    // not a URL, fall back to raw value
  }

  return trimmed.replace(/[^A-Za-z0-9_-]/g, "");
}

export default function VideoPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const decodedId = decodeURIComponent(id);
  const videoId = parseYouTubeId(decodedId);

  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [activeDownloadVideoId, setActiveDownloadVideoId] = useState<string | null>(null);
  const [downloadPosition, setDownloadPosition] = useState<{ x: number; y: number } | null>(null);
  const [downloadAnchor, setDownloadAnchor] = useState<HTMLElement | null>(null);

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
    <main className="min-h-screen bg-[#0d0f12] text-slate-100 pb-28 overflow-x-hidden">
      {/* Full-Width Auto-Sizing Video Container */}
      <div className="w-full bg-black shadow-2xl">
        <div className="relative aspect-video w-full max-w-7xl mx-auto bg-slate-900">
          {videoId ? (
            <iframe
              className="absolute inset-0 h-full w-full border-0 object-cover"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(
                origin || ""
              )}`}
              title="YouTube Video Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-center text-sm text-slate-400">
              Invalid video ID. Please check the link and try again.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Container with Fluid Padding */}
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pt-5 space-y-5">

        {/* Back Link */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
          >
            ← Back to browsing
          </Link>
        </div>

        {/* Title & Metadata Header */}
        <div className="space-y-2">
          <span className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Video Playback Experience
          </span>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-400 font-medium">
            <span className="text-amber-400 font-bold">★ 4.8</span>
            <span>•</span>
            <span>High Definition</span>
            <span>•</span>
            <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-slate-200 truncate max-w-50 sm:max-w-none">
              ID: {id}
            </span>
          </div>

          {/* Genre / Category Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="rounded-full bg-indigo-600/80 px-3 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Official
            </span>
            <span className="rounded-full bg-blue-600/80 px-3 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Visuals
            </span>
          </div>
        </div>

        {/* Action Buttons Row - Fully Auto-Stacking on Mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          {/* Watch / Play Stream Button */}
          <a
            href={videoId ? `https://www.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-3 text-sm font-bold text-white transition shadow-lg shadow-emerald-950/40"
          >
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Watch on YouTube</span>
          </a>

          {/* Secondary Options Group (Download & Share) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={(event) => openDownloadModal(event, id)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="sm:hidden">Download</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Check out this video", url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copied to clipboard!");
                }
              }}
              className="flex items-center justify-center rounded-xl bg-white/5 border border-white/10 h-11 w-11 shrink-0 text-slate-200 hover:bg-white/10 transition shadow"
              title="Share video"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3.3 3.3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3.3 3.3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Studio Info Cards Grid */}
        <div className=" space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Studio Information
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-2.5 shadow-sm">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-linear-to-br from-indigo-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm">
                NS
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-semibold text-white truncate">Noll Studio</h4>
                <p className="text-[11px] text-slate-400 truncate">Creator & Channel Host</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-2.5 shadow-sm">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-linear-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm">
                YT
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-semibold text-white truncate">YouTube API Stream</h4>
                <p className="text-[11px] text-slate-400 truncate">Direct Source Feed</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Download Modal Component */}
      <DownloadModal
        open={Boolean(activeDownloadVideoId)}
        videoId={activeDownloadVideoId}
        position={downloadPosition}
        anchor={downloadAnchor}
        onClose={closeDownloadModal}
      />
    </main>
  );
}
