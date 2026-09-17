'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Gauge, MousePointerClick, TrendingUp, Users } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type ConversionBucket = {
  label?: string;
  name?: string;
  key?: string;
  sessions?: number;
  convertingSessions?: number;
  conversionEvents?: number;
  visitors?: number;
  conversionRate?: number;
  value?: number;
  page?: string;
  pagePath?: string;
  source?: string;
  medium?: string;
  device?: string;
  [key: string]: unknown;
};

type ConversionTrendPoint = {
  date?: string;
  label?: string;
  period?: string;
  conversionEvents?: number;
  convertingSessions?: number;
  conversionRate?: number;
  sessions?: number;
  value?: number;
  [key: string]: unknown;
};

type ConversionsResponse = {
  conversionEvents?: number;
  convertingSessions?: number;
  sessions?: number;
  conversionRate?: number;
  breakdown?: Record<string, number> | ConversionBucket[];
  byPage?: ConversionBucket[];
  bySource?: ConversionBucket[];
  byDevice?: ConversionBucket[];
  trend?: ConversionTrendPoint[];
  conversionTrend?: ConversionTrendPoint[];
  byDate?: ConversionTrendPoint[];
  [key: string]: unknown;
};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLabel = (value: string | undefined) => {
  if (!value) return 'Unknown';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeBreakdown = (value: unknown): Array<{ label: string; value: number }> => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const label = String(record.label ?? record.name ?? record.key ?? record.page ?? record.pagePath ?? record.source ?? record.device ?? record.type ?? 'Item');
        const metric = asNumber(record.value ?? record.conversionEvents ?? record.events ?? record.count ?? record.total ?? record.sessions ?? record.convertingSessions);
        return { label: formatLabel(label), value: metric };
      })
      .filter(Boolean) as Array<{ label: string; value: number }>;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => ({ label: formatLabel(key), value: asNumber(raw) }))
      .filter((entry) => entry.value > 0);
  }

  return [];
};

const normalizeTableRows = (items: unknown): Array<{ label: string; sessions: number; conversions: number; convertingSessions: number; cvr: number }> => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const sessions = asNumber(record.sessions);
      const conversions = asNumber(record.conversionEvents ?? record.conversions ?? record.events ?? record.value);
      const convertingSessions = asNumber(record.convertingSessions ?? record.uniqueConvertingSessions ?? record.convertingSessions ?? record.uniqueSessions);
      const cvr = sessions > 0 ? (convertingSessions / sessions) * 100 : 0;
      return {
        label: String(record.page ?? record.pagePath ?? record.source ?? record.device ?? record.name ?? record.label ?? record.key ?? 'Unknown'),
        sessions,
        conversions,
        convertingSessions,
        cvr,
      };
    })
    .filter(Boolean) as Array<{ label: string; sessions: number; conversions: number; convertingSessions: number; cvr: number }>;
};

const buildTrendSeries = (payload: unknown): { label: string; events: number; sessions: number; rate: number }[] => {
  const source = Array.isArray(payload) ? payload : []; 
  return source.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return { label: '—', events: 0, sessions: 0, rate: 0 };
    }

    const record = entry as Record<string, unknown>;
    const label = String(record.date ?? record.label ?? record.period ?? record.day ?? record.month ?? 'Period');
    return {
      label,
      events: asNumber(record.conversionEvents ?? record.events ?? record.conversions ?? record.total),
      sessions: asNumber(record.convertingSessions ?? record.sessions ?? record.uniqueSessions),
      rate: asNumber(record.conversionRate ?? (asNumber(record.convertingSessions) / Math.max(asNumber(record.sessions), 1)) * 100),
    };
  });
};

function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-state error-state">
      <Gauge size={18} />
      <div>
        <h3>Unable to load conversion analytics</h3>
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

