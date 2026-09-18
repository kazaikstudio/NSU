import { Flame } from 'lucide-react';

interface PinedProps {
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
}

const iconSize = {
  xs: 15,
  sm: 18,
  md: 22,
};

const glowSize = {
  xs: 'h-4.5 w-4.5',
  sm: 'h-5.5 w-5.5',
  md: 'h-6.5 w-6.5',
};

const sparkOffsets = [
  { left: '46%', delay: '0s', duration: '1.1s', x: '-3px' },
  { left: '52%', delay: '0.35s', duration: '1.35s', x: '4px' },
  { left: '58%', delay: '0.7s', duration: '1.2s', x: '-1px' },
];

export default function Pined({
  size = 'sm',
  title = 'Pinned track',
  className = '',
}: PinedProps) {
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className={`relative inline-flex items-center justify-center align-middle ${className}`}
    >
      {/* Glow background */}
      <span
        aria-hidden="true"
        className={`pined-fire absolute rounded-full blur-[3px] ${glowSize[size]}`}
        style={{
          background:
            'radial-gradient(circle, rgba(255,220,120,0.6) 0%, rgba(255,120,0,0.42) 45%, rgba(255,40,0,0.26) 100%)',
          animation: 'pined-glow 1.6s ease-in-out infinite',
        }}
      />

      {/* Burning flame icon */}
      <span
        aria-hidden="true"
        className="pined-fire relative"
        style={{
          animation: 'pined-flame 0.9s ease-in-out infinite',
          transformOrigin: '50% 100%',
        }}
      >
        <Flame
          size={iconSize[size]}
          className="relative text-red-500 fill-rose-600/60 drop-shadow-[0_0_8px_rgba(255,70,0,0.95)]"
        />
        <Flame
          size={Math.round(iconSize[size] * 0.55)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-300 fill-yellow-400 drop-shadow-[0_0_6px_rgba(255,210,0,0.95)]"
        />
      </span>

      {/* Rising sparks */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {sparkOffsets.map((spark, index) => (
          <span
            key={index}
            className="pined-fire absolute top-[4%] h-0.75 w-0.75 rounded-full bg-amber-300"
            style={{
              left: spark.left,
              ['--spark-x' as string]: spark.x,
              animation: `pined-spark ${spark.duration} ease-out infinite`,
              animationDelay: spark.delay,
            }}
          />
        ))}
      </span>
    </span>
  );
}
