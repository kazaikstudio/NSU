'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

export type MemberCategory = 'Board Members' | 'Artists' | 'Dancers' | 'Regular Members';
export type MemberStatus = 'Active' | 'Inactive' | 'Pending' | 'Suspended';

export interface Member {
  id: string;
  name: string;
  email: string;
  contact?: string;
  contact2?: string;
  profilePic?: string;
  age?: number;
  dateJoined?: string;
  village?: string;
  district?: string;
  guardianName?: string;
  guardianContact?: string;
  subCounty?: string;
  suspendedAt?: string | null;
  suspensionDays?: number;
  category: MemberCategory;
  status: MemberStatus;
}

export interface MemberFormValues {
  name: string;
  email: string;
  contact: string;
  contact2: string;
  profilePic: string;
  age: number;
  dateJoined: string;
  village: string;
  district: string;
  guardianName: string;
  guardianContact: string;
  subCounty: string;
  suspendedAt: string | null;
  suspensionDays: number;
  category: MemberCategory;
  status: MemberStatus;
}

interface EditMemberModalProps {
  member: Member;
  isDarkMode: boolean;
  onClose: () => void;
  onUpdate: (values: MemberFormValues) => Promise<void>;
}

const CATEGORIES: MemberCategory[] = ['Regular Members', 'Board Members', 'Artists', 'Dancers'];
const STATUS_OPTIONS: { value: Exclude<MemberStatus, 'Pending'>; label: string; activeClass: string; inactiveClass: string }[] = [
  {
    value: 'Active',
    label: 'Active',
    activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30',
    inactiveClass: 'border-slate-700 text-slate-400 hover:border-emerald-500/40',
  },
  {
    value: 'Inactive',
    label: 'Inactive',
    activeClass: 'border-amber-500 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30',
    inactiveClass: 'border-slate-700 text-slate-400 hover:border-amber-500/40',
  },
  {
    value: 'Suspended',
    label: 'Suspended',
    activeClass: 'border-rose-500 bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30',
    inactiveClass: 'border-slate-700 text-slate-400 hover:border-rose-500/40',
  },
];

