'use client'

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Link as LinkIcon } from 'lucide-react'
import Switchbutton from '../../../components/Switchbutton'

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

type DownloadFormat = {
  itag: number
  label: string
  kind: string
  extension: string
  outputBitrate?: number
  size: number | null
}

type DownloadControlDetail = {
  title: string
  action: 'pause' | 'resume'
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
  const [source, setSource] = useState(() => searchParams.get('video') || '')
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [formats, setFormats] = useState<DownloadFormat[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [loadingFormat, setLoadingFormat] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const progressRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeDownloadRef = useRef<{ title: string; format: DownloadFormat; videoId: string } | null>(null)
  const chunksRef = useRef<Uint8Array[]>([])
  const pausedRef = useRef(false)

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
      const response = await fetch(`/api/youtube/formats?id=${encodeURIComponent(videoId)}`)
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

    if (!videoId) {
      setError('Enter a valid YouTube video URL or 11-character video ID.')
      return
    }

    void fetchFormats(videoId)
  }

  const handleDownload = useCallback(async (format: DownloadFormat, options?: { resume?: boolean }) => {
    const videoId = getVideoId(source)
    if (!videoId) return

    const historyTitle = title || `youtube-${videoId}`
    activeDownloadRef.current = { title: historyTitle, format, videoId }

    if (!options?.resume) {
      chunksRef.current = []
      setLoadingFormat(format.itag)
      setDownloadProgress(0)
      progressRef.current = 0
      pausedRef.current = false
      emitDownloadHistory({ status: 'downloading', title: historyTitle, progress: 0, paused: false, totalBytes: format.size ?? undefined, downloadedBytes: 0, sourceVideoId: videoId, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate })
    } else {
      setLoadingFormat(format.itag)
      emitDownloadHistory({ status: 'downloading', title: historyTitle, progress: progressRef.current, paused: false, totalBytes: format.size ?? undefined, sourceVideoId: videoId, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate })
    }

    try {
      const downloadUrl = `/api/youtube/download?id=${encodeURIComponent(videoId)}&itag=${format.itag}&output=${format.extension}&bitrate=${format.outputBitrate || ''}`
      const filename = `${historyTitle}.${format.extension || 'mp4'}`

      const controller = new AbortController()
      abortControllerRef.current = controller
      const response = await fetch(downloadUrl, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || response.statusText || 'Unable to download this video.')
      }

      const total = Number(response.headers.get('content-length'))
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Unable to start download.')

      const chunks = chunksRef.current
      let loaded = 0
      let lastProgress = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          loaded += value.length
          if (total && total > 0) {
            const nextProgress = Math.min(100, Math.round((loaded / total) * 100))
            if (nextProgress !== lastProgress) {
              lastProgress = nextProgress
              progressRef.current = nextProgress
              setDownloadProgress(nextProgress)
              emitDownloadHistory({ status: 'downloading', title: historyTitle, progress: nextProgress, paused: false, downloadedBytes: loaded, totalBytes: total || format.size || undefined, sourceVideoId: videoId, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate })
            }
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[])
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = filename
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(anchor.href)

      setDownloadProgress(100)
      progressRef.current = 100
      chunksRef.current = []
      activeDownloadRef.current = null
      emitDownloadHistory({ status: 'done', title: historyTitle, progress: 100, paused: false, downloadedBytes: blob.size, totalBytes: blob.size, sourceVideoId: videoId, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate })
    } catch (downloadError) {
      if (downloadError instanceof Error && downloadError.name === 'AbortError' && pausedRef.current) {
        return
      }
      const currentProgress = progressRef.current
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this video.')
      chunksRef.current = []
      activeDownloadRef.current = null
      emitDownloadHistory({ status: 'error', title: historyTitle, progress: currentProgress, paused: false, sourceVideoId: videoId, sourceItag: format.itag, sourceExtension: format.extension, sourceOutputBitrate: format.outputBitrate })
    } finally {
      abortControllerRef.current = null
      if (!pausedRef.current) {
        setLoadingFormat(null)
      }
    }
  }, [source, title])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleDownloadControl = (event: Event) => {
      const detail = (event as CustomEvent<DownloadControlDetail>).detail
      const activeDownload = activeDownloadRef.current
      if (!detail || !activeDownload || detail.title !== activeDownload.title) return

      if (detail.action === 'pause') {
        pausedRef.current = true
        abortControllerRef.current?.abort()
        emitDownloadHistory({
          status: 'downloading',
          title: activeDownload.title,
          progress: progressRef.current,
          paused: true,
        })
        return
      }

      if (detail.action === 'resume') {
        pausedRef.current = false
        void handleDownload(activeDownload.format, { resume: true })
      }
    }

    const handleDownloadRetry = (event: Event) => {
      const detail = (event as CustomEvent<DownloadRetryDetail>).detail
      if (!detail) return

      setSource(`https://www.youtube.com/watch?v=${detail.videoId}`)
      setTitle(detail.title)
      void handleDownload({
        itag: detail.itag,
        label: detail.title,
        kind: 'video',
        extension: detail.extension,
        outputBitrate: detail.outputBitrate,
        size: null,
      })
    }

    window.addEventListener('nsu-download-control', handleDownloadControl as EventListener)
    window.addEventListener('nsu-download-retry', handleDownloadRetry as EventListener)
    return () => {
      window.removeEventListener('nsu-download-control', handleDownloadControl as EventListener)
      window.removeEventListener('nsu-download-retry', handleDownloadRetry as EventListener)
    }
  }, [handleDownload])

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

  return (
    <main className="min-h-screen pt-2 text-primary">
          <Switchbutton />

          <section className="mx-auto max-w-5xl px-1">
            <div className="rounded-3xl border border-card1/20 bg-linear-to-br from-cardcl via-cardcl to-rose-950/30 p-6 shadow-2xl shadow-black/30 sm:p-10">
              <div className="mb-8 flex h-[clamp(2.75rem,8vw,3.5rem)] w-[clamp(2.75rem,8vw,3.5rem)] items-center justify-center rounded-[clamp(0.75rem,2vw,1rem)] border border-rose-500/30 bg-rose-500/10 text-rose-400">
                <Download className="h-[50%] w-[50%]" aria-hidden="true" />
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-400">Noll Studio Downloads</p>
              <span className="mt-3 text-2xl font-bold text-primary sm:text-5xl">Download your media</span>
              <p className="mt-4 w-full max-w-xl text-balance text-xs leading-relaxed text-secondry sm:text-sm md:text-base">
                Paste a YouTube video link or ID to see the formats YouTube makes available.
              </p>

              <form onSubmit={handleSubmit} className="mt-4 space-y-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-primary">YouTube video</span>
                  <span className="flex items-center gap-3 rounded-xl border border-card1/20 bg-cardcl/80 px-4 transition focus-within:border-rose-500">
                    <LinkIcon size={18} className="shrink-0 text-secondry" aria-hidden="true" />
                    <input
                      type="text"
                      value={source}
                      onChange={(event) => {
                        setSource(event.target.value)
                        if (!getVideoId(event.target.value)) {
                          setFormats([])
                          setTitle('')
                          setError('')
                        }
                      }}
                      placeholder="https://youtube.com/watch?v=..."
                      className="min-w-0 flex-1 bg-transparent py-4 text-sm text-primary outline-none placeholder:text-secondry/60"
                      aria-describedby={error ? 'download-error' : undefined}
                    />
                  </span>
                </label>

                {error && <p id="download-error" className="text-sm text-red-400" role="alert">{error}</p>}
                {loadingFormats && <p className="text-sm text-secondry">Checking available formats...</p>}
                {title && <p className="text-sm font-semibold text-primary">{title}</p>}
                {!loadingFormats && !error && (['audio', 'video'] as const).map((section) => {
                  const sectionFormats = formats.filter((format) => section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video'))
                  if (!sectionFormats.length) return null
                  return (
                    <div key={section} className="space-y-3">
                      <h2 className="border-b border-card1/20 pb-2 text-sm font-bold uppercase tracking-wider text-rose-300">{section} formats</h2>
                      {sectionFormats.map((format) => {
                        const isPreparing = loadingFormat === format.itag;

                        return (
                          <div key={`${format.itag}-${format.extension}`} className="rounded-xl border border-card1/20 bg-cardcl/70 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-primary">
                                  {format.label} {format.extension.toUpperCase()}
                                </p>
                                <p className="mt-1 text-xs text-secondry">
                                  {format.kind.replace('+', ' + ')}
                                  {format.size ? ` • ${(format.size / 1024 / 1024).toFixed(1)} MB` : ''}
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
                                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60 cursor-pointer"
                              >
                                <Download size={15} aria-hidden="true" />
                                {isPreparing ? 'Preparing...' : 'Download'}
                              </button>
                            </div>
                            {loadingFormat === format.itag && (
                              <div
                                className="mt-3"
                                role="status"
                                aria-label={downloadProgress ? `Download ${downloadProgress}% complete` : 'Download in progress'}
                              >
                                <div className="h-1.5 overflow-hidden rounded-full bg-card1/20">
                                  <div
                                    className={`h-full rounded-full bg-rose-500 transition-[width] duration-200 ${downloadProgress ? '' : 'w-1/3 animate-pulse'}`}
                                    style={downloadProgress ? { width: `${downloadProgress}%` } : undefined}
                                  />
                                </div>
                                <p className="mt-1 text-right text-[10px] text-secondry">
                                  {downloadProgress ? `${downloadProgress}%` : 'Preparing download...'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                })}
                <button type="submit" className="w-full rounded-xl border border-card1/20 px-5 py-3 text-sm font-semibold text-primary transition hover:border-rose-500 hover:text-white cursor-pointer">
                  Refresh formats
                </button>
              </form>
            </div>
          </section>
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
