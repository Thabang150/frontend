'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Globe2, CalendarRange } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from './auth-provider';

export type WebsiteRecord = {
  _id: string;
  name: string;
  url?: string;
  domain?: string;
  status?: string;
  trackingId?: string;
  archived?: boolean;
  [key: string]: unknown;
};

export type DateRange = {
  from: string;
  to: string;
  label: string;
};

type DashboardContextValue = {
  websites: WebsiteRecord[];
  selectedWebsite: WebsiteRecord | null;
  websiteLoading: boolean;
  websiteError: string | null;
  dateRange: DateRange;
  setDateRange: (nextRange: DateRange) => void;
  setWebsiteId: (websiteId: string) => void;
  refreshWebsites: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const isoDate = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);

const normalizeDateValue = (value: string | null | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateRange = (input: Partial<DateRange>): DateRange => {
  const fallback = defaultRange();
  const fromDate = normalizeDateValue(input.from);
  const toDate = normalizeDateValue(input.to);

  if (!fromDate || !toDate) {
    return fallback;
  }

  const start = fromDate.getTime() <= toDate.getTime() ? input.from! : input.to!;
  const end = fromDate.getTime() <= toDate.getTime() ? input.to! : input.from!;

  return {
    from: start,
    to: end,
    label: input.label ?? 'Custom range',
  };
};

const defaultRange = (): DateRange => {
  const end = new Date();
  const start = addDays(end, -29);
  return { from: isoDate(start), to: isoDate(end), label: 'Last 30 days' };
};

const safeWebsiteStatus = (status?: string) => (status ?? '').toLowerCase();

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [websites, setWebsites] = useState<WebsiteRecord[]>([]);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [dateRange, setDateRangeState] = useState<DateRange>(defaultRange());

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ websiteId?: string }>();
  const { accessToken } = useAuth();

  const refreshWebsites = useCallback(async () => {
    if (!accessToken) return;
    setWebsiteLoading(true);
    setWebsiteError(null);

    try {
      const nextWebsites = await apiRequest<WebsiteRecord[]>('/websites');
      setWebsites(nextWebsites.filter((website) => safeWebsiteStatus(website.status) !== 'archived'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load websites';
      setWebsiteError(message);
    } finally {
      setWebsiteLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refreshWebsites();
  }, [refreshWebsites]);

  useEffect(() => {
    const incomingFrom = searchParams.get('startDate') ?? searchParams.get('from');
    const incomingTo = searchParams.get('endDate') ?? searchParams.get('to');

    if (incomingFrom && incomingTo) {
      setDateRangeState(normalizeDateRange({ from: incomingFrom, to: incomingTo, label: 'Custom range' }));
      return;
    }

    setDateRangeState(defaultRange());
  }, [searchParams]);

  const setDateRange = useCallback(
    (nextRange: DateRange) => {
      const safeRange = normalizeDateRange(nextRange);
      setDateRangeState(safeRange);
      const params = new URLSearchParams(searchParams.toString());
      params.set('startDate', safeRange.from);
      params.set('endDate', safeRange.to);
      const nextUrl = `${pathname}?${params.toString()}`;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams],
  );

  const setWebsiteId = useCallback(
    (websiteId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextUrl = `/websites/${websiteId}/overview?${params.toString() || ''}`;
      router.push(nextUrl.replace(/\?$/, ''));
    },
    [router, searchParams],
  );

  const selectedWebsite = useMemo(() => {
    if (!params?.websiteId) return websites[0] ?? null;
    return websites.find((website) => website._id === params.websiteId) ?? websites[0] ?? null;
  }, [params?.websiteId, websites]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      websites,
      selectedWebsite,
      websiteLoading,
      websiteError,
      dateRange,
      setDateRange,
      setWebsiteId,
      refreshWebsites,
    }),
    [dateRange, refreshWebsites, selectedWebsite, setDateRange, websiteError, websiteLoading, websites, setWebsiteId],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used inside a DashboardProvider');
  }
  return context;
}

