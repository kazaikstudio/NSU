"use client";

import React, { useState } from "react";
import DashboardLogin from '@/components/DashboardLogin';
import DashboardApp from '@/components/DashboardApp';

export default function Page() {
  // Read localStorage synchronously on first render (client-side only)
  const [user, setUser] = useState<{ email: string; full_name: string; role: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("nsu_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (u: { email: string; full_name: string; role: string }) => {
    setUser(u);
  };

  if (!user) {
    return <DashboardLogin onLogin={handleLogin} />;
  }

  return <DashboardApp user={user} />;
}