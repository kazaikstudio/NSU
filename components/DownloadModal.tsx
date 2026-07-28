"use client";

import { useEffect, useState } from "react";

type DownloadStream = {
  label: string;
  size?: string;
  url: string;
};

type DownloadModalProps = {
  open: boolean;
  videoId: string | null;
  onClose: () => void;
};

const DownloadModal = ({ open, videoId, onClose }: DownloadModalProps) => {
  const [streams, setStreams] = useState<DownloadStream[]>([]);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !videoId) {
      setStreams([]);
      setMessage(undefined);
      setLoading(false);
      return;
    }

    const fetchStreams = async () => {
      setLoading(true);
      setMessage("Loading download links...");
      setStreams([]);

      try {
        const res = await fetch(`/api/youtube/download?videoId=${encodeURIComponent(videoId)}`);
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          setMessage(payload?.message ?? payload?.error ?? "Downloader currently unavailable.");
          return;
        }

        const fetchedStreams = payload?.streams ?? [];
        setStreams(fetchedStreams);
        setMessage(fetchedStreams.length === 0 ? payload?.message ?? "No download streams found." : undefined);
      } catch (err: unknown) {
        setMessage(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void fetchStreams();
  }, [open, videoId]);

  if (!open || !videoId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">Download Options</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-300 text-center py-4">{message}</p>
        ) : streams.length > 0 ? (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {streams.map((stream, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <div>
                  <div className="font-semibold text-sm text-white">{stream.label}</div>
                  {stream.size && <div className="text-xs text-slate-400">{stream.size}</div>}
                </div>
                <a
                  href={stream.url}
                  className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-4 py-2 rounded-lg text-white transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300 text-center py-4">
            {message ?? "No download streams available."}
          </p>
        )}
      </div>
    </div>
  );
};

export default DownloadModal;
