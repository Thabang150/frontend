'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, MousePointer2, ScrollText, Users, Gauge, CheckCircle2 } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type HeatmapPoint = {
  pagePath?: string;
  x?: number | string;
  y?: number | string;
  clicks?: number;
  [key: string]: unknown;
};

type BehaviorResponse = {
  engagement?: Record<string, unknown>;
  scrollDepth?: Record<string, unknown> | Array<Record<string, unknown>>;
  outboundClicks?: Record<string, unknown> | Array<Record<string, unknown>>;
  forms?: Record<string, unknown> | Array<Record<string, unknown>>;
  interactionProblems?: Record<string, unknown> | Array<Record<string, unknown>>;
  clicks?: HeatmapPoint[];
  [key: string]: unknown;
};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLabel = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatTiming = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const normaliseRows = (raw: unknown): Array<{ label: string; value: number; meta?: string }> => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'number') {
          return { label: 'Value', value: asNumber(item) };
        }

        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const label = String(record.label ?? record.name ?? record.key ?? record.pagePath ?? record.destination ?? record.page ?? record.threshold ?? record.type ?? 'Item');
          const value = asNumber(record.value ?? record.sessions ?? record.count ?? record.total ?? record.clicks ?? record.submissions ?? record.starts ?? record.abandonment ?? record.events ?? record.visitors ?? record.conversions);
          return { label, value };
        }

        return null;
      })
      .filter((item): item is { label: string; value: number; meta?: string } => Boolean(item));
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return { label: formatLabel(key), value: asNumber(value) };
        }

        if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          const nextValue = asNumber(record.sessions ?? record.count ?? record.total ?? record.value ?? record.events ?? record.clicks ?? record.submissions ?? record.starts ?? record.abandonment);
          return { label: formatLabel(key), value: nextValue };
        }

        return null;
      })
      .filter((item): item is { label: string; value: number; meta?: string } => Boolean(item));
  }

  return [];
};

function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-state error-state">
      <AlertTriangle size={18} />
      <div>
        <h3>Unable to load behaviour data</h3>
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

