interface ShareDotProps {
  size?: 'xs' | 'sm';
  title?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3 shadow-[0_0_4px_1px_rgba(90,19,210,0)]',
  sm: 'h-3.5 w-3.5 shadow-[0_0_5px_2px_rgba(90,19,210,0)]',
};

export default function ShareDot({
  size = 'sm',
  title = "Also available on another artist's page",
  className = '',
}: ShareDotProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`absolute flex items-center justify-center rounded-full bg-[#158415] ${sizeClasses[size]} ${className}`}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#5a13d2] opacity-40" />
      <span className="h-1 w-1 rounded-full bg-white" />
    </span>
  );
}
