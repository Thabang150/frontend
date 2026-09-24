'use client';

import { useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, ShieldCheck, Users } from 'lucide-react';
import { AuthGuard } from '../../../../components/auth-guard';
import { LoadingState } from '../../../../components/loading-state';
import { useDashboard } from '../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../lib/api';

type AudienceMetric = {
  value?: string;
  label?: string;
  sessions?: number;
  visitors?: number;
  [key: string]: unknown;
};

type AudienceResponse = {
  devices?: AudienceMetric[];
  operatingSystems?: AudienceMetric[];
  browsers?: AudienceMetric[];
  languages?: AudienceMetric[];
  timezones?: AudienceMetric[];
  viewports?: AudienceMetric[];
  screens?: AudienceMetric[];
  [key: string]: unknown;
};

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
      <ShieldCheck size={18} />
      <div>
        <h3>Unable to load audience data</h3>
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

export default function AudiencePage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [data, setData] = useState<AudienceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudience = async () => {
    if (!selectedWebsite?._id) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest<AudienceResponse>(
        `/websites/${selectedWebsite._id}/audience?startDate=${dateRange.from}&endDate=${dateRange.requestTo}`,
      );
      setData(response);
    } catch (cause) {
      setError((cause as ApiError)?.message ?? 'The audience data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudience();
  }, [selectedWebsite?._id, dateRange.from, dateRange.to]);

  const sections = useMemo(
    () => [
      { key: 'devices', label: 'Devices', icon: <Smartphone size={14} /> },
      { key: 'operatingSystems', label: 'Operating systems', icon: <Monitor size={14} /> },
      { key: 'browsers', label: 'Browsers', icon: <Monitor size={14} /> },
      { key: 'languages', label: 'Languages', icon: <Users size={14} /> },
      { key: 'timezones', label: 'Timezones', icon: <Users size={14} /> },
      { key: 'viewports', label: 'Viewports', icon: <Monitor size={14} /> },
      { key: 'screens', label: 'Screen categories', icon: <Monitor size={14} /> },
    ] as const,
    [],
  );

  const hasData = !!data && sections.some(({ key }) => Array.isArray((data as Record<string, unknown>)[key]) && ((data as Record<string, unknown>)[key] as AudienceMetric[]).length > 0);

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Audience</p>
          <h2>No website selected</h2>
          <p>Choose a website to view audience environment data.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="analytics-page">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Audience</p>
            <h2>Visitor environments</h2>
          </div>
          <div className="analytics-range">
            <span>{dateRange.from}</span>
            <span>→</span>
            <span>{dateRange.to}</span>
          </div>
        </header>

        {loading ? (
          <LoadingState message="Loading audience signals..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadAudience()} />
        ) : !hasData ? (
          <div className="panel-state empty-state-panel">
            <Users size={18} />
            <div>
              <h3>No audience data yet</h3>
              <p>Sample technical environment data will appear here once tracked visits are recorded.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="privacy-note">
              This section shows technical information recorded from website visits. It does not provide demographic information such as age, gender or income.
            </div>

            <div className="analytics-grid audience-grid">
              {sections.map(({ key, label, icon }) => {
                const list = (data as Record<string, unknown>)[key] as AudienceMetric[] | undefined;
                if (!Array.isArray(list) || list.length === 0) return null;

                const maxValue = Math.max(...list.map((entry) => toNumber(entry.sessions)), 1);

                return (
                  <div key={key} className="panel-block">
                    <div className="panel-heading-row">
                      <div>
                        <p className="eyebrow">{label}</p>
                        <h3>{label}</h3>
                      </div>
                      {icon}
                    </div>

                    <div className="distribution-list compact-list">
                      {list.slice(0, 8).map((entry, index) => {
                        const value = toNumber(entry.sessions);
                        const displayValue = entry.value ?? entry.label ?? `Item ${index + 1}`;
                        return (
                          <div key={`${key}-${displayValue}`} className="distribution-row">
                            <div className="distribution-header">
                              <span>{formatValue(String(displayValue))}</span>
                              <strong>{value.toLocaleString()}</strong>
                            </div>
                            <div className="distribution-track">
                              <i style={{ width: `${(value / maxValue) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
