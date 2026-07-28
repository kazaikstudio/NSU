"use client";

import { useState } from "react";

type DownloadModalProps = {
  open: boolean;
  videoId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
};

const DownloadModal = ({ open, videoId, position, onClose }: DownloadModalProps) => {
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  if (!open || !videoId || !position) return null;

  const handleDownload = (format: string) => {
    setLoadingFormat(format);
    window.location.href = `/api/download?id=${encodeURIComponent(videoId)}&format=${format}`;
    setTimeout(() => setLoadingFormat(null), 3000);
  };

  return (
    <>
      {/* Invisible backdrop to dismiss when clicking outside */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
      />

      {/* Popover container positioned directly at the click point */}
      <div
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        /* -translate-x-1/2 centers it horizontally over the button */
        className="fixed z-50 w-80 sm:w-96 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl select-none"
      >
        {/* Top Caret Arrow pointing up at the button */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-t border-l border-slate-800 rotate-45" />

        {/* Header */}
        <div className="relative z-10 flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 text-xs">🎬</span>
            <h3 className="text-sm font-bold text-white">Download Options</h3>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-medium transition-colors p-1 cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Options */}
        <div className="relative z-10 space-y-2.5">
          {/* MP3 */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Audio Only (MP3)</div>
              <div className="text-[10px] text-slate-400">High Quality</div>
            </div>
            <button
              onClick={() => handleDownload("mp3")}
              disabled={loadingFormat === "mp3"}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "mp3" ? "..." : "Download"}
            </button>
          </div>

          {/* 720p */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Video (720p)</div>
              <div className="text-[10px] text-slate-400">HD MP4</div>
            </div>
            <button
              onClick={() => handleDownload("720p")}
              disabled={loadingFormat === "720p"}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "720p" ? "..." : "Download"}
            </button>
          </div>

          {/* 1080p */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Video (1080p)</div>
              <div className="text-[10px] text-slate-400">Full HD MP4</div>
            </div>
            <button
              onClick={() => handleDownload("1080p")}
              disabled={loadingFormat === "1080p"}
              className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "1080p" ? "..." : "Download"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DownloadModal;