import { AuthGuard } from '../../../components/auth-guard';
import { DashboardProvider } from '../../../components/dashboard-context';
import { RouteShell } from '../../../components/route-shell';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardProvider>
        <RouteShell>{children}</RouteShell>
      </DashboardProvider>
    </AuthGuard>
  );
}
