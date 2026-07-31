"use client";

import { useState, useLayoutEffect, useRef } from "react";

type DownloadModalProps = {
  open: boolean;
  videoId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
};

const DownloadModal = ({ open, videoId, position, onClose }: DownloadModalProps) => {
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; placeAbove: boolean }>({
    x: 0,
    y: 0,
    placeAbove: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !position) return;

    const modalWidth = modalRef.current?.offsetWidth || 350;
    const modalHeight = modalRef.current?.offsetHeight || 250;

    const padding = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const minX = modalWidth / 2 + padding;
    const maxX = viewportWidth - modalWidth / 2 - padding;
    const clampedX = Math.max(minX, Math.min(position.x, maxX));

    const placeAbove = position.y + modalHeight > viewportHeight - padding;
    const clampedY = placeAbove
      ? Math.max(padding, position.y - modalHeight - 16)
      : position.y;

    setCoords({ x: clampedX, y: clampedY, placeAbove });
  }, [open, position]);

  if (!open || !videoId || !position) return null;

  const handleDownload = (format: string) => {
    setLoadingFormat(format);

    // Build the stream endpoint URL
    const downloadUrl = `/api/youtube/download?id=${encodeURIComponent(videoId)}&format=${format}`;

    // Create an invisible anchor tag to trigger instant browser download streaming
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.style.display = "none";
    
    // Suggest filename to browser
    const extension = format === "mp3" ? "mp3" : "mp4";
    a.download = `video_${videoId}.${extension}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Reset button loading indicator after triggering browser download tray
    setTimeout(() => {
      setLoadingFormat(null);
    }, 2000);
  };

  return (
    <>
      {/* Invisible backdrop to dismiss on outer click */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[1px]" 
        onClick={onClose} 
      />

      {/* Dynamic Popover Container */}
      <div
        ref={modalRef}
        style={{
          left: `${coords.x}px`,
          top: `${coords.y}px`,
        }}
        className="fixed z-[9999] w-80 sm:w-96 -translate-x-1/2 bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl select-none"
      >
        {/* Dynamic Caret Arrow */}
        <div 
          className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-slate-700/80 rotate-45 ${
            coords.placeAbove 
              ? "-bottom-2 border-b border-r" 
              : "-top-2 border-t border-l"
          }`} 
        />

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

        {/* Content Options */}
        <div className="relative z-10 space-y-2.5">
          {/* MP3 */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Audio Only (MP3)</div>
              <div className="text-[10px] text-slate-400">High Quality</div>
            </div>
            <button
              onClick={() => handleDownload("mp3")}
              disabled={loadingFormat === "mp3"}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "mp3" ? "Starting..." : "Download"}
            </button>
          </div>

          {/* 720p */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Video (720p)</div>
              <div className="text-[10px] text-slate-400">HD MP4</div>
            </div>
            <button
              onClick={() => handleDownload("720p")}
              disabled={loadingFormat === "720p"}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "720p" ? "Starting..." : "Download"}
            </button>
          </div>

          {/* 1080p */}
          <div className="flex justify-between items-center p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
            <div>
              <div className="font-semibold text-xs text-white">Video (1080p)</div>
              <div className="text-[10px] text-slate-400">Full HD MP4</div>
            </div>
            <button
              onClick={() => handleDownload("1080p")}
              disabled={loadingFormat === "1080p"}
              className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingFormat === "1080p" ? "Starting..." : "Download"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DownloadModal;