export default function ConversionsPage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [data, setData] = useState<ConversionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversions = async () => {
    if (!selectedWebsite?._id) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<ConversionsResponse>(`/websites/${selectedWebsite._id}/conversions?startDate=${dateRange.from}&endDate=${dateRange.to}`);
      setData(response);
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'The conversion data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConversions();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const headlineRate = asNumber(data?.conversionRate ?? ((asNumber(data?.convertingSessions) / Math.max(asNumber(data?.sessions), 1)) * 100));
  const totalEvents = asNumber(data?.conversionEvents);
  const convertingSessions = asNumber(data?.convertingSessions);
  const sessions = asNumber(data?.sessions);
  const breakdownEntries = normalizeBreakdown(data?.breakdown).slice(0, 8);
  const pageRows = normalizeTableRows(data?.byPage).slice(0, 8);
  const sourceRows = normalizeTableRows(data?.bySource).slice(0, 8);
  const deviceRows = normalizeTableRows(data?.byDevice).slice(0, 8);
  const trendData = buildTrendSeries(data?.trend ?? data?.conversionTrend ?? data?.byDate).slice(0, 14);

  const hasAnyData = !!data && (
    sessions > 0 || totalEvents > 0 || convertingSessions > 0 || breakdownEntries.length > 0 || pageRows.length > 0 || sourceRows.length > 0 || deviceRows.length > 0 || trendData.length > 0
  );

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Conversions</p>
          <h2>No website selected</h2>
          <p>Choose a website to view conversion analytics.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="analytics-page">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Conversions</p>
            <h2>Conversion analytics</h2>
          </div>
          <div className="analytics-range">
            <span>{dateRange.from}</span>
            <span>→</span>
            <span>{dateRange.to}</span>
          </div>
        </header>

        {loading ? (
          <LoadingState message="Loading conversion analytics..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadConversions()} />
        ) : !hasAnyData ? (
          <div className="panel-state empty-state-panel">
            <CheckCircle2 size={18} />
            <div>
              <h3>No conversions recorded yet</h3>
              <p>There is traffic during this period, but no tracked conversion actions have been recorded yet.</p>
            </div>
          </div>
        ) : (
          <>
            <section className="conversion-kpis">
              <article className="summary-chip">
                <div className="stat-icon green"><TrendingUp size={15} /></div>
                <span>Conversion Rate</span>
                <strong>{headlineRate.toFixed(1)}%</strong>
                <small>{convertingSessions.toLocaleString()} converting sessions / {sessions.toLocaleString()} sessions</small>
              </article>
              <article className="summary-chip">
                <div className="stat-icon blue"><Users size={15} /></div>
                <span>Converting Sessions</span>
                <strong>{convertingSessions.toLocaleString()}</strong>
                <small>Distinct sessions with at least one conversion</small>
              </article>
              <article className="summary-chip">
                <div className="stat-icon violet"><MousePointerClick size={15} /></div>
                <span>Conversion Events</span>
                <strong>{totalEvents.toLocaleString()}</strong>
                <small>Recorded conversion actions</small>
              </article>
              <article className="summary-chip">
                <div className="stat-icon orange"><BarChart3 size={15} /></div>
                <span>Sessions</span>
                <strong>{sessions.toLocaleString()}</strong>
                <small>Total sessions in this range</small>
              </article>
            </section>

            <div className="info-note">
              Conversion events are recorded actions such as WhatsApp clicks, phone clicks, email clicks, form submissions and CTAs. A single session can generate multiple conversion events, so conversion events and converting sessions are different metrics.
            </div>

            {trendData.length > 0 && (
              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Trend</p>
                    <h3>Conversion trend</h3>
                  </div>
                </div>

                <div className="conversion-trend-wrap">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-chart-svg">
                    <path
                      d={trendData
                        .map((segment, index) => {
                          const x = trendData.length === 1 ? 50 : (index / Math.max(trendData.length - 1, 1)) * 100;
                          const maxValue = Math.max(...trendData.map((item) => item.events), 1);
                          const y = 100 - (segment.events / maxValue) * 80;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            )}

            <section className="analytics-grid">
              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Breakdown</p>
                    <h3>Conversion types</h3>
                  </div>
                </div>

                {breakdownEntries.length ? (
                  <div className="distribution-list">
                    {breakdownEntries.map((entry) => (
                      <div key={entry.label} className="distribution-row">
                        <div className="distribution-header">
                          <span>{entry.label}</span>
                          <strong>{entry.value.toLocaleString()}</strong>
                        </div>
                        <div className="distribution-track">
                          <i style={{ width: `${Math.min(100, (entry.value / Math.max(...breakdownEntries.map((item) => item.value), 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-copy">No conversion-type breakdown was returned for this range.</p>
                )}
              </div>

              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Source</p>
                    <h3>By source</h3>
                  </div>
                </div>

                {sourceRows.length ? (
                  <div className="mini-list">
                    {sourceRows.map((row) => (
                      <div key={row.label} className="mini-row">
                        <div>
                          <strong>{row.label}</strong>
                          <span>{row.convertingSessions.toLocaleString()} converting sessions</span>
                        </div>
                        <span>{row.conversions.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-copy">No source-level conversion data was returned.</p>
                )}
              </div>
            </section>

            <section className="analytics-grid">
              <div className="panel-block table-panel">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Pages</p>
                    <h3>Conversions by page</h3>
                  </div>
                </div>

                {pageRows.length ? (
                  <div className="table-wrap">
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Sessions</th>
                          <th>Conversions</th>
                          <th>Converting sessions</th>
                          <th>CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.sessions.toLocaleString()}</td>
                            <td>{row.conversions.toLocaleString()}</td>
                            <td>{row.convertingSessions.toLocaleString()}</td>
                            <td>{row.cvr.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted-copy">No page-level conversion data was returned for this range.</p>
                )}
              </div>

              <div className="panel-block table-panel">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Devices</p>
                    <h3>Conversions by device</h3>
                  </div>
                </div>

                {deviceRows.length ? (
                  <div className="table-wrap">
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>Device</th>
                          <th>Sessions</th>
                          <th>Conversions</th>
                          <th>CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceRows.map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{row.sessions.toLocaleString()}</td>
                            <td>{row.conversions.toLocaleString()}</td>
                            <td>{row.cvr.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted-copy">No device-level conversion data was returned for this range.</p>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