export default function BehaviorPage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [data, setData] = useState<BehaviorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>('all');

  const loadBehavior = async () => {
    if (!selectedWebsite?._id) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextData = await apiRequest<BehaviorResponse>(`/websites/${selectedWebsite._id}/behavior?startDate=${dateRange.from}&endDate=${dateRange.to}`);
      setData(nextData);
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'The behaviour data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBehavior();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const heatmapClicks = useMemo(() => (Array.isArray(data?.clicks) ? data.clicks : []) as HeatmapPoint[], [data]);

  const availablePages = useMemo(
    () => Array.from(new Set(heatmapClicks.filter((item) => item.pagePath).map((item) => String(item.pagePath)))),
    [heatmapClicks],
  );

  useEffect(() => {
    if (!availablePages.length) {
      setSelectedPage('all');
      return;
    }

    if (!selectedPage || selectedPage === 'all') {
      setSelectedPage('all');
      return;
    }

    if (!availablePages.includes(selectedPage)) {
      setSelectedPage(availablePages[0]);
    }
  }, [availablePages, selectedPage]);

  const filteredClicks = useMemo(() => {
    if (!heatmapClicks.length) return [];
    if (selectedPage === 'all') return heatmapClicks;
    return heatmapClicks.filter((point) => point.pagePath === selectedPage);
  }, [heatmapClicks, selectedPage]);

  const engagement = data?.engagement ?? {};
  const scrollDepth = data?.scrollDepth ?? [];
  const outboundClicks = data?.outboundClicks ?? [];
  const forms = data?.forms ?? {};
  const interactionProblems = data?.interactionProblems ?? {};

  const engagementCards = [
    {
      label: 'Sessions',
      value: asNumber(engagement.sessions ?? engagement.totalSessions ?? engagement.recordedSessions).toLocaleString(),
      detail: 'Recorded sessions',
      icon: <Users size={15} />,
      accent: 'green',
    },
    {
      label: 'Engagement time',
      value: formatTiming(asNumber(engagement.averageActiveMs ?? engagement.averageEngagementMs ?? engagement.averageActiveMilliseconds)),
      detail: 'Typical engagement window',
      icon: <Gauge size={15} />,
      accent: 'blue',
    },
    {
      label: 'Scroll depth',
      value: `${asNumber(engagement.averageMaxScrollDepthPercent ?? engagement.averageScrollDepthPercent).toFixed(1)}%`,
      detail: 'Average max depth',
      icon: <ScrollText size={15} />,
      accent: 'orange',
    },
    {
      label: 'Recorded clicks',
      value: filteredClicks.reduce((sum, point) => sum + asNumber(point.clicks), 0).toLocaleString(),
      detail: 'Normalized click activity',
      icon: <MousePointer2 size={15} />,
      accent: 'violet',
    },
  ];

  const hasBehaviourData = !!data && Object.keys(data).some((key) => {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return Boolean(value);
  });

  const scrollEntries = normaliseRows(scrollDepth).slice(0, 8);
  const outboundEntries = normaliseRows(outboundClicks).slice(0, 8);
  const formEntries = normaliseRows(forms).slice(0, 6);
  const frictionEntries = normaliseRows(interactionProblems).slice(0, 8);

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Behaviour</p>
          <h2>No website selected</h2>
          <p>Choose a website to view behavioural signals.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="analytics-page">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Behaviour</p>
            <h2>Visitor actions</h2>
          </div>
          <div className="analytics-range">
            <span>{dateRange.from}</span>
            <span>→</span>
            <span>{dateRange.to}</span>
          </div>
        </header>

        {loading ? (
          <LoadingState message="Loading behaviour signals..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadBehavior()} />
        ) : !hasBehaviourData ? (
          <div className="panel-state empty-state-panel">
            <BarChart3 size={18} />
            <div>
              <h3>No behaviour data yet</h3>
              <p>Behaviour data will appear here after visitors begin interacting with the website.</p>
            </div>
          </div>
        ) : (
          <>
            <section className="summary-grid">
              {engagementCards.map((card) => (
                <article key={card.label} className="summary-chip">
                  <div className={`stat-icon ${card.accent}`}>{card.icon}</div>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </section>

            <div className="analytics-grid">
              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Scroll</p>
                    <h3>Scroll depth</h3>
                  </div>
                </div>

                <div className="distribution-list">
                  {scrollEntries.length ? (
                    scrollEntries.map((entry) => (
                      <div key={entry.label} className="distribution-row">
                        <div className="distribution-header">
                          <span>{entry.label}</span>
                          <strong>{entry.value.toLocaleString()}</strong>
                        </div>
                        <div className="distribution-track">
                          <i style={{ width: `${Math.min(100, (entry.value / Math.max(...scrollEntries.map((item) => item.value), 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted-copy">Scroll-depth data is not available for this period.</p>
                  )}
                </div>
              </div>

              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Forms</p>
                    <h3>Form behaviour</h3>
                  </div>
                  <CheckCircle2 size={16} />
                </div>

                <div className="distribution-list">
                  {formEntries.length ? (
                    formEntries.map((entry) => (
                      <div key={entry.label} className="distribution-row">
                        <div className="distribution-header">
                          <span>{entry.label}</span>
                          <strong>{entry.value.toLocaleString()}</strong>
                        </div>
                        <div className="distribution-track">
                          <i style={{ width: `${Math.min(100, (entry.value / Math.max(...formEntries.map((item) => item.value), 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted-copy">No form behaviour was recorded for the selected period.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="analytics-grid">
              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Outbound</p>
                    <h3>Outbound clicks</h3>
                  </div>
                </div>

                {outboundEntries.length ? (
                  <div className="mini-list">
                    {outboundEntries.map((entry) => (
                      <div key={entry.label} className="mini-row">
                        <div>
                          <strong>{entry.label}</strong>
                          <span>Recorded destinations</span>
                        </div>
                        <span>{entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-copy">No outbound click data was returned for this range.</p>
                )}
              </div>

              <div className="panel-block">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Friction</p>
                    <h3>Interaction problems</h3>
                  </div>
                  <AlertTriangle size={16} />
                </div>

                {frictionEntries.length ? (
                  <div className="mini-list">
                    {frictionEntries.map((entry) => (
                      <div key={entry.label} className="mini-row">
                        <div>
                          <strong>{entry.label}</strong>
                          <span>Recorded interaction signal</span>
                        </div>
                        <span>{entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-copy">No rage-click or dead-click activity was recorded for this period.</p>
                )}
              </div>
            </div>

            <div className="panel-block heatmap-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Heatmap</p>
                  <h3>Recorded click activity</h3>
                </div>
                {availablePages.length > 0 && (
                  <select className="toolbar-select compact-select" value={selectedPage} onChange={(event) => setSelectedPage(event.target.value)}>
                    <option value="all">All pages</option>
                    {availablePages.map((page) => (
                      <option key={page} value={page}>{page}</option>
                    ))}
                  </select>
                )}
              </div>

              {filteredClicks.length ? (
                <>
                  <p className="heatmap-caption">Click activity is shown using normalized page coordinates. This is not a session recording.</p>
                  <div className="heatmap-wrap">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="heatmap-svg">
                      {filteredClicks.map((point, index) => {
                        const x = asNumber(point.x) / 10000 * 100;
                        const y = asNumber(point.y) / 10000 * 100;
                        const radius = Math.max(2, Math.min(12, asNumber(point.clicks) * 0.8 + 2));
                        return (
                          <circle key={`${point.pagePath ?? 'page'}-${x}-${y}-${index}`} cx={x} cy={y} r={radius} fill="rgba(217,183,106,0.72)" opacity={Math.min(1, 0.25 + asNumber(point.clicks) / 25)} />
                        );
                      })}
                    </svg>
                  </div>
                </>
              ) : (
                <div className="panel-state empty-state-panel">
                  <MousePointer2 size={18} />
                  <div>
                    <h3>No heatmap data</h3>
                    <p>Recorded click activity will appear here once visitors begin interacting with the page.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
