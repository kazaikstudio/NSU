"use client";

import { useState, useLayoutEffect, useRef } from "react";

type DownloadFormat = {
  itag: number;
  label: string;
  kind: string;
  mimeType: string;
  extension: string;
  outputBitrate?: number;
  codec: string;
  size: number | null;
  bitrate: number;
};

type DownloadModalProps = {
  open: boolean;
  videoId: string | null;
  position: { x: number; y: number } | null;
  anchor: HTMLElement | null;
  onClose: () => void;
};

const DownloadModal = ({ open, videoId, position, anchor, onClose }: DownloadModalProps) => {
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
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

    const updatePosition = () => {
      const modalWidth = modalRef.current?.offsetWidth || 350;
      const modalHeight = Math.min(modalRef.current?.offsetHeight || 250, window.innerHeight * 0.72);
      const rect = anchor?.getBoundingClientRect();
      const sourceX = rect ? rect.left + rect.width / 2 : position.x;
      const sourceY = rect ? rect.bottom + 8 : position.y;
      const padding = 16;
      const maxX = window.innerWidth - modalWidth / 2 - padding;
      const clampedX = Math.max(modalWidth / 2 + padding, Math.min(sourceX, maxX));
      const placeAbove = sourceY + modalHeight > window.innerHeight - padding;
      const clampedY = placeAbove
        ? Math.max(padding, (rect?.top || sourceY) - modalHeight - 8)
        : Math.max(padding, sourceY);
      setCoords({ x: clampedX, y: clampedY, placeAbove });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, position, anchor]);

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

  const getFormatKey = (format: DownloadFormat) => `${format.itag}-${format.extension}-${format.outputBitrate || "source"}`;

  const handleDownload = async (format: DownloadFormat) => {
    const formatKey = getFormatKey(format);
    setLoadingFormat(formatKey);
    setDownloadProgress(0);
    try {
      const response = await fetch(`/api/youtube/download?id=${encodeURIComponent(videoId)}&itag=${format.itag}&output=${format.extension}&bitrate=${format.outputBitrate || ''}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to download this format.");
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encodedFilename ? decodeURIComponent(encodedFilename) : `${title || videoId}.mp4`;
      const contentLength = Number(response.headers.get("Content-Length"));
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value);
          receivedLength += value.length;
          if (Number.isFinite(contentLength) && contentLength > 0) {
            setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
          }
        }
      } else {
        chunks.push(new Uint8Array(await response.arrayBuffer()));
      }

      setDownloadProgress(100);
      const blobParts = chunks.map((chunk) => {
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        return copy.buffer;
      });
      const blobUrl = URL.createObjectURL(new Blob(blobParts, { type: format.mimeType }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError: unknown) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download this format.");
    } finally {
      setLoadingFormat(null);
      setDownloadProgress(0);
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
        <div className="relative z-10 max-h-[min(72vh,32rem)] space-y-2.5 overflow-y-auto pr-1">
          {loadingFormats && <p className="py-4 text-center text-sm text-slate-400">Checking available formats...</p>}
          {error && <p className="py-2 text-sm text-red-400" role="alert">{error}</p>}
          {!loadingFormats && !error && (['audio', 'video'] as const).map((section) => {
            const sectionFormats = formats.filter((format) => section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video'));
            if (!sectionFormats.length) return null;
            return (
              <div key={section} className="space-y-2.5">
                <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-wider text-rose-300">{section} formats</h4>
                {sectionFormats.map((format) => (
                  <div key={getFormatKey(format)} className="rounded-xl border border-slate-700/50 bg-slate-800/80 p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs text-white">{format.label}</div>
                        <div className="text-[10px] text-slate-400">{format.extension === "mp3" ? "converts to MP3" : format.kind.replace('+', ' + ')}{format.size ? ` • ${(format.size / 1024 / 1024).toFixed(1)} MB` : ""}</div>
                      </div>
                      <button onClick={() => void handleDownload(format)} disabled={loadingFormat !== null} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50">
                        {loadingFormat === getFormatKey(format) ? "Preparing..." : "Download"}
                      </button>
                    </div>
                    {loadingFormat === getFormatKey(format) && (
                      <div className="mt-2" role="status" aria-label={downloadProgress ? `Download ${downloadProgress}% complete` : "Download in progress"}>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                          <div className={`h-full rounded-full bg-rose-500 transition-[width] duration-200 ${downloadProgress ? "" : "w-1/3 animate-pulse"}`} style={downloadProgress ? { width: `${downloadProgress}%` } : undefined} />
                        </div>
                        <p className="mt-1 text-right text-[10px] text-slate-500">{downloadProgress ? `${downloadProgress}%` : "Preparing download..."}</p>
                      </div>
                    )}
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