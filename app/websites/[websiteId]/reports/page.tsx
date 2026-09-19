'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { API_BASE_URL, apiRequest, getStoredSession, type ApiError } from '../../../../lib/api';

type ReportRecord = {
  _id?: string;
  id?: string;
  status?: string;
  type?: string;
  reportType?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  startDate?: string;
  endDate?: string;
  websiteId?: string;
  website?: { name?: string } | string;
  fileName?: string;
  pdfUrl?: string;
  downloadable?: boolean;
  [key: string]: unknown;
};

type ReportResponse = ReportRecord | ReportRecord[] | { reports?: ReportRecord[]; data?: ReportRecord[]; report?: ReportRecord; [key: string]: unknown };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getReportId = (record: ReportRecord | null | undefined) => {
  if (!record) return null;
  const rawId = record._id ?? record.id;
  return typeof rawId === 'string' && rawId.trim() ? rawId : null;
};

const getReportPeriod = (record: ReportRecord | null | undefined) => {
  if (!record) return 'No period provided';
  const start = record.periodStart ?? record.startDate ?? 'Unknown';
  const end = record.periodEnd ?? record.endDate ?? 'Unknown';
  return start === 'Unknown' && end === 'Unknown' ? 'Custom period' : `${start} → ${end}`;
};

const getReportStatus = (status: string | undefined) => {
  const value = (status ?? 'unknown').toLowerCase();
  if (['generated', 'ready', 'success', 'complete', 'completed'].includes(value)) return 'Generated';
  if (['pending', 'processing', 'running', 'in_progress'].includes(value)) return 'Processing';
  if (['failed', 'error', 'rejected'].includes(value)) return 'Failed';
  if (['unavailable', 'missing'].includes(value)) return 'Unavailable';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
};

const formatDate = (value: string | undefined) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const unwrapReports = (payload: ReportResponse | null): ReportRecord[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean) as ReportRecord[];

  const record = asRecord(payload);
  if (!record) return [];

  const candidates = [record.reports, record.data, record.report];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(Boolean) as ReportRecord[];
    if (candidate && typeof candidate === 'object') return [candidate as ReportRecord];
  }

  return Object.values(record).filter((value) => value && typeof value === 'object').map((value) => value as ReportRecord);
};

