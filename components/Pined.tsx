import { Flame } from 'lucide-react';

interface PinedProps {
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
}

const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
};

const glowSize = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
};

export default function Pined({
  size = 'sm',
  title = 'Pinned track',
  className = '',
}: PinedProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`relative inline-flex items-center justify-center text-orange-400 ${className}`}
    >
      <span
        className={`absolute animate-ping rounded-full bg-orange-400/40 ${glowSize[size]}`}
      />
      <Flame size={iconSize[size]} className="relative fill-orange-400/40" />
    </span>
  );
}
