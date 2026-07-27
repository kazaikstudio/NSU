"use client";

import { useEffect } from "react";

interface PlayerProps {
  videoId: string;
  onClose: () => void;
}

export default function Player({ videoId, onClose }: PlayerProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 sm:p-8 backdrop-blur-xl">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Frame Container */}
      <div className="relative z-10 w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-black">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 flex items-center gap-2 rounded-full bg-black/80 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold border border-slate-700 shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95"
        >
          <span>Close</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <iframe
          className="w-full h-full border-0"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${origin}`}
          title="YouTube Video Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}