"use client";

import React, { useEffect, useState } from "react";
import DashboardLogin from '@/components/DashboardLogin';
import DashboardApp from '@/components/DashboardApp';

type DashboardUser = { email: string; full_name: string; role: string };

export default function Page() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("nsu_user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  const handleLogin = (u: DashboardUser) => {
    setUser(u);
  };

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-sm text-slate-400">Loading dashboard…</p>
      </main>
    );
  }

  if (!user) {
    return <DashboardLogin onLogin={handleLogin} />;
  }

  return <DashboardApp user={user} />;
}
