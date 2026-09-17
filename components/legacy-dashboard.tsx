'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Check,
  Copy,
  Globe2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { apiRequest, type ApiError } from '../lib/api';
import { useAuth } from './auth-provider';

type User = { id: string; name: string; email: string; role: string };
type Website = { _id: string; name: string; domain: string; url: string; trackingId: string; status: string };
type Overview = {
  visitors: number;
  sessions: number;
  pageViews: number;
  pagesPerSession: number;
  conversions: number;
  conversionRate: number;
  conversionBreakdown: Record<string, number>;
};
type Audit = { performanceScore: number; seoScore: number; mobileScore: number; securityScore: number };
type Report = { _id: string; status: string };

export function LegacyDashboard() {
  const { user, accessToken, logout } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selected, setSelected] = useState<Website | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-10-01');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [installationWebsite, setInstallationWebsite] = useState<Website | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    apiRequest<Website[]>('/websites', {}, false)
      .then((items) => {
        setWebsites(items);
        setSelected(items[0] ?? null);
      })
      .catch((cause) => setNotice((cause as ApiError).message || 'Unable to load websites'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!selected || !accessToken) return;
    setLoading(true);
    Promise.all([
      apiRequest<Overview>(`/websites/${selected._id}/overview?startDate=${startDate}&endDate=${endDate}`),
      apiRequest<Audit>(`/websites/${selected._id}/audits/latest`),
      apiRequest<Report>(`/websites/${selected._id}/reports/latest`),
    ])
      .then(([nextOverview, nextAudit, nextReport]) => {
        setOverview(nextOverview);
        setAudit(nextAudit);
        setReport(nextReport);
      })
      .catch((cause) => setNotice((cause as ApiError).message || 'Unable to fetch workspace metrics'))
      .finally(() => setLoading(false));
  }, [selected, startDate, endDate, accessToken]);

  async function addWebsite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const website = await apiRequest<Website>('/websites', {
        method: 'POST',
        body: JSON.stringify({ name: data.get('name'), url: data.get('url'), timezone: data.get('timezone') }),
      });
      setWebsites([website, ...websites]);
      setSelected(website);
      setInstallationWebsite(website);
      setCopiedSnippet(false);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not add website');
    }
  }

  const trackerSnippet = installationWebsite
    ? `import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://tmtr20-web-tracker.onrender.com/tracker.js"
          data-site-id="tmtr_${installationWebsite.trackingId}"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`
    : '';

  async function copySnippet() {
    if (!trackerSnippet) return;
    await navigator.clipboard.writeText(trackerSnippet);
    setCopiedSnippet(true);
  }

  async function runAudit() {
    if (!selected) return;
    setNotice('Running audit...');
    try {
      const nextAudit = await apiRequest<Audit>(`/websites/${selected._id}/audits`, { method: 'POST' });
      setAudit(nextAudit);
      setNotice('Audit completed.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Audit failed');
    }
  }

  async function generateReport() {
    if (!selected) return;
    setNotice('Generating report and PDF...');
    try {
      const nextReport = await apiRequest<Report>(`/websites/${selected._id}/reports/monthly`, {
        method: 'POST',
        body: JSON.stringify({ periodStart: startDate, periodEnd: endDate }),
      });
      setReport(nextReport);
      setNotice('Report ready.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Report failed');
    }
  }

  async function emailReport() {
    if (!selected || !report) return;
    setNotice('Sending report...');
    try {
      const nextReport = await apiRequest<Report>(`/websites/${selected._id}/reports/${report._id}/email`, { method: 'POST' });
      setReport(nextReport);
      setNotice('Report emailed.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Email failed');
    }
  }

  const score = audit
    ? Math.round((audit.performanceScore + audit.seoScore + audit.mobileScore + audit.securityScore) / 4)
    : null;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand-mark sidebar-brand">
            <img src="/TMTR20-double-infinity.png" alt="TMTR20" />
            <strong>TMTR20</strong>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}>
            <X size={20} />
          </button>
        </div>

        <nav>
          <a className="active">
            <LayoutDashboard size={18} />
            Overview
          </a>
          <a>
            <BarChart3 size={18} />
            Analytics
          </a>
          <a>
            <ShieldCheck size={18} />
            Audits
          </a>
          <a>
            <Inbox size={18} />
            Reports
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'U'}</div>
            <div>
              <strong>{user?.name ?? 'User'}</strong>
              <span>{user?.email ?? ''}</span>
            </div>
          </div>
          <button className="signout-button" onClick={() => void logout()}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}>
            <Menu size={21} />
          </button>

          <div className="topbar-brand">
            <p className="eyebrow">TMTR20</p>
            <h1>Website Intelligence</h1>
          </div>

          <div className="topbar-actions">
            <button className="icon-button">
              <Search size={19} />
            </button>
            <button className="avatar desktop-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'U'}</button>
          </div>
        </header>

        <div className="content">
          <div className="workspace-toolbar">
            <div className="website-select">
              <Globe2 size={18} />
              <select value={selected?._id ?? ''} onChange={(e) => setSelected(websites.find((item) => item._id === e.target.value) ?? null)}>
                {websites.map((website) => (
                  <option key={website._id} value={website._id}>
                    {website.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>

            <button className="secondary-button" onClick={() => setShowAdd(true)}>
              <Plus size={17} />
              Add website
            </button>
          </div>

          {notice && (
            <div className="notice">
              <Check size={16} />
              {notice}
            </div>
          )}

          {loading && (
            <div className="loading-line">
              <RefreshCw size={16} className="spin" />
              Refreshing workspace data...
            </div>
          )}

          {!loading && !selected && <EmptyState onClick={() => setShowAdd(true)} />}

          {selected && (
            <>
              <div className="site-heading">
                <div>
                  <p className="eyebrow">Current website</p>
                  <h2>{selected.name}</h2>
                  <a href={selected.url} target="_blank" rel="noreferrer">
                    {selected.url}
                    <ArrowUpRight size={14} />
                  </a>
                </div>
                <span className="status-pill">
                  <span />
                  {selected.status.toLowerCase()}
                </span>
              </div>

              <section className="metrics-grid">
                <Metric label="Visitors" value={overview?.visitors ?? 0} detail="unique visitors" icon={<Users size={19} />} accent="green" />
                <Metric label="Sessions" value={overview?.sessions ?? 0} detail={`${overview?.pagesPerSession ?? 0} pages / session`} icon={<BarChart3 size={19} />} accent="blue" />
                <Metric label="Page views" value={overview?.pageViews ?? 0} detail="tracked views" icon={<Globe2 size={19} />} accent="orange" />
                <Metric label="Conversions" value={overview?.conversions ?? 0} detail={`${overview?.conversionRate ?? 0}% conversion rate`} icon={<Sparkles size={19} />} accent="violet" />
              </section>

              <div className="date-bar">
                <div>
                  <span>Reporting window</span>
                  <strong>
                    {startDate} → {endDate}
                  </strong>
                </div>
                <div className="date-inputs">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Conversions</p>
                      <h3>What is working</h3>
                    </div>
                    <span className="panel-kicker">{overview?.conversionRate ?? 0}% rate</span>
                  </div>

                  <div className="conversion-list">
                    {Object.entries(overview?.conversionBreakdown ?? {}).map(([key, value]) => (
                      <div className="conversion-row" key={key}>
                        <span>{key.replaceAll('_', ' ')}</span>
                        <strong>{value}</strong>
                        <div className="bar">
                          <i style={{ width: `${Math.min(100, Number(value) * 18)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Website health</p>
                      <h3>Audit snapshot</h3>
                    </div>
                    <span className="health-score">
                      {score ?? '—'}
                      <small>/100</small>
                    </span>
                  </div>

                  {audit ? (
                    <div className="score-list">
                      <Score label="Performance" value={audit.performanceScore} />
                      <Score label="SEO" value={audit.seoScore} />
                      <Score label="Mobile" value={audit.mobileScore} />
                      <Score label="Security" value={audit.securityScore} />
                    </div>
                  ) : (
                    <p className="empty-copy">No audit yet. Run a scan to see the site health picture.</p>
                  )}

                  <button className="panel-action" onClick={runAudit}>
                    <RefreshCw size={15} />
                    Run audit
                  </button>
                </section>
              </div>

              <section className="report-strip">
                <div>
                  <p className="eyebrow">MONTHLY REPORT</p>
                  <h3>{report ? `Report ready for ${startDate}` : 'Turn this period into a client-ready report'}</h3>
                  <p>{report ? `Status: ${report.status.toLowerCase()}` : 'Bundle KPIs, insights, and your latest website audit.'}</p>
                </div>

                <div className="report-actions">
                  <button className="secondary-button" onClick={generateReport}>
                    <Sparkles size={16} />
                    Generate report
                  </button>

                  {report && (
                    <button className="primary-button compact" onClick={emailReport}>
                      <Mail size={16} />
                      Email report
                    </button>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </section>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setShowAdd(false)}>
              <X size={18} />
            </button>

            {installationWebsite ? (
              <>
                <p className="eyebrow">TRACKING READY</p>
                <h2>Add tracking to {installationWebsite.name}</h2>
                <p className="modal-copy">Paste this into that website&apos;s <strong>app/layout.tsx</strong>, then redeploy it.</p>
                <div className="code-wrap">
                  <pre><code>{trackerSnippet}</code></pre>
                  <button className="copy-button" onClick={copySnippet} type="button">
                    {copiedSnippet ? <Check size={15} /> : <Copy size={15} />}
                    {copiedSnippet ? 'Copied' : 'Copy snippet'}
                  </button>
                </div>
                <p className="modal-copy">The generated site ID is:</p>
                <code className="tracking-id">tmtr_{installationWebsite.trackingId}</code>
                <button className="secondary-button modal-done" onClick={() => { setShowAdd(false); setInstallationWebsite(null); }} type="button">
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">NEW PROPERTY</p>
                <h2>Add a website</h2>

                <form onSubmit={addWebsite}>
                  <label>
                    Website name
                    <input name="name" required placeholder="Acme Studio" />
                  </label>

                  <label>
                    Website URL
                    <input name="url" type="url" required placeholder="https://example.com" />
                  </label>

                  <label>
                    Timezone
                    <input name="timezone" defaultValue="UTC" required />
                  </label>

                  <button className="primary-button" type="submit">
                    Add website
                    <ArrowUpRight size={17} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, icon, accent }: { label: string; value: number; detail: string; icon: React.ReactNode; accent: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="score-track">
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ onClick }: { onClick: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Globe2 size={26} />
      </div>
      <h2>Your workspace is quiet.</h2>
      <p>Add your first website to start collecting visitor signals and health data.</p>
      <button className="primary-button" onClick={onClick}>
        <Plus size={17} />
        Add your first website
      </button>
    </div>
  );
}
