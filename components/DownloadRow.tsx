'use client';

import { AlertCircle, CheckCircle2, Clock3, Download, Pause, Play } from 'lucide-react';

export interface DownloadEntry {
  id: string;
  title: string;
  status: 'downloading' | 'done' | 'error';
  progress?: number;
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
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
      <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/40 p-4 transition-all hover:border-amber-500/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Download size={15} className="shrink-0 text-amber-400 animate-pulse" />
              <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-medium text-amber-200/80">
              <span>Task #{index != null ? index + 1 : 1}</span>
              <span>{typeof progressValue === 'number' ? `${Math.round(progressValue)}%` : 'Preparing...'}</span>
            </div>

            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800/80">
              <div
                className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-all duration-300"
                style={{ width: `${progressValue ?? 8}%` }}
              />
            </div>
          </div>

          {onTogglePause && (
            <button
              type="button"
              onClick={() => onTogglePause(entry)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-all hover:bg-amber-400/20"
            >
              {entry.paused ? (
                <>
                  <Play size={12} fill="currentColor" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause size={12} fill="currentColor" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/30 px-4 py-3 transition-colors hover:bg-slate-800/30">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          entry.status === 'done'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}
      >
        {entry.status === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-200">{entry.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <Clock3 size={12} />
          {entry.status === 'done' ? 'Completed & Saved' : 'Download Failed'}
        </p>
      </div>
    </div>
  );
}
