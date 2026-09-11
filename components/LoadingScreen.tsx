import React from 'react'

const LoadingScreen = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-6 py-10">
      {/* Spinner: a faint track ring with a spinning gradient "comet" on top */}
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-[5px] border-primary/10" />
        <div
          className="absolute inset-0 animate-spin rounded-full [animation-duration:900ms]"
          style={{
            background:
              'conic-gradient(from 90deg, transparent 0deg, transparent 30deg, var(--color-navlink) 330deg)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px))',
          }}
        />
        <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-navlink shadow-[0_0_16px_3px_var(--color-navlink)]" />
      </div>

      {/* Text */}
      <div className="text-center">
        <h2 className="text-lg font-semibold tracking-tight text-primary">
          Loading your experience
        </h2>
        <p className="mt-1.5 text-sm text-secondary/70">
          Please wait while NSU gets everything ready.
        </p>
      </div>
    </div>
  )
}

export default LoadingScreen
