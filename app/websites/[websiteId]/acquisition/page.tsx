'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Earth, Globe2, TrendingUp, Users } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type AcquisitionRow = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referralDomain?: string;
  sourceCategory?: string;
  sessions?: number;
  visitors?: number;
  conversions?: number;
  conversionRate?: number;
  [key: string]: unknown;
};

type AcquisitionResponse = AcquisitionRow[] | { sources?: AcquisitionRow[]; [key: string]: unknown };

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatValue = (value: string | undefined) => {
  if (!value) return 'Unknown';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-state error-state">
      <BarChart3 size={18} />
      <div>
        <h3>Unable to load acquisition data</h3>
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

export default function AcquisitionPage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [rows, setRows] = useState<AcquisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSources = async () => {
    if (!selectedWebsite?._id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<AcquisitionResponse>(
        `/websites/${selectedWebsite._id}/sources?startDate=${dateRange.from}&endDate=${dateRange.requestTo}`,
      );

      const nextRows = Array.isArray(response)
        ? response
        : Array.isArray(response?.sources)
          ? response.sources
          : [];

      setRows(nextRows);
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'The acquisition data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSources();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const totals = useMemo(() => {
    const sessions = rows.reduce((sum, row) => sum + toNumber(row.sessions), 0);
    const visitors = rows.reduce((sum, row) => sum + toNumber(row.visitors), 0);
    const conversions = rows.reduce((sum, row) => sum + toNumber(row.conversions), 0);
    const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
    return { sessions, visitors, conversions, conversionRate };
  }, [rows]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const name = (row.sourceCategory && String(row.sourceCategory).trim()) || (row.source && String(row.source).trim()) || 'Other';
      map.set(name, (map.get(name) ?? 0) + toNumber(row.sessions));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const maxCategory = categoryTotals[0]?.[1] ?? 1;

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Acquisition</p>
          <h2>No website selected</h2>
          <p>Choose a website to view acquisition sources.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="analytics-page">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Acquisition</p>
            <h2>Traffic sources</h2>
          </div>
          <div className="analytics-range">
            <span>{dateRange.from}</span>
            <span>→</span>
            <span>{dateRange.to}</span>
          </div>
        </header>

        {loading ? (
          <LoadingState message="Loading acquisition sources..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadSources()} />
        ) : rows.length === 0 ? (
          <div className="panel-state empty-state-panel">
            <Earth size={18} />
            <div>
              <h3>No acquisition data yet</h3>
              <p>Traffic will appear here once visitors begin arriving from tracked sources.</p>
            </div>
          </div>
        ) : (
          <>
            <section className="stats-grid">
              <article className="stat-card compact-card">
                <div className="stat-icon green"><Users size={16} /></div>
                <span>Sessions</span>
                <strong>{totals.sessions.toLocaleString()}</strong>
                <small>Recorded sessions</small>
              </article>
              <article className="stat-card compact-card">
                <div className="stat-icon blue"><Globe2 size={16} /></div>
                <span>Visitors</span>
                <strong>{totals.visitors.toLocaleString()}</strong>
                <small>Unique visitors</small>
              </article>
              <article className="stat-card compact-card">
                <div className="stat-icon violet"><TrendingUp size={16} /></div>
                <span>Conversions</span>
                <strong>{totals.conversions.toLocaleString()}</strong>
                <small>Attributed conversions</small>
              </article>
              <article className="stat-card compact-card">
                <div className="stat-icon orange"><BarChart3 size={16} /></div>
                <span>CVR</span>
                <strong>{totals.conversionRate.toFixed(1)}%</strong>
                <small>Session conversion rate</small>
              </article>
            </section>

            <section className="analytics-grid">
              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Channels</p>
                    <h3>Acquisition mix</h3>
                  </div>
                </div>

                <div className="distribution-list">
                  {categoryTotals.map(([label, value]) => (
                    <div key={label} className="distribution-row">
                      <div className="distribution-header">
                        <span>{formatValue(label)}</span>
                        <strong>{value.toLocaleString()}</strong>
                      </div>
                      <div className="distribution-track">
                        <i style={{ width: `${(value / maxCategory) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Sources</p>
                    <h3>Top channels</h3>
                  </div>
                </div>

                <div className="mini-list">
                  {rows.slice(0, 6).map((row, index) => (
                    <div key={`${row.source ?? 'source'}-${row.medium ?? 'medium'}-${index}`} className="mini-row">
                      <div>
                        <strong>{formatValue(row.sourceCategory || row.source || 'Unknown')}</strong>
                        <span>{formatValue(row.medium || row.referralDomain || row.campaign || 'Direct')}</span>
                      </div>
                      <span>{toNumber(row.sessions).toLocaleString()} sessions</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel-block table-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Source detail</p>
                  <h3>Channel performance</h3>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Medium</th>
                      <th>Sessions</th>
                      <th>Visitors</th>
                      <th>Conversions</th>
                      <th>CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.source ?? 'source'}-${row.medium ?? 'medium'}-${index}`}>
                        <td>{formatValue(row.sourceCategory || row.source || 'Unknown')}</td>
                        <td>{formatValue(row.medium || row.referralDomain || row.campaign || 'Direct')}</td>
                        <td>{toNumber(row.sessions).toLocaleString()}</td>
                        <td>{toNumber(row.visitors).toLocaleString()}</td>
                        <td>{toNumber(row.conversions).toLocaleString()}</td>
                        <td>{toNumber(row.conversionRate ?? (toNumber(row.conversions) / Math.max(toNumber(row.sessions), 1)) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
