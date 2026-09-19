'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileSearch, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type AuditRecord = {
  _id?: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  status?: string;
  overallScore?: number;
  score?: number;
  performanceScore?: number;
  seoScore?: number;
  accessibilityScore?: number;
  mobileScore?: number;
  securityScore?: number;
  categories?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  checks?: unknown;
  results?: unknown;
  [key: string]: unknown;
};

type AuditResponse = AuditRecord | { audit?: AuditRecord; data?: AuditRecord; [key: string]: unknown };

type CategoryScore = { key: string; label: string; score?: number };
type AuditCheck = { key: string; label: string; status: string; value?: string; explanation?: string };
type AuditCheckGroup = { key: string; label: string; checks: AuditCheck[] };

const categoryDefinitions = [
  { key: 'performance', label: 'Performance' },
  { key: 'seo', label: 'SEO' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'security', label: 'Security' },
];

const checkCategoryAliases: Record<string, string> = {
  technical: 'performance',
  performance: 'performance',
  seo: 'seo',
  accessibility: 'accessibility',
  mobile: 'mobile',
  security: 'security',
};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const formatLabel = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const unwrapAudit = (response: AuditResponse | null): AuditRecord | null => {
  if (!response) return null;
  const record = response as Record<string, unknown>;
  return (asRecord(record.audit) ?? asRecord(record.data) ?? record) as AuditRecord;
};

const formatDate = (value?: string) => {
  if (!value) return 'Date not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const statusLabel = (value: unknown, checkValue?: unknown) => {
  const normalized = String(value ?? '').toLowerCase();
  if (['pass', 'passed', 'success', 'ok', 'true', 'healthy'].includes(normalized)) return 'Passed';
  if (['fail', 'failed', 'error', 'false'].includes(normalized)) return 'Failed';
  if (['attention', 'warning'].includes(normalized)) return 'Needs attention';
  if (checkValue !== undefined && checkValue !== null && typeof checkValue === 'boolean') return checkValue ? 'Passed' : 'Failed';
  return value ? formatLabel(String(value)) : 'Not checked';
};

const checkFromEntry = (key: string, value: unknown): AuditCheck => {
  const record = asRecord(value);
  if (!record) {
    return { key, label: formatLabel(key), status: statusLabel(undefined, value), value: typeof value === 'string' || typeof value === 'number' ? String(value) : undefined };
  }

  const rawStatus = record.status ?? record.result ?? record.state ?? record.passed ?? record.ok;
  const rawValue = record.value ?? record.detail ?? record.observed ?? record.actual ?? record.content ?? record.message;
  const rawExplanation = record.explanation ?? record.description ?? record.reason ?? record.error;

  return {
    key,
    label: formatLabel(String(record.label ?? record.name ?? key)),
    status: statusLabel(rawStatus, record.passed ?? record.ok),
    value: rawValue === undefined || rawValue === null ? undefined : String(rawValue),
    explanation: rawExplanation === undefined || rawExplanation === null ? undefined : String(rawExplanation),
  };
};

const normalizeCheckGroups = (audit: AuditRecord | null): AuditCheckGroup[] => {
  if (!audit) return [];
  const source = audit.checks ?? audit.results;
  const groups = new Map<string, AuditCheck[]>();

  const add = (category: string, key: string, value: unknown) => {
    const normalizedCategory = checkCategoryAliases[category.toLowerCase()] ?? category.toLowerCase();
    const checks = groups.get(normalizedCategory) ?? [];
    checks.push(checkFromEntry(key, value));
    groups.set(normalizedCategory, checks);
  };

  const sourceRecord = asRecord(source);
  if (sourceRecord) {
    Object.entries(sourceRecord).forEach(([category, rawChecks]) => {
      const checksRecord = asRecord(rawChecks);
      if (checksRecord) Object.entries(checksRecord).forEach(([key, value]) => add(category, key, value));
      else if (Array.isArray(rawChecks)) rawChecks.forEach((value, index) => add(category, String(asRecord(value)?.key ?? asRecord(value)?.name ?? `check-${index + 1}`), value));
      else add(category, category, rawChecks);
    });
  } else if (Array.isArray(source)) {
    source.forEach((value, index) => {
      const record = asRecord(value);
      add(String(record?.category ?? record?.group ?? record?.section ?? 'technical'), String(record?.key ?? record?.name ?? `check-${index + 1}`), value);
    });
  }

  return categoryDefinitions
    .map(({ key, label }) => ({ key, label, checks: groups.get(key) ?? [] }))
    .filter((group) => group.checks.length > 0);
};

