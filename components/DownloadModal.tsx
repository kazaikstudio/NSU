"use client";

import { useState, useLayoutEffect, useRef } from "react";

type DownloadFormat = {
  itag: number;
  label: string;
  kind: string;
  mimeType: string;
  extension: string;
  codec: string;
  size: number | null;
  bitrate: number;
};

type DownloadModalProps = {
  open: boolean;
  videoId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
};

const DownloadModal = ({ open, videoId, position, onClose }: DownloadModalProps) => {
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);
  const [formats, setFormats] = useState<DownloadFormat[]>([]);
  const [title, setTitle] = useState("");
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [error, setError] = useState("");
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

  useLayoutEffect(() => {
    if (!open || !videoId) return;

    let cancelled = false;
    const loadFormats = async () => {
      setLoadingFormats(true);
      setError("");
      setFormats([]);

      try {
        const response = await fetch(`/api/youtube/formats?id=${encodeURIComponent(videoId)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to fetch formats.");
        if (!cancelled) {
          setTitle(payload.title);
          setFormats(payload.formats);
        }
      } catch (loadError: unknown) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to fetch formats.");
      } finally {
        if (!cancelled) setLoadingFormats(false);
      }
    };

    void loadFormats();

    return () => { cancelled = true; };
  }, [open, videoId]);

  if (!open || !videoId || !position) return null;

  const handleDownload = async (format: DownloadFormat) => {
    setLoadingFormat(String(format.itag));
    try {
      const response = await fetch(`/api/youtube/download?id=${encodeURIComponent(videoId)}&itag=${format.itag}&output=${format.extension}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to download this format.");
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encodedFilename ? decodeURIComponent(encodedFilename) : `${title || videoId}.mp4`;
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError: unknown) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download this format.");
    } finally {
      setLoadingFormat(null);
    }
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

        <p className="mb-3 truncate text-xs text-slate-400">{title}</p>
        <div className="relative z-10 space-y-2.5">
          {loadingFormats && <p className="py-4 text-center text-sm text-slate-400">Checking available formats...</p>}
          {error && <p className="py-2 text-sm text-red-400" role="alert">{error}</p>}
          {!loadingFormats && !error && (['audio', 'video'] as const).map((section) => {
            const sectionFormats = formats.filter((format) => section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video'));
            if (!sectionFormats.length) return null;
            return (
              <div key={section} className="space-y-2.5">
                <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-wider text-rose-300">{section} formats</h4>
                {sectionFormats.map((format) => (
                  <div key={`${format.itag}-${format.extension}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/80 p-2.5">
                    <div>
                      <div className="font-semibold text-xs text-white">{format.label} {format.extension.toUpperCase()}</div>
                      <div className="text-[10px] text-slate-400">{format.kind.replace('+', ' + ')}{format.size ? ` • ${(format.size / 1024 / 1024).toFixed(1)} MB` : ""}</div>
                    </div>
                    <button onClick={() => void handleDownload(format)} disabled={loadingFormat !== null} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50">
                      {loadingFormat === String(format.itag) ? "Preparing..." : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default DownloadModal;