"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mic, MicOff } from 'lucide-react'
import Switchbutton from '@/components/Switchbutton'
import AudioPlayer from '@/components/AudioPlayer'

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
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
    <main className="min-h-screen pb-28 px-2 sm:px-4 py-4 sm:py-6 text-primary mx-auto max-w-7xl">
      <Switchbutton searchHref="/search" />

      <section className="rounded-3xl border border-card1/20 bg-cardcl/90 p-1 shadow-2xl shadow-black/15 backdrop-blur-2xl">
        <div className="mb-6 sm:mb-8 p-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.24em] sm:tracking-[0.32em] text-rose-400">Search</p>
            <span className="mt-1 sm:mt-2 text-2xl font-bold tracking-tight text-primary sm:text-4xl">
              Audio & Videos
            </span>
            <p className="mt-2 sm:mt-3 max-w-2xl text-xs sm:text-base leading-5 sm:leading-6 text-secondry">
              Enter a keyword and view matching Audio tracks, Comedies & videos from the app.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-wrap sm:flex-nowrap w-full gap-2 sm:gap-3 sm:w-auto">
            <label htmlFor="searchQuery" className="sr-only">Search query</label>
            <input
              id="searchQuery"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search here..."
              className="min-w-0 flex-1 rounded-2xl sm:rounded-3xl border border-card1/20 bg-black/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-primary outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl sm:rounded-3xl border border-card1/20 bg-black/10 text-primary transition hover:bg-card1/20 ${isListening ? 'bg-rose-500/20 text-rose-300' : ''}`}
                aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
                title={isListening ? 'Stop voice search' : 'Start voice search'}
                >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
          </form>

        </div>

        {loading ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-card1/20 bg-cardcl/50 p-6 sm:p-8 text-center text-xs sm:text-sm text-secondry">Loading search sources...</div>
        ) : error ? (
          <div className="rounded-2xl sm:rounded-3xl border border-red-500/30 bg-red-500/5 p-4 sm:p-6 text-xs sm:text-sm text-red-400">{error}</div>
        ) : query.trim() === '' ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-card1/20 bg-cardcl/50 p-6 sm:p-8 text-center text-xs sm:text-sm text-secondry">
            Search across audio and video content by entering a phrase above.
          </div>
        ) : (
          <div>
            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-2xl sm:rounded-3xl border border-card1/20 bg-cardcl/80 p-1 sm:p-5">
                <div className="flex items-center justify-between gap-4 pb-3 mt-2 sm:pb-4 border-b border-card1/15">
                  <div>
                    <span className="text-lg px-2 sm:text-xl font-semibold text-primary">Audios</span>
                    <p className="mt-0.5 px-2 text-xs sm:text-sm text-secondry">
                      {filteredTracks.length} result{filteredTracks.length === 1 ? '' : 's'} found
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-500/10 px-2.5 sm:px-3 py-.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-rose-300">
                    Audio
                  </span>
                </div>

                {filteredTracks.length === 0 ? (
                  <p className="py-6 sm:py-8 text-center text-xs sm:text-sm text-secondry">No audio tracks match your search.</p>
                ) : (
                  <div className="space-y-1 mt-3">
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
              </div>

              <div className="rounded-2xl sm:rounded-3xl border border-card1/20 bg-cardcl/80 p-1 sm:p-5">
                <div className="flex items-center justify-between gap-4 pb-3 sm:pb-4 border-b border-card1/15">
                  <div>
                    <h2 className="text-lg px-2 mt-4 sm:text-xl font-semibold text-primary">Videos</h2>
                    <p className="mt-0.5 px-2 text-xs sm:text-sm text-secondry">
                      {filteredVideos.length} result{filteredVideos.length === 1 ? '' : 's'} found
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-400/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-amber-300">
                    Videos
                  </span>
                </div>

                {filteredVideos.length === 0 ? (
                  <p className="py-6 sm:py-8 text-center text-xs sm:text-sm text-secondry">No videos match your search.</p>
                ) : (
                  <div className="grid gap-1 sm:gap-4 mt-3">
                    {filteredVideos.map((video) => (
                      <a
                        key={video.id}
                        href={`/video/${encodeURIComponent(video.id)}`}
                        className="group grid gap-2.5 sm:gap-3 rounded-2xl sm:rounded-3xl border border-card1/15 bg-cardcl/70 p-3 sm:p-4 transition hover:border-rose-400/30"
                      >
                        <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl sm:rounded-3xl bg-black">
                          <Image
                            src={video.thumbnail}
                            alt={video.title}
                            fill
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-semibold text-primary">{video.title}</p>
                          <p className="mt-0.5 text-xs sm:text-sm text-secondry">{video.date ? new Date(video.date).toLocaleDateString() : 'Video'}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </section>
    </main>
  )
}

