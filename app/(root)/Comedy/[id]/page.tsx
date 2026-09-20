"use client";

import React, { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import ComedyDirectoryList, { type ComedyDirectoryItem } from '@/components/ComedyDirectoryList';
import ModernVideoPlayer from '@/components/ModernVideoPlayer';
import { ArrowLeft, Share2, Download, Check } from "lucide-react";
import { registerClientDownload } from '@/lib/download-controls';

type PlaylistItem = ComedyDirectoryItem;

type StorageItem = {
  id: string | number;
  title?: string;
  name?: string;
  artist?: string;
  comedian?: string;
  duration?: string;
  views?: string;
  thumbnail?: string;
  file_url?: string;
  url?: string;
};

export default function ComedyVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;


  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activeItem, setActiveItem] = useState<PlaylistItem | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);


  const [copied, setCopied] = useState(false);
  const [isMobileView, setIsMobileView] = useState<boolean | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobileView(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const aspect = videoAspect || 16 / 9;
  const playerColSpan = aspect >= 1.6 ? 9 : aspect >= 1.3 ? 8 : aspect >= 1 ? 7 : 5;
  const listColSpan = 12 - playerColSpan;
  const playerColumnClass = { 9: 'lg:col-span-9', 8: 'lg:col-span-8', 7: 'lg:col-span-7', 5: 'lg:col-span-5' }[playerColSpan];
  const listColumnClass = { 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 7: 'lg:col-span-7' }[listColSpan];

  const handleVideoRatio = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) setVideoAspect(width / height);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('nsu-nav-visibility', { detail: { hidden: chromeHidden } }));
  }, [chromeHidden]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('nsu-nav-visibility', { detail: { hidden: false } }));
    };
  }, []);

  useEffect(() => {
    const fetchDirectoryFiles = async () => {
      try {
        setLoading(true);
        const storageResponse = await fetch("/api/dashboard/storage?source=talk-show");
        const storageData = (await storageResponse.json().catch(() => ({ items: [] }))) as { items?: StorageItem[] };
        const allItems = Array.isArray(storageData.items) ? storageData.items : [];

        let current = allItems.find((item) => String(item.id) === String(id));

        if (!current && allItems.length > 0) {
          current = allItems[0];
        }

        if (current) {
          const mainUrl = current.file_url || current.url || "";
          setVideoSrc(mainUrl);
          setVideoTitle(current.title || current.name || "Untitled Track");

          const basePath = mainUrl.substring(0, mainUrl.lastIndexOf("/") + 1);

          const pathFiles: PlaylistItem[] = allItems
            .map((item) => {
              const itemUrl = item.file_url || item.url || "";
              return {
                id: String(item.id),
                title: item.title || item.name || itemUrl.split("/").pop() || "Audio File",
                comedian: item.artist || item.comedian || "Media Track",
                duration: item.duration || "--:--",
                views: item.views || "Audio Stream",
                fileUrl: itemUrl,
                thumbnail: item.thumbnail,
              };
            })
            .filter((item) => item.fileUrl.startsWith(basePath));

          const matchedActive = pathFiles.find((f) => f.id === String(id)) || pathFiles[0];

          setPlaylist(pathFiles);
          setActiveItem(matchedActive);
        }
      } catch (err) {
        console.error("Failed to retrieve directory files:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDirectoryFiles();
  }, [id]);


  const selectVideo = (item: PlaylistItem) => {
    if (item.fileUrl) {
      setActiveItem(item);
      setVideoSrc(item.fileUrl);
      setVideoTitle(item.title);
    }
  };

  const handleVideoEnded = () => {
    if (!activeItem || playlist.length === 0) return;
    const currentIndex = playlist.findIndex((item) => item.id === activeItem.id);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      selectVideo(playlist[currentIndex + 1]);
    }
  };

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !activeItem || playlist.length === 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("input, button, a")) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const MIN_DISTANCE = 60;
    if (Math.abs(deltaX) < MIN_DISTANCE || Math.abs(deltaY) > Math.abs(deltaX) * 1.5) return;

    const currentIndex = playlist.findIndex((item) => item.id === activeItem.id);
    if (currentIndex === -1) return;

    if (deltaX < 0) {
      if (currentIndex < playlist.length - 1) selectVideo(playlist[currentIndex + 1]);
    } else {
      if (currentIndex > 0) selectVideo(playlist[currentIndex - 1]);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: videoTitle,
          url: window.location.href
        });
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareItem = async (item: PlaylistItem) => {
    const shareUrl = `${window.location.origin}/Comedy/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          url: shareUrl,
        });
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadItem = async (item: PlaylistItem) => {
    const safeTitle = (item.title || 'download').trim() || 'download';
    const targetUrl = item.fileUrl || '';
    const fallbackFileName = targetUrl.split('/').pop()?.split('?')[0]?.trim() || `${safeTitle}.mp4`;

    const getDownloadUrl = (fileUrl: string) => {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = match ? (match[1] || match[2]) : null;
      if (!fileId) return fileUrl;

      return `/api/dashboard/media/${fileId}?download=1`;
    };

    const downloadUrl = getDownloadUrl(targetUrl);

    const dispatchStatus = (status: 'downloading' | 'done' | 'error', progress?: number, downloadedBytes?: number, totalBytes?: number) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status, title: safeTitle, progress, downloadedBytes, totalBytes },
      }));
    };

    if (!downloadUrl) {
      dispatchStatus('error', 0);
      return;
    }

    dispatchStatus('downloading', 0, 0);

    const controller = new AbortController();
    const downloadControl = registerClientDownload(safeTitle, () => controller.abort());

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Download body is unavailable.');
      }

      const chunks: Uint8Array[] = [];
      let loaded = 0;
      let lastProgress = 0;

      while (true) {
        await downloadControl.waitUntilResumed();
        if (downloadControl.isCancelled()) return;

        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          const nextProgress = Math.min(100, Math.round((loaded / total) * 100));
          if (nextProgress !== lastProgress) {
            lastProgress = nextProgress;
            dispatchStatus('downloading', nextProgress, loaded, total);
          }
        }
      }

      const blob = new Blob(chunks.map((chunk) => {
        const array = new Uint8Array(chunk.length);
        array.set(chunk);
        return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
      }), { type: response.headers.get('content-type') || 'video/mp4' });

      const anchor = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = fallbackFileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      dispatchStatus('done', 100, loaded, total || loaded);
    } catch (error) {
      if (downloadControl.isCancelled() || (error instanceof Error && error.name === 'AbortError')) return;
      console.error('Download failed:', error);
      dispatchStatus('error', 0);
    } finally {
      downloadControl.unregister();
    }
  };

  const handleDownload = () => {
    if (!activeItem) {
      return;
    }

    handleDownloadItem(activeItem);
  };

  const handlePlayerSurface = () => {
    if (isMobileView !== true) return;
    setChromeHidden((previous) => !previous);
  };


  return (
    <main className="mt-1 flex min-h-screen flex-col text-Eltext p-0 font-sans sm:p-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-0 lg:grid-cols-12">

      {/* Sticky Video Section on desktop screens only */}
      <section className={`flex h-[100dvh] w-full flex-col gap-1.5 sm:h-auto sm:top-20 lg:sticky lg:top-16 ${playerColumnClass} lg:h-fit lg:pb-2`}>
          <div className="relative min-h-0 flex-1 sm:h-auto sm:flex-none lg:flex-initial">
            <ModernVideoPlayer
              src={videoSrc}
              loading={loading}
              immersive={isMobileView === true}
              onEndedAction={handleVideoEnded}
              onSurfaceAction={handlePlayerSurface}
              onRatioAction={handleVideoRatio}
            />

            {isMobileView === true ? (
              <div
                className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3"
                style={{
                  opacity: chromeHidden ? 0 : 1,
                  pointerEvents: chromeHidden ? 'none' : 'auto',
                  transition: 'opacity 220ms ease',
                }}
              >
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card1/20 bg-backnav/80 text-primary backdrop-blur-md transition active:scale-95"
                >
                  {copied ? <Check size={18} className="text-navlink" /> : <Share2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  aria-label="Download"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navlink text-backnav backdrop-blur-md transition active:scale-95"
                >
                  <Download size={18} />
                </button>
              </div>
            ) : null}

          <Link
            href="/"
            aria-label="Back"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card1/20 bg-backnav/80 text-primary backdrop-blur-md transition hover:bg-cardcl active:scale-95 sm:flex sm:absolute sm:left-3 sm:top-3 sm:z-40"
          >
            <ArrowLeft size={16} className="w-4 h-4" />
          </Link>
          </div>
      </section>

      <ComedyDirectoryList
        items={playlist}
        activeItemId={activeItem?.id ?? null}
        loading={loading}
        className={listColumnClass}
        onSelectAction={selectVideo}
        onShareAction={handleShareItem}
      />

      </div>
    </main>
  );
}
