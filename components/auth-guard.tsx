'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';
import { LoadingState } from './loading-state';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated' && pathname !== '/') {
      router.replace('/');
    }
  }, [pathname, router, status]);

  if (status === 'loading' || status === 'refreshing') {
    return <LoadingState message="Authenticating workspace access..." />;
  }

  if (status === 'authenticated' && user) {
    return <>{children}</>;
  }

  return null;
}
