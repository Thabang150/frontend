'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthScreen } from '../components/auth-screen';
import { LoadingState } from '../components/loading-state';
import { useAuth } from '../components/auth-provider';

function DashboardEntryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/websites');
  }, [router]);

  return <LoadingState message="Opening your workspace..." />;
}

export default function HomePage() {
  const { status, user } = useAuth();

  if (status === 'loading' || status === 'refreshing') {
    return <LoadingState message="Checking your workspace..." />;
  }

  if (status === 'authenticated' && user) {
    return <DashboardEntryRedirect />;
  }

  return <AuthScreen />;
}
