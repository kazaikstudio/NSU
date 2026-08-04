"use client";

import React, { useState } from "react";
import DashboardLogin from '@/components/DashboardLogin';
import DashboardApp from '@/components/DashboardApp';

type DashboardUser = { email: string; full_name: string; role: string };

export default function DashboardSession() {
  const [sessionUser, setSessionUser] = useState<DashboardUser | null>(null);

  const handleLogin = (u: DashboardUser) => {
    setSessionUser(u);
  };

  if (!sessionUser) {
    return <DashboardLogin onLogin={handleLogin} />;
  }

  return <DashboardApp user={sessionUser} />;
}
