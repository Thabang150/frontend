'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '../../components/auth-guard';
import { DashboardProvider, useDashboard } from '../../components/dashboard-context';
import { LoadingState } from '../../components/loading-state';

function WebsiteEntryRedirect() {
  const router = useRouter();
  const { selectedWebsite, websiteLoading } = useDashboard();

  useEffect(() => {
    if (selectedWebsite?._id) {
      router.replace(`/websites/${selectedWebsite._id}/overview`);
    }
  }, [router, selectedWebsite?._id]);

  if (websiteLoading || !selectedWebsite) {
    return <LoadingState message="Loading your websites..." />;
  }

  return <LoadingState message="Opening your website workspace..." />;
}

export default function WebsitesRootPage() {
  return (
    <AuthGuard>
      <DashboardProvider>
        <WebsiteEntryRedirect />
      </DashboardProvider>
    </AuthGuard>
  );
}
