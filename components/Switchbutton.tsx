'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Dispatch, SetStateAction } from 'react'

interface SwitchbuttonProps {
  onScrollToSearch?: () => void
  searchHref?: string
  showSearch?: boolean
  searchQuery?: string
  setSearchQuery?: Dispatch<SetStateAction<string>>
}

const Switchbutton = ({ onScrollToSearch, searchHref }: SwitchbuttonProps) => {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const isAudio = pathname === '/Audio'
  const isDownload = pathname === '/download'
  const isVideo = pathname === '/' || pathname.startsWith('/video/')
  const resolvedSearchHref = searchHref ?? '/search'

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex max-w-full items-center justify-center px-3 sm:px-4 pointer-events-none text-primary">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2.5rem)] items-center gap-1 sm:gap-2 rounded-full border border-card1/20 bg-cardcl/95 p-1 sm:p-1.5 shadow-xl shadow-black/40 backdrop-blur">
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

        <button
          type="button"
          onClick={() => {
            if (onScrollToSearch) {
              onScrollToSearch()
              return
            }
            router.push(resolvedSearchHref)
          }}
          title={onScrollToSearch ? 'Focus search input' : 'Open search page'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-card1/20 bg-cardcl/95 text-secondry transition-all hover:text-primary hover:bg-card1/10 active:bg-rose-600 sm:h-9 sm:w-9"
        >
          <svg
            className="h-3.5 w-3.5 sm:h-4 sm:w-4"
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
      </div>
    </div>
  )
}

export default Switchbutton
