"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mic, MicOff, Music2, Video, Search, Mic2, ChevronRight } from 'lucide-react'
import DockBar from '@/components/DockBar'
import AudioRow from '@/components/AudioRow'
import { playerTrackFor } from '@/lib/audio-player'

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/)
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url
}

function formatVideoDate(date: string) {
  if (!date) return 'Video'
  const parsed = new Date(date)
  return isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
  featuredArtistName?: string | null
  artistGenre?: string | null
  artistProfileUrl?: string | null
  thumbnailUrl?: string | null
  downloadCount?: number
}

interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  date: string
  url: string
  type?: 'short' | 'official'
  views?: number
  source?: 'youtube'
}

interface SearchArtist {
  id: string
  name: string
  genre: string
  tracksCount: number
  status: string
  profileUrl?: string | null
}

interface SearchResponse {
  tracks?: AudioTrack[]
  artists?: SearchArtist[]
  videos?: YouTubeVideo[]
  dbAvailable?: boolean
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
  const [artists, setArtists] = useState<SearchArtist[]>([])
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
  }, [])

  // Debounced, real-time search against the server as the user types.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    const normalized = query.trim()

    debounceRef.current = window.setTimeout(() => {
      if (!normalized) {
        setTracks([])
        setArtists([])
        setVideos([])
        setSearching(false)
        setError(null)
        const currentParams = new URLSearchParams(window.location.search)
        if (currentParams.has('q')) {
          currentParams.delete('q')
          const search = currentParams.toString()
          router.replace(`/search${search ? `?${search}` : ''}`, { scroll: false })
        }
        return
      }

      setSearching(true)
      const controller = new AbortController()
      abortRef.current = controller

      void (async () => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, {
            cache: 'no-store',
            signal: controller.signal,
          })
          if (controller.signal.aborted || !response.ok) return

          const data = (await response.json()) as SearchResponse
          if (controller.signal.aborted) return

          setTracks(data.tracks ?? [])
          setArtists(data.artists ?? [])
          setVideos(data.videos ?? [])
          setError(null)

          const params = new URLSearchParams(window.location.search)
          if ((params.get('q') ?? '') !== normalized) {
            params.set('q', normalized)
            router.replace(`/search?${params.toString()}`, { scroll: false })
          }
        } catch (err) {
          if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
          setError(err instanceof Error ? err.message : 'Unable to search')
        } finally {
          if (!controller.signal.aborted) setSearching(false)
        }
      })()
    }, normalized ? 250 : 0)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, router])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = query.trim()
    if (!normalized) return
    const params = new URLSearchParams(window.location.search)
    params.set('q', normalized)
    router.replace(`/search?${params.toString()}`, { scroll: false })
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

  const hasResults =
    tracks.length > 0 || artists.length > 0 || videos.length > 0 || searching

  const artistCountText = useMemo(
    () => `${tracks.length}${artists.length > 0 ? ` · ${artists.length} artist${artists.length === 1 ? '' : 's'}` : ''}`,
    [tracks.length, artists.length],
  )

  const playerQueue = tracks
    .filter((track) => track.fileUrl)
    .map((track) => playerTrackFor(
      track.id,
      track.title,
      getPlayableAudioUrl(track.fileUrl),
      {
        artist: track.featuredArtistName
          ? `${track.artistName} ft ${track.featuredArtistName}`
          : track.artistName,
        thumbnailUrl: track.thumbnailUrl ?? undefined,
        fileUrl: track.fileUrl,
        fileName: track.fileName ?? undefined,
      },
    ))

  return (
    <main className="min-h-screen pb-28 text-primary">
      <DockBar searchHref="/search" />

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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm sm:text-base text-primary placeholder:text-secondry/50 outline-none"
            />
            {searching && (
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" aria-label="Searching" />
            )}
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
        {error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-5 text-xs sm:text-sm text-red-400">{error}</div>
        ) : query.trim() === '' ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-card1/20 bg-cardcl/40 py-20 text-center backdrop-blur-sm">
            <Search className="h-8 w-8 text-secondry/40" />
            <p className="text-xs sm:text-sm text-secondry">Start typing to search across audio and video content.</p>
          </div>
        ) : searching && !hasResults ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-card1/20 bg-cardcl/40 py-20 text-center backdrop-blur-sm">
            <div className="h-6 w-6 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
            <p className="text-xs sm:text-sm text-secondry">Searching…</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-card1/20 bg-cardcl/40 py-20 text-center backdrop-blur-sm">
            <Search className="h-8 w-8 text-secondry/40" />
            <p className="text-xs sm:text-sm text-secondry">No results for “{query.trim()}”.</p>
          </div>
        ) : (
          <>
            {/* Audio results */}
            {tracks.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10">
                    <Music2 className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-primary">Tracks</h3>
                    <p className="text-[10px] sm:text-[11px] text-secondry">{artistCountText}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-card1/15 bg-cardcl/60 overflow-hidden backdrop-blur-sm">
                  {tracks.map((track) => (
                    <AudioRow
                      key={track.id}
                      src={getPlayableAudioUrl(track.fileUrl)}
                      fileUrl={track.fileUrl}
                      title={track.title}
                      album={track.album}
                      fileName={track.fileName}
                      createdAt={track.createdAt}
                      artistName={track.artistName}
                      featuredArtistName={track.featuredArtistName}
                      artistGenre={track.artistGenre}
                      thumbnailUrl={track.thumbnailUrl ?? undefined}
                      downloadCount={track.downloadCount}
                      playerQueue={playerQueue}
                      playerQueueIndex={playerQueue.findIndex((q) => q.id === track.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Artist results */}
            {artists.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-navlink/10">
                    <Mic2 className="h-4 w-4 text-navlink" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-primary">Artists</h3>
                    <p className="text-[10px] sm:text-[11px] text-secondry">{artists.length} result{artists.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {artists.map((artist) => (
                    <a
                      key={artist.id}
                      href={`/artist/${encodeURIComponent(artist.id)}`}
                      className="group flex items-center gap-3 rounded-2xl border border-card1/15 bg-cardcl/60 px-4 py-3 backdrop-blur-sm transition hover:border-navlink/30 hover:shadow-lg hover:shadow-navlink/5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-navlink/20 to-glow/10 text-sm font-bold text-navlink">
                        {artist.profileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artist.profileUrl} alt={artist.name} className="h-full w-full object-cover" />
                        ) : (
                          artist.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs sm:text-sm font-semibold text-primary group-hover:text-navlink transition-colors">
                          {artist.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-secondry/60 sm:text-xs">
                          {artist.genre} · {artist.tracksCount} track{artist.tracksCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-secondry/25 group-hover:text-navlink/60 group-hover:translate-x-0.5 transition-all duration-200" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Video results */}
            {videos.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10">
                    <Video className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-primary">Videos</h3>
                    <p className="text-[10px] sm:text-[11px] text-secondry">{videos.length} result{videos.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {videos.map((video) => (
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
                          unoptimized
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        {video.type === 'short' && (
                          <span className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-white/10">
                            SHORT
                          </span>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <p className="text-xs sm:text-sm font-semibold text-primary line-clamp-2 leading-snug">{video.title}</p>
                        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] text-secondry">
                          {formatVideoDate(video.date)}
                          {video.views ? <> · {video.views.toLocaleString()} views</> : null}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
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