'use client'

import { Download, Headphones, Play, Search } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type Dispatch, type SetStateAction } from 'react'

import Dock, { type DockItemData } from './Dock'

interface DockBarProps {
  onScrollToSearch?: () => void
  searchHref?: string
  showSearch?: boolean
  searchQuery?: string
  setSearchQuery?: Dispatch<SetStateAction<string>>
}

const DockBar = ({ onScrollToSearch, searchHref }: DockBarProps) => {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const isAudio = pathname === '/Audio'
  const isDownload = pathname === '/download'
  const isVideo = pathname === '/' || pathname.startsWith('/video/')
  const isSearch = pathname === '/search'
  const resolvedSearchHref = searchHref ?? '/search'

  useEffect(() => {
    router.prefetch(resolvedSearchHref)
  }, [router, resolvedSearchHref])

  const activeClass =
    'bg-linear-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
  const inactiveClass =
    'text-white/40 hover:text-white/80 hover:bg-white/[0.06]'

  const items: DockItemData[] = [
    {
      icon: <Play aria-hidden="true" />,
      label: 'Watch',
      onClick: () => router.push('/'),
      className: isVideo ? activeClass : inactiveClass
    },
    {
      icon: <Headphones aria-hidden="true" />,
      label: 'Listen',
      onClick: () => router.push('/Audio'),
      className: isAudio ? activeClass : inactiveClass
    },
    {
      icon: <Download aria-hidden="true" />,
      label: 'Download',
      onClick: () => router.push('/download'),
      className: isDownload ? activeClass : inactiveClass
    },
    { separator: true },
    {
      icon: <Search aria-hidden="true" />,
      label: isSearch ? 'Go back' : 'Open search page',
      onClick: () =>
        onScrollToSearch
          ? onScrollToSearch()
          : isSearch
            ? router.back()
            : router.push(resolvedSearchHref),
      className: isSearch ? activeClass : inactiveClass
    }
  ]

  return (
    <div className="fixed inset-x-0 bottom-4 sm:bottom-6 z-50 flex items-end justify-center px-3 sm:px-4 pointer-events-none">
      <div className="pointer-events-auto">
        <Dock
          items={items}
          panelHeight={68}
          baseItemSize={44}
          magnification={62}
          distance={180}
        />
      </div>
    </div>
  )
}

export default DockBar
