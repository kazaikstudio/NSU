import React from 'react'

const LoadingScreen = () => {
  return (
<div className="loader-shell flex min-h-screen items-center justify-center bg-backnav px-6 py-10 transition-colors duration-300">
  <div className="w-full max-w-sm rounded-[28px] border border-card1/15 bg-cardcl/80 p-8 text-center shadow-[0_20px_80px_rgba(2,48,71,0.18)] backdrop-blur-xl transition-all duration-300 dark:border-card1/10 dark:bg-cardcl/70">

    {/* Animated Spinner Ring */}
    <div className="loader-ring mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card1/15 border-t-navlink animate-spin dark:border-card1/10" />

    {/* Title */}
    <h2 className="text-xl font-semibold text-primary">
      Loading your experience
    </h2>

    {/* Description Paragraph */}
    <p className="mt-2 text-sm text-secondary/80">
      Please wait while N.S.U gets everything ready.
    </p>
  </div>
</div>
  )
}

export default LoadingScreen


