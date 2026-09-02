"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getDownloadPath, inferDownloadCategoryFromFilename } from '@/lib/download';
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
  downloadedBytes?: number;
  totalBytes?: number;
  paused?: boolean;
  action?: "pause" | "resume";
  sourceVideoId?: string;
  sourceItag?: number;
  sourceExtension?: string;
  sourceOutputBitrate?: number;
};

type DownloadControlDetail = {
  title: string;
  action: "pause" | "resume";
};

type DownloadRetryDetail = {
  title: string;
  videoId: string;
  itag: number;
  extension: string;
  outputBitrate?: number;
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
  const [, setDownloadProgress] = useState(0);

  const downloadProgressRef = useRef(0);
  const downloadOffsetRef = useRef(0);
  const setDownloadProgressValue = (value: number) => {
    downloadProgressRef.current = value;
    setDownloadProgress(value);
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const activeFormatRef = useRef<DownloadFormat | null>(null);
  const activeTitleRef = useRef<string | null>(null);
  const downloadChunksRef = useRef<Uint8Array[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = (callback: () => void) => {
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
    activeFormatRef.current = null;
    activeTitleRef.current = null;
    downloadChunksRef.current = [];
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
      downloadChunksRef.current = [];
      emitDownloadHistory({ status: "downloading", title: historyTitle, progress: 0, downloadedBytes: 0, totalBytes: format.size ?? undefined, paused: false, sourceVideoId: videoId || undefined, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate });
    } else {
      safeSetState(() => setLoadingFormat(formatKey));
      emitDownloadHistory({ status: "downloading", title: historyTitle, progress: downloadProgressRef.current, downloadedBytes: undefined, totalBytes: format.size ?? undefined, paused: false, sourceVideoId: videoId || undefined, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate });
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      const downloadUrl = `/api/youtube/download?id=${encodeURIComponent(videoId || "")}&itag=${format.itag}&output=${format.extension}&bitrate=${format.outputBitrate || ""}`;
      const filename = `${title || videoId}.${format.extension || "mp4"}`;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const response = await fetch(downloadUrl, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const totalBytes = Number(response.headers.get("content-length")) || format.size || 0;
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Download body is unavailable.");
      }

      const chunks = downloadChunksRef.current;
      let downloadedBytes = 0;
      let lastProgress = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        downloadedBytes += value.length;

        if (totalBytes > 0) {
          const progress = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
          if (progress !== lastProgress) {
            lastProgress = progress;
            safeSetState(() => setDownloadProgressValue(progress));
            emitDownloadHistory({
              status: "downloading",
              title: historyTitle,
              progress,
              downloadedBytes,
              totalBytes,
              paused: false,
              sourceVideoId: videoId || undefined,
              sourceItag: format.itag,
              sourceExtension: format.extension,
              sourceOutputBitrate: format.outputBitrate,
            });
          }
        }
      }

      const binaryData = chunks.map((chunk) => {
        const array = new Uint8Array(chunk.length);
        array.set(chunk);
        return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
      });
      const blob = new Blob(binaryData, { type: response.headers.get("content-type") || format.mimeType || "application/octet-stream" });
      const anchor = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = getDownloadPath(filename, inferDownloadCategoryFromFilename(filename));
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      safeSetState(() => setDownloadProgressValue(100));
      downloadChunksRef.current = [];
      activeFormatRef.current = null;
      activeTitleRef.current = null;
      emitDownloadHistory({
        status: "done",
        title: historyTitle,
        progress: 100,
        downloadedBytes,
        totalBytes: totalBytes || downloadedBytes,
        paused: false,
        sourceVideoId: videoId || undefined,
        sourceItag: format.itag,
        sourceExtension: format.extension,
        sourceOutputBitrate: format.outputBitrate,
      });
    } catch (downloadError: unknown) {
      if (downloadError instanceof Error && downloadError.name === "AbortError" && isPausedRef.current) {
        return;
      }
      downloadChunksRef.current = [];
      activeFormatRef.current = null;
      activeTitleRef.current = null;
      emitDownloadHistory({ status: "error", title: historyTitle, progress: downloadProgressRef.current, paused: false, sourceVideoId: videoId || undefined, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate });
      safeSetState(() => setError(downloadError instanceof Error ? downloadError.message : "Unable to download this format."));
    } finally {
      if (!isPausedRef.current) {
        safeSetState(() => setLoadingFormat(null));
        safeSetState(() => setDownloadProgressValue(0));
      }
      abortControllerRef.current = null;
    }
  }, [emitDownloadHistory, title, videoId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDownloadControl = (event: Event) => {
      const detail = (event as CustomEvent<DownloadControlDetail>).detail;
      const activeTitle = activeTitleRef.current;
      const activeFormat = activeFormatRef.current;
      if (!detail || !activeTitle || !activeFormat || detail.title !== activeTitle) return;

      if (detail.action === 'pause') {
        isPausedRef.current = true;
        abortControllerRef.current?.abort();
        emitDownloadHistory({
          status: 'downloading',
          title: activeTitle,
          progress: downloadProgressRef.current,
          paused: true,
        });
        return;
      }

      if (detail.action === 'resume') {
        isPausedRef.current = false;
        void handleDownload(activeFormat, { skipReset: true });
      }
    };

    const handleDownloadRetry = (event: Event) => {
      const detail = (event as CustomEvent<DownloadRetryDetail>).detail;
      if (!detail || detail.videoId !== videoId) return;

      setTitle(detail.title);
      void handleDownload({
        itag: detail.itag,
        label: detail.title,
        kind: 'video',
        mimeType: detail.extension === 'mp3' ? 'audio/mpeg' : 'video/mp4',
        extension: detail.extension,
        outputBitrate: detail.outputBitrate,
        codec: '',
        size: null,
        bitrate: 0,
      });
    };

    window.addEventListener('nsu-download-control', handleDownloadControl as EventListener);
    window.addEventListener('nsu-download-retry', handleDownloadRetry as EventListener);
    return () => {
      window.removeEventListener('nsu-download-control', handleDownloadControl as EventListener);
      window.removeEventListener('nsu-download-retry', handleDownloadRetry as EventListener);
    };
  }, [emitDownloadHistory, handleDownload, videoId]);

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