"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, History, HardDrive, LogOut, Video } from 'lucide-react';
import { clampUploadProgress, formatUploadStatusMessage, shouldAutoUploadOnSelection } from '@/lib/talk-show-upload';
import { updateStorageItemTitle } from '@/lib/storage-items';

type NavPage = 'dashboard' | 'artists' | 'videos' | 'histories' | 'storage' | 'members';

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
  profileUrl?: string | null;
}

interface Member {
  id: string;
  name: string;
  email: string;
  contact?: string;
  profilePic?: string;
  category: 'Board Members' | 'Artists' | 'Dancers' | 'Regular Members';
  status: 'Active' | 'Inactive' | 'Pending';
}

interface StorageItem {
  id: string;
  title: string;
  type: string;
  file_url: string;
  created_at: string;
}

interface HistoryItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  createdAt: string;
}

interface UploadResponsePayload {
  item?: StorageItem;
  error?: string;
  message?: string;
  uploadError?: string;
}

interface DriveStorage {
  used: number;
  limit: number | null;
  usedInDrive: number;
  usedInTrash: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export default function DashboardApp({ user }: { user?: User | null }) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const savedMode = window.localStorage.getItem('nsu-theme') || window.localStorage.getItem('theme_mode');
    return savedMode === 'dark';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isMegaUploadOpen, setIsMegaUploadOpen] = useState(false);

  const [artists, setArtists] = useState<Artist[]>([]);

  const [members, setMembers] = useState<Member[]>([]);
  const [memberCategoryFilter, setMemberCategoryFilter] = useState<string>('All');

  // Member Form States
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberContact, setNewMemberContact] = useState('');
  const [newMemberProfilePic, setNewMemberProfilePic] = useState('');
  const [newMemberCategory, setNewMemberCategory] = useState<'Board Members' | 'Artists' | 'Dancers' | 'Regular Members'>('Regular Members');

  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('');

  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [totalUploads, setTotalUploads] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [driveStorage, setDriveStorage] = useState<DriveStorage | null>(null);
  const [driveStorageError, setDriveStorageError] = useState('');
  const [driveStorageEntries, setDriveStorageEntries] = useState<Array<{ label: string; used: number; limit: number | null; usedInDrive: number; usedInTrash: number; error?: string }>>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('music');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingStorageItemId, setEditingStorageItemId] = useState<string | null>(null);
  const [editingStorageTitle, setEditingStorageTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [artistMessage, setArtistMessage] = useState('');
  const [memberMessage, setMemberMessage] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [artistsResponse, membersResponse, mediaResponse, historyResponse, storageResponse] = await Promise.all([
          fetch('/api/dashboard/artists'),
          fetch('/api/members'),
          fetch('/api/dashboard/media'),
          fetch('/api/dashboard/history'),
          fetch('/api/dashboard/storage'),
        ]);
        const artistsData = await artistsResponse.json();
        const membersData = await membersResponse.json();
        const mediaData = await mediaResponse.json();
        const historyData = await historyResponse.json();
        const storageData = await storageResponse.json();

        if (!artistsResponse.ok) throw new Error(artistsData.error || 'Unable to load artists');
        if (!membersResponse.ok) throw new Error(membersData.error || 'Unable to load members');
        if (!mediaResponse.ok) throw new Error(mediaData.error || 'Unable to load upload count');
        if (!historyResponse.ok) throw new Error(historyData.error || 'Unable to load activity history');
        if (!storageResponse.ok) throw new Error(storageData.error || 'Unable to load Drive storage');

        setArtists(artistsData.artists || []);
        setMembers(membersData.members || []);
        setTotalUploads(Number(mediaData.totalUploads || 0));
        setHistory(historyData.history || []);
        setStorageItems(storageData.items || []);
        setDriveStorage(storageData.driveStorage || null);
        setDriveStorageError(storageData.driveStorageError || '');
        setDriveStorageEntries(storageData.driveStorageEntries || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dashboard data';
        setArtistMessage(message);
        setMemberMessage(message);
      }
    };

    void loadDashboardData();
  }, []);

  const handleOpenEditMember = useCallback((member: Member) => {
    setEditingMember(member);
    setNewMemberName(member.name);
    setNewMemberEmail(member.email);
    setNewMemberContact(member.contact || '');
    setNewMemberProfilePic(member.profilePic || '');
    setNewMemberCategory(member.category);
    setIsMemberModalOpen(true);
  }, []);

  const megaUploadUrl = 'https://mega.nz/filerequest#!N3MQs2f_ucY!d!en';

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as NavPage, label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { id: 'members' as NavPage, label: 'Members', icon: <Users className="h-5 w-5" /> },
      { id: 'artists' as NavPage, label: 'Artists', icon: <Users className="h-5 w-5" /> },
      { id: 'videos' as NavPage, label: 'Videos', icon: <Video className="h-5 w-5" /> },
      { id: 'histories' as NavPage, label: 'Histories', icon: <History className="h-5 w-5" /> },
      { id: 'storage' as NavPage, label: 'Storage', icon: <HardDrive className="h-5 w-5" /> },
    ],
    []
  );

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
          if (!response.ok) throw new Error(data.error || 'Unable to save artist');

          setArtists((prev) => [data.artist, ...prev]);
          setNewArtistName('');
          setNewArtistGenre('');
          setIsModalOpen(false);
          setArtistMessage('Artist added successfully.');
        } catch (error) {
          setArtistMessage(error instanceof Error ? error.message : 'Unable to save artist');
        }
    }, [newArtistName, newArtistGenre]);

  const handleDeleteArtist = useCallback(async (id: string) => {
    const response = await fetch(`/api/dashboard/artists/${id}`, { method: 'DELETE' });
    if (response.ok) setArtists((prev) => prev.filter((artist) => artist.id !== id));
  }, []);

  const handleAddMember = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) return;

    setMemberMessage('');
    try {
      const response = await fetch(editingMember ? `/api/members/${editingMember.id}` : '/api/members', {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName,
          email: newMemberEmail,
          contact: newMemberContact,
          profilePic: newMemberProfilePic,
          category: newMemberCategory,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save member');

      setMembers((prev) => editingMember
        ? prev.map((member) => member.id === editingMember.id ? data.member : member)
        : [data.member, ...prev]);
      setEditingMember(null);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberContact('');
      setNewMemberProfilePic('');
      setIsMemberModalOpen(false);
      setMemberMessage(editingMember ? 'Member updated successfully.' : 'Member added successfully.');
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : 'Unable to save member');
    }
  }, [newMemberName, newMemberEmail, newMemberContact, newMemberProfilePic, newMemberCategory, editingMember]);

  const handleDeleteMember = useCallback(async (id: string) => {
    const response = await fetch(`/api/members/${id}`, { method: 'DELETE' });
    if (response.ok) setMembers((prev) => prev.filter((member) => member.id !== id));
  }, []);

  const handleDeleteHistory = useCallback(async (id: string) => {
    const response = await fetch(`/api/dashboard/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearHistory = useCallback(async () => {
    const response = await fetch('/api/dashboard/history', { method: 'DELETE' });
    if (response.ok) setHistory([]);
  }, []);

  const filteredMembers = useMemo(() => {
    if (memberCategoryFilter === 'All') return members;
    return members.filter((m) => m.category === memberCategoryFilter);
  }, [members, memberCategoryFilter]);

  const submitUpload = useCallback(async (fileToUpload: File | null, titleToUse = uploadTitle, typeToUse = uploadType) => {
    if (!titleToUse.trim() || !fileToUpload) {
      setUploadMessage('Please provide a title and select a file.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage('Uploading file…');

    try {
      const formData = new FormData();
      formData.append('title', titleToUse.trim());
      formData.append('type', typeToUse);
      formData.append('file', fileToUpload as File);
      formData.append('source', 'talk-show');

      const uploadUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/dashboard/storage` : '/api/dashboard/storage';

      const response = await new Promise<{ ok: boolean; status: number; data: UploadResponsePayload; errorMessage?: string }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', uploadUrl);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(clampUploadProgress((event.loaded / event.total) * 100));
          }
        };
        request.onload = () => {
          try {
            const payload = request.responseText ? (JSON.parse(request.responseText) as UploadResponsePayload) : {};
            resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, data: payload });
          } catch {
            resolve({ ok: false, status: request.status, data: {}, errorMessage: 'Invalid server response' });
          }
        };
        request.onerror = () => reject(new Error('Unable to reach the upload server.'));
        request.onabort = () => reject(new Error('Upload cancelled.'));
        request.send(formData);
      });

      if (!response.ok) {
        throw new Error(response.data.error || response.data.message || response.errorMessage || `Upload failed with status ${response.status}`);
      }

      const newItem = response.data.item;
      if (!newItem) {
        throw new Error('Upload completed but no storage item was returned.');
      }
      setStorageItems((prev) => [newItem, ...prev]);
      setUploadTitle('');
      setUploadFile(null);
      setUploadProgress(100);
      setUploadMessage(formatUploadStatusMessage(response.data.uploadError || null));
    } catch (error) {
      setUploadProgress(0);
      setUploadMessage(error instanceof Error ? error.message : 'Unable to save upload.');
    } finally {
      setUploading(false);
    }
  }, [uploadTitle, uploadType]);

  const handleUpload = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStorageItemId) {
      const itemToUpdate = storageItems.find((item) => item.id === editingStorageItemId);
      if (!itemToUpdate) {
        setUploadMessage('Selected item could not be found.');
        return;
      }

      try {
        const response = await fetch(`/api/dashboard/storage/${editingStorageItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editingStorageTitle.trim() || itemToUpdate.title }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Unable to update title');
        }

        setStorageItems((prev) => updateStorageItemTitle(prev, editingStorageItemId, editingStorageTitle.trim() || itemToUpdate.title));
        setEditingStorageItemId(null);
        setEditingStorageTitle('');
        setUploadTitle('');
        setUploadFile(null);
        setUploadProgress(100);
        setUploadMessage('Updated title successfully.');
      } catch (error) {
        setUploadProgress(0);
        setUploadMessage(error instanceof Error ? error.message : 'Unable to update title.');
      }
      return;
    }

    await submitUpload(uploadFile);
  }, [submitUpload, uploadFile, editingStorageItemId, editingStorageTitle, storageItems]);

  const handleFileSelection = useCallback((file: File | null) => {
    setUploadFile(file);

    if (shouldAutoUploadOnSelection(file, uploadTitle, uploading)) {
      void submitUpload(file, uploadTitle, uploadType);
    }
  }, [submitUpload, uploadTitle, uploadType, uploading]);

  const startEditingStorageItem = useCallback((item: StorageItem) => {
    setEditingStorageItemId(item.id);
    setEditingStorageTitle(item.title);
    setUploadTitle(item.title);
    setUploadFile(null);
    setUploadMessage('');
  }, []);

  const handleDeleteStorageItem = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/dashboard/storage/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete Talk Show upload');
      }

      setStorageItems((prev) => prev.filter((item) => item.id !== id));
      if (editingStorageItemId === id) {
        setEditingStorageItemId(null);
        setEditingStorageTitle('');
      }
      setUploadMessage('Talk Show upload removed.');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Unable to delete Talk Show upload.');
    }
  }, [editingStorageItemId]);

  const handleUpdateStorageItem = useCallback(async (id: string) => {
    try {
      if (!editingStorageTitle.trim()) {
        setUploadMessage('Title cannot be empty');
        return;
      }

      const response = await fetch(`/api/dashboard/storage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingStorageTitle }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update Talk Show upload');
      }

      setStorageItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: editingStorageTitle } : item))
      );
      setEditingStorageItemId(null);
      setEditingStorageTitle('');
      setUploadMessage('Talk Show upload updated successfully.');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Unable to update Talk Show upload.');
    }
  }, [editingStorageTitle]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/dashboard/login', { method: 'DELETE' });
    } catch {
      // Ignore logout API errors and continue clearing local state.
    }

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

            <button onClick={() => {
              const nextMode = !isDarkMode;
              setIsDarkMode(nextMode);
              window.localStorage.setItem('nsu-theme', nextMode ? 'dark' : 'light');
            }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
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
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Artists</p>
                  <p className="mt-2 text-lg font-medium">{artists.length}</p>
                </div>

                <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Uploads</p>
                  <p className="mt-2 text-lg font-medium">{totalUploads}</p>
                </div>

                <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Members</p>
                  <p className="mt-2 text-lg font-medium">{members.length}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <h3 className="mb-4 text-base font-semibold">Streams Over Time</h3>
                  <div className="flex h-48 items-end justify-between gap-2 pt-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                      const heights = ['h-24', 'h-32', 'h-16', 'h-40', 'h-36', 'h-48', 'h-44'];
                      return (
                        <div key={day} className="flex flex-1 flex-col items-center gap-2">
                          <div className={`w-full rounded-t-md bg-indigo-600 transition-all hover:bg-indigo-500 ${heights[i]}`} />
                          <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <h3 className="mb-4 text-base font-semibold">Revenue Analytics</h3>
                  <div className="flex h-48 items-end justify-between gap-2 pt-4">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month, i) => {
                      const heights = ['h-20', 'h-28', 'h-36', 'h-30', 'h-42', 'h-48', 'h-40'];
                      return (
                        <div key={month} className="flex flex-1 flex-col items-center gap-2">
                          <div className={`w-full rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-400 ${heights[i]}`} />
                          <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'members' && (
            <div className="space-y-6">
              <div className={`flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div>
                  <h2 className="text-xl font-semibold">Members Management</h2>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>View platform team members across Board Members, Artists, Dancers, and Regular Members.</p>
                </div>
                <button onClick={() => { setEditingMember(null); setNewMemberName(''); setNewMemberEmail(''); setNewMemberContact(''); setNewMemberProfilePic(''); setIsMemberModalOpen(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  Add New Member
                </button>
              </div>

              {memberMessage ? <p className="text-sm text-emerald-400">{memberMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                {['All', 'Board Members', 'Artists', 'Dancers', 'Regular Members'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMemberCategoryFilter(cat)}
                    className={`rounded-xl px-4 py-2 text-xs font-medium transition-all shadow-sm ${
                      memberCategoryFilter === cat
                        ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                        : isDarkMode
                        ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className={`overflow-hidden rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`border-b text-xs uppercase tracking-wider ${isDarkMode ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-3.5">Name</th>
                        <th className="px-6 py-3.5">Email</th>
                        <th className="px-6 py-3.5">Contact</th>
                        <th className="px-6 py-3.5">Category</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            <p className="text-sm font-medium text-slate-400">No members found in this category</p>
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <tr key={member.id} onClick={() => handleOpenEditMember(member)} className={`cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-6 py-4 font-medium">
                              <div className="flex items-center gap-3">
                                {member.profilePic ? (
                                  <img src={member.profilePic} alt={member.name} className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">
                                    {member.name.charAt(0)}
                                  </div>
                                )}
                                {member.name}
                              </div>
                            </td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{member.email}</td>
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{member.contact || 'N/A'}</td>
                            <td className="px-6 py-4">
                              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400">
                                {member.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                                {member.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => handleDeleteMember(member.id)} className="text-xs font-medium text-red-400 transition hover:text-red-300">
                                Remove
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

          {activePage === 'artists' && (
            <div className="space-y-6">
              <div className={`flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div>
                  <h2 className="text-xl font-semibold">Noll Artists</h2>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Manage your custom artists and add new profiles.</p>
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
                      {artists.length === 0 ? (
                                              <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                  <div className="flex flex-col items-center justify-center gap-2">
                                                    <p className="text-sm font-medium text-slate-400">No artists added yet</p>
                                                    <p className="text-xs text-slate-600">Click &quot;Add New Artist&quot; above to create your custom artist profile.</p>
                                                  </div>
                                                </td>
                                              </tr>
                                            ) : (
                                              artists.map((artist) => (
                                                <tr
                                                  key={artist.id}
                                                  onClick={() => router.push(`/dashboard/artist/${artist.id}`)}
                                                  className={`cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}
                                                >
                                                  <td className="px-6 py-4 font-medium">
                                                    <div className="flex items-center gap-3">
                                                      {artist.profileUrl ? (
                                                        <img src={artist.profileUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                                      ) : (
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">{artist.name.charAt(0)}</div>
                                                      )}
                                                      {artist.name}
                                                    </div>
                                                  </td>
                                                  <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{artist.genre}</td>
                                                  <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{artist.tracksCount} tracks</td>
                                                  <td className="px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${artist.status === 'Active' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>{artist.status}</span></td>
                                                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}><button onClick={() => handleDeleteArtist(artist.id)} className="text-xs font-medium text-red-400 transition hover:text-red-300">Delete</button></td>
                                                </tr>
                                              ))
                                            )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'videos' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <h2 className="mb-2 text-xl font-semibold">Video Library</h2>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                  Manage music videos and video media catalog.
                </p>
              </div>

              {/* Upload Section */}
              <div className={`rounded-xl border p-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <h3 className="text-lg font-semibold">Talk Show Uploads</h3>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Drag & drop video files here or click to choose a file to upload to the Talk Show Drive.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingStorageItemId) {
                      void handleUpdateStorageItem(editingStorageItemId);
                    } else if (uploadFile) {
                      void submitUpload(uploadFile, uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, ""), uploadType);
                    }
                  }}
                  className="mt-4"
                >
                  {/* Drag and Drop Area */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const droppedFiles = e.dataTransfer.files;
                      if (droppedFiles && droppedFiles.length > 0) {
                        const droppedFile = droppedFiles[0];
                        const derivedTitle = uploadTitle.trim() || droppedFile.name.replace(/\.[^/.]+$/, "");

                        if (!uploadTitle.trim()) {
                          setUploadTitle(derivedTitle);
                        }
                        setUploadFile(droppedFile);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                      isDarkMode ? 'border-slate-700 bg-slate-900/40 hover:border-indigo-500' : 'border-slate-300 bg-slate-50 hover:border-indigo-500'
                    }`}
                  >
                    <div className="text-center">
                      <p className={isDarkMode ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>Drop a file here</p>
                      <p className="mt-2 text-xs text-slate-500">or</p>
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500">
                        <input
                          type="file"
                          accept="video/*,audio/*"
                          onChange={(ev) => {
                            const selectedFile = ev.target.files?.[0] || null;
                            if (selectedFile) {
                              setUploadFile(selectedFile);
                              if (!uploadTitle.trim()) {
                                setUploadTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
                              }
                            }
                          }}
                          className="hidden"
                        />
                        Choose file
                      </label>
                      {uploadFile ? (
                        <div className={`mt-3 text-sm font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          Selected: {uploadFile.name}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Input & Submit Row */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Title"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className={`col-span-2 rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 ${
                        isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={uploading || (!uploadFile && !editingStorageItemId)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {uploading ? 'Uploading…' : editingStorageItemId ? 'Update Title' : 'Upload to Talk Show'}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {(uploading || uploadProgress > 0) && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{uploading ? 'Uploading file...' : 'Upload complete'}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload Status Message */}
                  {uploadMessage && (
                    <p className={`mt-2 text-sm ${uploadMessage.includes('Unable') || uploadMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {uploadMessage}
                    </p>
                  )}
                </form>

                {/* Uploaded Items List */}
                <div className={`mt-6 rounded-xl border p-4 ${isDarkMode ? 'border-slate-800/70 bg-slate-950/30' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Talk Show Uploads</h4>
                      <p className={`mt-0.5 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Manage and edit details of uploaded items.
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400">
                      {storageItems.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {storageItems.length === 0 ? (
                      <div className={`rounded-lg border border-dashed px-3 py-4 text-center text-sm ${
                        isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                      }`}>
                        No Talk Show uploads yet.
                      </div>
                    ) : storageItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 transition ${
                          isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                              {item.type}
                            </span>
                            {editingStorageItemId === item.id ? (
                              <input
                                type="text"
                                value={editingStorageTitle}
                                onChange={(e) => setEditingStorageTitle(e.target.value)}
                                className={`w-full rounded-md border px-2 py-1 text-sm outline-none transition focus:border-indigo-500 ${
                                  isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
                                }`}
                                autoFocus
                              />
                            ) : (
                              <span className="truncate text-sm font-medium">{item.title}</span>
                            )}
                          </div>
                          <p className={`mt-1 truncate text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            {item.file_url}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {editingStorageItemId === item.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleUpdateStorageItem(item.id)}
                                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStorageItemId(null);
                                  setEditingStorageTitle('');
                                }}
                                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStorageItemId(item.id);
                                  setEditingStorageTitle(item.title);
                                }}
                                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteStorageItem(item.id)}
                                className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'histories' && (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Activity History</h2>
                    <p className={isDarkMode ? 'mt-1 text-sm text-slate-400' : 'mt-1 text-sm text-slate-600'}>Every recorded dashboard change with the exact time it happened.</p>
                  </div>
                  <button type="button" onClick={handleClearHistory} disabled={history.length === 0} className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40">Clear all history</button>
                </div>
              </div>
              <div className={`overflow-hidden rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`border-b text-xs uppercase tracking-wider ${isDarkMode ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      <tr><th className="px-6 py-3.5">Change</th><th className="px-6 py-3.5">Type</th><th className="px-6 py-3.5">Time</th></tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {history.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-500">No activity recorded yet.</td></tr>
                      ) : history.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 font-medium">{item.description}</td>
                          <td className={`px-6 py-4 capitalize ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{item.action} {item.entityType.replace('_', ' ')}</td>
                          <td className={`whitespace-nowrap px-6 py-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{new Date(item.createdAt).toLocaleString()}</span>
                              <button type="button" onClick={() => handleDeleteHistory(item.id)} className="text-xs font-medium text-rose-400 hover:text-rose-300">Clear</button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Google Drive capacity used by your uploaded media.</p>
                {driveStorageEntries && driveStorageEntries.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {driveStorageEntries.map((entry) => (
                      <div key={entry.label} className="rounded-md border p-3">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{entry.label}</p>
                            <p className="text-2xl font-semibold">{formatBytes(entry.used)}</p>
                            <p className="text-xs text-slate-400">used</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">{entry.limit ? `${formatBytes(entry.limit)} total` : 'No storage limit'}</p>
                            <div className="mt-2 text-xs text-slate-400">My Drive: {formatBytes(entry.usedInDrive)}</div>
                            <div className="text-xs text-slate-400">Trash: {formatBytes(entry.usedInTrash)}</div>
                          </div>
                        </div>
                        {entry.limit ? <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min((entry.used / (entry.limit || 1)) * 100, 100)}%` }} /></div> : null}
                        {entry.error ? <p className="mt-2 text-xs text-rose-400">{entry.error}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : driveStorage ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-end justify-between gap-4">
                      <div><p className="text-2xl font-semibold">{formatBytes(driveStorage.used)}</p><p className="text-xs text-slate-400">used across Drive</p></div>
                      <p className="text-right text-sm text-slate-400">{driveStorage.limit ? `${formatBytes(driveStorage.limit)} total` : 'No storage limit reported'}</p>
                    </div>
                    {driveStorage.limit ? <div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min((driveStorage.used / driveStorage.limit) * 100, 100)}%` }} /></div> : null}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400"><span>My Drive: {formatBytes(driveStorage.usedInDrive)}</span><span>Trash: {formatBytes(driveStorage.usedInTrash)}</span></div>
                  </div>
                ) : <p className="mt-4 text-sm text-rose-400">{driveStorageError || 'Drive storage usage is unavailable.'}</p>}
              </div>

              <div className="hidden">
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
                    <input
                      type="file"
                      accept="audio/*,image/*"
                      onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-950 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                  </div>

                  {uploadMessage && (
                    <p className={`text-sm ${uploadMessage.includes('Unable') ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {uploadMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {uploading ? 'Saving Upload…' : 'Save Upload Record'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Artist Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <h3 className="text-xl font-semibold">Add New Artist</h3>
            <form onSubmit={handleAddArtist} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Artist Name</label>
                <input
                  type="text"
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`}
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Genre</label>
                <input
                  type="text"
                  value={newArtistGenre}
                  onChange={(e) => setNewArtistGenre(e.target.value)}
                  required
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`}
                  placeholder="e.g. Afro-ragga"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  Save Artist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingMember ? 'Edit Member' : 'Add New Member'}</h3>
              <button onClick={() => setIsMemberModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm">Full Name</label>
                <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} required className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} placeholder="Enter full name" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm">Email Address</label>
                <input type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} required className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} placeholder="Enter email address" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm">Contact Phone</label>
                <input type="text" value={newMemberContact} onChange={(e) => setNewMemberContact(e.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`} placeholder="Enter phone number" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm">Profile Picture (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewMemberProfilePic(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 ${
                    isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm">Category</label>
                <select value={newMemberCategory} onChange={(e) => setNewMemberCategory(e.target.value as Member['category'])} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
                  <option value="Board Members">Board Members</option>
                  <option value="Artists">Artists</option>
                  <option value="Dancers">Dancers</option>
                  <option value="Regular Members">Regular Members</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsMemberModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">{editingMember ? 'Update Member' : 'Save Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mega Upload Modal */}
      {isMegaUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
            <h3 className="text-xl font-semibold">Mega File Request</h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Upload files directly through Mega&apos;s dropzone request link below:
            </p>
            <div className={`my-4 rounded-xl border p-3 text-xs break-all ${isDarkMode ? 'border-slate-800 bg-slate-950 text-indigo-400' : 'border-slate-200 bg-slate-100 text-indigo-600'}`}>
              {megaUploadUrl}
            </div>
            <div className="flex justify-end gap-3">
              <a
                href={megaUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Open in Mega
              </a>
              <button
                type="button"
                onClick={() => setIsMegaUploadOpen(false)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
