'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Trash2, Inbox, Sparkles } from 'lucide-react';
import DownloadRow, { DownloadEntry } from '../../../components/DownloadRow';
import { startYoutubeDownload } from '@/lib/youtube-download-manager';

interface DownloadNotice {
  status: 'downloading' | 'done' | 'error';
  title: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  paused?: boolean;
  sourceVideoId?: string;
  sourceItag?: number;
  sourceExtension?: string;
  sourceOutputBitrate?: number;
}

interface RetryDetail {
  title: string;
  videoId: string;
  itag: number;
  extension: string;
  outputBitrate?: number;
}

export default function DownloadsPage() {
  const [downloadEntries, setDownloadEntries] = useState<DownloadEntry[]>([]);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRetryRef = useRef<RetryDetail | null>(null);

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
          paused: detail.status === 'downloading' ? (detail.paused ?? previousEntries.find((entry) => entry.title === detail.title)?.paused ?? false) : false,
          sourceVideoId: detail.sourceVideoId ?? previousEntries.find((entry) => entry.title === detail.title)?.sourceVideoId,
          sourceItag: detail.sourceItag ?? previousEntries.find((entry) => entry.title === detail.title)?.sourceItag,
          sourceExtension: detail.sourceExtension ?? previousEntries.find((entry) => entry.title === detail.title)?.sourceExtension,
          sourceOutputBitrate: detail.sourceOutputBitrate ?? previousEntries.find((entry) => entry.title === detail.title)?.sourceOutputBitrate,
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
  const previewEntry = downloadEntries.find((entry) => entry.sourceVideoId);

  const runRetryDownload = async (detail: RetryDetail, options?: { keepProgress?: boolean }) => {
    activeRetryRef.current = detail;

    if (!options?.keepProgress) {
      setDownloadEntries((previousEntries) => {
        const nextEntries = previousEntries.map((item): DownloadEntry => item.title === detail.title
          ? {
              ...item,
              status: 'downloading',
              paused: false,
              progress: 0,
              downloadedBytes: 0,
              updatedAt: new Date().toISOString(),
            }
          : item);
        window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
        return nextEntries;
      });
      setDownloadNotice({
        status: 'downloading',
        title: detail.title,
        progress: 0,
        paused: false,
        sourceVideoId: detail.videoId,
        sourceItag: detail.itag,
        sourceExtension: detail.extension,
        sourceOutputBitrate: detail.outputBitrate,
      });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/youtube/download?id=${encodeURIComponent(detail.videoId)}&itag=${detail.itag}&output=${detail.extension}&bitrate=${detail.outputBitrate || ''}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || response.statusText || 'Unable to retry download.');
      }

      const totalBytes = Number(response.headers.get('content-length')) || undefined;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unable to start retry download.');

      const chunks: Uint8Array[] = [];
      let downloadedBytes = 0;
      let lastProgress = options?.keepProgress ? Math.round(downloadEntries.find((item) => item.title === detail.title)?.progress || 0) : 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        downloadedBytes += value.length;
        const progress = totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : lastProgress;

        if (!totalBytes || progress !== lastProgress) {
          lastProgress = progress;
          const notice: DownloadNotice = {
            status: 'downloading',
            title: detail.title,
            progress,
            downloadedBytes,
            totalBytes,
            paused: false,
            sourceVideoId: detail.videoId,
            sourceItag: detail.itag,
            sourceExtension: detail.extension,
            sourceOutputBitrate: detail.outputBitrate,
          };
          setDownloadNotice(notice);
          setDownloadEntries((previousEntries) => {
            const nextEntries = previousEntries.map((item): DownloadEntry => item.title === detail.title
              ? {
                  ...item,
                  status: 'downloading',
                  paused: false,
                  progress,
                  downloadedBytes,
                  totalBytes,
                  updatedAt: new Date().toISOString(),
                }
              : item);
            window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
            return nextEntries;
          });
        }
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: response.headers.get('content-type') || 'application/octet-stream',
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${detail.title}.${detail.extension}`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      const completedNotice: DownloadNotice = {
        status: 'done',
        title: detail.title,
        progress: 100,
        downloadedBytes: blob.size,
        totalBytes: blob.size,
        paused: false,
        sourceVideoId: detail.videoId,
        sourceItag: detail.itag,
        sourceExtension: detail.extension,
        sourceOutputBitrate: detail.outputBitrate,
      };
      setDownloadNotice(completedNotice);
      setDownloadEntries((previousEntries) => {
        const nextEntries = previousEntries.map((item): DownloadEntry => item.title === detail.title
          ? {
              ...item,
              status: 'done',
              paused: false,
              progress: 100,
              downloadedBytes: blob.size,
              totalBytes: blob.size,
              updatedAt: new Date().toISOString(),
            }
          : item);
        window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
        return nextEntries;
      });
      activeRetryRef.current = null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const failedNotice: DownloadNotice = {
        status: 'error',
        title: detail.title,
        paused: false,
        sourceVideoId: detail.videoId,
        sourceItag: detail.itag,
        sourceExtension: detail.extension,
        sourceOutputBitrate: detail.outputBitrate,
      };
      setDownloadNotice(failedNotice);
      setDownloadEntries((previousEntries) => {
        const nextEntries = previousEntries.map((item): DownloadEntry => item.title === detail.title
          ? {
              ...item,
              status: 'error',
              paused: false,
              updatedAt: new Date().toISOString(),
            }
          : item);
        window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
        return nextEntries;
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleTogglePause = (entry: DownloadEntry) => {
    const canResume = Boolean(entry.sourceVideoId && typeof entry.sourceItag === 'number' && entry.sourceExtension);
    if (!canResume && !entry.paused) {
      handleCancelDownload(entry);
      return;
    }

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

    if (nextPaused) {
      if (activeRetryRef.current?.title === entry.title) {
        abortControllerRef.current?.abort();
      }
      setDownloadNotice((current) => current && current.title === entry.title
        ? { ...current, paused: true, progress: entry.progress }
        : current);
    } else if (activeRetryRef.current?.title === entry.title) {
      void runRetryDownload(activeRetryRef.current, { keepProgress: true });
    }

    window.dispatchEvent(new CustomEvent('nsu-download-control', {
      detail: { title: entry.title, action: nextPaused ? 'pause' : 'resume' },
    }));
  };

  const handleCancelDownload = (entry: DownloadEntry) => {
    activeRetryRef.current = null;
    abortControllerRef.current?.abort();
    window.dispatchEvent(new CustomEvent('nsu-download-control', {
      detail: { title: entry.title, action: 'cancel' },
    }));
    setDownloadNotice((current) => current && current.title === entry.title ? null : current);
    setDownloadEntries((previousEntries) => {
      const nextEntries = previousEntries.filter((item) => item.id !== entry.id);
      window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
      return nextEntries;
    });
  };

  const handleRemoveEntry = (entry: DownloadEntry) => {
    setDownloadEntries((previousEntries) => {
      const nextEntries = previousEntries.filter((item) => item.id !== entry.id);
      window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
      return nextEntries;
    });

    setDownloadNotice((current) => current && current.title === entry.title ? null : current);
  };

  const handleRetry = (entry: DownloadEntry) => {
    if (!entry.sourceVideoId || typeof entry.sourceItag !== 'number' || !entry.sourceExtension) {
      return;
    }

    const detail = {
      title: entry.title,
      videoId: entry.sourceVideoId,
      itag: entry.sourceItag,
      extension: entry.sourceExtension,
      outputBitrate: entry.sourceOutputBitrate,
    };

    setDownloadEntries((previousEntries) => {
      const nextEntries = previousEntries.map((item) => item.id === entry.id
        ? {
            ...item,
            status: 'downloading' as const,
            paused: false,
            progress: 0,
            downloadedBytes: 0,
            updatedAt: new Date().toISOString(),
          }
        : item);
      window.localStorage.setItem('nsu-download-history', JSON.stringify(nextEntries));
      return nextEntries;
    });
    startYoutubeDownload({
      title: detail.title,
      videoId: detail.videoId,
      itag: detail.itag,
      extension: detail.extension,
      outputBitrate: detail.outputBitrate,
    });
  };

  const handleClearHistory = () => {
    setDownloadEntries([]);
    setDownloadNotice(null);
    window.localStorage.removeItem('nsu-download-history');
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <main className="mt-2 min-h-screen px-3 pb-16 text-slate-100 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-6">

        {/* Main Glass Section */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-2xl shadow-black/50 sm:rounded-3xl sm:p-8">

          {/* Subtle Background Glow Accent */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

          <div className="relative mb-4 flex">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-900/70 hover:text-white"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          </div>

          {/* Header */}
          <div className="relative flex items-start justify-between gap-2.5 sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-400 shadow-inner sm:h-13 sm:w-13 sm:rounded-2xl">
                <Download size={18} className="sm:h-5.5 sm:w-5.5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-400 sm:gap-1.5 sm:text-[11px] sm:tracking-widest">
                  <Sparkles size={10} className="sm:h-3 sm:w-3" />
                  <span>Downloads</span>
                </div>
                <span className="block truncate text-base font-extrabold tracking-tight text-white sm:text-3xl">
                  Download History
                </span>
              </div>
            </div>

            {downloadEntries.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-200"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear history</span>
                <span className="sm:hidden">Clear</span>
              </button>
            )}
          </div>

          {downloadEntries.length > 0 && (
            <div className="relative mt-6 hidden grid-cols-2 gap-3 sm:grid sm:max-w-md">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/35 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transferred</p>
                <p className="mt-1 wrap-break-words text-base font-bold tabular-nums text-amber-300 sm:text-lg">
                  {formatBytes(downloadedBytes)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/35 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total size</p>
                <p className="mt-1 wrap-break-words text-base font-bold tabular-nums text-white sm:text-lg">
                  {totalBytes ? formatBytes(totalBytes) : 'Calculating'}
                </p>
              </div>
            </div>
          )}

          {/* Download Notice Banner */}
          {downloadNotice && (
            <div className="mt-5 hidden items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-200 backdrop-blur-md sm:flex sm:items-center sm:px-4 sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              <span className="min-w-0 wrap-break-words leading-relaxed">
                {downloadNotice.status === 'downloading'
                  ? `Downloading ${downloadNotice.title}`
                  : downloadNotice.status === 'done'
                  ? `Downloaded ${downloadNotice.title}`
                  : 'Download failed'}
              </span>
            </div>
          )}

          {previewEntry?.sourceVideoId && (
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-black/30">
              <div className="border-b border-slate-800/80 px-3 py-2.5 sm:px-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Video preview</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-200">{previewEntry.title}</p>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${encodeURIComponent(previewEntry.sourceVideoId)}`}
                  title={`Preview of ${previewEntry.title}`}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Empty State */}
          {downloadEntries.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-4 py-8 text-center sm:mt-8 sm:rounded-2xl sm:px-6 sm:py-12">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 text-slate-500 sm:mb-3 sm:h-12 sm:w-12 sm:rounded-2xl">
                <Inbox size={20} className="sm:h-6 sm:w-6" />
              </div>
              <p className="text-xs font-medium text-slate-400 sm:text-sm">No downloads yet</p>
              <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Your downloaded files will appear here.</p>
            </div>
          ) : (
            <div className="mt-7 space-y-5 sm:mt-8 sm:space-y-6">

              {/* Active Downloads Section */}
              {activeDownloads.length > 0 && (
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex flex-wrap items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400 sm:text-xs sm:tracking-wider">
                      Active Downloads
                    </span>
                    <span className="inline-flex w-fit max-w-full rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 sm:px-2.5 sm:text-xs">
                      {activeDownloads.length} active
                    </span>
                  </div>

                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="space-y-2.5 sm:space-y-3">
                      {activeDownloads.map((entry) => (
                        <DownloadRow
                          key={entry.id}
                          entry={entry}
                          onTogglePause={handleTogglePause}
                          onCancel={handleCancelDownload}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Downloads Section */}
              {previousDownloads.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recent Activity
                  </span>
                  <div className="space-y-2">
                    {previousDownloads.map((entry) => (
                      <DownloadRow key={entry.id} entry={entry} onRetry={handleRetry} onRemove={handleRemoveEntry} />
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
