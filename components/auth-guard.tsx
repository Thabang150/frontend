'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      router.replace('/');
    }
  }, [router, status, user]);

  if (status === 'loading' || status === 'refreshing') {
    return <LoadingState message="Authenticating workspace access..." />;
  }

  if (status === 'authenticated' && user) {
    return <>{children}</>;
  }

  return null;
}
