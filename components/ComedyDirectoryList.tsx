'use client';

import { Download, Flame, Music, Play } from 'lucide-react';

export type ComedyDirectoryItem = {
  id: string;
  title: string;
  comedian?: string;
  duration?: string;
  views?: string;
  thumbnail?: string;
  fileUrl: string;
};

type ComedyDirectoryListProps = {
  items: ComedyDirectoryItem[];
  activeItemId?: string | null;
  loading?: boolean;
  onSelectAction: (item: ComedyDirectoryItem) => void;
  onDownloadAction?: (item: ComedyDirectoryItem) => void;
};

export default function ComedyDirectoryList({
  items,
  activeItemId,
  loading = false,
  onSelectAction,
  onDownloadAction,
}: ComedyDirectoryListProps) {
  return (
    <aside className="flex flex-col gap-2 overflow-hidden rounded-3xl border border-card1/20 bg-cardcl/70 p-3 backdrop-blur-md lg:col-span-1 lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)] lg:self-start">
      <div className="flex shrink-0 items-center justify-between border-b border-card1/20 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Flame size={18} className="fill-navlink text-navlink" />
          <span>Directory Files</span>
        </div>
        <span className="rounded-full border border-navlink/20 bg-navlink/10 px-2 py-0.5 font-mono text-[10px] text-navlink">
          {items.length} Files
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {items.length === 0 && !loading ? (
          <div className="p-4 text-center text-xs text-secondry">No other files found in this path.</div>
        ) : (
          items.map((item, index) => {
            const isCurrent = activeItemId === item.id;
            return (
              <div
                key={item.id}
                className={`group flex items-center gap-3 rounded-2xl p-2.5 text-left transition-all ${
                  isCurrent
                    ? 'border border-navlink/30 bg-navlink/10 text-primary'
                    : 'border border-transparent bg-backnav/60 text-secondary hover:bg-backnav/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAction(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-card1/20 bg-backnav">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        {isCurrent ? (
                          <Play size={14} className="fill-navlink text-navlink" />
                        ) : (
                          <Music size={14} className="text-secondry group-hover:text-primary" />
                        )}
                        <span className="mt-0.5 text-[9px] font-mono text-secondry">#{index + 1}</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-primary group-hover:text-primary">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-secondry">{item.comedian}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-secondry">
                      <span>{item.duration}</span>
                      <span>•</span>
                      <span className="text-secondary">{item.views}</span>
                    </div>
                  </div>
                </button>

                {onDownloadAction ? (
                  <button
                    type="button"
                    onClick={() => onDownloadAction(item)}
                    aria-label={`Download ${item.title}`}
                    title="Download"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-navlink/20 bg-navlink/10 text-navlink transition hover:border-navlink/40 hover:bg-navlink/20 hover:text-navlink"
                  >
                    <Download size={15} />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
