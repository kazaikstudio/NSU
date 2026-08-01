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
    <main className="min-h-screen px-3 pb-20 pt-16 text-primary sm:px-6 sm:pb-24 sm:pt-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-6">
        {/* Top Bar Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-full border border-card1/20 bg-cardcl/80 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-semibold text-primary transition hover:border-amber-400/40 hover:text-amber-300"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-amber-300 transition hover:text-amber-200"
          >
            Go home
          </Link>
        </div>

        {/* Main Section */}
        <section className="rounded-2xl sm:rounded-3xl border border-card1/20 bg-slate-600 p-4 sm:p-8 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Download size={20} className="sm:hidden" />
              <Download size={22} className="hidden sm:block" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-amber-300">
                Downloads
              </p>
              <h1 className="truncate text-xl font-bold text-primary sm:text-3xl">
                Your download history
              </h1>
            </div>
          </div>

          {/* Download Notice Banner */}
          {downloadNotice ? (
            <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-amber-200">
              {downloadNotice.status === 'downloading'
                ? `Downloading ${downloadNotice.title}`
                : downloadNotice.status === 'done'
                  ? `Downloaded ${downloadNotice.title}`
                  : 'Download failed'}
            </div>
          ) : null}

          {/* Download Entries List */}
          {downloadEntries.length === 0 ? (
            <div className="mt-6 sm:mt-8 rounded-xl sm:rounded-2xl border border-dashed border-card1/20 px-4 py-6 sm:px-5 sm:py-8 text-center text-xs sm:text-sm text-secondry">
              No downloads have been started yet.
            </div>
          ) : (
            <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-rose-200 transition hover:bg-rose-400/20"
                >
                  Clear history
                </button>
              </div>

              {/* Active Downloads Section */}
              {activeDownloads.length > 0 ? (
                <div>
                  <div className="mb-2.5 sm:mb-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-amber-300">
                      Active downloads
                    </p>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                      {activeDownloads.length} / {downloadEntries.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeDownloads.map((entry, index) => {
                      const progressValue = typeof entry.progress === 'number' ? Math.max(0, Math.min(100, entry.progress)) : undefined;

                      return (
                        <div key={entry.id} className="rounded-xl sm:rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 sm:px-4 sm:py-3">
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Download size={14} className="shrink-0 text-amber-300" />
                                <p className="truncate text-xs sm:text-sm font-semibold text-white">{entry.title}</p>
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-medium text-amber-100">
                                <span>#{index + 1}</span>
                                <span>
                                  {typeof progressValue === 'number' ? `${Math.round(progressValue)}%` : 'Preparing...'}
                                </span>
                              </div>

                              <div className="mt-1.5 space-y-1">
                                <div className="h-1.5 overflow-hidden rounded-full bg-amber-400/20">
                                  <div
                                    className="h-full rounded-full bg-amber-300 transition-[width] duration-200"
                                    style={{ width: `${progressValue ?? 8}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePause(entry)}
                              className="shrink-0 rounded-full border border-amber-300/30 bg-cardcl/70 px-2 py-1 sm:px-2.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-amber-200 transition hover:bg-cardcl"
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

              {/* Recent Downloads Section */}
              {previousDownloads.length > 0 ? (
                <div>
                  <p className="mb-2.5 sm:mb-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-secondry">
                    Recent
                  </p>
                  <div className="space-y-2">
                    {previousDownloads.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-card1/20 bg-cardcl/70 px-3.5 py-2.5 sm:px-4 sm:py-3">
                        {entry.status === 'done' ? (
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                        ) : (
                          <AlertCircle size={16} className="shrink-0 text-rose-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-semibold text-primary">{entry.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-xs text-secondry">
                            <Clock3 size={11} />
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
