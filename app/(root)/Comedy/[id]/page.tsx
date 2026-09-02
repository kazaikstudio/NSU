"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import ComedyDirectoryList, { type ComedyDirectoryItem } from '@/components/ComedyDirectoryList';
import ModernVideoPlayer from '@/components/ModernVideoPlayer';
import { ArrowLeft, Share2, Download, Info, Check } from "lucide-react";

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

  const handleDownloadItem = async (item: PlaylistItem) => {
    const safeTitle = (item.title || 'download').trim() || 'download';
    const targetUrl = item.fileUrl || '';

    const getDownloadUrl = (fileUrl: string) => {
      const match = fileUrl.match(/[?&]id=([^&]+)/);
      if (!match?.[1]) return fileUrl;

      return `/api/dashboard/media/${match[1]}?download=1&filename=${encodeURIComponent(`${safeTitle}.mp4`)}`;
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

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store' });
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
      anchor.download = `${safeTitle}.mp4`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      dispatchStatus('done', 100, loaded, total || loaded);
    } catch (error) {
      console.error('Download failed:', error);
      dispatchStatus('error', 0);
    }
  };

  const handleDownload = () => {
    if (!activeItem) {
      return;
    }

    handleDownloadItem(activeItem);
  };


  return (
    <main className="mt-1 flex min-h-screen flex-col text-Eltext p-1 font-sans sm:p-6">
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-2 lg:grid-cols-4">

      {/* Sticky Video Section on desktop screens only */}
      <section className="sticky top-16 z-20 flex h-fit flex-col gap-1.5 pb-2 sm:top-20 lg:col-span-3">
          <ModernVideoPlayer
            src={videoSrc}
            loading={loading}
            onEndedAction={handleVideoEnded}
          />

          <section className="w-full max-w-79xl mx-auto flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-card1/20 bg-cardcl/80 px-4 py-3 text-xs font-semibold text-secondary backdrop-blur-md transition hover:bg-cardcl hover:text-primary active:scale-95 sm:w-auto sm:gap-3 sm:rounded-full sm:px-10 sm:py-2.5"
            >
              <ArrowLeft size={14} className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </section>

          <div className="flex flex-col justify-between gap-2 rounded-2xl border border-card1/20 bg-cardcl/70 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:rounded-3xl sm:p-5">
            <div className="space-y-1 min-w-0">
              <span className="flex items-center gap-2 truncate text-base font-bold text-primary sm:text-lg">
                <Info size={18} className="shrink-0 text-navlink" />
                <span className="truncate">{videoTitle}</span>
              </span>
              <p className="max-w-xl text-[11px] leading-relaxed text-secondry sm:text-xs">
                Powered by <span className="font-semibold text-navlink">Noll Music Ug</span> — your home for premium local beats and high-energy shows.
              </p>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-card1/20 bg-backnav px-4 py-2.5 text-xs font-semibold text-secondary transition active:scale-95 hover:bg-cardcl sm:flex-none sm:rounded-2xl"
              >
                {copied ? <Check size={14} className="text-navlink" /> : <Share2 size={14} />}
                <span>{copied ? "Copied Link" : "Share"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navlink px-4 py-2.5 text-xs font-semibold text-backnav transition active:scale-95 hover:opacity-90 sm:flex-none sm:rounded-2xl"
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            </div>
          </div>
      </section>

      <ComedyDirectoryList
        items={playlist}
        activeItemId={activeItem?.id ?? null}
        loading={loading}
        onSelectAction={selectVideo}
        onDownloadAction={handleDownloadItem}
      />

      </div>
    </main>
  );
}