export default function ReportsPage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [latestReport, setLatestReport] = useState<ReportRecord | null>(null);
  const [history, setHistory] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const loadLatestReport = async () => {
    if (!selectedWebsite?._id) {
      setLatestReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const next = await apiRequest<ReportRecord>(`/websites/${selectedWebsite._id}/reports/latest`);
      setLatestReport(next);
      setSelectedReportId((current) => current ?? getReportId(next));
    } catch (cause) {
      if ((cause as ApiError).status === 404) {
        setLatestReport(null);
      } else {
        setError((cause as ApiError)?.message ?? 'The latest report could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!selectedWebsite?._id) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const payload = await apiRequest<ReportResponse>(`/websites/${selectedWebsite._id}/reports`);
      const nextHistory = unwrapReports(payload);
      setHistory(nextHistory);
      if (!selectedReportId && nextHistory.length) {
        const firstId = getReportId(nextHistory[0]) ?? getReportId(latestReport);
        setSelectedReportId(firstId);
      }
    } catch (cause) {
      setHistoryError((cause as ApiError)?.message ?? 'Report history could not be loaded.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshReports = async () => {
    await Promise.all([loadLatestReport(), loadHistory()]);
  };

  useEffect(() => {
    setLatestReport(null);
    setHistory([]);
    setSelectedReportId(null);
    setGenerateError(null);
    setEmailError(null);
    setPdfError(null);
    void refreshReports();
  }, [selectedWebsite?._id]);

  const generateReport = async () => {
    if (!selectedWebsite?._id || generating) return;

    setGenerating(true);
    setGenerateError(null);
    setEmailError(null);
    setPdfError(null);

    try {
      const next = await apiRequest<ReportRecord>(`/websites/${selectedWebsite._id}/reports/monthly`, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: dateRange.from,
          periodEnd: dateRange.to,
        }),
      });

      setLatestReport(next);
      setSelectedReportId(getReportId(next));
      await refreshReports();
    } catch (cause) {
      setGenerateError((cause as ApiError)?.message ?? 'The report could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const emailReport = async (report: ReportRecord | null = latestReport) => {
    const id = report ? getReportId(report) : null;
    if (!selectedWebsite?._id || !id || emailing) return;

    setEmailing(true);
    setEmailError(null);

    try {
      const next = await apiRequest<ReportRecord>(`/websites/${selectedWebsite._id}/reports/${id}/email`, {
        method: 'POST',
      });
      setLatestReport(next);
      setSelectedReportId(getReportId(next) ?? id);
      await refreshReports();
    } catch (cause) {
      setEmailError((cause as ApiError)?.message ?? 'The report could not be emailed.');
    } finally {
      setEmailing(false);
    }
  };

  const downloadPdf = async (report: ReportRecord | null = latestReport) => {
    const id = report ? getReportId(report) : null;
    if (!selectedWebsite?._id || !id) return;

    setPdfLoadingId(id);
    setPdfError(null);

    try {
      const session = getStoredSession();
      const response = await fetch(`${API_BASE_URL}/websites/${selectedWebsite._id}/reports/${id}/pdf`, {
        headers: {
          Authorization: session.accessToken ? `Bearer ${session.accessToken}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('The PDF could not be downloaded.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = report?.fileName ?? `report-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setPdfError(cause instanceof Error ? cause.message : 'The PDF could not be downloaded.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const activeReport = useMemo(() => {
    if (selectedReportId) {
      return history.find((report) => getReportId(report) === selectedReportId) ?? latestReport ?? null;
    }
    return latestReport ?? history[0] ?? null;
  }, [history, latestReport, selectedReportId]);

  const reportType = activeReport?.type ?? activeReport?.reportType ?? 'Monthly report';
  const reportPeriod = getReportPeriod(activeReport);

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Reports</p>
          <h2>No website selected</h2>
          <p>Select a website to manage generated reports and delivery.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="reports-page">
        <header className="analytics-header reports-header">
          <div>
            <p className="eyebrow">Reports</p>
            <h2>Website reports</h2>
            <p className="overview-subtitle">Generate and review website performance reports using the analytics and intelligence collected by TMTR20.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => void generateReport()} disabled={generating || loading}>
            <Sparkles size={16} className={generating ? 'spin' : ''} />
            {generating ? 'Generating report...' : 'Generate report'}
          </button>
        </header>

        {generateError && (
          <div className="panel-state error-state report-alert">
            <AlertTriangle size={16} />
            <p>{generateError}</p>
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading reports..." />
        ) : error ? (
          <div className="panel-state error-state report-alert">
            <AlertTriangle size={16} />
            <div>
              <h3>Unable to load reports</h3>
              <p>{error}</p>
            </div>
            <button type="button" className="primary-button compact" onClick={() => void refreshReports()}>
              Retry
            </button>
          </div>
        ) : !latestReport && !history.length ? (
          <div className="panel-state empty-state-panel report-empty-state">
            <FileText size={20} />
            <div>
              <h3>No reports generated yet</h3>
              <p>No reports have been generated for this website yet. Generate the first one to review the period snapshot and delivery options.</p>
            </div>
            <button type="button" className="primary-button compact" onClick={() => void generateReport()} disabled={generating}>
              <Sparkles size={16} className={generating ? 'spin' : ''} />
              {generating ? 'Generating...' : 'Generate report'}
            </button>
          </div>
        ) : (
          <>
            <div className="report-summary-grid">
              <article className="panel-block report-highlight">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Latest report</p>
                    <h3>{reportType}</h3>
                  </div>
                  <span className={`report-status ${String(activeReport?.status ?? '').toLowerCase()}`}>
                    {activeReport ? getReportStatus(activeReport.status) : 'No report'}
                  </span>
                </div>

                <div className="report-metadata">
                  <span><strong>Period:</strong> {reportPeriod}</span>
                  <span><strong>Generated:</strong> {formatDate(activeReport?.generatedAt ?? activeReport?.createdAt ?? activeReport?.updatedAt)}</span>
                  <span><strong>Website:</strong> {typeof activeReport?.website === 'string' ? activeReport.website : activeReport?.website?.name ?? selectedWebsite.name}</span>
                </div>

                <div className="report-actions-row">
                  {activeReport && (
                    <>
                      <button type="button" className="primary-button compact" onClick={() => void emailReport(activeReport)} disabled={emailing}>
                        <Mail size={15} />
                        {emailing ? 'Sending...' : 'Email report'}
                      </button>
                      <button type="button" className="secondary-button compact" onClick={() => void downloadPdf(activeReport)} disabled={pdfLoadingId === getReportId(activeReport)}>
                        <Download size={15} className={pdfLoadingId === getReportId(activeReport) ? 'spin' : ''} />
                        {pdfLoadingId === getReportId(activeReport) ? 'Preparing PDF...' : 'View PDF'}
                      </button>
                    </>
                  )}
                </div>

                {pdfError && (
                  <div className="panel-state error-state report-alert compact-error">
                    <AlertTriangle size={16} />
                    <p>{pdfError}</p>
                  </div>
                )}
                {emailError && (
                  <div className="panel-state error-state report-alert compact-error">
                    <AlertTriangle size={16} />
                    <p>{emailError}</p>
                  </div>
                )}
              </article>

              <article className="panel-block report-metadata-panel">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Report window</p>
                    <h3>Current request</h3>
                  </div>
                  <Clock3 size={16} className="panel-icon" />
                </div>

                <div className="report-metadata-stack">
                  <div>
                    <span>Selected period</span>
                    <strong>{dateRange.from} → {dateRange.to}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{activeReport ? getReportStatus(activeReport.status) : 'No report generated yet'}</strong>
                  </div>
                  <div>
                    <span>Generated</span>
                    <strong>{activeReport ? formatDate(activeReport.generatedAt ?? activeReport.createdAt ?? activeReport.updatedAt) : 'Not available'}</strong>
                  </div>
                </div>
              </article>
            </div>

            <section className="panel-block report-history-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">History</p>
                  <h3>Report history</h3>
                </div>
                <button type="button" className="text-button inline" onClick={() => void refreshReports()}>
                  Refresh
                </button>
              </div>

              {historyLoading ? (
                <p className="muted-copy">Loading report history...</p>
              ) : historyError ? (
                <div className="panel-state error-state report-alert">
                  <AlertTriangle size={16} />
                  <p>{historyError}</p>
                </div>
              ) : history.length === 0 ? (
                <p className="muted-copy">No reports have been generated for this website yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table compact-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Period</th>
                        <th>Status</th>
                        <th>Generated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((report) => {
                        const id = getReportId(report);
                        const isActive = activeReport && id && getReportId(activeReport) === id;
                        return (
                          <tr key={id ?? `${report.createdAt ?? 'report'}-${report.status ?? 'status'}`} className={isActive ? 'report-selected-row' : ''}>
                            <td>{report.type ?? report.reportType ?? 'Monthly report'}</td>
                            <td>{getReportPeriod(report)}</td>
                            <td>
                              <span className={`report-status ${String(report.status ?? '').toLowerCase()}`}>
                                {getReportStatus(report.status)}
                              </span>
                            </td>
                            <td>{formatDate(report.generatedAt ?? report.createdAt ?? report.updatedAt)}</td>
                            <td>
                              <div className="history-actions">
                                <button type="button" className="text-button inline" onClick={() => setSelectedReportId(id)}>
                                  View
                                </button>
                                {id && (
                                  <button type="button" className="text-button inline" onClick={() => void emailReport(report)}>
                                    Email
                                  </button>
                                )}
                                {id && (
                                  <button type="button" className="text-button inline" onClick={() => void downloadPdf(report)}>
                                    PDF
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
