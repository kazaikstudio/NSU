"use client";

import React, { useEffect, useState } from "react";
import DashboardLogin from '@/components/DashboardLogin';
import DashboardApp from '@/components/DashboardApp';

type DashboardUser = { email: string; full_name: string; role: string };

export default function DashboardSession() {
  const [sessionUser, setSessionUser] = useState<DashboardUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHydrated(true);
      return;
    }

    try {
      const rawUser = window.localStorage.getItem('nsu_user');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as Partial<DashboardUser>;
        if (
          typeof parsedUser.email === 'string' &&
          typeof parsedUser.full_name === 'string' &&
          typeof parsedUser.role === 'string'
        ) {
          setSessionUser({
            email: parsedUser.email,
            full_name: parsedUser.full_name,
            role: parsedUser.role,
          });
        }
      }
    } catch {
      window.localStorage.removeItem('nsu_user');
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const handleLogin = (u: DashboardUser) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nsu_user', JSON.stringify(u));
    }
    setSessionUser(u);
  };

  if (!isHydrated) {
    return null;
  }

  if (!sessionUser) {
    return <DashboardLogin onLogin={handleLogin} />;
  }

  return <DashboardApp user={sessionUser} />;
}
