'use client';

import { AlertCircle, CheckCircle2, Download, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react';

export interface DownloadEntry {
  id: string;
  title: string;
  status: 'downloading' | 'done' | 'error';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  paused?: boolean;
  sourceVideoId?: string;
  sourceItag?: number;
  sourceExtension?: string;
  sourceOutputBitrate?: number;
  createdAt: string;
  updatedAt: string;
}

function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes) || !bytes || bytes < 0) return 'Size unknown';
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

interface DownloadRowProps {
  entry: DownloadEntry;
  onTogglePause?: (entry: DownloadEntry) => void;
  onCancel?: (entry: DownloadEntry) => void;
  onRemove?: (entry: DownloadEntry) => void;
  onRetry?: (entry: DownloadEntry) => void;
}

export default function DownloadRow({ entry, onTogglePause, onCancel, onRemove, onRetry }: DownloadRowProps) {
  const progressValue = typeof entry.progress === 'number' ? Math.max(0, Math.min(100, entry.progress)) : undefined;
  const isActive = entry.status === 'downloading';
  const canResume = Boolean(entry.sourceVideoId && typeof entry.sourceItag === 'number' && entry.sourceExtension);
  const progressLabel = entry.paused ? 'Paused' : typeof progressValue === 'number' ? `${Math.round(progressValue)}%` : 'Preparing...';
  const sizeLabel = entry.totalBytes
    ? `${formatBytes(entry.downloadedBytes)} / ${formatBytes(entry.totalBytes)}`
    : `${formatBytes(entry.downloadedBytes)}${entry.downloadedBytes ? '' : ' • Calculating size'}`;

  if (isActive) {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 shadow-lg shadow-black/20 transition-all duration-300 hover:border-amber-500/30 hover:bg-slate-950/60 sm:rounded-2xl sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2">
                <Download size={14} className={`mt-0.5 shrink-0 text-amber-400 sm:h-3.75 sm:w-3.7 ${entry.paused ? '' : 'animate-pulse'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-slate-100 sm:text-sm">{entry.title}</p>
                    <div className="ml-2 flex shrink-0 items-center gap-2 sm:gap-2.5">
                      <div className="text-right">
                        <div className="font-mono text-[10px] font-semibold text-amber-300 sm:text-[11px]">
                          {progressLabel}
                        </div>
                        <div className="text-[9px] text-slate-500 sm:text-[10px]">
                          {sizeLabel}
                        </div>
                      </div>
                      {onTogglePause && canResume ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTogglePause(entry);
                          }}
                          aria-label={entry.paused ? 'Resume download' : 'Pause download'}
                          title={entry.paused ? 'Resume' : 'Pause'}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300 transition-all duration-200 hover:scale-105 hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-200 active:scale-95 sm:h-9 sm:w-9 sm:rounded-xl"
                        >
                          {entry.paused ? (
                            <Play size={13} fill="currentColor" className="ml-0.5 sm:h-3.5 sm:w-3.5" />
                          ) : (
                            <Pause size={13} fill="currentColor" className="sm:h-3.5 sm:w-3.5" />
                          )}
                        </button>
                      ) : null}
                      {onCancel ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCancel(entry);
                          }}
                          aria-label="Abort download"
                          title="Abort"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 transition-all duration-200 hover:scale-105 hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95 sm:h-9 sm:w-9 sm:rounded-xl"
                        >
                          <X size={13} className="sm:h-3.5 sm:w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/90 p-px sm:mt-2.5 sm:h-1.5 sm:p-px">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  entry.paused
                    ? 'bg-slate-500'
                    : 'bg-linear-to-r from-amber-500 via-amber-400 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                }`}
                style={{ width: `${progressValue ?? 8}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800/60 bg-slate-950/20 px-3 py-2.5 transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900/40 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border sm:h-8 sm:w-8 sm:rounded-xl ${
          entry.status === 'done'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
            : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
        }`}
      >
        {entry.status === 'done' ? <CheckCircle2 size={14} className="sm:h-4 sm:w-4" /> : <AlertCircle size={14} className="sm:h-4 sm:w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-200 sm:text-sm">{entry.title}</p>
        {(entry.downloadedBytes || entry.totalBytes) ? (
          <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">
            {formatBytes(entry.downloadedBytes)} of {formatBytes(entry.totalBytes)}
          </p>
        ) : null}
      </div>
      {entry.status === 'error' && onRetry ? (
        <button
          type="button"
          onClick={() => onRetry(entry)}
          aria-label="Retry download"
          title="Retry"
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/20 hover:text-rose-200 sm:px-3"
        >
          <RotateCcw size={13} className="sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Retry</span>
        </button>
      ) : null}
      {entry.status !== 'downloading' && onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(entry)}
          aria-label="Remove download"
          title="Remove"
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/80 hover:text-white sm:px-3"
        >
          <Trash2 size={13} className="sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Remove</span>
        </button>
      ) : null}
    </div>
  );
}
