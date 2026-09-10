"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mic, MicOff, Music2, Video, Search } from 'lucide-react'
import Switchbutton from '@/components/Switchbutton'
import AudioPlayer from '@/components/AudioPlayer'

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/)
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url
}

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

function SearchClient() {
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

    if (!SpeechRecognition) return

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
    <main className="min-h-screen pb-28 text-primary">
      <Switchbutton searchHref="/search" />

      {/* Hero header */}
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-6 text-center sm:pt-12 sm:pb-8">
        <p className="text-[10px] xs:text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-rose-400 mb-2">Discover</p>
        <h2 className="text-2xl xs:text-3xl sm:text-5xl font-black tracking-tight text-primary leading-tight">
          Audio <span className="text-rose-400">&</span> Videos
        </h2>
        <p className="mt-2 sm:mt-3 text-xs xs:text-sm sm:text-base text-secondry max-w-md mx-auto">
          Search tracks, artists, and videos all in one place.
        </p>

        {/* Search bar + mic */}
        <div className="mt-6 sm:mt-8 flex items-center gap-2">
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2 rounded-2xl bg-cardcl/80 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur-md focus-within:border-rose-400/60 focus-within:ring-2 focus-within:ring-rose-400/15 transition">
            <Search className="h-4 w-4 shrink-0 text-secondry" />
            <label htmlFor="searchQuery" className="sr-only">Search query</label>
            <input
              id="searchQuery"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a song, artist, or video…"
              className="min-w-0 flex-1 bg-transparent py-1 text-sm sm:text-base text-primary placeholder:text-secondry/50 outline-none"
            />
          </form>
          <button
            type="button"
            onClick={toggleListening}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
              isListening
                ? 'bg-rose-500/15 text-rose-400'
                : 'bg-cardcl/80 text-secondry hover:text-primary'
            } shadow-lg shadow-black/10 backdrop-blur-md`}
            aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
            title={isListening ? 'Stop voice search' : 'Start voice search'}
            >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Results area */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-card1/20 bg-cardcl/40 py-20 text-center backdrop-blur-sm">
            <div className="h-6 w-6 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
            <p className="text-xs sm:text-sm text-secondry">Loading search sources…</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-5 text-xs sm:text-sm text-red-400">{error}</div>
        ) : query.trim() === '' ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-card1/20 bg-cardcl/40 py-20 text-center backdrop-blur-sm">
            <Search className="h-8 w-8 text-secondry/40" />
            <p className="text-xs sm:text-sm text-secondry">Start typing to search across audio and video content.</p>
          </div>
        ) : (
          <>
            {/* Audio results */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10">
                  <Music2 className="h-4 w-4 text-rose-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-primary">Tracks</h3>
                  <p className="text-[10px] sm:text-[11px] text-secondry">{filteredTracks.length} result{filteredTracks.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              {filteredTracks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-card1/20 bg-cardcl/40 py-10 text-center text-xs sm:text-sm text-secondry">
                  No audio tracks match your search.
                </div>
              ) : (
                <div className="rounded-2xl border border-card1/15 bg-cardcl/60 overflow-hidden backdrop-blur-sm">
                  {filteredTracks.map((track) => (
                    <AudioPlayer
                      key={track.id}
                      src={getPlayableAudioUrl(track.fileUrl)}
                      fileUrl={track.fileUrl}
                      title={track.title}
                      album={track.album}
                      fileName={track.fileName}
                      createdAt={track.createdAt}
                      artistName={track.artistName}
                      artistGenre={track.artistGenre}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Video results */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10">
                  <Video className="h-4 w-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-primary">Videos</h3>
                  <p className="text-[10px] sm:text-[11px] text-secondry">{filteredVideos.length} result{filteredVideos.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-card1/20 bg-cardcl/40 py-10 text-center text-xs sm:text-sm text-secondry">
                  No videos match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredVideos.map((video) => (
                    <a
                      key={video.id}
                      href={`/video/${encodeURIComponent(video.id)}`}
                      className="group flex flex-col rounded-2xl border border-card1/15 bg-cardcl/60 overflow-hidden backdrop-blur-sm transition hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-400/5"
                    >
                      <div className="relative h-44 sm:h-48 overflow-hidden bg-black">
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-3 sm:p-4">
                        <p className="text-xs sm:text-sm font-semibold text-primary line-clamp-2 leading-snug">{video.title}</p>
                        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-secondry">
                          {video.date ? new Date(video.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Video'}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pb-28 px-4 py-6 text-primary mx-auto max-w-7xl">Loading search…</div>}>
      <SearchClient />
    </Suspense>
  )
}
