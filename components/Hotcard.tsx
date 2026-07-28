'use client';

interface CardProps {
  card: {
    title: string;
    date: string;
    imgUrl: string;
    gradient: string;
  };
  onPlay?: () => void;
  // Kept MouseEvent parameter so click position can be forwarded
  onDownload?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const Card = ({ card, onPlay, onDownload }: CardProps) => {
  return (
    <div className="w-80 h-96 relative flex flex-col shrink-0 overflow-hidden rounded-3xl shadow-2xl bg-slate-300 group border-2 border-slate-700">
      <div className="absolute top-0 left-0 right-0 h-[65%] overflow-hidden z-0">
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (onPlay) onPlay(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && onPlay) onPlay(); }}
          className="w-full h-full bg-cover bg-center cursor-pointer"
          style={{
            backgroundImage: `url(${card.imgUrl})`,
          }}
        />
      </div>

      <div className={`absolute bottom-0 left-0 right-0 top-[60%] z-10 rounded-none p-8 flex flex-col justify-between bg-gradient-to-br ${card.gradient}`}>
        <div className="h-8 w-full" />
        <div>
          <h3 className="text-white font-extrabold text-xl tracking-tight leading-tight truncate">
            {card.title}
          </h3>
        </div>

        <div className="flex justify-between items-end mt-4">
          <span className="text-white/70 text-sm font-mono">{card.date}</span>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (onDownload) onDownload(e); 
            }} 
            className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-slate-950 font-bold hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>
    </div>
  );
};