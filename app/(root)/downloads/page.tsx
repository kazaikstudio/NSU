'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DownloadNotice {
  status: 'downloading' | 'done' | 'error';
  title: string;
  progress?: number;
}

interface DownloadEntry {
  id: string;
  title: string;
  status: 'downloading' | 'done' | 'error';
  progress?: number;
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DownloadsPage() {
  const [downloadEntries, setDownloadEntries] = useState<DownloadEntry[]>([]);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);
  const router = useRouter();

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
    <main className="min-h-screen bg-cardcl px-4 pb-24 pt-24 text-primary sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-card1/20 bg-cardcl/80 px-4 py-2 text-sm font-semibold text-primary transition hover:border-amber-400/40 hover:text-amber-300"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <Link
            href="/"
            className="text-sm font-semibold text-amber-300 transition hover:text-amber-200"
          >
            Go home
          </Link>
        </div>

        <section className="rounded-3xl border border-card1/20 bg-linear-to-br from-cardcl via-cardcl to-rose-950/30 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Download size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Downloads</p>
              <h1 className="text-2xl font-bold text-primary sm:text-3xl">Your download history</h1>
            </div>
          </div>

          {downloadNotice ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {downloadNotice.status === 'downloading'
                ? `Downloading ${downloadNotice.title}`
                : downloadNotice.status === 'done'
                  ? `Downloaded ${downloadNotice.title}`
                  : 'Download failed'}
            </div>
          ) : null}

          {downloadEntries.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-card1/20 px-5 py-8 text-center text-sm text-secondry">
              No downloads have been started yet.
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:bg-rose-400/20"
                >
                  Clear history
                </button>
              </div>
              {activeDownloads.length > 0 ? (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Active downloads</p>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                      {activeDownloads.length} / {downloadEntries.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeDownloads.map((entry, index) => {
                      const progressValue = typeof entry.progress === 'number' ? Math.max(0, Math.min(100, entry.progress)) : undefined;

                      return (
                        <div key={entry.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Download size={14} className="text-amber-300" />
                                <p className="truncate text-sm font-semibold text-white">{entry.title}</p>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-medium text-amber-100">
                                <span>#{index + 1}</span>
                                <span>{Math.round(progressValue ?? 0)}%</span>
                              </div>
                              <div className="mt-2 space-y-1">
                                <div className="h-1.5 overflow-hidden rounded-full bg-amber-400/20">
                                  <div
                                    className="h-full rounded-full bg-amber-300 transition-[width] duration-200"
                                    style={{ width: `${progressValue ?? 8}%` }}
                                  />
                                </div>
                                <p className="text-right text-[10px] font-medium text-amber-100">
                                  {typeof progressValue === 'number' ? `${Math.round(progressValue)}%` : 'Preparing...'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTogglePause(entry)}
                              className="rounded-full border border-amber-300/30 bg-cardcl/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:bg-cardcl"
                            >
                              {entry.paused ? 'Resume' : 'Pause'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {previousDownloads.length > 0 ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-secondry">Recent</p>
                  <div className="space-y-2">
                    {previousDownloads.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-card1/20 bg-cardcl/70 px-4 py-3">
                        {entry.status === 'done' ? (
                          <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" />
                        ) : (
                          <AlertCircle size={16} className="mt-0.5 text-rose-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-primary">{entry.title}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-secondry">
                            <Clock3 size={12} />
                            {entry.status === 'done' ? 'Saved' : 'Failed'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
