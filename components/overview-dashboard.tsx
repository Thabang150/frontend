'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, RefreshCw, Users, MousePointerClick, TrendingUp } from 'lucide-react';
import { apiRequest, type ApiError } from '../lib/api';
import { useDashboard, type WebsiteRecord } from './dashboard-context';
import { LoadingState } from './loading-state';

type TrafficPoint = {
  date?: string;
  label?: string;
  visitors?: number;
  sessions?: number;
  [key: string]: unknown;
};

type OverviewResponse = {
  visitors?: number;
  sessions?: number;
  pageViews?: number;
  pagesPerSession?: number;
  averageSessionDurationSeconds?: number;
  conversions?: number;
  conversionRate?: number;
  conversionBreakdown?: Record<string, number>;
  trafficTrend?: TrafficPoint[];
  trend?: TrafficPoint[];
  comparison?: {
    visitorsChange?: number;
    sessionsChange?: number;
    conversionRateChange?: number;
  };
  [key: string]: unknown;
};

const formatLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${accent}`}>
        {label === 'Visitors' ? <Users size={16} /> : label === 'Sessions' ? <BarChart3 size={16} /> : <MousePointerClick size={16} />}
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-state error-state">
      <AlertTriangle size={18} />
      <div>
        <h3>Something went wrong</h3>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="primary-button compact" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel-state empty-state-panel">
      <p className="eyebrow">Overview</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function OverviewDashboard() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    if (!selectedWebsite?._id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextData = await apiRequest<OverviewResponse>(
        `/websites/${selectedWebsite._id}/overview?startDate=${encodeURIComponent(dateRange.from)}&endDate=${encodeURIComponent(dateRange.to)}`,
      );
      setData(nextData);
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'Unable to load overview analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const trendPoints = useMemo(() => {
    const list = Array.isArray(data?.trafficTrend) ? data.trafficTrend : Array.isArray(data?.trend) ? data.trend : [];
    if (!list.length) return [];

    const values = list.map((point) => Number(point.visitors ?? point.sessions ?? 0)).filter((value) => Number.isFinite(value));
    const maxValue = Math.max(...values, 1);

    return list.map((point, index) => {
      const value = Number(point.visitors ?? point.sessions ?? 0);
      const x = list.length === 1 ? 50 : (index / (list.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 80;
      return `${x},${y}`;
    });
  }, [data]);

  if (!selectedWebsite) {
    return <EmptyState title="No website selected" description="Choose an active website to view its overview." />;
  }

  if (loading) return <LoadingState message="Loading overview data..." />;

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadOverview()} />;
  }

  if (!data || (!data.visitors && !data.sessions && !data.pageViews && !data.conversions)) {
    return (
      <EmptyState
        title="No data yet"
        description="This website has not collected enough analytics for the chosen time period yet. Once visits start arriving, the overview will populate here."
      />
    );
  }

  const conversionEntries = Object.entries(data.conversionBreakdown ?? {});
  const comparison = data.comparison ?? {};

  return (
    <div className="overview-page">
      <header className="overview-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>{selectedWebsite.name}</h2>
          <p className="overview-subtitle">Here is what is happening on your website during the selected period.</p>
        </div>
        <div className="overview-range-meta">
          <span>{dateRange.from}</span>
          <span>→</span>
          <span>{dateRange.to}</span>
        </div>
      </header>

      <section className="stat-grid">
        <StatCard label="Visitors" value={Number(data.visitors ?? 0).toLocaleString()} detail="unique visitors" accent="green" />
        <StatCard label="Sessions" value={Number(data.sessions ?? 0).toLocaleString()} detail={`${Number(data.pagesPerSession ?? 0).toFixed(1)} pages / session`} accent="blue" />
        <StatCard label="Pageviews" value={Number(data.pageViews ?? 0).toLocaleString()} detail="tracked page views" accent="orange" />
        <StatCard label="Conversions" value={Number(data.conversions ?? 0).toLocaleString()} detail={`${Number(data.conversionRate ?? 0).toFixed(1)}% conversion rate`} accent="violet" />
      </section>

      <section className="overview-main-grid">
        <div className="panel-block">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Traffic</p>
              <h3>Traffic trend</h3>
            </div>
            {comparison.visitorsChange !== undefined && (
              <span className="period-badge">
                <TrendingUp size={14} />
                {comparison.visitorsChange > 0 ? '+' : ''}
                {Number(comparison.visitorsChange).toFixed(1)}% vs previous period
              </span>
            )}
          </div>

          {trendPoints.length ? (
            <div className="trend-chart-box">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-chart-svg">
                <path d={`M ${trendPoints.join(' L ')}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <div className="chart-empty">Traffic trend data is not available for this range yet.</div>
          )}
        </div>

        <div className="panel-block">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Conversions</p>
              <h3>Conversion summary</h3>
            </div>
            <span className="panel-kicker">{Number(data.conversionRate ?? 0).toFixed(1)}% rate</span>
          </div>

          <div className="conversion-summary">
            <div>
              <span>Total conversions</span>
              <strong>{Number(data.conversions ?? 0).toLocaleString()}</strong>
            </div>
            <div>
              <span>Conversion rate</span>
              <strong>{Number(data.conversionRate ?? 0).toFixed(1)}%</strong>
            </div>
            <div>
              <span>Page views</span>
              <strong>{Number(data.pageViews ?? 0).toLocaleString()}</strong>
            </div>
          </div>

          {conversionEntries.length ? (
            <div className="conversion-breakdown-list">
              {conversionEntries.map(([key, value]) => (
                <div key={key} className="conversion-breakdown-row">
                  <span>{formatLabel(key)}</span>
                  <strong>{Number(value).toLocaleString()}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No conversion breakdown was returned for this website and period.</p>
          )}
        </div>
      </section>
    </div>
  );
}
