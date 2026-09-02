'use client';

import { AlertCircle, CheckCircle2, Clock3, Download, Pause, Play } from 'lucide-react';

export interface DownloadEntry {
  id: string;
  title: string;
  status: 'downloading' | 'done' | 'error';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  paused?: boolean;
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
  index?: number;
  onTogglePause?: (entry: DownloadEntry) => void;
}

export default function DownloadRow({ entry, index, onTogglePause }: DownloadRowProps) {
  const progressValue = typeof entry.progress === 'number' ? Math.max(0, Math.min(100, entry.progress)) : undefined;
  const isActive = entry.status === 'downloading';

  if (isActive) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4 transition-all duration-300 hover:border-amber-500/30 hover:bg-slate-950/60 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Download size={15} className={`shrink-0 text-amber-400 ${entry.paused ? '' : 'animate-pulse'}`} />
              <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs font-medium text-amber-200/80">
              <span className="text-[11px] font-bold tracking-wider text-slate-400">
                TASK #{index != null ? index + 1 : 1}
              </span>
              <span className="font-mono text-[11px] text-amber-300">
                {entry.paused ? 'Paused' : typeof progressValue === 'number' ? `${Math.round(progressValue)}%` : 'Preparing...'}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-slate-500">
              <span>{formatBytes(entry.downloadedBytes)} transferred</span>
              <span>{entry.totalBytes ? `${formatBytes(entry.totalBytes)} total` : 'Calculating size'}</span>
            </div>

            {/* Progress Bar */}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800/90 p-[1px]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  entry.paused 
                    ? 'bg-slate-500' 
                    : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                }`}
                style={{ width: `${progressValue ?? 8}%` }}
              />
            </div>
          </div>

          {/* Icon-Only Action Button */}
          {onTogglePause && (
            <button
              type="button"
              onClick={() => onTogglePause(entry)}
              aria-label={entry.paused ? 'Resume download' : 'Pause download'}
              title={entry.paused ? 'Resume' : 'Pause'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300 transition-all duration-200 hover:scale-105 hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-200 active:scale-95"
            >
              {entry.paused ? (
                <Play size={14} fill="currentColor" className="ml-0.5" />
              ) : (
                <Pause size={14} fill="currentColor" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/20 px-4 py-3 transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900/40">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          entry.status === 'done'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
            : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
        }`}
      >
        {entry.status === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-200">{entry.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          <Clock3 size={12} className="text-slate-500" />
          {entry.status === 'done' ? 'Completed & Saved' : 'Download Failed'}
        </p>
        {(entry.downloadedBytes || entry.totalBytes) ? (
          <p className="mt-1 text-[10px] text-slate-500">
            {formatBytes(entry.downloadedBytes)} of {formatBytes(entry.totalBytes)}
          </p>
        ) : null}
      </div>
    </div>
  );
}