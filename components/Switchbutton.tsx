'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Download, Headphones, Play } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

interface SwitchbuttonProps {
  onScrollToSearch?: () => void
  searchHref?: string
  showSearch?: boolean
  searchQuery?: string
  setSearchQuery?: Dispatch<SetStateAction<string>>
}

const Switchbutton = ({ onScrollToSearch, searchHref }: SwitchbuttonProps) => {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const isAudio = pathname === '/Audio'
  const isDownload = pathname === '/download'
  const isVideo = pathname === '/' || pathname.startsWith('/video/')
  const isSearch = pathname === '/search'
  const resolvedSearchHref = searchHref ?? '/search'

  const navLinkBase =
    'relative rounded-xl px-4 py-2 sm:px-5 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap'
  const navLinkActive =
    'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
  const navLinkInactive =
    'text-white/40 hover:text-white/80 hover:bg-white/[0.06]'

  const searchBtnBase = `flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
    isSearch
      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
      : 'bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white'
  }`

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex items-center justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-2xl border border-white/8 bg-black/70 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl ring-1 ring-inset ring-white/4">

        <Link href="/" className={`${navLinkBase} ${isVideo ? navLinkActive : navLinkInactive}`}>
          <Play className="inline-block h-3 w-3 mr-1.5 -mt-px" aria-hidden="true" />Watch
        </Link>
        <Link href="/Audio" className={`${navLinkBase} ${isAudio ? navLinkActive : navLinkInactive}`}>
          <Headphones className="inline-block h-3 w-3 mr-1.5 -mt-px" aria-hidden="true" />Listen
        </Link>
        <Link href="/download" className={`${navLinkBase} ${isDownload ? navLinkActive : navLinkInactive}`}>
          <Download className="inline-block h-3 w-3 mr-1.5 -mt-px" aria-hidden="true" />Download
        </Link>

        <div className="mx-1 h-5 w-px bg-white/8" aria-hidden="true" />

        {onScrollToSearch ? (
          <button
            type="button"
            onClick={onScrollToSearch}
            title="Focus search input"
            className={searchBtnBase}
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => isSearch ? router.back() : router.push(resolvedSearchHref)}
            title={isSearch ? 'Go back' : 'Open search page'}
            aria-label={isSearch ? 'Go back' : 'Open search page'}
            className={searchBtnBase}
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        )}

      </div>
    </div>
  )
}

export default Switchbutton
