"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, History, HardDrive, LogOut } from 'lucide-react';

type NavPage = 'dashboard' | 'artists' | 'histories' | 'storage';

interface User {
  email: string;
  full_name: string;
  role: string;
}

interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: 'Active' | 'Inactive' | 'Pending';
}

interface StorageItem {
  id: string;
  title: string;
  type: string;
  file_url: string;
  created_at: string;
}

export default function DashboardApp({ user }: { user?: User | null }) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initialized with an empty list
  const [artists, setArtists] = useState<Artist[]>([]);
  
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('');

  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('music');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [artistMessage, setArtistMessage] = useState('');
  const [loadingArtists, setLoadingArtists] = useState(true);

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as NavPage, label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { id: 'artists' as NavPage, label: 'Artists', icon: <Users className="h-5 w-5" /> },
      { id: 'histories' as NavPage, label: 'Histories', icon: <History className="h-5 w-5" /> },
      { id: 'storage' as NavPage, label: 'Storage', icon: <HardDrive className="h-5 w-5" /> },
    ],
    []
  );

  useEffect(() => {
    const loadArtists = async () => {
      try {
        const response = await fetch('/api/dashboard/artists');
        const data = await response.json();
        if (response.ok && Array.isArray(data.artists)) {
          setArtists(data.artists);
        }
      } catch (error) {
        console.error('Failed to load artists', error);
      } finally {
        setLoadingArtists(false);
      }
    };

    void loadArtists();
  }, []);

  const handleAddArtist = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName || !newArtistGenre) return;

    setArtistMessage('');

    try {
      const response = await fetch('/api/dashboard/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArtistName, genre: newArtistGenre }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save artist');
      }

      const newArtist: Artist = data.artist;
      setArtists((prev) => [newArtist, ...prev]);
      setNewArtistName('');
      setNewArtistGenre('');
      setIsModalOpen(false);
      setArtistMessage('Artist saved to PostgreSQL.');
    } catch (error) {
      setArtistMessage(error instanceof Error ? error.message : 'Unable to save artist.');
    }
  }, [newArtistName, newArtistGenre]);

  const handleDeleteArtist = useCallback((id: string) => {
    setArtists((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleUpload = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !uploadFile) {
      setUploadMessage('Please provide a title and select a file.');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    setTimeout(() => {
      const newItem: StorageItem = {
        id: Date.now().toString(),
        title: uploadTitle,
        type: uploadType,
        file_url: '#',
        created_at: new Date().toISOString(),
      };

      setStorageItems((prev) => [newItem, ...prev]);
      setUploading(false);
      setUploadTitle('');
      setUploadFile(null);
      setUploadMessage('Uploaded successfully!');
    }, 800);
  }, [uploadTitle, uploadFile, uploadType]);

  const handleLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('nsu_user');
      window.location.href = '/dashboard';
    }
    router.push('/dashboard');
  }, [router]);

  return (
    <div
      className={`flex min-h-screen ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      } transition-colors duration-300`}
    >
      <aside
        className={`flex w-64 flex-col justify-between border-r p-4 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'
        }`}
      >
        <div>
          <div className="mb-6 flex items-center gap-3 border-b border-slate-700/50 px-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">N</div>
            <div>
              <h2 className="text-base font-semibold leading-none">Noll Music</h2>
              <span className="text-xs text-indigo-400">Uganda</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : isDarkMode
                      ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>


        <div className="space-y-2 border-t border-slate-700/50 pt-4">
          <button
              onClick={handleLogout}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isDarkMode
                  ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                  : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <LogOut className="h-5 w-5" />
              <span>Log Out</span>
            </button>
          <div
            className={`flex items-center justify-between rounded-xl border p-3 ${
              isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {isDarkMode ? (
                <svg className="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
              <span className="text-xs font-medium">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </div>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>

          </div>


        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">{activePage.replace('-', ' ')}</p>
              <h1 className="mt-1 text-3xl font-semibold">Welcome back, {user?.full_name || 'User'}</h1>
            </div>
          </div>

          {activePage === 'dashboard' && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email</p>
                <p className="mt-2 text-lg font-medium">{user?.email || 'N/A'}</p>
              </div>

              <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Role</p>
                <p className="mt-2 text-lg font-medium">{user?.role || 'User'}</p>
              </div>

              <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Database</p>
                <p className="mt-2 text-lg font-medium">PostgreSQL</p>
              </div>
            </div>
          )}

          {activePage === 'artists' && (
            <div className="space-y-6">
              <div className={`flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div>
                  <h2 className="text-xl font-semibold">Noll Artists</h2>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Manage registered musicians, view analytics, and upload tracks.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  Add New Artist
                </button>
              </div>

              {artistMessage ? <p className="text-sm text-emerald-400">{artistMessage}</p> : null}

              <div className={`overflow-hidden rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`border-b text-xs uppercase tracking-wider ${isDarkMode ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-3.5">Artist Name</th>
                        <th className="px-6 py-3.5">Genre</th>
                        <th className="px-6 py-3.5">Tracks</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {loadingArtists ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            <p className="text-sm font-medium text-slate-400">Loading artists…</p>
                          </td>
                        </tr>
                      ) : artists.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <p className="text-sm font-medium text-slate-400">No artists found</p>
                              <p className="text-xs text-slate-600">Click &quot;Add New Artist&quot; above to add your first artist profile.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        artists.map((artist) => (
                          <tr key={artist.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-6 py-4 font-medium">
                              <Link href={`/dashboard/artist/${artist.id}`} className="flex items-center gap-3 transition hover:text-indigo-400">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">{artist.name.charAt(0)}</div>
                                {artist.name}
                              </Link>
                            </td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{artist.genre}</td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{artist.tracksCount} tracks</td>
                            <td className="px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${artist.status === 'Active' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>{artist.status}</span></td>
                            <td className="px-6 py-4 text-right"><button onClick={() => handleDeleteArtist(artist.id)} className="text-xs font-medium text-red-400 transition hover:text-red-300">Delete</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'storage' && (
            <div className="space-y-6">
              <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <h2 className="mb-2 text-xl font-semibold">Storage Overview</h2>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Upload music and images and save their metadata in PostgreSQL.</p>
              </div>

              <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <h3 className="mb-4 text-lg font-semibold">Upload Media</h3>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm">Title</label>
                    <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} placeholder="Song or image title" />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm">Type</label>
                    <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
                      <option value="music">Music</option>
                      <option value="image">Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm">File</label>
                    <input type="file" accept="audio/*,image/*" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className={`w-full rounded-lg border px-3 py-2 text-sm ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} />
                  </div>

                  {uploadMessage ? <p className="text-sm text-indigo-400">{uploadMessage}</p> : null}

                  <button type="submit" disabled={uploading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{uploading ? 'Uploading...' : 'Save to PostgreSQL'}</button>
                </form>
              </div>

              <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <h3 className="mb-4 text-lg font-semibold">Stored Media</h3>
                {storageItems.length === 0 ? (
                  <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>No uploads yet.</p>
                ) : (
                  <div className="space-y-3">
                    {storageItems.map((item) => (
                      <div key={item.id} className={`rounded-lg border p-4 ${isDarkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-slate-400">{item.type} • {new Date(item.created_at).toLocaleString()}</p>
                          </div>
                          <a href={item.file_url} className="text-sm text-indigo-400 hover:text-indigo-300" target="_blank" rel="noreferrer">View file</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Artist</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-sm text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddArtist} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium opacity-80">Artist Name</label>
                <input type="text" required value={newArtistName} onChange={(e) => setNewArtistName(e.target.value)} placeholder="e.g. Jose Chameleone" className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium opacity-80">Genre</label>
                <input type="text" required value={newArtistGenre} onChange={(e) => setNewArtistGenre(e.target.value)} placeholder="e.g. Afro-ragga, Hip Hop" className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className={`rounded-lg px-4 py-2 text-sm font-medium ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'}`}>Cancel</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">Save Artist</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

