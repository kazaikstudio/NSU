interface ComponentNameProps {
  artist?: {
    name?: string;
    imageUrl?: string;
  };
}

const ComponentName: React.FC<ComponentNameProps> = ({ artist }) => {
  return (
    <div className="my-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 shadow-xl backdrop-blur-xl max-w-sm mx-auto">
      <div className="flex flex-col gap-2">
        <div className="w-full aspect-video rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700/50 overflow-hidden relative group">
          <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-15 transition-opacity" />
          <span className="text-zinc-400 font-medium text-xs">Media Preview</span>
        </div>
        <div className='flex items-center gap-2 min-w-0'>
          <div className='bg-amber-300 flex justify-center items-center w-16 h-16 sm:w-20 sm:h-20 shrink-0 aspect-square rounded-2xl overflow-hidden relative'>
            {artist?.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt={artist.name || "Artist"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-black font-medium text-xs">Image</span>
            )}
          </div>

          <div className="w-full space-y-1 text-left px-1 min-w-0">
            <span className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Featured Release
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white truncate">{artist?.name || "Latest Track Title"}</h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed line-clamp-2">
              Experience high-fidelity audio and visual production straight from Noll Studio Uganda.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComponentName
