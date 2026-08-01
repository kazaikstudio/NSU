'use client';

interface CardProps {
  card: {
    title: string;
    date: string;
    imgUrl: string;
    gradient: string;
  };
  onPlay?: () => void;
  onDownload?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const Card = ({ card, onPlay, onDownload }: CardProps) => {
  return (
    <div className="w-full h-full min-h-96 relative flex flex-col shrink-0 overflow-hidden rounded-2xl shadow-xl bg-cardcl group border border-card1/20 text-primary">
          <div className="absolute top-0 left-0 right-0 h-[65%] overflow-hidden z-0">
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (onPlay) onPlay(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && onPlay) onPlay(); }}
              className="w-full h-full bg-cover bg-center cursor-pointer group-hover:scale-105 transition-transform duration-300"
              style={{
                backgroundImage: `url(${card.imgUrl})`,
              }}
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 top-[60%] z-10 p-5 sm:p-6 flex flex-col justify-between bg-cardcl/90 backdrop-blur-md border-t border-card1/20">
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight leading-snug line-clamp-2">
                {card.title}
              </h3>
            </div>

            <div className="flex justify-between items-center mt-3">
              <span className="text-secondry text-xs sm:text-sm font-medium">{card.date}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDownload) onDownload(e);
                }}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-lg shadow-blue-950/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
    </div>
  );
};
