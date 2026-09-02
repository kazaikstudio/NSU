'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, Inbox, Sparkles } from 'lucide-react';
import DownloadRow, { DownloadEntry } from '../../../components/DownloadRow';

interface DownloadNotice {
  status: 'downloading' | 'done' | 'error';
  title: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
}

export default function DownloadsPage() {
  const [downloadEntries, setDownloadEntries] = useState<DownloadEntry[]>([]);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreEntries = () => {
      try {
        const storedEntries = window.localStorage.getItem('nsu-download-history');
        if (storedEntries) {
          const parsedEntries = JSON.parse(storedEntries) as DownloadEntry[];
          if (Array.isArray(parsedEntries)) {
            setDownloadEntries(parsedEntries);
          }
        }
      } catch {
        // Ignore malformed storage values.
      }
    };

    restoreEntries();

    const handleDownloadStatus = (event: Event) => {
      const detail = (event as CustomEvent<DownloadNotice>).detail;
      if (!detail) return;

      setDownloadNotice(detail);
      setDownloadEntries((previousEntries) => {
        const nextEntries = previousEntries.filter((entry) => entry.title !== detail.title);
        const now = new Date().toISOString();
        const updatedEntry: DownloadEntry = {
          id: previousEntries.find((entry) => entry.title === detail.title)?.id ?? `${detail.title}-${now}`,
          title: detail.title,
          status: detail.status,
          progress: detail.progress,
          downloadedBytes: detail.downloadedBytes ?? previousEntries.find((entry) => entry.title === detail.title)?.downloadedBytes,
          totalBytes: detail.totalBytes ?? previousEntries.find((entry) => entry.title === detail.title)?.totalBytes,
          paused: detail.status === 'downloading' ? (previousEntries.find((entry) => entry.title === detail.title)?.paused ?? false) : false,
          createdAt: previousEntries.find((entry) => entry.title === detail.title)?.createdAt ?? now,
          updatedAt: now,
        };

        const mergedEntries = [updatedEntry, ...nextEntries].slice(0, 12);
        window.localStorage.setItem('nsu-download-history', JSON.stringify(mergedEntries));
        return mergedEntries;
      });
    };

    window.addEventListener('nsu-download-status', handleDownloadStatus as EventListener);
    return () => {
      window.removeEventListener('nsu-download-status', handleDownloadStatus as EventListener);
    };
  }, []);

  const activeDownloads = downloadEntries.filter((entry) => entry.status === 'downloading');
  const previousDownloads = downloadEntries.filter((entry) => entry.status !== 'downloading');
  const downloadedBytes = downloadEntries.reduce((sum, entry) => sum + (entry.downloadedBytes ?? 0), 0);
  const totalBytes = downloadEntries.reduce((sum, entry) => sum + (entry.totalBytes ?? 0), 0);

  const handleTogglePause = (entry: DownloadEntry) => {
    const nextPaused = !entry.paused;
    const now = new Date().toISOString();
    const updatedEntry: DownloadEntry = {
      ...entry,
      paused: nextPaused,
      updatedAt: now,
    };

    setDownloadEntries((previousEntries) => {
      const nextEntries = previousEntries.map((item) => (item.id === entry.id ? updatedEntry : item));
      window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
      return nextEntries;
    });

    window.dispatchEvent(new CustomEvent('nsu-download-control', {
      detail: { title: entry.title, action: nextPaused ? 'pause' : 'resume' },
    }));
  };

  const handleClearHistory = () => {
    setDownloadEntries([]);
    setDownloadNotice(null);
    window.localStorage.removeItem('nsu-download-history');
  };

  return (
    <main className="min-h-screen px-1 mt-2 text-slate-100 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">

        {/* Main Glass Section */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-2xl shadow-black/50 sm:p-8">

          {/* Subtle Background Glow Accent */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-400 shadow-inner sm:h-13 sm:w-13">
                <Download size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  <Sparkles size={12} />
                  <span>Downloads</span>
                </div>
                <span className="truncate text-xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Download History
                </span>
              </div>
            </div>

            {downloadEntries.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-200"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear history</span>
              </button>
            )}
          </div>

          {downloadEntries.length > 0 && (
            <div className="relative mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/35 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transferred</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-amber-300">
                  {formatBytes(downloadedBytes)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/35 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total size</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                  {totalBytes ? formatBytes(totalBytes) : 'Calculating'}
                </p>
              </div>
            </div>
          )}

          {/* Download Notice Banner */}
          {downloadNotice && (
            <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 backdrop-blur-md sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              <span>
                {downloadNotice.status === 'downloading'
                  ? `Downloading ${downloadNotice.title}`
                  : downloadNotice.status === 'done'
                  ? `Downloaded ${downloadNotice.title}`
                  : 'Download failed'}
              </span>
            </div>
          )}

          {/* Empty State */}
          {downloadEntries.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/50 text-slate-500">
                <Inbox size={24} />
              </div>
              <p className="text-sm font-medium text-slate-400">No downloads yet</p>
              <p className="mt-1 text-xs text-slate-500">Your downloaded files will appear here.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-6">

              {/* Active Downloads Section */}
              {activeDownloads.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Active Downloads
                    </h2>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      {activeDownloads.length} active
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                    </div>

                    <div className="space-y-3">
                      {activeDownloads.map((entry, index) => (
                        <DownloadRow
                          key={entry.id}
                          entry={entry}
                          index={index}
                          onTogglePause={handleTogglePause}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Downloads Section */}
              {previousDownloads.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recent Activity
                  </h2>
                  <div className="space-y-2">
                    {previousDownloads.map((entry) => (
                      <DownloadRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
