"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mic, MicOff } from 'lucide-react'
import Switchbutton from '@/components/Switchbutton'

interface AudioTrack {
  id: string
  title: string
  album?: string | null
  fileName: string
  fileUrl: string
  createdAt: string
  artistId: string
  artistName: string
  artistGenre?: string | null
  artistProfileUrl?: string | null
}

interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  date: string
  url: string
  type?: string
  views?: number
  source?: "youtube"
}

interface SpeechRecognitionResultItem {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem
  length: number
  isFinal: boolean
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}

interface SpeechRecognitionEventCustom extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEventCustom extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventCustom) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventCustom) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export default function SearchClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const win = window as unknown as WindowWithSpeech
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition

    if (!SpeechRecognition) {
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEventCustom) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      const normalized = transcript.trim()
      if (normalized) {
        setQuery(normalized)
        const params = new URLSearchParams()
        params.set('q', normalized)
        router.replace(`/search?${params.toString()}`)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEventCustom) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const [audioRes, videoRes] = await Promise.all([
          fetch('/api/audio'),
          fetch('/api/youtube/videos?channelId=UCDwZ_ENzU7LIDA5F8EYf1Jg'),
        ])

        const audioData = await audioRes.json()
        const videoData = await videoRes.json()
        const combinedVideos = [
          ...(videoData.videos || []),
          ...(videoData.shorts || []),
        ]

        if (!cancelled) {
          setTracks(audioData.tracks || [])
          setVideos(combinedVideos)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load search sources')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return tracks.filter((track) =>
      [track.title, track.artistName, track.album || '']
        .some((value) => value.toLowerCase().includes(normalized))
    )
  }, [query, tracks])

  const filteredVideos = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return videos.filter((video) =>
      [video.title, video.type || '']
        .some((value) => value.toLowerCase().includes(normalized))
    )
  }, [query, videos])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    const path = `/search${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(path)
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    recognitionRef.current.start()
    setIsListening(true)
  }

  return (
    <main className="min-h-screen pb-28 px-4 py-6 text-primary mx-auto max-w-7xl">
      <Switchbutton searchHref="/search" />

      <section className="rounded-4xl border border-card1/20 bg-cardcl/90 p-6 shadow-2xl shadow-black/10 backdrop-blur-2xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-rose-400">Search</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Search audio, artists, and videos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondry sm:text-base">
              Enter a keyword and view matching audio tracks, artists, and YouTube videos from the app.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full gap-3 sm:w-auto">
            <label htmlFor="searchQuery" className="sr-only">Search query</label>
            <input
              id="searchQuery"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search here..."
              className="min-w-0 flex-1 rounded-3xl border border-card1/20 bg-black/10 px-4 py-3 text-base text-primary outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
            />
            <button
              type="button"
              onClick={toggleListening}
              className={`flex h-12 w-12 items-center justify-center rounded-3xl border border-card1/20 bg-black/10 text-primary transition hover:bg-card1/20 ${isListening ? 'bg-rose-500/20 text-rose-300' : ''}`}
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
              title={isListening ? 'Stop voice search' : 'Start voice search'}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="submit"
              className="rounded-3xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-card1/20 bg-cardcl/50 p-8 text-center text-sm text-secondry">Loading search sources...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-400">{error}</div>
        ) : query.trim() === '' ? (
          <div className="rounded-3xl border border-dashed border-card1/20 bg-cardcl/50 p-8 text-center text-sm text-secondry">
            Search across audio and video content by entering a phrase above.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-card1/20 bg-cardcl/80 p-5">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-card1/15">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Audio results</h2>
                    <p className="mt-1 text-sm text-secondry">
                      {filteredTracks.length} result{filteredTracks.length === 1 ? '' : 's'} found
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
                    Audio
                  </span>
                </div>

                {filteredTracks.length === 0 ? (
                  <p className="py-8 text-center text-sm text-secondry">No audio tracks match your search.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredTracks.map((track) => (
                      <div key={track.id} className="rounded-3xl border border-card1/15 bg-cardcl/70 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-500/10 text-lg font-bold text-rose-300">
                            {track.artistName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-primary">{track.title}</p>
                            <p className="mt-1 text-sm text-secondry">{track.artistName} • {track.album || 'Unknown album'}</p>
                            <p className="mt-2 text-xs text-secondary/70">{new Date(track.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-card1/20 bg-cardcl/80 p-5">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-card1/15">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Video results</h2>
                    <p className="mt-1 text-sm text-secondry">
                      {filteredVideos.length} result{filteredVideos.length === 1 ? '' : 's'} found
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                    Videos
                  </span>
                </div>

                {filteredVideos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-secondry">No videos match your search.</p>
                ) : (
                  <div className="grid gap-4">
                    {filteredVideos.map((video) => (
                      <a
                        key={video.id}
                        href={`/video/${encodeURIComponent(video.id)}`}
                        className="group grid gap-3 rounded-3xl border border-card1/15 bg-cardcl/70 p-4 transition hover:border-rose-400/30"
                      >
                        <div className="relative h-48 overflow-hidden rounded-3xl bg-black">
                          <Image
                            src={video.thumbnail}
                            alt={video.title}
                            fill
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-primary">{video.title}</p>
                          <p className="mt-1 text-sm text-secondry">{video.date ? new Date(video.date).toLocaleDateString() : 'Video'}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="rounded-3xl border border-card1/20 bg-black/10 p-5">
              <h3 className="text-lg font-semibold text-primary">Search notes</h3>
              <p className="mt-3 text-sm leading-6 text-secondry">
                This page loads the available audio track and video sources, then filters them in the browser.
                Use a few keywords to narrow the results.
              </p>
              <div className="mt-5 space-y-3 text-sm text-secondry">
                <div className="rounded-2xl bg-cardcl/60 p-3">
                  <p className="font-semibold text-primary">Tip</p>
                  <p>Try artist names, track titles, or video keywords.</p>
                </div>
                <div className="rounded-2xl bg-cardcl/60 p-3">
                  <p className="font-semibold text-primary">Open from anywhere</p>
                  <p>The search button navigates to this page from any page with the Switchbutton component.</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
