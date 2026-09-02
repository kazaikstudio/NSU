'use client';

import type { MouseEvent } from 'react';
import { Download, Flame } from 'lucide-react';

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
};

export default function ComedyDirectoryList({
  items,
  activeItemId,
  loading = false,
  onSelectAction,
}: ComedyDirectoryListProps) {
  const handleDownloadClick = async (event: MouseEvent<HTMLButtonElement>, item: ComedyDirectoryItem) => {
    event.preventDefault();
    event.stopPropagation();

    const safeTitle = (item.title || 'download').trim() || 'download';

    const getDownloadUrl = (fileUrl: string) => {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = match ? (match[1] || match[2]) : null;
      if (!fileId) return fileUrl;

      return `/api/dashboard/media/${fileId}?download=1&filename=${encodeURIComponent(`${safeTitle}.mp4`)}`;
    };

    const downloadUrl = getDownloadUrl(item.fileUrl);
    if (!downloadUrl) return;

    window.dispatchEvent(new CustomEvent('nsu-download-status', {
      detail: { status: 'downloading', title: safeTitle, progress: 0, downloadedBytes: 0 },
    }));

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
            window.dispatchEvent(new CustomEvent('nsu-download-status', {
              detail: { status: 'downloading', title: safeTitle, progress: nextProgress, downloadedBytes: loaded, totalBytes: total },
            }));
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

      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'done', title: safeTitle, progress: 100, downloadedBytes: loaded, totalBytes: total || loaded },
      }));
    } catch (error) {
      console.error('Download failed:', error);
      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'error', title: safeTitle, progress: 0 },
      }));
    }
  };

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
          items.map((item) => {
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
                  className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-primary group-hover:text-primary"
                >
                  {item.title}
                </button>

                <button
                  type="button"
                  onClick={(event) => void handleDownloadClick(event, item)}
                  aria-label={`Download ${item.title}`}
                  title="Download"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-navlink/20 bg-navlink/10 text-navlink transition hover:border-navlink/40 hover:bg-navlink/20 hover:text-navlink"
                >
                  <Download size={15} />
                </button>


              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
