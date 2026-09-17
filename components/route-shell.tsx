'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './auth-provider';
import { DateRangePicker, WebsiteSelector } from './dashboard-context';

const mainNav = [
  { label: 'Overview', href: 'overview' },
  { label: 'Acquisition', href: 'acquisition' },
  { label: 'Audience', href: 'audience' },
  { label: 'Behaviour', href: 'behavior' },
  { label: 'Conversions', href: 'conversions' },
  { label: 'Website Health', href: 'health' },
  { label: 'Intelligence', href: 'intelligence' },
  { label: 'Reports', href: 'reports' },
];

const settingsNav = [
  { label: 'Tracking', href: 'settings/tracking' },
  { label: 'Funnels', href: 'settings/funnels' },
  { label: 'Website', href: 'settings/website' },
];

export function RouteShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ websiteId?: string }>();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const websiteId = params?.websiteId;
  const basePath = websiteId ? `/websites/${websiteId}` : '/websites';

  return (
    <div className="route-shell">
      <aside className={`route-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="route-sidebar-header">
          <div className="brand-mark sidebar-brand">
            <img src="/TMTR20-double-infinity.png" alt="TMTR20" />
            <strong>TMTR20</strong>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="route-nav-group">
          {mainNav.map((item) => {
            const href = `${basePath}/${item.href}`;
            const active = pathname === href;
            return (
              <Link key={item.label} href={href} className={`route-link ${active ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="route-nav-divider" />

        <div className="route-nav-group">
          {settingsNav.map((item) => {
            const href = `${basePath}/${item.href}`;
            const active = pathname === href;
            return (
              <Link key={item.label} href={href} className={`route-link ${active ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="route-user-panel">
          <div className="route-user-meta">
            <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'U'}</div>
            <div>
              <strong>{user?.name ?? 'User'}</strong>
              <span>{user?.email ?? 'Workspace access'}</span>
            </div>
          </div>
          <button className="signout-button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="route-content">
        <header className="route-topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="route-topbar-copy">
            <p className="eyebrow">Workspace</p>
            <h1>TMTR20 Website Intelligence</h1>
          </div>

          <div className="route-toolbar">
            <WebsiteSelector />
            <DateRangePicker />
          </div>
        </header>

        <div className="route-page-content">{children}</div>
      </div>
    </div>
  );
}
