'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getArtistById } from '@/lib/artists';
import { extractAudioCoverArt } from '@/lib/audio-cover';
import { ARTIST_STATUS_OPTIONS, getArtistStatusStyle } from '@/lib/artist-status';
import ArtistProfileLoading from '@/components/ArtistProfileLoading';
import ShareDot from '@/components/ShareDot';
import { setPinnedTrackFileUrls, togglePinnedTrackFileUrl, usePinnedTrackFileUrls } from '@/lib/pinned-tracks';

interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  bio: string;
  followers: number;
  featuredTrack: string;
  monthlyListeners: number;
  bannerUrl?: string | null;
  profileUrl?: string | null;
}

interface Track {
  id: string;
  kind?: string;
  title: string;
  album: string;
  fileName: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  featuredArtistName?: string | null;
  featuredArtistId?: string | null;
  ownerArtistId?: string | null;
  ownerArtistName?: string | null;
  isShared?: boolean;
  downloadCount?: number;
  createdAt?: string;
  uploadedAt: string;
}

const DEFAULT_TRACK_THUMBNAIL = '/noll.jpg';

function getDisplayImageUrl(url: string | null | undefined) {
  if (!url) return null;

  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1]
    ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`
    : url;
}

function getPlayableAudioUrl(url: string | null | undefined) {
  if (!url) return null;

  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const ensureAuthorized = async () => {
      try {
        const response = await fetch('/api/dashboard/session', { cache: 'no-store', credentials: 'same-origin' });

        if (!response.ok) {
          const isUnauthorized = response.status === 401 || response.status === 403;
          if (isUnauthorized && !cancelled) {
            const storedUser = window.localStorage.getItem('nsu_user');
            if (!storedUser) {
              window.location.href = '/dashboard';
            }
          }
          return;
        }
      } catch {
        if (!cancelled) {
          // Keep the artist page visible instead of bouncing back to the dashboard
          // when a network or backend error prevents the session check from resolving.
          return;
        }
      }
    };

    void ensureAuthorized();

    return () => {
      cancelled = true;
    };
  }, []);

  // Image State Management
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<File | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<File | null>(null);

  // File Input Refs for Images
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // All Artists List for Featured Artist Dropdown
  const [allArtists, setAllArtists] = useState<{ id: string; name: string }[]>([]);

  // Music Tracks State Management (Initialized empty)
  const [tracks, setTracks] = useState<Track[]>([]);

  // Music Upload State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [featuredArtistName, setFeaturedArtistName] = useState('');
  const [featuredDropdownOpen, setFeaturedDropdownOpen] = useState(false);
  const [featuredSearchText, setFeaturedSearchText] = useState('');
  const featuredDropdownRef = useRef<HTMLDivElement>(null);
  const [albumName, setAlbumName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [processMessage, setProcessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Save Changes State
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditingArtistName, setIsEditingArtistName] = useState(false);
  const [artistNameDraft, setArtistNameDraft] = useState('');
  const [isEditingGenre, setIsEditingGenre] = useState(false);
  const [artistGenreDraft, setArtistGenreDraft] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitleDraft, setTrackTitleDraft] = useState('');
  const [trackAlbumDraft, setTrackAlbumDraft] = useState('');
  const [trackFeaturedArtistDraft, setTrackFeaturedArtistDraft] = useState('');
  const [isSavingTrack, setIsSavingTrack] = useState(false);

  // Thumbnail editing state
  const [changingThumbnailId, setChangingThumbnailId] = useState<string | null>(null);
  const thumbnailInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Inline audio preview state (simple play button per track)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Pinned track state (checkbox = pin track to the featured audio carousel)
  const pinnedFileUrls = usePinnedTrackFileUrls();

  const toggleTrackSelection = (track: Track) => {
    if (!track.fileUrl) return;
    togglePinnedTrackFileUrl(track.fileUrl);
  };

  const toggleSelectAllTracks = () => {
    const trackFileUrls = tracks
      .map((track) => track.fileUrl)
      .filter((url): url is string => Boolean(url));
    if (trackFileUrls.length === 0) return;

    const allPinned = trackFileUrls.every((url) => pinnedFileUrls.includes(url));
    const next = allPinned
      ? pinnedFileUrls.filter((url) => !trackFileUrls.includes(url))
      : Array.from(new Set([...pinnedFileUrls, ...trackFileUrls]));
    setPinnedTrackFileUrls(next);
  };

  useEffect(() => {
    let ignore = false;

    const loadArtist = async () => {
      if (!params.id) {
        setArtist(null);
        setLoadingArtist(false);
        return;
      }

      setLoadingArtist(true);
      const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 500));

      try {
        const response = await Promise.all([
          fetch(`/api/dashboard/artists/${encodeURIComponent(params.id)}`),
          minimumDelay,
        ]).then(([artistResponse]) => artistResponse);

        if (!response.ok) {
          throw new Error(`Artist API returned ${response.status}`);
        }

        const data = await response.json();

        if (!ignore) {
          if (data.artist) {
            const fetchedArtist = data.artist as Artist;
            setArtist(fetchedArtist);
            setArtistNameDraft(fetchedArtist.name);
            setArtistGenreDraft(fetchedArtist.genre);
            setBannerUrl(fetchedArtist.bannerUrl || null);
            setProfileUrl(fetchedArtist.profileUrl || null);
            try {
              const mediaResponse = await fetch(`/api/dashboard/artists/${encodeURIComponent(params.id)}/media`);
              if (!mediaResponse.ok) {
                throw new Error(`Artist media API returned ${mediaResponse.status}`);
              }
              const mediaData = await mediaResponse.json();
              if (!ignore) {
                const media = mediaData.media || [];
                const bannerMedia = media.find((item: Track) => item.kind === 'banner');
                const profileMedia = media.find((item: Track) => item.kind === 'profile');
                if (bannerMedia?.fileUrl) setBannerUrl(bannerMedia.fileUrl);
                if (profileMedia?.fileUrl) setProfileUrl(profileMedia.fileUrl);
                setTracks(media.filter((item: Track) => item.kind === 'track').map((item: Track) => ({
                  id: item.id,
                  title: item.title,
                  album: item.album || 'Single',
                  featuredArtistName: item.featuredArtistName || null,
                  featuredArtistId: item.featuredArtistId || null,
                  ownerArtistId: item.ownerArtistId || null,
                  ownerArtistName: item.ownerArtistName || null,
                  isShared: Boolean(item.featuredArtistId),
                  fileName: item.fileName,
                  fileUrl: item.fileUrl,
                  thumbnailUrl: item.thumbnailUrl,
                  downloadCount: Number(item.downloadCount || 0),
                  uploadedAt: new Date(item.uploadedAt || item.createdAt || new Date().toISOString()).toISOString().split('T')[0],
                })));
              }
            } catch (mediaError) {
              console.warn('Failed to load artist media; showing the artist profile without tracks.', mediaError);
            }
          } else {
            // Safely check if fallback exists before assigning
            const fallbackArtist = getArtistById(params.id);
            if (fallbackArtist) {
              setArtist(fallbackArtist as Artist);
              setBannerUrl((fallbackArtist?.bannerUrl as string | null) || null);
              setProfileUrl((fallbackArtist?.profileUrl as string | null) || null);
            } else {
              setArtist(null); // Explicitly trigger the "Artist not found" view safely
            }
          }
        }
      } catch (error) {
        console.error('Failed to load artist details', error);
        if (!ignore) {
          const fallbackArtist = getArtistById(params.id);
          if (fallbackArtist) {
            setArtist(fallbackArtist as Artist);
            setBannerUrl((fallbackArtist?.bannerUrl as string | null) || null);
            setProfileUrl((fallbackArtist?.profileUrl as string | null) || null);
          } else {
            setArtist(null);
          }
        }
      }
      finally {
        if (!ignore) {
          setLoadingArtist(false);
        }
      }
    };

    void loadArtist();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  useEffect(() => {
    let ignore = false;

    const loadAllArtists = async () => {
      try {
        const response = await fetch('/api/dashboard/artists', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const artists = Array.isArray(data.artists) ? data.artists : [];
        if (!ignore) {
          setAllArtists(artists.map((item: { id: string; name: string }) => ({
            id: item.id,
            name: item.name,
          })).filter((item: { name: string }) => Boolean(item.name)));
        }
      } catch {
        // Keep the featured artist field usable as a plain text input if the list cannot be loaded.
      }
    };

    void loadAllArtists();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (featuredDropdownRef.current && !featuredDropdownRef.current.contains(event.target as Node)) {
        setFeaturedDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (loadingArtist) {
    const loadingName = artist?.name || getArtistById(params.id)?.name || 'Artist';
    return (
      <ArtistProfileLoading
        artistName={loadingName}
        description={`Fetching ${loadingName} details and media from the dashboard.`}
      />
    );
  }

  if (!artist) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
          <h1 className="text-2xl font-semibold">Artist not found</h1>
          <p className="mt-2 text-sm text-slate-400">The selected artist could not be found.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Handle Banner Upload
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBannerUrl(URL.createObjectURL(file));
      setSelectedBanner(file);
      setIsDirty(true);
      setSaveSuccess(false);
    }
  };

  // Handle Profile Picture Upload
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileUrl(URL.createObjectURL(file));
      setSelectedProfile(file);
      setIsDirty(true);
      setSaveSuccess(false);
    }
  };

  // Drag & Drop Music Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    const cleanedName = file.name.replace(/\.[^/.]+$/, '');
    setTrackTitle(cleanedName);
  };

  const uploadMedia = async (file: File, kind: 'banner' | 'profile' | 'track', title = '', album = '', featuredArtist = '', featuredArtistId = '', onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    formData.append('title', title);
    formData.append('album', album);
    formData.append('featuredArtistName', featuredArtist);
    if (featuredArtistId) formData.append('featuredArtistId', featuredArtistId);
    if (kind === 'track') {
      try {
        const cover = await extractAudioCoverArt(file);
        if (cover) {
          formData.append('thumbnail', new File([cover.blob], cover.name, { type: cover.blob.type }));
        }
      } catch {
        // tolerate cover extraction failures and upload the track without a thumbnail
      }
    }
    return await new Promise<Track>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `/api/dashboard/artists/${params.id}/media`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        let data: { media?: Track; error?: string } = {};
        try {
          data = JSON.parse(request.responseText);
        } catch {
          reject(new Error('The server returned an invalid upload response'));
          return;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(data.error || `Upload failed (${request.status})`));
          return;
        }
        if (!data.media) {
          reject(new Error('Upload completed without media details'));
          return;
        }
        onProgress?.(100);
        resolve(data.media);
      };
      request.onerror = () => reject(new Error('Unable to connect to the local upload server'));
      request.onabort = () => reject(new Error('Upload was cancelled'));
      request.send(formData);
    });
  };

  const handleUploadTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !trackTitle) return;

    setIsUploading(true);
    setUploadProgress(0);
    setProcessMessage('Uploading track to storage...');
    try {
      const trimmedFeaturedArtist = featuredArtistName.trim();
      const matchedArtist = allArtists.find((artist) => artist.name.trim().toLowerCase() === trimmedFeaturedArtist.toLowerCase());
      const media = await uploadMedia(selectedFile, 'track', trackTitle, albumName || 'Single', trimmedFeaturedArtist, matchedArtist?.id || '', setUploadProgress);
      setTracks((prevTracks) => [{
        id: media.id,
        title: media.title,
        album: media.album || 'Single',
        featuredArtistName: media.featuredArtistName || null,
        featuredArtistId: media.featuredArtistId || null,
        ownerArtistId: media.ownerArtistId || artist.id,
        ownerArtistName: media.ownerArtistName || artist.name,
        isShared: Boolean(media.featuredArtistId),
        fileName: media.fileName,
        fileUrl: media.fileUrl,
        thumbnailUrl: media.thumbnailUrl,
        downloadCount: Number(media.downloadCount || 0),
        uploadedAt: new Date(media.createdAt || new Date().toISOString()).toISOString().split('T')[0],
      }, ...prevTracks]);
      setSelectedFile(null);
      setTrackTitle('');
      setFeaturedArtistName('');
      setAlbumName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setProcessMessage('Track saved to storage and added to the list.');
      setTimeout(() => {
        setProcessMessage('');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to upload track');
      setProcessMessage('Track upload failed.');
      setTimeout(() => setProcessMessage(''), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveArtistIdentity = async () => {
    if (!artist) return;

    const trimmedName = artistNameDraft.trim();
    const trimmedGenre = artistGenreDraft.trim();
    if (!trimmedName || !trimmedGenre) {
      setProcessMessage('Artist name and genre cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`/api/dashboard/artists/${artist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, genre: trimmedGenre }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update artist information');

      setArtist((currentArtist) => currentArtist ? { ...currentArtist, name: trimmedName, genre: trimmedGenre } : currentArtist);
      setArtistNameDraft(trimmedName);
      setArtistGenreDraft(trimmedGenre);
      setIsEditingArtistName(false);
      setIsEditingGenre(false);
      setProcessMessage('Artist details updated successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : 'Unable to update artist information.');
      setTimeout(() => setProcessMessage(''), 3000);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!artist) {
      setStatusDropdownOpen(false);
      return;
    }

    if (newStatus === artist.status) {
      setStatusDropdownOpen(false);
      return;
    }

    setIsSavingStatus(true);
    try {
      const response = await fetch(`/api/dashboard/artists/${artist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artist.name, genre: artist.genre, status: newStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update artist status');

      setArtist((currentArtist) => currentArtist
        ? {
          ...currentArtist,
          name: data.artist?.name || currentArtist.name,
          genre: data.artist?.genre || currentArtist.genre,
          status: data.artist?.status || newStatus,
        }
        : currentArtist);
      setProcessMessage('Artist status updated successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : 'Unable to update artist status.');
      setTimeout(() => setProcessMessage(''), 3000);
    } finally {
      setIsSavingStatus(false);
      setStatusDropdownOpen(false);
    }
  };

  const startEditingTrack = (track: Track) => {
    setEditingTrackId(track.id);
    setTrackTitleDraft(track.title);
    setTrackAlbumDraft(track.album || '');
    setTrackFeaturedArtistDraft(track.featuredArtistName || '');
  };

  const handleSaveTrackEdit = async () => {
    if (!editingTrackId || !artist) return;

    const trimmedTitle = trackTitleDraft.trim();
    if (!trimmedTitle) {
      setProcessMessage('Track title cannot be empty.');
      return;
    }

    setIsSavingTrack(true);
    try {
      const response = await fetch(`/api/dashboard/artists/${artist.id}/media?mediaId=${encodeURIComponent(editingTrackId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          album: trackAlbumDraft.trim(),
          featuredArtistName: trackFeaturedArtistDraft.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update track information');

      setTracks((prevTracks) => prevTracks.map((track) => track.id === editingTrackId
        ? {
          ...track,
          title: trimmedTitle,
          album: trackAlbumDraft.trim() || 'Single',
          featuredArtistName: trackFeaturedArtistDraft.trim() || null,
        }
        : track));
      setEditingTrackId(null);
      setTrackTitleDraft('');
      setTrackAlbumDraft('');
      setTrackFeaturedArtistDraft('');
      setProcessMessage('Track updated successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : 'Unable to update track information.');
      setTimeout(() => setProcessMessage(''), 3000);
    } finally {
      setIsSavingTrack(false);
    }
  };

  const handleThumbnailChange = async (track: Track, file: File) => {
    if (!file.type.startsWith('image/')) {
      window.alert('Please select a valid image file');
      return;
    }

    setChangingThumbnailId(track.id);
    const formData = new FormData();
    formData.append('thumbnail', file);

    try {
      const response = await fetch(`/api/dashboard/artists/${params.id}/media?mediaId=${encodeURIComponent(track.id)}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update thumbnail');

      // Immediately update the UI with the new thumbnail URL
      if (data.media?.fileUrl) {
        setTracks((prevTracks) => prevTracks.map((t) => t.id === track.id ? { ...t, thumbnailUrl: data.media.thumbnailUrl } : t));
      }

      setProcessMessage('Thumbnail updated successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to update thumbnail');
      setProcessMessage('Thumbnail update failed.');
      setTimeout(() => setProcessMessage(''), 3000);
    } finally {
      setChangingThumbnailId(null);
    }
  };

  const togglePlayTrack = (track: Track) => {
    if (!getPlayableAudioUrl(track.fileUrl)) return;
    // Toggle playback; a single hidden <audio> element (below) follows this state.
    setPlayingTrackId((current) => (current === track.id ? null : track.id));
  };

  const persistTrackOrder = async (orderedTracks: Track[]) => {
    const trackIds = orderedTracks.map((track) => track.id);
    try {
      const response = await fetch(`/api/dashboard/artists/${params.id}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save track order');
      setProcessMessage('Track order saved.');
      setTimeout(() => setProcessMessage(''), 2000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to save track order');
    }
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    setTracks((prevTracks) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prevTracks.length) return prevTracks;

      const reordered = [...prevTracks];
      const [movedTrack] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, movedTrack);
      void persistTrackOrder(reordered);
      return reordered;
    });
  };

  const handleDeleteTrack = async (id: string) => {
    try {
      const response = await fetch(`/api/dashboard/artists/${params.id}/media?mediaId=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete track');
      }

      const deletedTrack = tracks.find((track) => track.id === id);
      if (deletedTrack?.fileUrl) {
        setPinnedTrackFileUrls(pinnedFileUrls.filter((url) => url !== deletedTrack.fileUrl));
      }

      setTracks((prevTracks) => prevTracks.filter((track) => track.id !== id));
      setIsDirty(true);
      setSaveSuccess(false);
      setProcessMessage('Track removed successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete track');
      setProcessMessage('Track deletion failed.');
      setTimeout(() => setProcessMessage(''), 3000);
    }
  };

  // Save All Changes to Server
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveProgress(0);
    setProcessMessage('Preparing image changes...');
    try {
      const imageUploads = [selectedBanner, selectedProfile].filter(Boolean).length;
      let completedUploads = 0;
      if (selectedBanner) {
        setProcessMessage('Uploading banner to storage...');
        const media = await uploadMedia(selectedBanner, 'banner', '', '', '', '', (progress) => setSaveProgress(Math.round((completedUploads + progress / 100) / imageUploads * 100)));
        setBannerUrl(media.fileUrl || null);
        setSelectedBanner(null);
        completedUploads += 1;
      }
      if (selectedProfile) {
        setProcessMessage('Uploading profile picture to storage...');
        const media = await uploadMedia(selectedProfile, 'profile', '', '', '', '', (progress) => setSaveProgress(Math.round((completedUploads + progress / 100) / imageUploads * 100)));
        setProfileUrl(media.fileUrl || null);
        setSelectedProfile(null);
        completedUploads += 1;
      }
      setSaveProgress(100);
      setIsSaving(false);
      setIsDirty(false);
      setSaveSuccess(true);
      setProcessMessage('Images saved successfully.');
      setTimeout(() => {
        setSaveSuccess(false);
        setProcessMessage('');
        setSaveProgress(0);
      }, 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to save artist changes');
      setProcessMessage('Saving changes failed.');
      setIsSaving(false);
      setTimeout(() => setProcessMessage(''), 3000);
    }
  };

  const playingTrack = tracks.find((track) => track.id === playingTrackId);
  const playingTrackUrl = getPlayableAudioUrl(playingTrack?.fileUrl);
  const editingTrack = tracks.find((track) => track.id === editingTrackId);

  return (
    <main className=" text-white">
      {playingTrack && playingTrackUrl ? (
        <audio
          key={playingTrack.id}
          src={playingTrackUrl}
          autoPlay
          onEnded={() => setPlayingTrackId(null)}
          className="hidden"
        />
      ) : null}
      {editingTrack ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-track-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingTrackId(null);
              setTrackTitleDraft('');
              setTrackAlbumDraft('');
              setTrackFeaturedArtistDraft('');
            }
          }}
          >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveTrackEdit();
            }}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Track details</p>
                <h2 id="edit-track-title" className="mt-1 text-xl font-semibold text-white">Edit uploaded track</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingTrackId(null);
                  setTrackTitleDraft('');
                  setTrackAlbumDraft('');
                  setTrackFeaturedArtistDraft('');
                }}
                className="text-2xl leading-none text-slate-400 transition hover:text-white"
                aria-label="Abort editing"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="edit-track-title-input" className="mb-1.5 block text-xs font-medium text-slate-300">Track title</label>
                <input
                  id="edit-track-title-input"
                  autoFocus
                  value={trackTitleDraft}
                  onChange={(event) => setTrackTitleDraft(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="edit-track-album-input" className="mb-1.5 block text-xs font-medium text-slate-300">Album / Project</label>
                <input
                  id="edit-track-album-input"
                  value={trackAlbumDraft}
                  onChange={(event) => setTrackAlbumDraft(event.target.value)}
                  placeholder="Single"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="edit-track-featured-artist-input" className="mb-1.5 block text-xs font-medium text-slate-300">Additional Artist</label>
                <input
                  id="edit-track-featured-artist-input"
                  value={trackFeaturedArtistDraft}
                  onChange={(event) => setTrackFeaturedArtistDraft(event.target.value)}
                  placeholder="Featured Artist (optional)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSavingTrack}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSavingTrack ? 'Saving' : 'Save'}
              </button>
            </div>
          </form>
        </div>

      ) : null}
      <div className="mx-auto  overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">

        {/* BANNER & PROFILE PICTURE SECTION */}
        <div
          className="relative h-48 w-full bg-cover bg-center transition-all duration-300 md:h-64"
          style={{
            backgroundImage: getDisplayImageUrl(bannerUrl)
              ? `url(${getDisplayImageUrl(bannerUrl)})`
              : 'linear-gradient(to right, #312e81, #0f172a, #581c87)',
          }}
        >
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            className="hidden"
          />

          <Link
            href="/dashboard"
            className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-lg bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-indigo-300 backdrop-blur-md transition hover:bg-slate-950/80 hover:text-white"
          >
            ← Back to dashboard
          </Link>

          {/* Change Banner Button Header */}
          <div className="absolute right-6 top-6 z-10">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950/70 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-slate-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Change Banner
            </button>
          </div>

          {/* Profile Avatar Overlay */}
          <div className="absolute -bottom-10 left-8 flex items-end gap-5">
            <div className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-slate-900 bg-indigo-600 text-3xl font-bold shadow-xl md:h-28 md:w-28">
              {getDisplayImageUrl(profileUrl) ? (
                // Uses a plain <img> because the source can be a blob: preview URL from a freshly selected file, which next/image does not support.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getDisplayImageUrl(profileUrl) || undefined} alt={artist.name} className="h-full w-full object-cover" />
              ) : (
                <span>{artist.name.charAt(0)}</span>
              )}

              {/* Change Profile Photo Button */}
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 opacity-0 transition group-hover:opacity-100"
                title="Change Profile Photo"
              >
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="mt-1 text-[10px] font-medium text-white">Upload</span>
              </button>

              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* ARTIST INFO HEADER */}
        <div className="px-8 pb-8 pt-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">Artist Profile</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {isEditingArtistName ? (
                  <input
                    value={artistNameDraft}
                    onChange={(e) => setArtistNameDraft(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-2xl font-semibold text-white outline-none focus:border-indigo-500 sm:text-3xl"
                  />
                ) : (
                  <h1 className="text-3xl font-semibold">{artist.name}</h1>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingArtistName) {
                      void handleSaveArtistIdentity();
                    } else {
                      setArtistNameDraft(artist.name);
                      setIsEditingArtistName(true);
                    }
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  {isEditingArtistName ? 'Save Name' : 'Edit Name'}
                </button>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{artist.bio}</p>
            </div>

            <div className="relative shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-3" ref={statusDropdownRef}>
              <p className="text-xs text-slate-400">Status</p>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((open) => !open)}
                className={`mt-1 inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${getArtistStatusStyle(artist.status).pillClass}`}
                aria-haspopup="listbox"
                aria-expanded={statusDropdownOpen}
                disabled={isSavingStatus}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${getArtistStatusStyle(artist.status).dotClass}`} />
                {isSavingStatus ? 'Saving...' : artist.status}
                <svg className={`h-3 w-3 opacity-60 transition ${statusDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {statusDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-2xl" role="listbox" aria-label="Artist status">
                  {ARTIST_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={artist.status === option.value}
                      onClick={() => void handleStatusChange(option.value)}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass}`} />
                      {option.value}
                      {artist.status === option.value && (
                        <svg className="ml-auto h-3.5 w-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* STATS GRID */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Genre</p>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingGenre) {
                      void handleSaveArtistIdentity();
                    } else {
                      setArtistGenreDraft(artist.genre);
                      setIsEditingGenre(true);
                    }
                  }}
                  className="text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                >
                  {isEditingGenre ? 'Save Genre' : 'Edit'}
                </button>
              </div>
              {isEditingGenre ? (
                <input
                  value={artistGenreDraft}
                  onChange={(e) => setArtistGenreDraft(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                />
              ) : (
                <p className="mt-1 text-lg font-medium">{artist.genre}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs text-slate-400">Total Tracks</p>
              <p className="mt-1 text-lg font-medium">{tracks.length}</p>
            </div>
          </div>

          {/* DRAG AND DROP MUSIC UPLOAD SECTION */}
          <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Upload New Music File</h2>
            <p className="mt-1 text-xs text-slate-400">Drag and drop audio stems or completed mixes below (.mp3, .wav, .m4a).</p>

            <form onSubmit={handleUploadTrack} className="mt-6 space-y-6">
              {/* Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : selectedFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-indigo-400">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                {selectedFile ? (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-emerald-400">Selected File:</p>
                    <p className="text-xs text-slate-300">{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-slate-200">
                      Drag & drop your audio file here, or <span className="text-indigo-400 underline">browse</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Supports WAV, MP3, AAC up to 50MB</p>
                  </div>
                )}
              </div>

              {(isUploading || isSaving || processMessage) && (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3" aria-live="polite">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                    <span>{processMessage}</span>
                    <span>{isSaving ? saveProgress : uploadProgress}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-label={isSaving ? 'Saving image changes' : 'Uploading track'}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={isSaving ? saveProgress : uploadProgress}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isSaving ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${isSaving ? saveProgress : uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Text Inputs */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Row 1 Col 1: Track Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Track Title</label>
                  <input
                    type="text"
                    required
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="e.g. Atiak Noll Music"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Row 1 Col 2: Featured Artist dropdown */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Featured Artist from Database</label>
                  <div className="relative" ref={featuredDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setFeaturedDropdownOpen((open) => !open);
                        setFeaturedSearchText('');
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    >
                      <span className={allArtists.some((artist) => artist.name === featuredArtistName) ? 'text-white' : 'text-slate-500'}>
                        {allArtists.some((artist) => artist.name === featuredArtistName) ? featuredArtistName : '— Select an artist —'}
                      </span>
                      <svg className={`h-4 w-4 shrink-0 text-slate-400 transition ${featuredDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {featuredDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="border-b border-slate-800 p-2">
                          <input
                            autoFocus
                            type="text"
                            value={featuredSearchText}
                            onChange={(e) => setFeaturedSearchText(e.target.value)}
                            placeholder="Search artists..."
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto py-1">
                          {allArtists.filter((artist) => artist.name.toLowerCase().includes(featuredSearchText.toLowerCase())).length === 0 ? (
                            <li className="px-3 py-2 text-xs text-slate-500">
                              {allArtists.length === 0 ? 'No artists available' : `No artists match "${featuredSearchText}"`}
                            </li>
                          ) : allArtists
                            .filter((artist) => artist.name.toLowerCase().includes(featuredSearchText.toLowerCase()))
                            .map((artist) => (
                              <li key={artist.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFeaturedArtistName(artist.name);
                                    setFeaturedDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${featuredArtistName === artist.name ? 'text-indigo-400' : 'text-white'}`}
                                >
                                  {artist.name}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2 Col 1: Custom artist name input */}
                <div>
                  <p className="mb-1.5 block text-[11px] leading-snug text-slate-500">Choosing an artist fills the field above; you can also type a custom name.</p>
                  <input
                    type="text"
                    value={featuredArtistName}
                    onChange={(e) => setFeaturedArtistName(e.target.value)}
                    placeholder="Type a custom artist name (optional)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Row 2 Col 2: Album / Project */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Album / Project (Optional)</label>
                  <input
                    type="text"
                    value={albumName}
                    onChange={(e) => setAlbumName(e.target.value)}
                    placeholder="e.g. Single / Studio Album"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={!isDirty || isSaving}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg transition ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving Changes...
                    </>
                  ) : saveSuccess ? (
                    <>✓ Saved Successfully</>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save All Changes
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={!selectedFile || !trackTitle || isUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading Track...
                    </>
                  ) : (
                    'Add Track to List'
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* EMPTY TRACKS LIST CONTAINER */}
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Uploaded Audio Tracks</h2>
              <span className="text-xs text-slate-400">{tracks.length} track(s) loaded</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="w-14 px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={tracks.length > 0 && tracks.every((track) => track.fileUrl && pinnedFileUrls.includes(track.fileUrl))}
                            onChange={toggleSelectAllTracks}
                            aria-label="Pin all tracks to the featured audio carousel"
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-indigo-600"
                          />
                          <span className="text-[10px] font-medium text-slate-500">Pin</span>
                        </div>
                      </th>
                      <th className="px-6 py-3.5">Thumbnail</th>
                      <th className="px-6 py-3.5">Song Title</th>
                      <th className="px-6 py-3.5">Artist</th>
                      <th className="px-6 py-3.5">Play</th>
                      <th className="px-6 py-3.5">Album</th>
                      <th className="px-6 py-3.5">Date Added</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tracks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <svg className="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <p className="text-sm font-medium text-slate-400">No uploaded tracks available yet</p>
                            <p className="text-xs text-slate-600">Use the upload box above to add your first track.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      tracks.map((track, index) => {
                        const isOwnedTrack = !track.ownerArtistId || track.ownerArtistId === artist.id;
                        return (
                        <tr key={track.id} className="transition hover:bg-slate-900/40">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={Boolean(track.fileUrl && pinnedFileUrls.includes(track.fileUrl))}
                              onChange={() => toggleTrackSelection(track)}
                              aria-label={`Pin ${track.title} to the featured audio carousel`}
                              className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-indigo-600"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={track.thumbnailUrl || DEFAULT_TRACK_THUMBNAIL}
                                  alt={track.title}
                                  className="h-full w-full object-cover"
                                />
                                {track.isShared && (
                                  <ShareDot className="right-0 top-0 border-slate-900" title="Shared with another artist account" />
                                )}
                                {/* Thumbnail Edit Overlay */}
                                {isOwnedTrack && (
                                <label className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 opacity-0 transition group-hover:opacity-100 cursor-pointer text-[10px] font-medium text-white text-center px-1">
                                  <svg className="h-4 w-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {changingThumbnailId === track.id ? 'Updating...' : 'Change'}
                                  <input
                                    ref={(el) => {
                                      if (el) thumbnailInputRefs.current[track.id] = el;
                                    }}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        void handleThumbnailChange(track, e.target.files[0]);
                                      }
                                    }}
                                    className="hidden"
                                    disabled={changingThumbnailId !== null}
                                  />
                                </label>
                                )}
                              </div>
                              <span className="whitespace-nowrap text-xs text-slate-400">
                                {Number(track.downloadCount || 0).toLocaleString()} {Number(track.downloadCount || 0) === 1 ? 'download' : 'downloads'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-white">{track.title}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {!isOwnedTrack && track.ownerArtistName ? track.ownerArtistName : artist.name}
                            {track.featuredArtistName ? ` ft ${track.featuredArtistName}` : ''}
                          </td>
                          <td className="px-6 py-4">
                            {track.fileUrl ? (
                              <button
                                type="button"
                                onClick={() => togglePlayTrack(track)}
                                aria-label={playingTrackId === track.id ? `Pause ${track.title}` : `Play ${track.title}`}
                                title={playingTrackId === track.id ? 'Pause' : 'Play'}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                              >
                                {playingTrackId === track.id ? (
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">Unavailable</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400">{track.album}</td>
                          <td className="px-6 py-4 text-slate-400">{track.uploadedAt}</td>
                          <td className="px-6 py-4 text-right">
                            {isOwnedTrack ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => moveTrack(index, -1)}
                                disabled={index === 0}
                                title="Move up"
                                aria-label={`Move ${track.title} up`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-indigo-500 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTrack(index, 1)}
                                disabled={index === tracks.length - 1}
                                title="Move down"
                                aria-label={`Move ${track.title} down`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-indigo-500 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => startEditingTrack(track)}
                                className="text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void handleDeleteTrack(track.id)}
                                className="text-xs font-medium text-red-400 transition hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                            ) : (
                              <span className="text-xs text-slate-500" title="Shared from another artist account">
                                Shared track
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
