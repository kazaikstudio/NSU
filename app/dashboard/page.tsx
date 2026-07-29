
'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(false);

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
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-0"
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
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-0"
            placeholder="Enter password"
            required
          />

          {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-400">Dashboard</p>
            <h1 className="text-3xl font-semibold">Welcome back, {user?.full_name || 'User'}</h1>
          </div>
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setEmail('');
              setPassword('');
              setUser(null);
            }}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Email</p>
            <p className="mt-2 text-lg font-medium">{user?.email}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Role</p>
            <p className="mt-2 text-lg font-medium">{user?.role}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Database</p>
            <p className="mt-2 text-lg font-medium">PostgreSQL</p>
          </div>
        </div>
      </div>
    </main>
  );
}