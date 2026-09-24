'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronRight, CircleAlert, Lightbulb, ShieldAlert, Sparkles } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type InsightItem = {
  id?: string;
  _id?: string;
  insightId?: string;
  stableId?: string;
  stable_id?: string;
  recommendationId?: string;
  recommendation_id?: string;
  title?: string;
  message?: string;
  severity?: string;
  scope?: string;
  evidence?: unknown;
  recommendation?: string;
  comparison?: unknown;
  period?: unknown;
  metric?: string;
  direction?: string;
  change?: unknown;
  value?: unknown;
  status?: string;
  [key: string]: unknown;
};

type RecommendationItem = {
  id?: string;
  _id?: string;
  recommendationId?: string;
  recommendation_id?: string;
  insightId?: string;
  insight_id?: string;
  title?: string;
  message?: string;
  recommendation?: string;
  scope?: string;
  evidence?: unknown;
  severity?: string;
  [key: string]: unknown;
};

type IntelligenceInsights = {
  problems?: InsightItem[];
  opportunities?: InsightItem[];
  trends?: InsightItem[];
  anomalies?: InsightItem[];
  recommendations?: RecommendationItem[];
};

type IntelligenceResponse = {
  period?: Record<string, unknown>;
  comparison?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  rows?: unknown[];
  exitPages?: unknown[];
  insights?: IntelligenceInsights;
  [key: string]: unknown;
};

type InsightCardKind = 'problems' | 'opportunities' | 'trends' | 'anomalies';

type SelectedInsight = {
  kind: InsightCardKind | 'recommendations';
  id: string;
  title: string;
  message: string;
  scope?: string;
  severity?: string;
  evidence: unknown;
  recommendation?: string;
  recommendationId?: string;
  comparison?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.values(record);
  }
  return [];
};

const formatListLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toTitleText = (value: unknown, fallback = 'Untitled finding') => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

const getInsightId = (insight: InsightItem | RecommendationItem | Record<string, unknown>, fallback: string) => {
  const record = asRecord(insight) ?? {};
  const rawId =
    record.id ??
    record._id ??
    record.insightId ??
    record.insight_id ??
    record.stableId ??
    record.stable_id ??
    record.recommendationId ??
    record.recommendation_id ??
    record.key;

  if (typeof rawId === 'string' && rawId.trim()) return rawId;
  if (typeof rawId === 'number') return String(rawId);

  // Backend IDs remain primary; this stable title-based fallback only covers malformed or legacy payloads.
  const titleSource = toTitleText(record.title ?? record.message ?? record.name, fallback);
  return `${fallback}-${slugify(String(titleSource))}`;
};

const getInsightTitle = (insight: InsightItem | RecommendationItem | Record<string, unknown>, fallback: string) =>
  toTitleText(
    (asRecord(insight)?.title ?? asRecord(insight)?.name ?? asRecord(insight)?.metric ?? asRecord(insight)?.message) as string | undefined,
    fallback,
  );

const getInsightMessage = (insight: InsightItem | RecommendationItem | Record<string, unknown>) => {
  const record = asRecord(insight) ?? {};
  const message = record.message ?? record.summary ?? record.description ?? '';
  return typeof message === 'string' ? message.trim() : 'No additional detail provided by the backend.';
};

const getSeverity = (value: unknown) => {
  const label = typeof value === 'string' ? value.trim() : '';
  return label || 'Info';
};

const renderEvidenceValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return 'No evidence provided.';
  if (Array.isArray(value)) {
    return value
      .map((entry) => renderEvidenceValue(entry))
      .filter(Boolean)
      .slice(0, 4)
      .join(' · ');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 4);
    return entries.map(([key, entry]) => `${formatListLabel(key)}: ${renderEvidenceValue(entry)}`).join(' · ');
  }
  return String(value);
};

