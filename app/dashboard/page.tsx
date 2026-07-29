'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { artistsSeed, type Artist } from '@/lib/artists';

type NavPage = 'dashboard' | 'artists' | 'histories' | 'storage';

interface User {
  email: string;
  full_name: string;
  role: string;
}

export default function DashboardPage() {
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Layout state
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Artist Management State (Placed at component top level)
  const [artists, setArtists] = useState<Artist[]>(artistsSeed);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
    setUser(null);
  };

  const handleAddArtist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName || !newArtistGenre) return;

    const newEntry: Artist = {
      id: Date.now().toString(),
      name: newArtistName,
      genre: newArtistGenre,
      tracksCount: 0,
      status: 'Active',
      bio: 'A newly added artist profile.',
      followers: 0,
      featuredTrack: 'Coming soon',
      monthlyListeners: 0,
    };

    setArtists([newEntry, ...artists]);
    setNewArtistName('');
    setNewArtistGenre('');
    setIsModalOpen(false);
  };

  const handleDeleteArtist = (id: string) => {
    setArtists(artists.filter((a) => a.id !== id));
  };

  const navItems = [
    {
      id: 'dashboard' as NavPage,
      label: 'Dashboard',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0l7 7 7-7m-14 0v9a1 1 0 001 1h3m10-11l2 2m-2-2v9a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'artists' as NavPage,
      label: 'Noll Artists',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'histories' as NavPage,
      label: 'Histories',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'storage' as NavPage,
      label: 'Storage',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
    },
  ];

  // 1. LOGIN FORM VIEW
  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl"
        >
          <h1 className="mb-2 text-2xl font-semibold">Dashboard Login</h1>
          <p className="mb-6 text-sm text-slate-400">
            Sign in with your PostgreSQL-backed dashboard credentials.
          </p>

          <label className="mb-2 block text-sm text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
            placeholder="admin@example.com"
            required
          />

          <label className="mb-2 block text-sm text-slate-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
            placeholder="Enter password"
            required
          />

          {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </main>
    );
  }

  // 2. MAIN DASHBOARD VIEW
  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-300`}>
      {/* SIDEBAR */}
      <aside className={`flex w-64 flex-col justify-between border-r p-4 ${isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white'}`}>
        <div>
          {/* Logo Header */}
          <div className="mb-6 flex items-center gap-3 border-b border-slate-700/50 px-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">
              N
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">Noll Music</h2>
              <span className="text-xs text-indigo-400">Uganda</span>
            </div>
          </div>

          {/* Navigation Items */}
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

        {/* Sidebar Footer */}
        <div className="space-y-3 border-t border-slate-700/50 pt-4">
          {/* Theme Toggle Switch */}
          <div className={`flex items-center justify-between rounded-xl border p-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-100'}`}>
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

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Logout Action */}
          <button
            onClick={handleLogout}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              isDarkMode
                ? 'border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT PANELS */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
                {activePage.replace('-', ' ')}
              </p>
              <h1 className="mt-1 text-3xl font-semibold">
                Welcome back, {user?.full_name || 'User'}
              </h1>
            </div>
          </div>

          {/* Page Dynamic Router View */}
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
              {/* Section Header with Add Button */}
              <div className={`flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div>
                  <h2 className="text-xl font-semibold">Noll Artists</h2>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Manage registered musicians, view analytics, and upload tracks.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Artist
                </button>
              </div>

              {/* Artist List View / Table */}
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
                      {artists.length === 0 ? (
                       <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          No artists found. Click &quot;Add New Artist&quot; to get started.
                          Modo
                        </td>
                      </tr>
                      ) : (
                        artists.map((artist) => (
                          <tr key={artist.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-6 py-4 font-medium">
                              <Link href={`/dashboard/artist/${artist.id}`} className="flex items-center gap-3 transition hover:text-indigo-400">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">
                                  {artist.name.charAt(0)}
                                </div>
                                {artist.name}
                              </Link>
                            </td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {artist.genre}
                            </td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {artist.tracksCount} tracks
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                artist.status === 'Active' 
                                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' 
                                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                              }`}>
                                {artist.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteArtist(artist.id)}
                                className="text-xs font-medium text-red-400 transition hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'histories' && (
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
              <h2 className="mb-2 text-xl font-semibold">Audit & Activity Logs</h2>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                System change logs, upload histories, and user activities.
              </p>
            </div>
          )}

          {activePage === 'storage' && (
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
              <h2 className="mb-2 text-xl font-semibold">Storage Overview</h2>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                Track media asset usage and available storage capacity.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Add Artist Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Artist</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddArtist} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium opacity-80">Artist Name</label>
                <input
                  type="text"
                  required
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  placeholder="e.g. Jose Chameleone"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium opacity-80">Genre</label>
                <input
                  type="text"
                  required
                  value={newArtistGenre}
                  onChange={(e) => setNewArtistGenre(e.target.value)}
                  placeholder="e.g. Afro-ragga, Hip Hop"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Save Artist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}