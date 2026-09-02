'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { Download } from 'lucide-react';

type HotComedyItem = {
  id: string;
  title: string;
  date: string;
  thumbnail: string;
  fileUrl?: string;
};

type HotComediesRowListProps = {
  items: HotComedyItem[];
  onOpenAction: (item: HotComedyItem) => void;
};

export default function HotComediesRowList({ items, onOpenAction }: HotComediesRowListProps) {
  const handleDownload = async (event: MouseEvent<HTMLButtonElement>, item: HotComedyItem) => {
    event.preventDefault();
    event.stopPropagation();

    const safeTitle = (item.title || 'download').trim() || 'download';
    const fileUrl = item.fileUrl || '';
    const fileId = fileUrl.match(/[?&]id=([^&]+)/)?.[1];
    const downloadUrl = fileId
      ? `/api/dashboard/media/${fileId}?download=1&filename=${encodeURIComponent(`${safeTitle}.mp4`)}`
      : fileUrl;

    const dispatchStatus = (status: 'downloading' | 'done' | 'error', progress?: number, downloadedBytes?: number, totalBytes?: number) => {
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
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Download body is unavailable.');

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
        return array.buffer;
      }), { type: response.headers.get('content-type') || 'video/mp4' });
      const anchor = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = `${safeTitle}.mp4`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      dispatchStatus('done', 100, loaded, total || loaded);
    } catch (error) {
      console.error('Download failed:', error);
      dispatchStatus('error', 0);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenAction(item);
          }
        };

        return (
        <div
          key={item.id}
          onClick={() => onOpenAction(item)}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          className="group relative flex items-center gap-3 rounded-xl bg-white/10 p-2.5 text-left shadow-sm transition-all duration-300 hover:bg-card1/10 hover:border-card1/40"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black sm:h-20 sm:w-20">
            <img
              src={item.thumbnail}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <h4 className="truncate text-sm font-semibold text-primary transition-colors group-hover:text-rose-400 sm:text-base" title={item.title}>
              {item.title}
            </h4>
            <span className="mt-0.5 block text-xs font-medium text-secondry">
              {item.date || 'Noll Studio'}
            </span>
          </div>

          <button
            type="button"
            onClick={(event) => void handleDownload(event, item)}
            aria-label={`Download ${item.title}`}
            title="Download"
            disabled={!item.fileUrl}
            className="flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-full bg-card1/20 text-secondry transition-all group-hover:bg-rose-600 group-hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-auto sm:px-3"
          >
            <Download size={16} />
            <span className="hidden text-xs font-semibold sm:inline">Download</span>
          </button>
        </div>
        );
      })}
    </div>
  );
}
