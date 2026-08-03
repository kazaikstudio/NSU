"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";import { getDownloadPath, inferDownloadCategoryFromFilename } from '@/lib/download'
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
  open?: boolean;
  videoId?: string | null;
  position?: { x: number; y: number } | null;
  anchor?: HTMLElement | null;
  onClose?: () => void;
};

type DownloadHistoryPayload = {
  status: "downloading" | "done" | "error";
  title: string;
  progress?: number;
  paused?: boolean;
  action?: "pause" | "resume";
};

const DownloadModal = ({ open = false, videoId, position, anchor, onClose }: DownloadModalProps) => {
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
  const [downloadProgress, setDownloadProgress] = useState(0);

  const downloadProgressRef = useRef(0);
  const downloadOffsetRef = useRef(0);
  const setDownloadProgressValue = (value: number) => {
    downloadProgressRef.current = value;
    setDownloadProgress(value);
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const activeFormatRef = useRef<DownloadFormat | null>(null);
  const activeTitleRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = <T extends unknown>(callback: () => T) => {
    if (isMountedRef.current) callback();
  };

  useLayoutEffect(() => {
    if (!open || !videoId) return;

    const updatePosition = () => {
      const modalWidth = modalRef.current?.offsetWidth || 360;
      const modalHeight = Math.min(modalRef.current?.offsetHeight || 320, window.innerHeight * 0.72);
      const rect = anchor?.getBoundingClientRect();
      const sourceX = rect ? rect.left + rect.width / 2 : position?.x ?? window.innerWidth / 2;
      const sourceY = rect ? rect.bottom + 8 : position?.y ?? window.innerHeight / 2;
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
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, videoId, anchor, position]);

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

    return () => {
      cancelled = true;
    };
  }, [open, videoId]);

  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setTitle("");
    setFormats([]);
    setError("");
    setLoadingFormats(false);
    setLoadingFormat(null);
    isPausedRef.current = false;
    downloadProgressRef.current = 0;
    setDownloadProgress(0);
    downloadOffsetRef.current = 0;
    onClose?.();
  }, [onClose]);

  const getFormatKey = (format: DownloadFormat) => `${format.itag}-${format.extension}-${format.outputBitrate || "source"}`;

  const emitDownloadHistory = useCallback((payload: DownloadHistoryPayload) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<DownloadHistoryPayload>("nsu-download-status", { detail: payload }));
  }, []);

  const handleDownload = useCallback(async (format: DownloadFormat, options?: { skipReset?: boolean }) => {
    const formatKey = getFormatKey(format);
    const historyTitle = title || videoId || format.label;
    activeFormatRef.current = format;
    activeTitleRef.current = historyTitle;

    if (!options?.skipReset) {
      safeSetState(() => setLoadingFormat(formatKey));
      downloadOffsetRef.current = 0;
      safeSetState(() => setDownloadProgressValue(0));
      isPausedRef.current = false;
      emitDownloadHistory({ status: "downloading", title: historyTitle, progress: 0, paused: false });
    } else {
      safeSetState(() => setLoadingFormat(formatKey));
      emitDownloadHistory({ status: "downloading", title: historyTitle, progress: downloadProgressRef.current, paused: false });
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      const downloadUrl = `/api/youtube/download?id=${encodeURIComponent(videoId || "")}&itag=${format.itag}&output=${format.extension}&bitrate=${format.outputBitrate || ""}`;
      const filename = `${title || videoId}.${format.extension || "mp4"}`;
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = getDownloadPath(filename, inferDownloadCategoryFromFilename(filename));
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      emitDownloadHistory({ status: "downloading", title: historyTitle, progress: 0, paused: false });
    } catch (downloadError: unknown) {
      if (downloadError instanceof Error && downloadError.name === "AbortError") {
        return;
      }
      emitDownloadHistory({ status: "error", title: historyTitle, progress: downloadProgressRef.current, paused: false });
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download this format.");
    } finally {
      if (!isPausedRef.current) {
        setLoadingFormat(null);
        setDownloadProgressValue(0);
      }
      abortControllerRef.current = null;
    }
  }, [downloadProgress, emitDownloadHistory, title, videoId]);



  if (!open || !videoId) return null;

  return (
    <>
      <div className="fixed inset-0 z-9998 bg-black/10 backdrop-blur-[1px]" onClick={handleClose} />
      <div
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
        className="fixed z-9999 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-900 p-5 shadow-2xl"
      >
        <div
          className={`absolute left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-slate-900 ${coords.placeAbove ? "-bottom-2 border-b border-r" : "-top-2 border-l border-t"} border-slate-700/80`}
        />

        <div className="relative z-10 mb-4 flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-rose-500">🎬</span>
            <h3 className="text-sm font-bold text-white">Download Options</h3>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            <X size={14} />
            Close
          </button>
        </div>

        <p className="mb-3 truncate text-xs text-slate-400">{title || "Loading download formats..."}</p>
        <div className="relative z-10 max-h-[min(72vh,32rem)] space-y-3 overflow-y-auto pr-1">
          {loadingFormats && <p className="py-4 text-center text-sm text-slate-400">Checking available formats...</p>}
          {error && <p className="py-2 text-sm text-red-400" role="alert">{error}</p>}
          {!loadingFormats && !error && (["audio", "video"] as const).map((section) => {
            const sectionFormats = formats.filter((format) => section === "audio" ? !format.kind.includes("video") : format.kind.includes("video"));
            if (!sectionFormats.length) return null;

            return (
              <div key={section} className="space-y-2.5">
                <h4 className="border-b border-slate-700 pb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-rose-300">
                  {section} formats
                </h4>
                {sectionFormats.map((format) => (
                  <div key={getFormatKey(format)} className="rounded-xl border border-slate-700/50 bg-slate-800/80 p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{format.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {format.extension === "mp3" ? "converts to MP3" : format.kind.replace("+", " + ")}
                          {format.size ? ` • ${(format.size / 1024 / 1024).toFixed(1)} MB` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          void handleDownload(format);
                          handleClose();
                        }}
                        disabled={loadingFormat !== null}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingFormat === getFormatKey(format) ? "Preparing..." : "Download"}
                      </button>
                    </div>
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