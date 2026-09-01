'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getArtistById } from '@/lib/artists';
import AudioPlayer from '@/components/AudioPlayer';
import ArtistProfileLoading from '@/components/ArtistProfileLoading';

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
  createdAt?: string;
  uploadedAt: string;
}

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
        if (!response.ok && !cancelled) {
          window.location.href = '/dashboard';
        }
      } catch {
        if (!cancelled) {
          window.location.href = '/dashboard';
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

  // Music Tracks State Management (Initialized empty)
  const [tracks, setTracks] = useState<Track[]>([]);

  // Music Upload State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
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
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitleDraft, setTrackTitleDraft] = useState('');
  const [trackAlbumDraft, setTrackAlbumDraft] = useState('');

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
          fetch(`/api/dashboard/artists/${params.id}`),
          minimumDelay,
        ]).then(([artistResponse]) => artistResponse);
        const data = await response.json();

        if (!ignore) {
          if (response.ok && data.artist) {
            const fetchedArtist = data.artist as Artist;
            setArtist(fetchedArtist);
            setArtistNameDraft(fetchedArtist.name);
            setArtistGenreDraft(fetchedArtist.genre);
            setBannerUrl(fetchedArtist.bannerUrl || null);
            setProfileUrl(fetchedArtist.profileUrl || null);
            const mediaResponse = await fetch(`/api/dashboard/artists/${params.id}/media`);
            const mediaData = await mediaResponse.json();
            if (mediaResponse.ok && !ignore) {
              const media = mediaData.media || [];
              const bannerMedia = media.find((item: Track) => item.kind === 'banner');
              const profileMedia = media.find((item: Track) => item.kind === 'profile');
              if (bannerMedia?.fileUrl) setBannerUrl(bannerMedia.fileUrl);
              if (profileMedia?.fileUrl) setProfileUrl(profileMedia.fileUrl);
              setTracks(media.filter((item: Track) => item.kind === 'track').map((item: Track) => ({
                id: item.id,
                title: item.title,
                album: item.album || 'Single',
                fileName: item.fileName,
                fileUrl: item.fileUrl,
                uploadedAt: new Date(item.uploadedAt || item.createdAt || new Date().toISOString()).toISOString().split('T')[0],
              })));
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

  if (loadingArtist) {
    return <ArtistProfileLoading />;
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

  const uploadMedia = async (file: File, kind: 'banner' | 'profile' | 'track', title = '', album = '', onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    formData.append('title', title);
    formData.append('album', album);
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
    setProcessMessage('Uploading track to Google Drive...');
    try {
      const media = await uploadMedia(selectedFile, 'track', trackTitle, albumName || 'Single', setUploadProgress);
      setTracks((prevTracks) => [{
        id: media.id,
        title: media.title,
        album: media.album || 'Single',
        fileName: media.fileName,
        fileUrl: media.fileUrl,
        uploadedAt: new Date(media.createdAt || new Date().toISOString()).toISOString().split('T')[0],
      }, ...prevTracks]);
      setSelectedFile(null);
      setTrackTitle('');
      setAlbumName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setProcessMessage('Track saved to Google Drive and added to the list.');
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

  const startEditingTrack = (track: Track) => {
    setEditingTrackId(track.id);
    setTrackTitleDraft(track.title);
    setTrackAlbumDraft(track.album || '');
  };

  const handleSaveTrackEdit = async () => {
    if (!editingTrackId || !artist) return;

    const trimmedTitle = trackTitleDraft.trim();
    if (!trimmedTitle) {
      setProcessMessage('Track title cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`/api/dashboard/artists/${artist.id}/media?mediaId=${encodeURIComponent(editingTrackId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, album: trackAlbumDraft.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update track information');

      setTracks((prevTracks) => prevTracks.map((track) => track.id === editingTrackId
        ? { ...track, title: trimmedTitle, album: trackAlbumDraft.trim() || 'Single' }
        : track));
      setEditingTrackId(null);
      setTrackTitleDraft('');
      setTrackAlbumDraft('');
      setProcessMessage('Track updated successfully.');
      setTimeout(() => setProcessMessage(''), 3000);
    } catch (error) {
      setProcessMessage(error instanceof Error ? error.message : 'Unable to update track information.');
      setTimeout(() => setProcessMessage(''), 3000);
    }
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
        setProcessMessage('Uploading banner to Google Drive...');
        const media = await uploadMedia(selectedBanner, 'banner', '', '', (progress) => setSaveProgress(Math.round((completedUploads + progress / 100) / imageUploads * 100)));
        setBannerUrl(media.fileUrl || null);
        setSelectedBanner(null);
        completedUploads += 1;
      }
      if (selectedProfile) {
        setProcessMessage('Uploading profile picture to Google Drive...');
        const media = await uploadMedia(selectedProfile, 'profile', '', '', (progress) => setSaveProgress(Math.round((completedUploads + progress / 100) / imageUploads * 100)));
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

  return (
    <main className=" text-white">
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

            <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-3">
              <p className="text-xs text-slate-400">Status</p>
              <span className="mt-1 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                {artist.status}
              </span>
            </div>
          </div>

          {/* STATS GRID */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
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
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs text-slate-400">Monthly Listeners</p>
              <p className="mt-1 text-lg font-medium">{artist.monthlyListeners?.toLocaleString() ?? 0}</p>
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
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Track Title</label>
                  <input
                    type="text"
                    required
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="e.g. Sitya Loss (Remix)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

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
                      <th className="px-6 py-3.5">Title</th>
                      <th className="px-6 py-3.5">Play</th>
                      <th className="px-6 py-3.5">Album</th>
                      <th className="px-6 py-3.5">File Name</th>
                      <th className="px-6 py-3.5">Date Added</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tracks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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
                      tracks.map((track) => (
                        <tr key={track.id} className="transition hover:bg-slate-900/40">
                          <td className="px-6 py-4 font-medium text-white">
                            {editingTrackId === track.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  value={trackTitleDraft}
                                  onChange={(e) => setTrackTitleDraft(e.target.value)}
                                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                />
                                <input
                                  value={trackAlbumDraft}
                                  onChange={(e) => setTrackAlbumDraft(e.target.value)}
                                  placeholder="Album / Project"
                                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                </div>
                                <div>
                                  <div>{track.title}</div>
                                  <div className="text-xs text-slate-500">{track.album}</div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {track.fileUrl ? (
                              <AudioPlayer
                                src={getPlayableAudioUrl(track.fileUrl) || ''}
                                title={track.title}
                              />
                            ) : (
                              <span className="text-xs text-slate-500">Unavailable</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400">{track.album}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-500">{track.fileName}</td>
                          <td className="px-6 py-4 text-slate-400">{track.uploadedAt}</td>
                          <td className="px-6 py-4 text-right">
                            {editingTrackId === track.id ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => void handleSaveTrackEdit()}
                                  className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingTrackId(null);
                                    setTrackTitleDraft('');
                                    setTrackAlbumDraft('');
                                  }}
                                  className="text-xs font-medium text-slate-400 transition hover:text-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
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
                            )}
                          </td>
                        </tr>
                      ))
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
