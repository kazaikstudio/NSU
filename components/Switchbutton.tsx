'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Dispatch, SetStateAction } from 'react'

interface SwitchbuttonProps {
  onScrollToSearch?: () => void
  showSearch?: boolean
  searchQuery?: string
  setSearchQuery?: Dispatch<SetStateAction<string>>
}

const Switchbutton = ({ onScrollToSearch }: SwitchbuttonProps) => {
  const pathname = usePathname()
  const isAudio = pathname === '/Audio'
  const isDownload = pathname === '/download'
  const isVideo = pathname === '/' || pathname.startsWith('/video/')

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex max-w-full items-center justify-center gap-1.5 px-3 sm:gap-2 sm:px-4 pointer-events-none text-primary">
      {/* Video / Audio / Download Toggle Pills */}
      <div className="pointer-events-auto flex max-w-[calc(100vw-4rem)] items-center gap-1 sm:gap-2 rounded-full border border-card1/20 bg-cardcl/95 p-1 sm:p-1.5 shadow-xl shadow-black/40 backdrop-blur">
        <Link
          href="/"
          className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            isVideo
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'text-secondry hover:bg-card1/10 hover:text-primary'
          }`}
        >
          Video
        </Link>
        <Link
          href="/Audio"
          className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            isAudio
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'text-secondry hover:bg-card1/10 hover:text-primary'
          }`}
        >
          Audio
        </Link>
        <Link
          href="/download"
          className={`rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            isDownload
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'text-secondry hover:bg-card1/10 hover:text-primary'
          }`}
        >
          Download
        </Link>
      </div>

      {/* Quick Jump & Focus Search Icon Button */}
      {onScrollToSearch && (
        <button
          type="button"
          onClick={onScrollToSearch}
          title="Focus search input"
          className="pointer-events-auto shrink-0 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-card1/20 bg-cardcl/95 text-secondry hover:text-primary hover:bg-card1/10 active:bg-rose-600 shadow-xl shadow-black/40 backdrop-blur transition-all cursor-pointer"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

export default Switchbutton
