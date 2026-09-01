"use client";

import React, { useEffect, useState } from 'react';
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

    const readStoredUser = () => {
      try {
        const rawUser = window.localStorage.getItem('nsu_user');
        if (!rawUser) return null;

        const parsedUser = JSON.parse(rawUser) as Partial<DashboardUser>;
        if (
          typeof parsedUser.email === 'string' &&
          typeof parsedUser.full_name === 'string' &&
          typeof parsedUser.role === 'string'
        ) {
          return {
            email: parsedUser.email,
            full_name: parsedUser.full_name,
            role: parsedUser.role,
          } satisfies DashboardUser;
        }
      } catch {
        window.localStorage.removeItem('nsu_user');
      }

      return null;
    };

    const storedUser = readStoredUser();
    if (storedUser) {
      setSessionUser(storedUser);
      setIsHydrated(true);
      return;
    }

    const hydrateFromServer = async () => {
      try {
        const response = await fetch('/api/dashboard/session', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (response.ok) {
          const data = await response.json();
          const user = data.user as Partial<DashboardUser> | undefined;

          if (
            user &&
            typeof user.email === 'string' &&
            typeof user.full_name === 'string' &&
            typeof user.role === 'string'
          ) {
            const normalizedUser = {
              email: user.email,
              full_name: user.full_name,
              role: user.role,
            } satisfies DashboardUser;

            setSessionUser(normalizedUser);
            window.localStorage.setItem('nsu_user', JSON.stringify(normalizedUser));
            setIsHydrated(true);
            return;
          }
        }
      } catch {
        // fall through to empty state
      }

      setIsHydrated(true);
    };

    void hydrateFromServer();
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
