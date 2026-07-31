'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
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

function DownloadForm() {
  const searchParams = useSearchParams()
  const [source, setSource] = useState(() => searchParams.get('video') || '')
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [formats, setFormats] = useState<DownloadFormat[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [loadingFormat, setLoadingFormat] = useState<number | null>(null)

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

  const handleDownload = async (format: DownloadFormat) => {
    const videoId = getVideoId(source)
    if (!videoId) return
    setLoadingFormat(format.itag)
    try {
      const response = await fetch(`/api/youtube/download?id=${encodeURIComponent(videoId)}&itag=${format.itag}&output=${format.extension}&bitrate=${format.outputBitrate || ''}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || 'Unable to download this video.')
      }

      const filenameHeader = response.headers.get('Content-Disposition') || ''
      const encodedFilename = filenameHeader.match(/filename\*=UTF-8''([^;]+)/)?.[1]
      const filename = encodedFilename ? decodeURIComponent(encodedFilename) : `${title || `youtube-${videoId}`}.mp4`
      const blobUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this video.')
    } finally {
      setLoadingFormat(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-32 pt-24 text-slate-100">
      <Switchbutton />

      <section className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-slate-800 bg-linear-to-br from-slate-900 via-slate-900 to-rose-950/30 p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <Download size={28} aria-hidden="true" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-400">Noll Studio Downloads</p>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-5xl">Download your media</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Paste a YouTube video link or ID to see the formats YouTube makes available.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">YouTube video</span>
              <span className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-4 transition focus-within:border-rose-500">
                <LinkIcon size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
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
                  className="min-w-0 flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600"
                  aria-describedby={error ? 'download-error' : undefined}
                />
              </span>
            </label>

            {error && <p id="download-error" className="text-sm text-red-400" role="alert">{error}</p>}
            {loadingFormats && <p className="text-sm text-slate-400">Checking available formats...</p>}
            {title && <p className="text-sm font-semibold text-white">{title}</p>}
            {!loadingFormats && !error && (['audio', 'video'] as const).map((section) => {
              const sectionFormats = formats.filter((format) => section === 'audio' ? !format.kind.includes('video') : format.kind.includes('video'))
              if (!sectionFormats.length) return null
              return (
                <div key={section} className="space-y-3">
                  <h2 className="border-b border-slate-700 pb-2 text-sm font-bold uppercase tracking-wider text-rose-300">{section} formats</h2>
                  {sectionFormats.map((format) => (
                    <div key={`${format.itag}-${format.extension}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{format.label} {format.extension.toUpperCase()}</p>
                        <p className="mt-1 text-xs text-slate-500">{format.kind.replace('+', ' + ')}{format.size ? ` • ${(format.size / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                      </div>
                      <button type="button" onClick={() => void handleDownload(format)} disabled={loadingFormat !== null} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60">
                        <Download size={15} aria-hidden="true" />
                        {loadingFormat === format.itag ? 'Preparing...' : 'Download'}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
            <button type="submit" className="w-full rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white">
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
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <DownloadForm />
    </Suspense>
  )
}