const renderEvidenceList = (value: unknown) => {
  if (value == null) return <p className="muted-copy">No evidence payload was returned for this finding.</p>;

  if (Array.isArray(value)) {
    if (!value.length) return <p className="muted-copy">No evidence payload was returned for this finding.</p>;
    return (
      <ul className="detail-list">
        {value.slice(0, 6).map((item, index) => (
          <li key={`${renderEvidenceValue(item)}-${index}`}>{renderEvidenceValue(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 6);
    if (!entries.length) return <p className="muted-copy">No evidence payload was returned for this finding.</p>;
    return (
      <ul className="detail-list">
        {entries.map(([key, item]) => (
          <li key={key}>
            <strong>{formatListLabel(key)}</strong>
            <span>{renderEvidenceValue(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <p className="detail-body-text">{renderEvidenceValue(value)}</p>;
};

const formatRange = (value: Record<string, unknown> | undefined) => {
  if (!value) return null;
  const start = value.startDate ?? value.from ?? value.start ?? value.begin;
  const end = value.endDate ?? value.to ?? value.end ?? value.finish;
  if (typeof start === 'string' || typeof end === 'string') {
    return `${String(start)} → ${String(end)}`;
  }
  if (value.label && typeof value.label === 'string') return value.label;
  return null;
};

const getList = (payload: IntelligenceResponse | null, key: keyof IntelligenceInsights) => {
  const section = asRecord(payload?.insights)?.[key];
  if (!Array.isArray(section)) return [];
  return section.filter((entry) => entry && typeof entry === 'object');
};

const getCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);

export default function IntelligencePage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<SelectedInsight | null>(null);

  const loadIntelligence = async () => {
    if (!selectedWebsite?._id) {
      setData(null);
      setLoading(false);
      setSelectedInsight(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<IntelligenceResponse>(`/websites/${selectedWebsite._id}/intelligence?startDate=${dateRange.from}&endDate=${dateRange.requestTo}`);
      setData(response);
      const nextGroups = response?.insights ?? {};
      const list = [
        ...(Array.isArray(nextGroups.problems) ? nextGroups.problems : []),
        ...(Array.isArray(nextGroups.opportunities) ? nextGroups.opportunities : []),
        ...(Array.isArray(nextGroups.trends) ? nextGroups.trends : []),
        ...(Array.isArray(nextGroups.anomalies) ? nextGroups.anomalies : []),
      ];
      if (list.length) {
        const first = list[0] as Record<string, unknown>;
        const firstKind = Array.isArray(nextGroups.problems) && nextGroups.problems.includes(first as never)
          ? 'problems'
          : Array.isArray(nextGroups.opportunities) && nextGroups.opportunities.includes(first as never)
            ? 'opportunities'
            : Array.isArray(nextGroups.trends) && nextGroups.trends.includes(first as never)
              ? 'trends'
              : 'anomalies';
        setSelectedInsight({
          kind: firstKind,
          id: getInsightId(first, firstKind),
          title: getInsightTitle(first, 'Finding'),
          message: getInsightMessage(first),
          scope: typeof first.scope === 'string' ? first.scope : undefined,
          severity: getSeverity(first.severity ?? first.level),
          evidence: first.evidence ?? first.details ?? first.data ?? null,
          recommendation: typeof first.recommendation === 'string' ? first.recommendation : undefined,
          recommendationId: typeof first.recommendationId === 'string' ? first.recommendationId : typeof first.recommendation_id === 'string' ? first.recommendation_id : undefined,
          comparison: first.comparison ?? first.period,
        });
      } else {
        setSelectedInsight(null);
      }
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'The intelligence feed could not be loaded.');
      setSelectedInsight(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntelligence();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const insightCounts = useMemo(() => {
    const groups = data?.insights ?? {};
    return {
      problems: getCount(groups.problems),
      opportunities: getCount(groups.opportunities),
      trends: getCount(groups.trends),
      anomalies: getCount(groups.anomalies),
      recommendations: getCount(groups.recommendations),
    };
  }, [data]);

  const hasFindings = Object.values(insightCounts).some((count) => count > 0);
  const comparisonText = formatRange(data?.comparison as Record<string, unknown> | undefined);

  const insightGroups = useMemo(
    () => [
      { key: 'problems', label: 'Problems', icon: ShieldAlert, accent: 'error', items: getList(data, 'problems') },
      { key: 'opportunities', label: 'Opportunities', icon: Sparkles, accent: 'success', items: getList(data, 'opportunities') },
      { key: 'trends', label: 'Trends', icon: BarChart3, accent: 'neutral', items: getList(data, 'trends') },
      { key: 'anomalies', label: 'Anomalies', icon: CircleAlert, accent: 'alert', items: getList(data, 'anomalies') },
    ] as const,
    [data],
  );

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Intelligence</p>
          <h2>No website selected</h2>
          <p>Choose a website to view evidence-based findings from its traffic, behaviour and conversion data.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="intelligence-page">
        <header className="analytics-header intelligence-header">
          <div>
            <p className="eyebrow">Website Intelligence</p>
            <h2>Evidence-based findings</h2>
            <p className="overview-subtitle">Evidence-based findings from your website's traffic, audience, behaviour and conversion data.</p>
          </div>
          <div className="analytics-range intelligence-range">
            <span>{dateRange.from}</span>
            <span>→</span>
            <span>{dateRange.to}</span>
            {comparisonText && (
              <>
                <span>|</span>
                <span>Comparison: {comparisonText}</span>
              </>
            )}
          </div>
        </header>

        {loading ? (
          <LoadingState message="Loading intelligence insights..." />
        ) : error ? (
          <div className="panel-state error-state">
            <AlertTriangle size={18} />
            <div>
              <h3>Unable to load intelligence</h3>
              <p>{error}</p>
            </div>
            <button type="button" className="primary-button compact" onClick={() => void loadIntelligence()}>
              Retry
            </button>
          </div>
        ) : !hasFindings ? (
          <div className="panel-state empty-state-panel intelligence-empty-state">
            <Sparkles size={18} />
            <div>
              <h3>No intelligence available</h3>
              <p>There are currently no findings returned for this website and date range. More traffic or conversion data may be required before TMTR20 can produce a reliable finding.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="summary-grid intelligence-summary-grid">
              {Object.entries(insightCounts).map(([key, count]) => {
                if (count <= 0) return null;
                const labels: Record<string, string> = {
                  problems: 'Problems',
                  opportunities: 'Opportunities',
                  trends: 'Trends',
                  anomalies: 'Anomalies',
                  recommendations: 'Recommendations',
                };
                return (
                  <div key={key} className="summary-chip intelligence-summary-chip">
                    <span>{labels[key]}</span>
                    <strong>{count}</strong>
                    <small>{count === 1 ? 'finding available' : 'findings available'}</small>
                  </div>
                );
              })}
            </div>

            <div className="intelligence-layout">
              <div className="intelligence-main">
                {insightGroups.map(({ key, label, icon: Icon, items }) => {
                  if (!items.length) return null;

                  return (
                    <section key={key} className="panel-block intelligence-section">
                      <div className="panel-heading-row">
                        <div>
                          <p className="eyebrow">{label}</p>
                          <h3>{label}</h3>
                        </div>
                        <Icon size={16} className="panel-icon" />
                      </div>

                      <div className="insight-list">
                        {items.map((entry) => {
                          const record = asRecord(entry) ?? {};
                          const title = getInsightTitle(record, label);
                          const message = getInsightMessage(record);
                          const severity = getSeverity(record.severity ?? record.level ?? record.priority);
                          const scope = typeof record.scope === 'string' ? record.scope : undefined;
                          const recommendation =
                            typeof record.recommendation === 'string'
                              ? record.recommendation
                              : typeof record.recommendedAction === 'string'
                                ? record.recommendedAction
                                : undefined;
                          const evidence = record.evidence ?? record.details ?? record.data ?? null;
                          const insightId = getInsightId(record, `${key}-${title}`);
                          const isActive = selectedInsight?.id === insightId && selectedInsight.kind === key;

                          const openDetail = () =>
                            setSelectedInsight({
                              kind: key,
                              id: insightId,
                              title,
                              message,
                              scope,
                              severity,
                              evidence,
                              recommendation,
                              recommendationId:
                                typeof record.recommendationId === 'string'
                                  ? record.recommendationId
                                  : typeof record.recommendation_id === 'string'
                                    ? record.recommendation_id
                                    : undefined,
                              comparison: record.comparison ?? record.period,
                            });

                          return (
                            <article key={insightId} className={`insight-card ${isActive ? 'selected' : ''}`} onClick={openDetail}>
                              <div className="insight-card-top">
                                <div>
                                  <span className="insight-type">{label}</span>
                                  <h4>{title}</h4>
                                </div>
                                {severity && <span className={`insight-severity ${severity.toLowerCase()}`}>{severity}</span>}
                              </div>
                              <p>{message}</p>
                              {scope && <p className="insight-meta"><strong>Scope:</strong> {scope}</p>}
                              <p className="insight-meta"><strong>Evidence:</strong> {renderEvidenceValue(evidence)}</p>
                              {recommendation && <p className="insight-meta"><strong>Recommended action:</strong> {recommendation}</p>}
                              <button type="button" className="text-button inline insight-button">
                                View details <ChevronRight size={14} />
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

                {getList(data, 'recommendations').length > 0 && (
                  <section className="panel-block intelligence-section">
                    <div className="panel-heading-row">
                      <div>
                        <p className="eyebrow">Recommendations</p>
                        <h3>Recommended actions</h3>
                      </div>
                      <Lightbulb size={16} className="panel-icon" />
                    </div>

                    <div className="insight-list">
                      {getList(data, 'recommendations').map((entry) => {
                        const record = asRecord(entry) ?? {};
                        const title = getInsightTitle(record, 'Recommendation');
                        const message = getInsightMessage(record);
                        const insightId = getInsightId(record, `recommendation-${title}`);
                        const isActive = selectedInsight?.id === insightId && selectedInsight.kind === 'recommendations';

                        return (
                          <article key={insightId} className={`insight-card ${isActive ? 'selected' : ''}`} onClick={() => setSelectedInsight({
                            kind: 'recommendations',
                            id: insightId,
                            title,
                            message,
                            scope: typeof record.scope === 'string' ? record.scope : undefined,
                            severity: getSeverity(record.severity ?? record.level),
                            evidence: record.evidence ?? record.details ?? null,
                            recommendation: typeof record.recommendation === 'string' ? record.recommendation : message,
                            recommendationId: typeof record.recommendationId === 'string' ? record.recommendationId : typeof record.recommendation_id === 'string' ? record.recommendation_id : undefined,
                            comparison: record.comparison ?? record.period,
                          })}>
                            <div className="insight-card-top">
                              <div>
                                <span className="insight-type">Recommendation</span>
                                <h4>{title}</h4>
                              </div>
                              <span className={`insight-severity ${getSeverity(record.severity ?? record.level).toLowerCase()}`}>
                                {getSeverity(record.severity ?? record.level)}
                              </span>
                            </div>
                            <p>{message}</p>
                            {typeof record.scope === 'string' && <p className="insight-meta"><strong>Scope:</strong> {record.scope}</p>}
                            {Boolean(record.evidence) && <p className="insight-meta"><strong>Evidence:</strong> {renderEvidenceValue(record.evidence)}</p>}
                            <button type="button" className="text-button inline insight-button">
                              View details <ChevronRight size={14} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {selectedInsight && (
                <aside className="insight-detail-panel panel-block">
                  <div className="panel-heading-row detail-header">
                    <div>
                      <p className="eyebrow">Details</p>
                      <h3>{selectedInsight.title}</h3>
                    </div>
                    <button type="button" className="text-button inline" onClick={() => setSelectedInsight(null)}>
                      Close
                    </button>
                  </div>

                  <div className="detail-stack">
                    <div className="detail-section">
                      <h4>Finding</h4>
                      <p>{selectedInsight.message}</p>
                    </div>

                    {selectedInsight.scope && (
                      <div className="detail-section">
                        <h4>Scope</h4>
                        <p>{selectedInsight.scope}</p>
                      </div>
                    )}

                    {selectedInsight.severity && (
                      <div className="detail-section">
                        <h4>Severity</h4>
                        <p>{selectedInsight.severity}</p>
                      </div>
                    )}

                    <div className="detail-section">
                      <h4>Evidence</h4>
                      {renderEvidenceList(selectedInsight.evidence)}
                    </div>

                    {Boolean(selectedInsight.comparison) && (
                      <div className="detail-section">
                        <h4>Comparison</h4>
                        <p>{renderEvidenceValue(selectedInsight.comparison)}</p>
                      </div>
                    )}

                    {Boolean(selectedInsight.recommendation) && (
                      <div className="detail-section recommendation-box">
                        <h4>Recommendation</h4>
                        <p>{selectedInsight.recommendation}</p>
                        {selectedInsight.recommendationId && <small>Recommendation ID: {selectedInsight.recommendationId}</small>}
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
