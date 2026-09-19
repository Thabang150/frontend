import { redirect } from 'next/navigation';

export default function WebsiteRoutePage({ params }: { params: Promise<{ websiteId: string }> }) {
  return params.then(({ websiteId }) => {
    redirect(`/websites/${websiteId}/overview`);
  });
}
