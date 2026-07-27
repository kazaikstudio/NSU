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

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex items-center justify-center gap-2 px-4 pointer-events-none">
      {/* Video / Audio Toggle Pills */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur">
        <Link
          href="/"
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            !isAudio
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Video
        </Link>
        <Link
          href="/Audio"
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            isAudio
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Audio
        </Link>
      </div>

      {/* Quick Jump & Focus Search Icon Button */}
      {onScrollToSearch && (
        <button
          type="button"
          onClick={onScrollToSearch}
          title="Focus search input"
          className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full border border-slate-700 bg-slate-900/95 text-slate-300 hover:text-white hover:bg-slate-800 active:bg-rose-600 shadow-xl shadow-black/40 backdrop-blur transition-all"
        >
          <svg
            className="w-5 h-5"
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