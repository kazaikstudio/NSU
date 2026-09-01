import React from 'react';
import DashboardSession from '@/components/DashboardSession';
import DashboardApp from '@/components/DashboardApp';
import { getDashboardSessionUser } from '@/lib/dashboard-auth';

export default async function Page() {
  const user = await getDashboardSessionUser();

  if (user) {
    return <DashboardApp user={user} />;
  }

  return <DashboardSession />;
}