const getCategoryScores = (audit: AuditRecord | null): CategoryScore[] => {
  if (!audit) return [];
  const scoreRecord = { ...(asRecord(audit.scores) ?? {}), ...(asRecord(audit.categories) ?? {}) };
  return categoryDefinitions
    .map(({ key, label }) => ({ key, label, score: asNumber(audit[`${key}Score`] ?? scoreRecord[key] ?? scoreRecord[`${key}Score`]) }))
    .filter((category) => category.score !== undefined);
};

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="panel-state error-state">
      <AlertTriangle size={18} />
      <div><h3>{title}</h3><p>{message}</p></div>
      {onRetry && <button type="button" className="primary-button compact" onClick={onRetry}>Retry</button>}
    </div>
  );
}

function CheckCard({ check }: { check: AuditCheck }) {
  const passed = check.status === 'Passed';
  const attention = check.status === 'Failed' || check.status === 'Needs attention';
  return (
    <article className="audit-check-card">
      <div className={`audit-check-icon ${passed ? 'pass' : attention ? 'attention' : 'neutral'}`}>
        {passed ? <CheckCircle2 size={16} /> : attention ? <XCircle size={16} /> : <Clock3 size={16} />}
      </div>
      <div className="audit-check-copy">
        <div className="audit-check-heading"><h4>{check.label}</h4><span className={`audit-status ${passed ? 'pass' : attention ? 'attention' : 'neutral'}`}>{check.status}</span></div>
        {check.value && <p className="audit-check-value">{check.value}</p>}
        {check.explanation && <p>{check.explanation}</p>}
      </div>
    </article>
  );
}