function formatRemaining(ms: number) {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export default function EditMemberModal({ member, isDarkMode, onClose, onUpdate }: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [contact, setContact] = useState(member.contact ?? '');
  const [contact2, setContact2] = useState(member.contact2 ?? '');
  const [profilePic, setProfilePic] = useState(member.profilePic ?? '');
  const [age, setAge] = useState(member.age ? String(member.age) : '');
  const [dateJoined, setDateJoined] = useState(member.dateJoined ?? '');
  const [village, setVillage] = useState(member.village ?? '');
  const [district, setDistrict] = useState(member.district ?? '');
  const [guardianName, setGuardianName] = useState(member.guardianName ?? '');
  const [guardianContact, setGuardianContact] = useState(member.guardianContact ?? '');
  const [subCounty, setSubCounty] = useState(member.subCounty ?? '');
  const [category, setCategory] = useState<MemberCategory>(member.category);
  const [status, setStatus] = useState<MemberStatus>(member.status);
  const [durationUnit, setDurationUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [durationValue, setDurationValue] = useState(member.suspensionDays ? String(member.suspensionDays) : '');
  const [suspendedAt, setSuspendedAt] = useState<string | null>(
    member.suspendedAt ?? (member.status === 'Suspended' ? new Date().toISOString() : null)
  );
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (status !== 'Suspended' || !suspendedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status, suspendedAt]);

  const unitMultiplier = durationUnit === 'weeks' ? 7 : durationUnit === 'months' ? 30 : 1;
  const suspensionDaysNum = (Number(durationValue) || 0) * unitMultiplier;
  const suspensionEnd = suspendedAt
    ? new Date(new Date(suspendedAt).getTime() + suspensionDaysNum * 86400000).getTime()
    : 0;
  const remainingMs = now > 0 ? suspensionEnd - now : 0;

  const selectStatus = (s: Exclude<MemberStatus, 'Pending'>) => {
    setStatus(s);
    if (s === 'Suspended') {
      setSuspendedAt((prev) => prev ?? new Date().toISOString());
    } else {
      setSuspendedAt(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !name.trim() || !email.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onUpdate({
        name,
        email,
        contact,
        contact2,
        profilePic,
        age: Number(age) || 0,
        dateJoined,
        village,
        district,
        guardianName,
        guardianContact,
        subCounty,
        suspendedAt: status === 'Suspended' ? suspendedAt : null,
        suspensionDays: status === 'Suspended' ? suspensionDaysNum : 0,
        category,
        status,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
    isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5';

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-2 sm:p-4 md:p-6 animate-fadeIn">
        <div className={`w-full max-w-6xl h-full max-h-[92vh] rounded-3xl border flex flex-col shadow-2xl transition-all duration-300 overflow-hidden ${
          isDarkMode
            ? 'border-slate-800/80 bg-slate-900/95 text-slate-100 shadow-indigo-950/30'
            : 'border-slate-200/85 bg-white text-slate-900 shadow-slate-300/40'
        }`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-700/20 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-500 font-bold text-lg shadow-inner">
                ⚡
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Edit Team Member</h3>
                <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Update member credentials, location, and operational statuses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2">
                <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Category
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MemberCategory)}
                    className={`appearance-none rounded-xl border px-3 py-2 pr-9 text-sm font-medium outline-none transition cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                      isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-indigo-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  isDarkMode
                    ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                }`}
              >
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
              {/* Split Layout: Profile/Status on Left (Col 1), Form Inputs on Right (Col 2) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">

                {/* Left Column: Photo & Status Controls (Span 5) */}
                {/* Left Column: Photo & Status Controls (Span 5) */}
                <aside className="w-full lg:col-span-5 space-y-6">

                  {/* Profile Card */}
                  <div className="relative group flex flex-col items-center">
                    <div className={`w-80 h-80 overflow-hidden rounded-3xl border-2 shadow-md flex items-center justify-center font-bold text-5xl uppercase relative ${
                      isDarkMode ? 'border-slate-700 bg-slate-800 text-indigo-400' : 'border-white bg-slate-200 text-indigo-600'
                    }`}>
                      {profilePic ? (
                        <Image
                          src={profilePic}
                          alt="Preview"
                          fill
                          unoptimized
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full">{name ? name.charAt(0) : 'N'}</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-2.5 w-full max-w-sm mx-auto">
                      <label className={`cursor-pointer flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition-all border ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}>
                        <span>📷 Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setProfilePic(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {profilePic && (
                        <button
                          type="button"
                          onClick={() => setProfilePic('')}
                          className={`cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition-all border ${
                            isDarkMode
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          <span>🗑️ Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Member Status */}
                  <div className={`rounded-3xl border p-6 space-y-4 shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200/80 bg-slate-50/50'
                    }`}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-500">Member Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <label
                          key={s.value}
                          className={`flex items-center justify-center gap-1.5 cursor-pointer rounded-2xl border px-2.5 py-3 text-xs font-semibold transition-all ${
                            status === s.value ? s.activeClass : isDarkMode ? s.inactiveClass : `${s.inactiveClass} border-slate-200 bg-white shadow-xs`
                          }`}
                        >
                          <input
                            type="radio"
                            name="memberStatus"
                            value={s.value}
                            checked={status === s.value}
                            onChange={() => selectStatus(s.value)}
                            className="h-3.5 w-3.5 accent-indigo-600"
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>

                    {/* Suspension Panel Inside Left Column */}
                    {status === 'Suspended' && (
                      <div className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3 animate-fadeIn mt-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1.5">
                              Suspension Duration
                            </label>
                            <div className={`grid grid-cols-3 gap-1 rounded-xl border p-1 mb-2.5 ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-rose-200 bg-white'}`}>
                              {(['days', 'weeks', 'months'] as const).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => setDurationUnit(u)}
                                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition-all ${
                                    durationUnit === u
                                      ? 'bg-rose-500 text-white shadow-sm'
                                      : isDarkMode
                                      ? 'text-slate-400 hover:text-white'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  {u}
                                </button>
                              ))}
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={durationValue}
                              onChange={(e) => setDurationValue(e.target.value)}
                              placeholder={`Enter number of ${durationUnit}`}
                              className={`${inputClass} ${isDarkMode ? 'border-rose-500/40 bg-rose-950/20' : 'border-rose-300 bg-rose-50/30'}`}
                            />
                          </div>
                          <div className={`flex-1 rounded-xl border px-4 py-3 ${isDarkMode ? 'border-rose-500/40 bg-rose-950/40' : 'border-rose-200 bg-rose-50'}`}>
                            <span className="block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">Remaining Time</span>
                            <div className="font-mono text-xl font-bold tabular-nums text-rose-400">
                              {now > 0 ? formatRemaining(remainingMs) : '…'}
                            </div>
                          </div>
                        </div>
                        <p className={`text-xs ${isDarkMode ? 'text-rose-300/60' : 'text-rose-400/80'}`}>
                          Timer starts automatically when this member is suspended.
                        </p>
                      </div>
                    )}
                  </div>

                </aside>

                {/* Right Column: Form Inputs (Span 7) */}
                <div className="space-y-6 w-full lg:col-span-7">

                  {/* Basic Info Group */}
                  <div className={`rounded-3xl border p-6 space-y-4 shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200/80 bg-slate-50/50'
                    }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">1. Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Full Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. john@example.com"
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Age</label>
                        <input
                          type="number"
                          min={0}
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="e.g. 25"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Date Joined Noll Studio</label>
                        <input
                          type="date"
                          value={dateJoined}
                          onChange={(e) => setDateJoined(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact & Location Group */}
                  <div className={`rounded-3xl border p-6 space-y-4 shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200/80 bg-slate-50/50'
                    }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">2. Contact & Location</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Contact Number</label>
                        <input
                          type="text"
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="e.g. +256 700 000000"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Alternative Contact</label>
                        <input
                          type="text"
                          value={contact2}
                          onChange={(e) => setContact2(e.target.value)}
                          placeholder="e.g. +256 700 000001"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Village</label>
                        <input
                          type="text"
                          value={village}
                          onChange={(e) => setVillage(e.target.value)}
                          placeholder="e.g. Raa"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>District</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g. Amuru"
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Sub County</label>
                        <input
                          type="text"
                          value={subCounty}
                          onChange={(e) => setSubCounty(e.target.value)}
                          placeholder="e.g. Kall west"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Guardian / Parent Group */}
                  <div className={`rounded-3xl border p-6 space-y-4 shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200/80 bg-slate-50/50'
                    }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">3. Guardian Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Guardian / Parent Name</label>
                        <input
                          type="text"
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          placeholder="e.g. Mama"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Guardian / Parent Contact</label>
                        <input
                          type="text"
                          value={guardianContact}
                          onChange={(e) => setGuardianContact(e.target.value)}
                          placeholder="e.g. +256 700 000002"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 px-6 sm:px-8 py-4 border-t border-slate-700/20 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

        </div>
      </div>
    );

}