export const datePresets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'This month', value: 'this_month' },
  { label: 'Previous month', value: 'previous_month' },
] as const;

export function createRangeForPreset(preset: (typeof datePresets)[number]['value']): DateRange {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case 'today':
      return normalizeDateRange({ from: isoDate(end), to: isoDate(end), label: 'Today' });
    case 'yesterday': {
      const yesterday = addDays(end, -1);
      return normalizeDateRange({ from: isoDate(yesterday), to: isoDate(yesterday), label: 'Yesterday' });
    }
    case 'last_7_days': {
      const from = addDays(end, -6);
      return normalizeDateRange({ from: isoDate(from), to: isoDate(end), label: 'Last 7 days' });
    }
    case 'last_30_days': {
      const from = addDays(end, -29);
      return normalizeDateRange({ from: isoDate(from), to: isoDate(end), label: 'Last 30 days' });
    }
    case 'this_month': {
      const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      return normalizeDateRange({ from: isoDate(from), to: isoDate(end), label: 'This month' });
    }
    case 'previous_month': {
      const firstOfCurrentMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      const previousMonthStart = new Date(Date.UTC(firstOfCurrentMonth.getUTCFullYear(), firstOfCurrentMonth.getUTCMonth() - 1, 1));
      const previousMonthEnd = new Date(Date.UTC(firstOfCurrentMonth.getUTCFullYear(), firstOfCurrentMonth.getUTCMonth(), 0));
      return normalizeDateRange({ from: isoDate(previousMonthStart), to: isoDate(previousMonthEnd), label: 'Previous month' });
    }
    default:
      return defaultRange();
  }
}

export function WebsiteSelector() {
  const { websites, selectedWebsite, websiteLoading, websiteError, setWebsiteId } = useDashboard();

  return (
    <div className="toolbar-select-wrap">
      <Globe2 size={16} />
      <select
        className="toolbar-select"
        value={selectedWebsite?._id ?? ''}
        onChange={(event) => setWebsiteId(event.target.value)}
        aria-label="Select website"
      >
        {websiteLoading && <option value="">Loading websites...</option>}
        {!websiteLoading && !websites.length && <option value="">No active websites</option>}
        {websites.map((website) => (
          <option key={website._id} value={website._id}>
            {website.name}
            {website.domain ? ` • ${website.domain}` : ''}
          </option>
        ))}
      </select>
      {websiteError && <span className="toolbar-hint error">{websiteError}</span>}
    </div>
  );
}

export function DateRangePicker() {
  const { dateRange, setDateRange } = useDashboard();
  const [customFrom, setCustomFrom] = useState(dateRange.from);
  const [customTo, setCustomTo] = useState(dateRange.to);

  useEffect(() => {
    setCustomFrom(dateRange.from);
    setCustomTo(dateRange.to);
  }, [dateRange]);

  const applyPreset = (preset: (typeof datePresets)[number]['value']) => {
    setDateRange(createRangeForPreset(preset));
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const nextRange = normalizeDateRange({ from: customFrom, to: customTo, label: 'Custom range' });
    setCustomFrom(nextRange.from);
    setCustomTo(nextRange.to);
    setDateRange(nextRange);
  };

  return (
    <div className="date-range-picker">
      <div className="date-range-header">
        <CalendarRange size={15} />
        <span>{dateRange.label}</span>
      </div>

      <div className="date-range-presets">
        {datePresets.map((preset) => (
          <button
            type="button"
            key={preset.value}
            className={`range-button ${dateRange.label === preset.label ? 'active' : ''}`}
            onClick={() => applyPreset(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="date-range-custom">
        <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
        <span>to</span>
        <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
        <button type="button" className="secondary-button compact" onClick={applyCustom}>
          Apply
        </button>
      </div>
    </div>
  );
}
