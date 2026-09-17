import { redirect } from 'next/navigation';

export default function WebsiteRoutePage({ params }: { params: Promise<{ websiteId: string }> }) {
  void params;
  redirect('/websites/overview');
}
