'use client';

import { LegacyDashboard } from '../components/legacy-dashboard';
import { AuthScreen } from '../components/auth-screen';
import { LoadingState } from '../components/loading-state';
import { useAuth } from '../components/auth-provider';

export default function HomePage() {
  const { status, user } = useAuth();

  if (status === 'loading' || status === 'refreshing') {
    return <LoadingState message="Checking your workspace..." />;
  }

  if (status === 'authenticated' && user) {
    return <LegacyDashboard />;
  }

  return <AuthScreen />;
}
