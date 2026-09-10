'use client'

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Link as LinkIcon, X } from 'lucide-react'
import Switchbutton from '../../../components/Switchbutton'
import { startYoutubeDownload } from '@/lib/youtube-download-manager'

const SAVED_DOWNLOAD_LINK_KEY = 'nsu-download-link'

function getVideoId(value: string) {
  const trimmedValue = value.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedValue)) return trimmedValue

  try {
    const url = new URL(trimmedValue)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0]
    if (url.hostname.endsWith('youtube.com')) {
      return url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || ''
    }
  } catch {
    return ''
  }

  return ''
}

function getDirectUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
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

function DownloadForm() {
  const searchParams = useSearchParams()
  const [source, setSource] = useState(() => {
    const querySource = searchParams.get('video')
    if (querySource) return querySource

    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(SAVED_DOWNLOAD_LINK_KEY) || ''
  })
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [formats, setFormats] = useState<DownloadFormat[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [loadingFormat, setLoadingFormat] = useState<number | null>(null)
  const [loadingDirectDownload, setLoadingDirectDownload] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
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
  }) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('nsu-download-status', { detail: payload }))
  }

  const fetchFormats = async (videoId: string) => {
    setLoadingFormats(true)
    setError('')
    try {
      const response = await fetch(`/api/youtube/formats?id=${encodeURIComponent(videoId)}`, { cache: 'no-store' })
      const payload = await response.json() as { title?: string; formats?: DownloadFormat[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to fetch downloadable formats.')
      setTitle(payload.title || '')
      setFormats(payload.formats || [])
    } catch (loadError) {
      setFormats([])
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
    } catch (downloadError) {
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

  const handleFormatButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    const itag = Number(button.dataset.itag)
    const extension = button.dataset.extension || ''
    const kind = button.dataset.kind || 'video'
    const outputBitrate = button.dataset.outputBitrate ? Number(button.dataset.outputBitrate) : undefined
    const size = button.dataset.size ? Number(button.dataset.size) : null
    const label = button.dataset.label || 'Download'

    if (!Number.isFinite(itag) || !extension) {
      return
    }

    void handleDownload({
      itag,
      label,
      kind,
      extension,
      outputBitrate,
      size,
    })
  }, [handleDownload])

  const videoId = getVideoId(source)

  return (
    <main className="min-h-screen pb-28 text-primary">
      <Switchbutton />

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
          <div className="space-y-6">
            {(['audio', 'video'] as const).map((section) => {
              const sectionFormats = formats.filter((format) =>
                section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video')
              )
              if (!sectionFormats.length) return null
              return (
                <section key={section}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                      section === 'audio' ? 'bg-rose-500/10' : 'bg-amber-400/10'
                    }`}>
                      <Download className={`h-3.5 w-3.5 ${
                        section === 'audio' ? 'text-rose-400' : 'text-amber-400'
                      }`} aria-hidden="true" />
                    </div>
                    <h2 className="text-xs sm:text-sm font-bold text-primary capitalize">{section} Formats</h2>
                  </div>

                  <div className="rounded-2xl border border-card1/15 bg-cardcl/60 overflow-hidden backdrop-blur-sm divide-y divide-card1/10">
                    {sectionFormats.map((format) => {
                      const isPreparing = loadingFormat === format.itag
                      return (
                        <div
                          key={`${format.itag}-${format.extension}-${format.outputBitrate || 'source'}`}
                          className="px-4 py-3 sm:px-5 sm:py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-primary">
                                {format.label}{' '}
                                <span className="text-[10px] sm:text-xs font-bold uppercase text-secondry">{format.extension}</span>
                              </p>
                              <p className="mt-0.5 text-[10px] sm:text-xs text-secondry">
                                {format.kind.replace('+', ' + ')}
                                {format.size ? ` · ${(format.size / 1024 / 1024).toFixed(1)} MB` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleFormatButtonClick}
                              data-itag={String(format.itag)}
                              data-extension={format.extension}
                              data-kind={format.kind}
                              data-output-bitrate={format.outputBitrate != null ? String(format.outputBitrate) : undefined}
                              data-size={format.size != null ? String(format.size) : undefined}
                              data-label={format.label}
                              disabled={loadingFormat !== null}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2 text-[11px] sm:text-xs font-semibold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Download size={13} aria-hidden="true" />
                              {isPreparing ? 'Preparing…' : 'Download'}
                            </button>
                          </div>
                          {isPreparing && (
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
                      )
                    })}
                  </div>
                </section>
              )
            })}

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
