"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Users, History, HardDrive, LogOut, Video } from 'lucide-react';
import { clampUploadProgress, formatUploadStatusMessage } from '@/lib/talk-show-upload';
import type { DashboardUser } from '@/lib/dashboard-auth';
import DashboardCharts from '@/components/DashboardCharts';

type NavPage = 'dashboard' | 'artists' | 'videos' | 'histories' | 'storage' | 'members';

interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  totalDownloads: number;
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
  thumbnail_url?: string | null;
}

function getStorageThumbnailUrl(fileUrl: string, thumbnailUrl?: string | null) {
  if (thumbnailUrl) return thumbnailUrl;

  const driveId = fileUrl.match(/\/api\/dashboard\/media\/([^/?]+)/)?.[1]
    || fileUrl.match(/[?&]id=([^&]+)/)?.[1];

  return driveId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w320` : null;
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

interface DownloadRegion {
  name: string;
  downloads: number;
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

interface DashboardDataCache {
  artists: Artist[];
  members: Member[];
  totalUploads: number;
  history: HistoryItem[];
  storageItems: StorageItem[];
  driveStorage: DriveStorage | null;
  driveStorageError: string;
  driveStorageEntries: Array<{ label: string; used: number; limit: number | null; usedInDrive: number; usedInTrash: number; error?: string }>;
  downloadRegions: DownloadRegion[];
}

// Held in module scope so the fetched dashboard data survives client-side
// navigation (e.g. opening an artist page and returning). It is only cleared
// when the module is re-evaluated, i.e. on a full browser refresh.
let dashboardDataCache: DashboardDataCache | null = null;

export default function DashboardApp({ user }: { user: DashboardUser }) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const savedMode = window.localStorage.getItem('nsu-theme') || window.localStorage.getItem('theme_mode');
    return savedMode === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  const [artists, setArtists] = useState<Artist[]>(() => dashboardDataCache?.artists ?? []);
  const [downloadRegions, setDownloadRegions] = useState<DownloadRegion[]>(() => dashboardDataCache?.downloadRegions ?? []);
  const [members, setMembers] = useState<Member[]>(() => dashboardDataCache?.members ?? []);
  const [memberCategoryFilter, setMemberCategoryFilter] = useState<string>('All');

  // Member Form States
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberContact, setNewMemberContact] = useState('');
  const [newMemberProfilePic, setNewMemberProfilePic] = useState('');
  const [newMemberCategory, setNewMemberCategory] = useState<'Board Members' | 'Artists' | 'Dancers' | 'Regular Members'>('Regular Members');
  const [newMemberStatus, setNewMemberStatus] = useState<Member['status']>('Active');
  const [savingMember, setSavingMember] = useState(false);

  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistGenre, setNewArtistGenre] = useState('');

  const [storageItems, setStorageItems] = useState<StorageItem[]>(() => dashboardDataCache?.storageItems ?? []);
  const [totalUploads, setTotalUploads] = useState(() => dashboardDataCache?.totalUploads ?? 0);
  const [history, setHistory] = useState<HistoryItem[]>(() => dashboardDataCache?.history ?? []);
  const [driveStorage, setDriveStorage] = useState<DriveStorage | null>(() => dashboardDataCache?.driveStorage ?? null);
  const [driveStorageError, setDriveStorageError] = useState(() => dashboardDataCache?.driveStorageError ?? '');
  const [driveStorageEntries, setDriveStorageEntries] = useState<Array<{ label: string; used: number; limit: number | null; usedInDrive: number; usedInTrash: number; error?: string }>>(() => dashboardDataCache?.driveStorageEntries ?? []);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('music');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingStorageItemId, setEditingStorageItemId] = useState<string | null>(null);
  const [editingStorageTitle, setEditingStorageTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [changingThumbnailId, setChangingThumbnailId] = useState<string | null>(null);
  const [artistMessage, setArtistMessage] = useState('');
  const [memberMessage, setMemberMessage] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);

  useEffect(() => {
    // Skip the network round-trip when data is already cached for this browser
    // session. It stays cached across navigation and only reloads on refresh.
    if (dashboardDataCache) return;

    const loadDashboardData = async () => {
      try {
        await fetch('/api/dashboard/storage/member-profiles', { method: 'DELETE' });
        const [artistsResponse, membersResponse, mediaResponse, historyResponse, storageResponse, regionsResponse] = await Promise.all([
          fetch('/api/dashboard/artists'),
          fetch('/api/members'),
          fetch('/api/dashboard/media'),
          fetch('/api/dashboard/history'),
          fetch('/api/dashboard/storage'),
          fetch('/api/dashboard/regions'),
        ]);
        const artistsData = await artistsResponse.json();
        const membersData = await membersResponse.json();
        const mediaData = await mediaResponse.json();
        const historyData = await historyResponse.json();
        const storageData = await storageResponse.json();
        const regionsData = await regionsResponse.json();

        if (!artistsResponse.ok) throw new Error(artistsData.error || 'Unable to load artists');
        if (!membersResponse.ok) throw new Error(membersData.error || 'Unable to load members');
        if (!mediaResponse.ok) throw new Error(mediaData.error || 'Unable to load upload count');
        if (!historyResponse.ok) throw new Error(historyData.error || 'Unable to load activity history');
        if (!storageResponse.ok) throw new Error(storageData.error || 'Unable to load Drive storage');
        if (!regionsResponse.ok) throw new Error(regionsData.error || 'Unable to load download regions');

        setArtists(artistsData.artists || []);
        setMembers(membersData.members || []);
        setTotalUploads(Number(mediaData.totalUploads || 0));
        setHistory(historyData.history || []);
        setStorageItems(storageData.items || []);
        setDriveStorage(storageData.driveStorage || null);
        setDriveStorageError(storageData.driveStorageError || '');
        setDriveStorageEntries(storageData.driveStorageEntries || []);
        setDownloadRegions(regionsData.regions || []);

        dashboardDataCache = {
          artists: artistsData.artists || [],
          members: membersData.members || [],
          totalUploads: Number(mediaData.totalUploads || 0),
          history: historyData.history || [],
          storageItems: storageData.items || [],
          driveStorage: storageData.driveStorage || null,
          driveStorageError: storageData.driveStorageError || '',
          driveStorageEntries: storageData.driveStorageEntries || [],
          downloadRegions: regionsData.regions || [],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dashboard data';
        setArtistMessage(message);
        setMemberMessage(message);
      }
    };

    void loadDashboardData();
  }, []);

  // Keep the session cache in sync with in-place mutations (add/edit/delete)
  // so returning to the dashboard after navigation shows up-to-date data
  // without refetching. Only runs once an initial load has populated the cache.
  useEffect(() => {
    if (!dashboardDataCache) return;

    dashboardDataCache = {
      artists,
      members,
      totalUploads,
      history,
      storageItems,
      driveStorage,
      driveStorageError,
      driveStorageEntries,
      downloadRegions,
    };
  }, [
    artists,
    members,
    totalUploads,
    history,
    storageItems,
    driveStorage,
    driveStorageError,
    driveStorageEntries,
    downloadRegions,
  ]);

  const handleOpenEditMember = useCallback((member: Member) => {
    setEditingMember(member);
    setNewMemberName(member.name);
    setNewMemberEmail(member.email);
    setNewMemberContact(member.contact || '');
    setNewMemberProfilePic(member.profilePic || '');
    setNewMemberCategory(member.category);
    setNewMemberStatus(member.status);
    setIsMemberModalOpen(true);
  }, []);

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

  const handleAddMember = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingMember || !newMemberName.trim() || !newMemberEmail.trim()) {
      return;
    }

    setMemberMessage('');
    setSavingMember(true);
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
          status: newMemberStatus,
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
    } finally {
      setSavingMember(false);
    }
  }, [newMemberName, newMemberEmail, newMemberContact, newMemberProfilePic, newMemberCategory, newMemberStatus, editingMember, savingMember]);

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

        setStorageItems((prev) => prev.map((item) => item.id === editingStorageItemId
          ? { ...item, title: editingStorageTitle.trim() || itemToUpdate.title }
          : item));
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

  const handleThumbnailChange = useCallback(async (item: StorageItem, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadMessage('Thumbnail must be an image.');
      return;
    }

    setChangingThumbnailId(item.id);
    setUploadMessage('Uploading thumbnail...');
    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      const response = await fetch(`/api/dashboard/storage/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update thumbnail.');

      setStorageItems((prev) => prev.map((current) => current.id === item.id
        ? { ...current, thumbnail_url: data.item?.thumbnail_url || null }
        : current));
      setUploadMessage('Thumbnail updated successfully.');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Unable to update thumbnail.');
    } finally {
      setChangingThumbnailId(null);
    }
  }, []);

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
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('nsu_user');
      }

      await fetch('/api/dashboard/logout', { method: 'POST' });
    } catch {
      // ignore logout endpoint failures and fall through to a refresh
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      } else {
        router.push('/dashboard');
      }
    }
  }, [router]);
  return (
    <div
      className={`flex h-screen overflow-hidden ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      } transition-colors duration-300`}
      >
      <aside
        className={`sticky top-0 flex h-screen w-64 flex-col justify-between border-r p-4 overflow-y-auto backdrop-blur-xl transition-all duration-300 ${
          isDarkMode ? 'border-slate-800/80 bg-slate-900/90 shadow-2xl shadow-black/40' : 'border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/50'
        }`}
        >
        <div>
          {/* Brand Logo Header */}
          <div className={`mb-6 flex items-center gap-3 border-b px-3 py-4 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 font-bold text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30">
              N
            </div>
            <div>
              <h2 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Noll Music</h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Uganda
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30'
                      : isDarkMode
                      ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Controls: Logout & Theme Toggle */}
        <div className={`space-y-3 border-t pt-4 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all border ${
              isDarkMode
                ? 'border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30'
                : 'border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-100 hover:border-rose-300'
            }`}
          >
            <LogOut className="h-5 w-5" />
            <span>Log Out</span>
          </button>

          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
              isDarkMode ? 'border-slate-800/80 bg-slate-950/50 shadow-inner' : 'border-slate-200/80 bg-slate-100/70 shadow-inner'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isDarkMode ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              )}
              <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>

            <button
              onClick={() => {
                const nextMode = !isDarkMode;
                setIsDarkMode(nextMode);
                window.localStorage.setItem('nsu-theme', nextMode ? 'dark' : 'light');
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-indigo-500/20 ${
                isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

      <main aria-label={`Dashboard for ${user.email}`} className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">{activePage.replace('-', ' ')}</p>
            </div>
          </div>

          {activePage === 'dashboard' && (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* Total Artists Card */}
                <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30 hover:border-slate-700' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Artists</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  </div>
                  <p className={`mt-4 text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{artists.length}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">Active Noll Artists</span>
                  </div>
                </div>

                {/* Total Uploads Card */}
                <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30 hover:border-slate-700' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Uploads</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                  </div>
                  <p className={`mt-4 text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalUploads}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-indigo-400">
                    <span className="inline-flex items-center rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5">Cloud Media files</span>
                  </div>
                </div>

                {/* Total Members Card */}
                <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30 hover:border-slate-700' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Members</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className={`mt-4 text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{members.length}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">Platform Community</span>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <DashboardCharts isDarkMode={isDarkMode} artists={artists} downloadRegions={downloadRegions} />
              </div>
            </div>
          )}

          {activePage === 'members' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Members Management</h2>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      View platform team members across Board Members, Artists, Dancers, and Regular Members.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(null);
                      setNewMemberName('');
                      setNewMemberEmail('');
                      setNewMemberContact('');
                      setNewMemberCategory('Regular Members');
                      setNewMemberStatus('Active');
                      setNewMemberProfilePic('');
                      setIsMemberModalOpen(true);
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Member
                  </button>
                </div>
              </div>

              {memberMessage && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400">
                  {memberMessage}
                </div>
              )}

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {['All', 'Board Members', 'Artists', 'Dancers', 'Regular Members'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setMemberCategoryFilter(cat)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-sm ${
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

              {/* Members Table */}
              <div className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`border-b text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'border-slate-800/80 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50/70 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200/80'}`}>
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full border ${isDarkMode ? 'border-slate-800 bg-slate-800/50 text-slate-500' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>No members found in this category</p>
                              <p className="mt-1 text-xs text-slate-500">Try selecting a different filter or add a new member.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <tr
                            key={member.id}
                            onClick={() => handleOpenEditMember(member)}
                            className={`cursor-pointer transition-colors duration-150 ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'}`}
                          >
                            <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              <div className="flex items-center gap-3">
                                {member.profilePic ? (
                                  <Image src={member.profilePic} alt={member.name} width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover shadow-sm border border-slate-700/50" />
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/20 border border-indigo-500/30 text-xs font-bold text-indigo-400 shadow-sm">
                                    {member.name.charAt(0)}
                                  </div>
                                )}
                                <span className="font-semibold">{member.name}</span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 text-xs font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{member.email}</td>
                            <td className={`px-6 py-4 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{member.contact || 'N/A'}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                                {member.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                                {member.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(member.id)}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/15 hover:border-rose-500/30 active:scale-95"
                              >
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

              {/* Modern Add / Edit Member Modal Panel */}
              {false && isMemberModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className={`relative w-full max-w-lg rounded-3xl border p-6 sm:p-8 shadow-2xl transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>

                    <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">
                          {editingMember ? 'Edit Team Member' : 'Add New Member'}
                        </h3>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {editingMember ? 'Update member details and privileges' : 'Register a new member to the platform roster'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMemberModalOpen(false)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition hover:scale-105 ${isDarkMode ? 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-6 space-y-4">

                      {/* Profile Picture Upload Section */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Profile Picture
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-indigo-500/30 bg-indigo-600/10 flex items-center justify-center shadow-inner">
                            {newMemberProfilePic ? (
                              <Image src={newMemberProfilePic} alt="Preview" fill unoptimized className="object-cover" />
                            ) : (
                              <span className="text-lg font-bold text-indigo-400">
                                {newMemberName ? newMemberName.charAt(0).toUpperCase() : 'N'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-sm transition hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                              <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              <span>Upload Image File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setNewMemberProfilePic(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              PNG, JPG, or WEBP up to 5MB.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'border-slate-700 bg-slate-950/60 text-white placeholder-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'}`}
                        />
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. john@domain.com"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'border-slate-700 bg-slate-950/60 text-white placeholder-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'}`}
                        />
                      </div>

                      {/* Contact Number */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Contact Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. +1 234 567 890"
                          value={newMemberContact}
                          onChange={(e) => setNewMemberContact(e.target.value)}
                          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'border-slate-700 bg-slate-950/60 text-white placeholder-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'}`}
                        />
                      </div>

                      {/* Category Dropdown */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Member Category
                        </label>
                        <div className="relative">
                          <select
                            value={newMemberCategory || 'Regular Members'}
                            onChange={(e) => setNewMemberCategory(e.target.value as Member['category'])}
                            className={`w-full appearance-none rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'border-slate-700 bg-slate-950/80 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                          >
                            <option value="Board Members">Board Members</option>
                            <option value="Artists">Artists</option>
                            <option value="Dancers">Dancers</option>
                            <option value="Regular Members">Regular Members</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Status Dropdown */}
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Account Status
                        </label>
                        <div className="relative">
                          <select
                            value={newMemberStatus}
                            onChange={(e) => setNewMemberStatus(e.target.value as Member['status'])}
                            className={`w-full appearance-none rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'border-slate-700 bg-slate-950/80 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Pending">Pending</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="mt-8 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsMemberModalOpen(false)}
                        className={`rounded-xl border px-5 py-2.5 text-xs font-semibold transition ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingMember}
                        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95"
                      >
                        {savingMember ? 'Saving...' : editingMember ? 'Save Changes' : 'Create Member'}
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {activePage === 'artists' && (
            <div className="space-y-6">
              {/* Fixed Position Top Panel */}
              <div className="sticky top-0 z-20 space-y-4 pb-2 pt-1">
                <div className={`flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-2xl shadow-black/40' : 'border-slate-200/80 bg-white/85 shadow-xl shadow-slate-200/50'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      <h2 className="text-xl font-bold tracking-tight">Noll Artists</h2>
                    </div>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Manage your custom artists and add new profiles.</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all duration-300 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-600/50 active:scale-[0.98]"
                  >
                    <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></span>
                    <svg className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Add New Artist</span>
                  </button>
                </div>

                {artistMessage && (
                  <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm animate-fadeIn ${isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-emerald-500/20 bg-emerald-50 text-emerald-700'}`}>
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    <span>{artistMessage}</span>
                  </div>
                )}
              </div>

              <div className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/60 shadow-2xl shadow-black/40' : 'border-slate-200/80 bg-white/80 shadow-xl shadow-slate-200/50'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className={`border-b text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'border-slate-800/80 bg-slate-950/60 text-slate-400' : 'border-slate-200/80 bg-slate-50/80 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-4">Artist Name</th>
                        <th className="px-6 py-4">Genre</th>
                        <th className="px-6 py-4">Tracks</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-200/60'}`}>
                      {artists.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isDarkMode ? 'border-slate-800 bg-slate-950/50 text-slate-500' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-300">No artists added yet</p>
                                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Click &quot;Add New Artist&quot; above to create your custom artist profile.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        artists.map((artist) => (
                          <tr
                            key={artist.id}
                            onClick={() => router.push(`/dashboard/artist/${artist.id}`)}
                            className={`group cursor-pointer transition-all duration-200 ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}
                          >
                            <td className="px-6 py-4 font-medium">
                              <div className="flex items-center gap-3.5">
                                {artist.profileUrl ? (
                                  <Image src={artist.profileUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-xl object-cover ring-2 ring-indigo-500/20 transition group-hover:ring-indigo-500/40" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 text-xs font-bold text-indigo-400 ring-2 ring-indigo-500/20 transition group-hover:ring-indigo-500/40">
                                    {artist.name.charAt(0)}
                                  </div>
                                )}
                                <span className="font-semibold tracking-tight">{artist.name}</span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium border ${isDarkMode ? 'border-slate-800 bg-slate-950/40 text-slate-300' : 'border-slate-200 bg-slate-100/60 text-slate-700'}`}>
                                {artist.genre}
                              </span>
                            </td>
                            <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              <span className="inline-flex items-center gap-1.5">
                                <svg className={`h-3.5 w-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                                {artist.tracksCount} tracks
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                                artist.status === 'Active'
                                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5'
                                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-amber-500/5'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${artist.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                                {artist.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteArtist(artist.id)}
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                                  isDarkMode
                                    ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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

          {activePage === 'videos' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Video Library</h2>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Manage music videos and video media catalog.
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 rounded-xl bg-indigo-500/10 px-3 py-1.5 border border-indigo-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-indigo-400">{storageItems.length} Active Streams</span>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <h3 className="text-base font-bold tracking-tight">Talk Show Uploads</h3>
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
                  className="mt-5"
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
                    className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                      isDarkMode
                        ? 'border-slate-700/80 bg-slate-950/40 hover:border-indigo-500 hover:bg-slate-900/60'
                        : 'border-slate-300 bg-slate-50/50 hover:border-indigo-500 hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className="absolute inset-0 bg-indigo-500/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                    <div className="flex flex-col items-center text-center z-10">
                      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                        isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Drag & drop video or audio files here
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Supports MP4, MOV, MP3, WAV and more</p>

                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/40 active:scale-95">
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
                        Browse Files
                      </label>

                      {uploadFile ? (
                        <div className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-medium border ${
                          isDarkMode ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        }`}>
                          <span className="truncate max-w-50">Selected: {uploadFile.name}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Input & Submit Row */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Enter media title..."
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className={`col-span-2 rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                        isDarkMode ? 'border-slate-800 bg-slate-950 text-white placeholder-slate-600' : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={uploading || (!uploadFile && !editingStorageItemId)}
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {uploading ? 'Uploading…' : editingStorageItemId ? 'Update Title' : 'Upload to Talk Show'}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {(uploading || uploadProgress > 0) && (
                    <div className="mt-4 rounded-xl border p-4 bg-slate-950/20 border-slate-800/50">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          {uploading ? 'Uploading media file...' : 'Upload complete'}
                        </span>
                        <span className="font-bold text-indigo-400">{uploadProgress}%</span>
                      </div>
                      <div className={`h-2.5 overflow-hidden rounded-full p-0.5 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-linear-to-r from-indigo-600 to-indigo-400 transition-all duration-300 shadow-sm shadow-indigo-500/50"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload Status Message */}
                  {uploadMessage && (
                    <div className={`mt-3 rounded-xl border p-3 text-sm flex items-center gap-2 ${
                      uploadMessage.includes('Unable') || uploadMessage.includes('Error')
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    }`}>
                      <span>{uploadMessage}</span>
                    </div>
                  )}
                </form>

                {/* Uploaded Items List */}
                <div className={`mt-8 rounded-2xl border p-5 ${isDarkMode ? 'border-slate-800/70 bg-slate-950/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold tracking-tight">Talk Show Uploads Catalog</h4>
                      <p className={`mt-0.5 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Manage and edit details of uploaded items.
                      </p>
                    </div>
                    <span className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-400 shadow-sm">
                      {storageItems.length} items
                    </span>
                  </div>

                  <div className="space-y-3">
                    {storageItems.length === 0 ? (
                      <div className={`rounded-xl border border-dashed px-4 py-8 text-center text-sm ${
                        isDarkMode ? 'border-slate-800 text-slate-500 bg-slate-900/20' : 'border-slate-300 text-slate-500 bg-white/50'
                      }`}>
                        No Talk Show uploads yet. Upload your first file above.
                      </div>
                    ) : storageItems.map((item) => {
                      const thumbnailUrl = getStorageThumbnailUrl(item.file_url, item.thumbnail_url);

                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-all duration-200 ${
                            isDarkMode
                              ? 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80 shadow-sm'
                              : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md'
                          }`}
                        >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-700/40 bg-slate-950 shadow-inner">
                          {thumbnailUrl ? (
                            <Image
                              src={thumbnailUrl}
                              alt=""
                              fill
                              unoptimized
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-indigo-400" aria-hidden="true">
                              <Video className="h-5 w-5" />
                            </div>
                          )}
                          <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-slate-950/85 px-1 py-1 text-center text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                            {changingThumbnailId === item.id ? 'Updating...' : 'Change thumb'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={changingThumbnailId !== null}
                              onChange={(event) => {
                                void handleThumbnailChange(item, event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                              {item.type}
                            </span>
                            {editingStorageItemId === item.id ? (
                              <input
                                type="text"
                                value={editingStorageTitle}
                                onChange={(e) => setEditingStorageTitle(e.target.value)}
                                className={`w-full rounded-lg border px-3 py-1 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 ${
                                  isDarkMode ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                                }`}
                                autoFocus
                              />
                            ) : (
                              <span className={`truncate text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {item.title}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 font-mono">
                            {item.file_url}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {editingStorageItemId === item.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleUpdateStorageItem(item.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStorageItemId(null);
                                  setEditingStorageTitle('');
                                }}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                                  isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
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
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                                  isDarkMode
                                    ? 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteStorageItem(item.id)}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/15 hover:border-rose-500/30 active:scale-95"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'histories' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Activity History</h2>
                    <p className={isDarkMode ? 'mt-1 text-sm text-slate-400' : 'mt-1 text-sm text-slate-600'}>
                      Every recorded dashboard change with the exact time it happened.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    disabled={history.length === 0}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm font-semibold text-rose-400 shadow-sm transition-all duration-200 hover:bg-rose-500/15 hover:border-rose-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear all history
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`border-b text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'border-slate-800/80 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-50/70 text-slate-500'}`}>
                      <tr>
                        <th className="px-6 py-4">Change</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Time</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200/80'}`}>
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full border ${isDarkMode ? 'border-slate-800 bg-slate-800/50 text-slate-500' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>No activity recorded yet.</p>
                              <p className="mt-1 text-xs text-slate-500">Dashboard events will appear here as they occur.</p>
                            </div>
                          </td>
                        </tr>
                      ) : history.map((item) => (
                        <tr
                          key={item.id}
                          className={`transition-colors duration-150 ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {item.description}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                              {item.action} {item.entityType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`whitespace-nowrap px-6 py-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <div className="flex items-center justify-between gap-6">
                              <span className="font-mono text-xs">{new Date(item.createdAt).toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteHistory(item.id)}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/15 hover:border-rose-500/30 active:scale-95"
                              >
                                Clear
                              </button>
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
              {/* Storage Overview Card */}
              <div className={`rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'border-slate-800/80 bg-slate-900/85 shadow-xl shadow-black/30' : 'border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50'}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Storage Overview</h2>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Google Drive capacity used by your uploaded media.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 shadow-sm">
                    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8-4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <span className="text-xs font-semibold text-indigo-400">Live Quota</span>
                  </div>
                </div>

                {driveStorageEntries && driveStorageEntries.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {driveStorageEntries.map((entry) => {
                      const usagePercent = entry.limit ? Math.min((entry.used / (entry.limit || 1)) * 100, 100) : 0;
                      return (
                        <div
                          key={entry.label}
                          className={`rounded-xl border p-5 transition-all duration-200 ${isDarkMode ? 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1">
                              <span className="inline-flex items-center rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                                {entry.label}
                              </span>
                              <div>
                                <p className="text-3xl font-bold tracking-tight mt-1">{formatBytes(entry.used)}</p>
                                <p className="text-xs font-medium text-slate-400">total space used</p>
                              </div>
                            </div>

                            <div className={`rounded-xl p-3 border text-right space-y-1 ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                              <p className="text-xs font-semibold text-slate-300">
                                {entry.limit ? `${formatBytes(entry.limit)} limit` : 'No storage limit'}
                              </p>
                              <div className="flex items-center justify-end gap-3 text-xs font-medium pt-1">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>My Drive: <strong className="font-mono text-indigo-400">{formatBytes(entry.usedInDrive)}</strong></span>
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Trash: <strong className="font-mono text-slate-300">{formatBytes(entry.usedInTrash)}</strong></span>
                              </div>
                            </div>
                          </div>

                          {entry.limit ? (
                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-xs font-medium text-slate-400">
                                <span>Usage Capacity</span>
                                <span className="font-mono">{Math.round(usagePercent)}%</span>
                              </div>
                              <div className={`h-2.5 w-full overflow-hidden rounded-full p-0.5 ${isDarkMode ? 'bg-slate-950 border border-slate-800' : 'bg-slate-200'}`}>
                                <div
                                  className="h-full rounded-full bg-linear-to-r from-indigo-600 to-indigo-400 transition-all duration-500 shadow-sm shadow-indigo-500/50"
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                            </div>
                          ) : null}

                          {entry.error ? (
                            <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400">
                              {entry.error}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : driveStorage ? (
                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-3xl font-bold tracking-tight">{formatBytes(driveStorage.used)}</p>
                        <p className="text-xs font-medium text-slate-400">used across Drive</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-300">
                        {driveStorage.limit ? `${formatBytes(driveStorage.limit)} total limit` : 'No storage limit reported'}
                      </p>
                    </div>

                    {driveStorage.limit ? (
                      <div className={`h-2.5 w-full overflow-hidden rounded-full p-0.5 ${isDarkMode ? 'bg-slate-950 border border-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-linear-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
                          style={{ width: `${Math.min((driveStorage.used / driveStorage.limit) * 100, 100)}%` }}
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-6 pt-2 text-xs font-medium text-slate-400 border-t border-slate-800/80">
                      <span>My Drive: <strong className="font-mono text-indigo-400">{formatBytes(driveStorage.usedInDrive)}</strong></span>
                      <span>Trash: <strong className="font-mono text-slate-300">{formatBytes(driveStorage.usedInTrash)}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm font-medium text-rose-400">
                    {driveStorageError || 'Drive storage usage is unavailable.'}
                  </div>
                )}
              </div>

              {/* Hidden Upload Form */}
              <div className="hidden">
                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Title</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white focus:border-indigo-500' : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-indigo-600'}`}
                      placeholder="Song or image title"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Type</label>
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white focus:border-indigo-500' : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-indigo-600'}`}
                    >
                      <option value="music">Music</option>
                      <option value="image">Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">File</label>
                    <input
                      type="file"
                      accept="audio/*,image/*"
                      onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 transition ${
                        isDarkMode
                          ? 'border-slate-800 bg-slate-950 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                  </div>

                  {uploadMessage && (
                    <p className={`text-sm font-medium ${uploadMessage.includes('Unable') ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {uploadMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-xl bg-indigo-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                  >
                    {uploading ? 'Saving Upload…' : 'Save Upload Record'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Artist Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className={`w-full max-w-md rounded-3xl border p-7 shadow-2xl transition-all duration-300 ${
            isDarkMode
              ? 'border-slate-800/90 bg-slate-900/95 text-white shadow-black/50'
              : 'border-slate-200/90 bg-white/95 text-slate-900 shadow-slate-200/50'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-700/30">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Add New Artist</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Enter the details to create a new artist profile
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddArtist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Artist Name</label>
                <input
                  type="text"
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                    isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Genre</label>
                <input
                  type="text"
                  value={newArtistGenre}
                  onChange={(e) => setNewArtistGenre(e.target.value)}
                  placeholder="e.g. Afrobeats, Pop"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                    isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  required
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30 hover:from-indigo-500 hover:to-indigo-600 transition-all"
                >
                  Add Artist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className={`w-full max-w-lg rounded-3xl border p-7 shadow-2xl transition-all duration-300 ${
            isDarkMode
              ? 'border-slate-800/90 bg-slate-900/95 text-white shadow-black/50'
              : 'border-slate-200/90 bg-white/95 text-slate-900 shadow-slate-200/50'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-700/30">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {editingMember ? 'Edit Team Member' : 'Add New Member'}
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {editingMember ? 'Update member details and privileges' : 'Fill in the information to add a new member to the platform'}
                </p>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              {/* Profile Picture Upload Section */}
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5">
                <div className="relative shrink-0">
                  <div className={`h-16 w-16 overflow-hidden rounded-2xl border-2 shadow-inner flex items-center justify-center font-bold text-xl uppercase ${
                    isDarkMode ? 'border-slate-700 bg-slate-800 text-indigo-400' : 'border-slate-200 bg-slate-100 text-indigo-600'
                  }`}>
                    {newMemberProfilePic ? (
                      <Image src={newMemberProfilePic} alt="Preview" fill unoptimized className="object-cover" />
                    ) : (
                      <span>{newMemberName ? newMemberName.charAt(0) : 'N'}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400">Profile Picture</label>
                  <div className="flex items-center gap-2">
                    <label className={`cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition border ${
                      isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}>
                      <span>📁 Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setNewMemberProfilePic(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {newMemberProfilePic && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMemberProfilePic('');
                        }}
                        className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                      isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                      isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Contact Number</label>
                <input
                  type="text"
                  value={newMemberContact}
                  onChange={(e) => setNewMemberContact(e.target.value)}
                  placeholder="e.g. +256 700 000000"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                    isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Member Category</label>
                <div className="relative">
                  <select
                    value={newMemberCategory}
                    onChange={(e) => setNewMemberCategory(e.target.value as Member['category'])}
                    className={`w-full appearance-none rounded-xl border px-4 py-2.5 pr-10 text-sm outline-none transition cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                      isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  >
                    <option value="Regular Members" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Regular Members</option>
                    <option value="Board Members" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Board Members</option>
                    <option value="Artists" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Artists</option>
                    <option value="Dancers" className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Dancers</option>
                  </select>
                  {/* Custom Modern Dropdown Arrow Indicator */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-indigo-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    disabled={savingMember}
                  className="rounded-xl bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30 hover:from-indigo-500 hover:to-indigo-600 transition-all"
                >
                  {savingMember ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
