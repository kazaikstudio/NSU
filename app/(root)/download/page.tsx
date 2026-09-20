'use client'

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Download, Link as LinkIcon, X } from 'lucide-react'
import DockBar from '../../../components/DockBar'
import { useClickOutside } from '../../../components/useClickOutside'
import { startYoutubeDownload } from '@/lib/youtube-download-manager'

const SAVED_DOWNLOAD_LINK_KEY = 'nsu-download-link'

function extractVideoIdFromUrl(value: string) {
  const trimmedValue = value.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedValue)) return trimmedValue

  const withProtocol = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`

  try {
    const bareUrl = new URL(withProtocol)
    if (['youtu.be', 'music.youtube.com'].includes(bareUrl.hostname)) {
      return bareUrl.pathname.slice(1).split('/')[0] || bareUrl.searchParams.get('v') || ''
    }
    if (bareUrl.hostname.endsWith('youtube.com') || bareUrl.hostname.endsWith('youtube-nocookie.com')) {
      const pathId = bareUrl.pathname.match(/^\/(?:shorts|embed|live|clip)\/([^/?]+)/)?.[1]
      return bareUrl.searchParams.get('v') || pathId || ''
    }
  } catch {
    // Fall through
  }

  return ''
}

function getVideoId(value: string) {
  const embeddedMatch = value.match(/https?:\/\/[^\s"'<>]+/)
  return embeddedMatch ? extractVideoIdFromUrl(embeddedMatch[0]) : extractVideoIdFromUrl(value)
}

function getDirectUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

type PreviewProbe = {
  effectiveUrl?: string
  contentType?: string
  contentLength?: string
  status?: number
  error?: string
}

type PreviewKind = 'audio' | 'video' | 'image' | 'document' | 'unsupported'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'heic', 'heif', 'tiff', 'tif', 'jfif', 'jpe'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'm4b', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'weba', 'wma'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ogv', '3gp', 'mpeg', 'mpg', 'ts'])
const DOCUMENT_EXTENSIONS = new Set(['pdf'])

function extensionFromUrl(value: string) {
  try {
    const pathname = new URL(value).pathname
    const lastSegment = pathname.split('/').pop() || ''
    const match = lastSegment.match(/\.([a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : ''
  } catch {
    return ''
  }
}

function kindFromExtension(value: string): PreviewKind {
  if (IMAGE_EXTENSIONS.has(value)) return 'image'
  if (AUDIO_EXTENSIONS.has(value)) return 'audio'
  if (VIDEO_EXTENSIONS.has(value)) return 'video'
  if (DOCUMENT_EXTENSIONS.has(value)) return 'document'
  return 'unsupported'
}

function kindFromContentType(contentType: string, url: string): PreviewKind {
  const normalized = contentType.toLowerCase()
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('audio/')) return 'audio'
  if (normalized.startsWith('video/')) return 'video'
  if (normalized === 'application/pdf') return 'document'
  return kindFromExtension(extensionFromUrl(url))
}

function MediaPreview({ url }: { url: string }) {
  const [previewError, setPreviewError] = useState('')
  const [kind, setKind] = useState<PreviewKind | null>(null)
  const [effectiveUrl, setEffectiveUrl] = useState(url)

  useEffect(() => {
    let cancelled = false

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { signal: controller.signal, cache: 'no-store' })
          const payload = await response.json() as PreviewProbe
          if (cancelled) return
          if (!response.ok || payload.error || !payload.contentType) {
            setKind('unsupported')
            setPreviewError(payload.error || 'This link does not appear to be a previewable media file.')
            return
          }
          const detectedKind = kindFromContentType(payload.contentType, payload.effectiveUrl || url)
          setKind(detectedKind)
          if (payload.effectiveUrl) setEffectiveUrl(payload.effectiveUrl)
          if (detectedKind === 'unsupported') {
            setPreviewError('This link cannot be previewed as a media file.')
          }
        } catch {
          if (cancelled) return
          setKind('unsupported')
          setPreviewError('Unable to probe this link.')
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [url])

  if (kind === null) return null

  if (kind === 'unsupported') {
    return previewError ? (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
        {previewError}
      </div>
    ) : null
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-xl shadow-black/30">
      {kind === 'audio' && (
        <div className="flex items-center gap-3 px-4 py-6">
          <audio src={effectiveUrl} controls preload="metadata" className="w-full" onError={() => setPreviewError('This audio link cannot be played in the browser.')} />
        </div>
      )}

      {kind === 'video' && (
        <video
          src={effectiveUrl}
          controls
          preload="metadata"
          playsInline
          className="max-h-72 w-full"
          onError={() => setPreviewError('This video link cannot be played in the browser.')}
        />
      )}

      {kind === 'image' && (
        <div className="flex items-center justify-center">
          <Image src={effectiveUrl} alt="" unoptimized width={1200} height={675} className="max-h-72 w-auto max-w-full" onError={() => setPreviewError('This image link could not be previewed.')} style={{ objectFit: 'contain' }} />
        </div>
      )}

      {kind === 'document' && (
        <iframe
          src={effectiveUrl}
          title="Document preview"
          className="h-72 w-full"
        />
      )}

      {previewError && <p className="px-4 py-2 text-xs text-amber-400">{previewError}</p>}
    </div>
  )
}

type DownloadFormat = {
  itag: number
  label: string
  kind: string
  extension: string
  outputBitrate?: number
  size: number | null
}

type DownloadRetryDetail = {
  title: string
  videoId: string
  itag: number
  extension: string
  outputBitrate?: number
}

function formatKey(format: DownloadFormat) {
  return `${format.itag}-${format.extension}-${format.outputBitrate || 'source'}`
}

function DownloadForm() {
  const searchParams = useSearchParams()
  const queryVideoId = searchParams.get('video')
  const [source, setSource] = useState(() => queryVideoId || '')
  const [previousQueryVideoId, setPreviousQueryVideoId] = useState(queryVideoId)
  const restoredFromStorage = useRef(false)
  if (previousQueryVideoId !== queryVideoId) {
    setPreviousQueryVideoId(queryVideoId)
    if (queryVideoId) setSource(queryVideoId)
  }
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [formats, setFormats] = useState<DownloadFormat[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [loadingFormat, setLoadingFormat] = useState<number | null>(null)
  const [loadingDirectDownload, setLoadingDirectDownload] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat | null>(null)
  const [showFormatList, setShowFormatList] = useState(false)
  const formatListRef = useRef<HTMLDivElement>(null)

  useClickOutside(formatListRef, () => setShowFormatList(false))

  useEffect(() => {
    if (restoredFromStorage.current) return
    restoredFromStorage.current = true
    if (queryVideoId || typeof window === 'undefined') return
    const saved = window.localStorage.getItem(SAVED_DOWNLOAD_LINK_KEY)
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time restore of the saved input from localStorage after mount
      setSource(saved)
    }
  }, [queryVideoId])

  const emitDownloadHistory = (payload: {
    status: 'downloading' | 'done' | 'error'
    title: string
    progress?: number
    paused?: boolean
    downloadedBytes?: number
    totalBytes?: number
    sourceVideoId?: string
    sourceItag?: number
    sourceExtension?: string
    sourceOutputBitrate?: number
    sourceUrl?: string
  }) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('nsu-download-status', { detail: payload }))
  }

  const fetchFormats = async (videoId: string) => {
    setLoadingFormats(true)
    setError('')
    setShowFormatList(false)
    try {
      const response = await fetch(`/api/youtube/formats?id=${encodeURIComponent(videoId)}`, { cache: 'no-store' })
      const payload = await response.json() as { title?: string; formats?: DownloadFormat[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to fetch downloadable formats.')
      setTitle(payload.title || '')
      setFormats(payload.formats || [])
      setSelectedFormat(null)
    } catch (loadError) {
      setFormats([])
      setSelectedFormat(null)
      setError(loadError instanceof Error ? loadError.message : 'Unable to fetch downloadable formats.')
    } finally {
      setLoadingFormats(false)
    }
  }

  useEffect(() => {
    const videoId = getVideoId(source)
    if (!videoId) return

    const timer = window.setTimeout(() => void fetchFormats(videoId), 450)
    return () => window.clearTimeout(timer)
  }, [source])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const videoId = getVideoId(source)

    if (!videoId && !getDirectUrl(source)) {
      setError('Enter a valid public media URL or YouTube video link.')
      return
    }

    if (videoId) void fetchFormats(videoId)
  }

  const handleClearSource = () => {
    setSource('')
    setTitle('')
    setFormats([])
    setSelectedFormat(null)
    setShowFormatList(false)
    setError('')
    setLoadingFormats(false)
    window.localStorage.removeItem(SAVED_DOWNLOAD_LINK_KEY)
  }

  const handleDirectDownload = useCallback(async () => {
    const directUrl = getDirectUrl(source)
    if (!directUrl) {
      setError('Enter a complete public HTTP or HTTPS media URL.')
      return
    }

    setLoadingDirectDownload(true)
    setError('')
    const historyTitle = new URL(directUrl).pathname.split('/').pop() || 'download'
    emitDownloadHistory({
      status: 'downloading',
      title: historyTitle,
      progress: 0,
      downloadedBytes: 0,
      paused: false,
      sourceUrl: directUrl,
    })
    try {
      const response = await fetch(`/api/download?url=${encodeURIComponent(directUrl)}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error || 'Unable to download this file.')
      }

      const blob = await response.blob()
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = 'download'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(anchor.href)

      emitDownloadHistory({
        status: 'done',
        title: historyTitle,
        progress: 100,
        downloadedBytes: blob.size,
        totalBytes: blob.size,
        paused: false,
        sourceUrl: directUrl,
      })
    } catch (downloadError) {
      emitDownloadHistory({
        status: 'error',
        title: historyTitle,
        paused: false,
        sourceUrl: directUrl,
      })
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.')
    } finally {
      setLoadingDirectDownload(false)
    }
  }, [source])

  const handleDownload = useCallback((format: DownloadFormat, options?: { resume?: boolean; videoId?: string }) => {
    const videoId = options?.videoId || getVideoId(source)
    if (!videoId) return

    const historyTitle = title || `youtube-${videoId}`
    if (!options?.resume) {
      setLoadingFormat(format.itag)
      setDownloadProgress(0)
      emitDownloadHistory({
        status: 'downloading',
        title: historyTitle,
        progress: 0,
        paused: false,
        totalBytes: format.size ?? undefined,
        downloadedBytes: 0,
        sourceVideoId: videoId,
        sourceItag: format.itag,
        sourceExtension: format.extension,
        sourceOutputBitrate: format.outputBitrate,
      })
    }
    startYoutubeDownload({
      title: historyTitle,
      videoId,
      itag: format.itag,
      extension: format.extension,
      outputBitrate: format.outputBitrate,
      totalBytes: format.size ?? undefined,
    })
  }, [source, title])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleDownloadStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; status?: string; progress?: number; error?: string }>).detail
      if (!detail?.title || detail.title !== title) return
      if (typeof detail.progress === 'number') setDownloadProgress(detail.progress)
      if (detail.error) setError(detail.error)
      if (detail.status === 'done' || detail.status === 'error') setLoadingFormat(null)
    }

    const handleDownloadRetry = (event: Event) => {
      const detail = (event as CustomEvent<DownloadRetryDetail>).detail
      if (!detail) return

      setSource(`https://www.youtube.com/watch?v=${detail.videoId}`)
      setTitle(detail.title)
      void handleDownload(
        {
          itag: detail.itag,
          label: detail.title,
          kind: 'video',
          extension: detail.extension,
          outputBitrate: detail.outputBitrate,
          size: null,
        },
        { videoId: detail.videoId },
      )
    }

    window.addEventListener('nsu-download-status', handleDownloadStatus as EventListener)
    window.addEventListener('nsu-download-retry', handleDownloadRetry as EventListener)
    return () => {
      window.removeEventListener('nsu-download-status', handleDownloadStatus as EventListener)
      window.removeEventListener('nsu-download-retry', handleDownloadRetry as EventListener)
    }
  }, [handleDownload, title])

  const videoId = getVideoId(source)

  return (
    <main className="min-h-screen pb-28 text-primary">
      <DockBar />

      {/* Hero */}
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-6 text-center sm:pt-12 sm:pb-8">
        <div className="mb-4 inline-flex items-center gap-2 sm:gap-3">
          <div className="inline-flex h-8 w-8 xs:h-9 xs:w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
            <Download className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </div>
          <h2 className="text-2xl xs:text-3xl sm:text-5xl font-black tracking-tight text-primary leading-tight">Download Media</h2>
        </div>
        <p className="mt-1 sm:mt-2 text-xs xs:text-sm sm:text-base text-secondry max-w-md mx-auto">
          Paste a YouTube link to browse available formats.
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-6 space-y-5">

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <label htmlFor="download-source" className="sr-only">YouTube video link or ID</label>
          <div className="flex items-center gap-2 rounded-2xl bg-cardcl/80 px-4 py-1 shadow-lg shadow-black/10 backdrop-blur-md focus-within:ring-rose-400/50 focus-within:ring-2">
            <LinkIcon size={16} className="shrink-0 text-secondry" aria-hidden="true" />
            <input
              id="download-source"
              type="text"
              value={source}
              onChange={(event) => {
                const nextSource = event.target.value
                setSource(nextSource)
                if (nextSource.trim()) {
                  window.localStorage.setItem(SAVED_DOWNLOAD_LINK_KEY, nextSource)
                } else {
                  window.localStorage.removeItem(SAVED_DOWNLOAD_LINK_KEY)
                }
                if (!getVideoId(nextSource)) {
                  setFormats([])
                  setTitle('')
                  setSelectedFormat(null)
                  setError('')
                  setLoadingFormats(false)
                }
              }}
              placeholder="https://youtube.com/watch?v=…"
              className="min-w-0 flex-1 bg-transparent py-3.5 text-xs sm:text-sm text-primary outline-none placeholder:text-secondry/40"
              aria-describedby={error ? 'download-error' : undefined}
            />
            {source && (
              <button
                type="button"
                onClick={handleClearSource}
                aria-label="Clear link"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-secondry transition hover:text-primary"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        {/* Status messages */}
        {error && (
          <p id="download-error" className="text-xs sm:text-sm text-red-400" role="alert">{error}</p>
        )}
        {error && videoId && !loadingFormats && (
          <button
            type="button"
            onClick={() => void fetchFormats(videoId)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navlink px-5 py-3 text-xs sm:text-sm font-semibold text-Eltext backdrop-blur-sm transition hover:text-primary hover:ring-card1/40 cursor-pointer"
          >
            <Download size={14} aria-hidden="true" />
            Refresh formats
          </button>
        )}
        {loadingFormats && (
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-secondry">
            <div className="h-4 w-4 rounded-full border-2 border-rose-400 border-t-transparent animate-spin shrink-0" />
            Checking available formats…
          </div>
        )}
        {title && !loadingFormats && (
          <p className="text-xs sm:text-sm font-semibold text-primary truncate">{title}</p>
        )}

        {/* Video preview */}
        {videoId && (
          <div className="overflow-hidden rounded-2xl bg-black shadow-xl shadow-black/30">
            <div className="aspect-video w-full">
              <iframe
                title={title ? `Preview of ${title}` : 'YouTube video preview'}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Direct media preview */}
        {!videoId && getDirectUrl(source) && (
          <MediaPreview key={getDirectUrl(source)} url={getDirectUrl(source)} />
        )}

        {/* Direct URL download */}
        {!videoId && getDirectUrl(source) && !loadingFormats && (
          <button
            type="button"
            onClick={() => void handleDirectDownload()}
            disabled={loadingDirectDownload}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={15} aria-hidden="true" />
            {loadingDirectDownload ? 'Downloading…' : 'Download file'}
          </button>
        )}

        {/* Format sections */}
        {!loadingFormats && !error && formats.length > 0 && (
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10">
                  <Download className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-primary">Select a Format</span>
              </div>
              <div ref={formatListRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowFormatList((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={showFormatList}
                  className="flex w-full items-center gap-3 rounded-2xl border border-card1/15 bg-cardcl/80 px-4 py-3.5 text-left shadow-lg shadow-black/10 backdrop-blur-md transition hover:border-card1/30 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                >
                  {selectedFormat ? (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs sm:text-sm font-semibold text-primary">{selectedFormat.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] sm:text-xs text-secondry">
                        {selectedFormat.kind.replace('+', ' + ')} · {selectedFormat.extension.toUpperCase()}
                        {selectedFormat.size ? ` · ${(selectedFormat.size / 1024 / 1024).toFixed(1)} MB` : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="flex-1 text-xs sm:text-sm text-secondry/60">Choose a format…</span>
                  )}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 text-secondry transition-transform duration-200 ${showFormatList ? 'rotate-180' : ''}`}
                  />
                </button>

                {showFormatList && (
                  <div
                    role="listbox"
                    aria-label="Download format"
                    className="absolute inset-x-0 bottom-full z-20 mb-2 flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl border border-card1/15 bg-backnav/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl"
                    >
                    {(['audio', 'video'] as const).map((section) => {
                      const sectionFormats = formats.filter((format) =>
                        section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video')
                      )
                      if (!sectionFormats.length) return null
                      return (
                        <div key={section} className="flex flex-col gap-1">
                          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-secondry/60">
                            {section} Formats
                          </p>
                          {sectionFormats.map((format) => {
                            const isSelected = selectedFormat != null && formatKey(format) === formatKey(selectedFormat)
                            return (
                              <button
                                key={formatKey(format)}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setSelectedFormat(format)
                                  setShowFormatList(false)
                                  setError('')
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                  isSelected ? 'bg-rose-500/10 text-primary' : 'text-primary hover:bg-white/6'
                                }`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs sm:text-sm font-semibold">{format.label}</span>
                                  <span className="mt-0.5 block truncate text-[10px] sm:text-xs text-secondry">
                                    {format.kind.replace('+', ' + ')}
                                    {format.size ? ` · ${(format.size / 1024 / 1024).toFixed(1)} MB` : ''}
                                  </span>
                                </span>
                                <span
                                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    section === 'audio' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-400/10 text-amber-400'
                                  }`}
                                >
                                  {format.extension}
                                </span>
                                {isSelected && <Check size={14} className="shrink-0 text-rose-400" aria-hidden="true" />}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {selectedFormat && (
              <div className="rounded-2xl border border-card1/15 bg-cardcl/60 px-4 py-3 sm:px-5 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs sm:text-sm font-semibold text-primary">{selectedFormat.label}</p>
                    <p className="mt-0.5 text-[10px] sm:text-xs text-secondry">
                      {selectedFormat.kind.replace('+', ' + ')} · {selectedFormat.extension}
                      {selectedFormat.size ? ` · ${(selectedFormat.size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownload(selectedFormat)}
                    disabled={loadingFormat !== null}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2 text-[11px] sm:text-xs font-semibold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={13} aria-hidden="true" />
                    {loadingFormat === selectedFormat.itag ? 'Preparing…' : 'Download'}
                  </button>
                </div>
                {loadingFormat === selectedFormat.itag && (
                  <div
                    className="mt-3"
                    role="status"
                    aria-label={downloadProgress ? `Download ${downloadProgress}% complete` : 'Download in progress'}
                  >
                    <div className="h-1 overflow-hidden rounded-full bg-card1/20">
                      <div
                        className={`h-full rounded-full bg-rose-500 transition-[width] duration-200 ${
                          downloadProgress ? '' : 'w-1/3 animate-pulse'
                        }`}
                        style={downloadProgress ? { width: `${downloadProgress}%` } : undefined}
                      />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-secondry">
                      {downloadProgress ? `${downloadProgress}%` : 'Preparing…'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => { if (videoId) void fetchFormats(videoId) }}
              className="w-full rounded-xl bg-navlink px-5 py-3 text-xs sm:text-sm font-semibold text-Eltext backdrop-blur-sm transition hover:text-primary hover:ring-card1/40 cursor-pointer"
            >
              Refresh formats
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-cardcl text-primary" />}>
      <DownloadForm />
    </Suspense>
  )
}