export default function HealthPage() {
  const { selectedWebsite } = useDashboard();
  const [latest, setLatest] = useState<AuditRecord | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const loadLatest = async () => {
    if (!selectedWebsite?._id) { setLatest(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const response = await apiRequest<AuditResponse>(`/websites/${selectedWebsite._id}/audits/latest`);
      setLatest(unwrapAudit(response));
    } catch (cause) {
      if ((cause as ApiError).status === 404) setLatest(null);
      else setError('The latest website audit could not be loaded.');
    } finally { setLoading(false); }
  };

  const loadHistory = async () => {
    if (!selectedWebsite?._id) { setHistory([]); return; }
    setHistoryLoading(true); setHistoryError(null);
    try {
      const response = await apiRequest<AuditResponse[] | { audits?: AuditResponse[] }>(`/websites/${selectedWebsite._id}/audits`);
      const records = Array.isArray(response) ? response : response?.audits ?? [];
      setHistory(records.map(unwrapAudit).filter(Boolean) as AuditRecord[]);
    } catch { setHistoryError('Audit history is not available right now.'); }
    finally { setHistoryLoading(false); }
  };

  const refreshAuditData = async () => { await Promise.all([loadLatest(), loadHistory()]); };

  useEffect(() => {
    setLatest(null); setHistory([]); void refreshAuditData();
  }, [selectedWebsite?._id]);

  const runAudit = async () => {
    if (!selectedWebsite?._id || running) return;
    setRunning(true); setRunError(null);
    try {
      const response = await apiRequest<AuditResponse>(`/websites/${selectedWebsite._id}/audits`, { method: 'POST' });
      const audit = unwrapAudit(response);
      if (audit) setLatest(audit);
      await refreshAuditData();
    } catch { setRunError('The website audit could not be completed. Please try again.'); }
    finally { setRunning(false); }
  };

  const scores = useMemo(() => getCategoryScores(latest), [latest]);
  const checkGroups = useMemo(() => normalizeCheckGroups(latest), [latest]);
  const auditDate = latest?.createdAt ?? latest?.updatedAt ?? latest?.timestamp;
  const auditStatus = latest?.status ? formatLabel(String(latest.status)) : latest ? 'Available' : 'No audit';
  const totalChecks = checkGroups.reduce((total, group) => total + group.checks.length, 0);
  const passedChecks = checkGroups.reduce((total, group) => total + group.checks.filter((check) => check.status === 'Passed').length, 0);

  if (!selectedWebsite) return <AuthGuard><section className="analytics-empty-state"><p className="eyebrow">Website Health</p><h2>No website selected</h2><p>Choose a website to view its latest audit.</p></section></AuthGuard>;

  return (
    <AuthGuard>
      <section className="health-page">
        <header className="analytics-header">
          <div><p className="eyebrow">Website Health</p><h2>Technical health audit</h2><p className="overview-subtitle">Observed checks for {selectedWebsite.name}</p></div>
          <button type="button" className="primary-button" onClick={() => void runAudit()} disabled={running || loading}><RefreshCw size={16} className={running ? 'spin' : ''} />{running ? 'Running audit...' : 'Run Website Audit'}</button>
        </header>

        {runError && <div className="form-error"><AlertTriangle size={16} />{runError}</div>}
        {loading ? <LoadingState message="Loading latest website audit..." /> : error ? <ErrorPanel title="Unable to load website health" message={error} onRetry={() => void refreshAuditData()} /> : !latest ? (
          <div className="health-empty-state panel-block"><div className="empty-icon"><FileSearch size={24} /></div><p className="eyebrow">No audit yet</p><h3>No website audit yet</h3><p>Run an audit to check the website's current technical, SEO, accessibility and security signals.</p><button type="button" className="primary-button compact" onClick={() => void runAudit()} disabled={running}><RefreshCw size={15} className={running ? 'spin' : ''} /> Run Website Audit</button></div>
        ) : (
          <>
            <section className="health-summary panel-block"><div className="panel-heading-row"><div><p className="eyebrow">Latest audit</p><h3>{selectedWebsite.name}</h3></div><span className="audit-status neutral">{auditStatus}</span></div><div className="health-summary-meta"><span>Audited {formatDate(auditDate)}</span>{totalChecks > 0 && <span>{passedChecks} of {totalChecks} checks passed</span>}</div></section>
            {scores.length > 0 && <section><div className="section-heading"><div><p className="eyebrow">Summary</p><h3>Category scores</h3></div></div><div className="health-score-grid">{scores.map((category) => <article key={category.key} className="health-score-card"><div className="health-score-card-top"><span>{category.label}</span><ShieldCheck size={16} /></div><strong>{category.score}</strong><small>Score returned by the audit</small></article>)}</div></section>}
            {checkGroups.length > 0 && <section className="health-checks-section"><div className="section-heading"><div><p className="eyebrow">Evidence</p><h3>Detailed checks</h3></div></div><div className="health-check-groups">{checkGroups.map((group) => <section key={group.key} className="panel-block"><div className="panel-heading-row"><h3>{group.label}</h3><span className="panel-kicker">{group.checks.length} checks</span></div><div className="audit-check-list">{group.checks.map((check) => <CheckCard key={check.key} check={check} />)}</div></section>)}</div></section>}
          </>
        )}

        <section className="health-history panel-block"><div className="panel-heading-row"><div><p className="eyebrow">History</p><h3>Previous audits</h3></div></div>{historyLoading ? <p className="muted-copy">Loading audit history...</p> : historyError ? <p className="muted-copy">{historyError}</p> : history.length === 0 ? <p className="muted-copy">No previous audits are available.</p> : <div className="table-wrap"><table className="data-table compact-table"><thead><tr><th>Date</th><th>Status</th><th>Scores available</th></tr></thead><tbody>{history.slice(0, 10).map((audit, index) => <tr key={audit._id ?? audit.id ?? `${audit.createdAt ?? 'audit'}-${index}`}><td>{formatDate(audit.createdAt ?? audit.updatedAt ?? audit.timestamp)}</td><td>{audit.status ? formatLabel(audit.status) : 'Available'}</td><td>{getCategoryScores(audit).length || '—'}</td></tr>)}</tbody></table></div>}</section>
        <div className="health-limitations"><strong>Audit scope</strong><span>This view reflects checks performed by TMTR20's current server-side audit system. It is not a full Lighthouse audit, penetration test, WCAG certification, or comprehensive multi-page crawl.</span></div>
      </section>
    </AuthGuard>
  );
}
