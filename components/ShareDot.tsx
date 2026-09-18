interface ShareDotProps {
  size?: 'xs' | 'sm';
  title?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
};

const glowClasses = {
  xs: 'shadow-[0_0_5px_1px_rgba(74,222,128,0.9),0_0_12px_3px_rgba(21,132,21,0.5)] ring-1 ring-inset ring-[#86efac]/80',
  sm: 'shadow-[0_0_7px_2px_rgba(74,222,128,0.9),0_0_14px_4px_rgba(21,132,21,0.55)] ring-1 ring-inset ring-[#86efac]/80',
};

export default function ShareDot({
  size = 'sm',
  title = "Also available on another artist's page",
  className = 'absolute',
}: ShareDotProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(74,222,128,1),rgba(21,132,21,0.85))] ${sizeClasses[size]} ${glowClasses[size]} ${className}`}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#4ade80] opacity-40" />
      <span className="relative h-1 w-1 rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.9)]" />
    </span>
  );
}
