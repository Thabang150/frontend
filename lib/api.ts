'use client';

const LAST_ACTIVITY_KEY = 'tmtr20_last_activity';
export const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function markSessionActivity() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function isSessionTimedOut() {
  if (typeof window === 'undefined') return false;

  const session = getStoredSession();
  if (!session.accessToken && !session.refreshToken) {
    return false;
  }

  const lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? '0');
  return Number.isFinite(lastActivity) && Date.now() - lastActivity > SESSION_TIMEOUT_MS;
}

export function notifySessionExpired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tmtr20:session-expired'));
}

export type ApiErrorDetails = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: ApiErrorDetails;
  message?: string;
};

export type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;

    if (typeof payload === 'object' && payload && 'error' in payload) {
      const error = (payload as { error?: { code?: string } }).error;
      this.code = error?.code;
    }
  }
}

const DEFAULT_BASE_URL = 'https://tmtr20-web-tracker.onrender.com/api';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE_URL;

const STORAGE_KEYS = {
  accessToken: 'tmtr20_access_token',
  refreshToken: 'tmtr20_refresh_token',
  user: 'tmtr20_user',
};

export function getStoredSession(): AuthSession {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, user: null };
  }

  try {
    const accessToken = window.localStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = window.localStorage.getItem(STORAGE_KEYS.refreshToken);
    const userValue = window.localStorage.getItem(STORAGE_KEYS.user);

    return {
      accessToken,
      refreshToken,
      user: userValue ? (JSON.parse(userValue) as Record<string, unknown>) : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function setStoredSession(tokens: Partial<AuthSession>) {
  if (typeof window === 'undefined') return;

  markSessionActivity();

  if (tokens.accessToken !== undefined) {
    if (tokens.accessToken) {
      window.localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.accessToken);
    }
  }

  if (tokens.refreshToken !== undefined) {
    if (tokens.refreshToken) {
      window.localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
    }
  }

  if (tokens.user !== undefined) {
    if (tokens.user) {
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(tokens.user));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.user);
    }
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(STORAGE_KEYS.user);
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
}

async function parseJsonBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshPromise: Promise<string | null> | null = null;
let sessionExpiryNotified = false;

function expireStoredSession() {
  clearStoredSession();
  if (sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  notifySessionExpired();
}

export async function refreshAccessToken(): Promise<string | null> {
  const currentSession = getStoredSession();
  if (!currentSession.refreshToken) return null;

  if (isSessionTimedOut()) {
    expireStoredSession();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession.refreshToken}`,
          },
        });

        const payload = await parseJsonBody(response);
        if (!response.ok) {
          throw new ApiError(response.status, payload?.error?.message ?? payload?.message ?? 'Session refresh failed', payload);
        }

        const nextAccessToken = payload?.data?.accessToken ?? payload?.accessToken ?? currentSession.accessToken;
        const nextRefreshToken = payload?.data?.refreshToken ?? payload?.refreshToken ?? currentSession.refreshToken;

        if (!nextAccessToken) {
          throw new ApiError(401, 'No access token returned by refresh endpoint', payload);
        }

        setStoredSession({ accessToken: nextAccessToken, refreshToken: nextRefreshToken, user: getStoredSession().user });
        return nextAccessToken;
      } catch (error) {
        expireStoredSession();
        throw error instanceof Error ? error : new Error('Session refresh failed');
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = false): Promise<T> {
  const session = getStoredSession();
  const accessToken = session.accessToken;

  if (isSessionTimedOut()) {
    expireStoredSession();
    throw new ApiError(401, 'Your session has expired due to inactivity. Please sign in again.', { code: 'SESSION_EXPIRED' });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await parseJsonBody(response);

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? 'Request failed';

    if (response.status === 401 && !retry && session.refreshToken) {
      try {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          return apiRequest<T>(path, options, true);
        }
      } catch {
        // The caller handles refresh failure through status/redirect flow.
      }
    }

    if (response.status === 401) {
      expireStoredSession();
    }

    throw new ApiError(response.status, message, payload);
  }

  return (payload && 'data' in payload ? payload.data : payload) as T;
}

export async function loginWithEmail(credentials: { email: string; password: string }) {
  const payload = await apiRequest<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>(`/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  setStoredSession({ accessToken: payload.accessToken, refreshToken: payload.refreshToken, user: payload.user });
  sessionExpiryNotified = false;
  return payload;
}

export async function registerWithEmail(credentials: { name: string; email: string; password: string }) {
  const payload = await apiRequest<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>(`/auth/register`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  setStoredSession({ accessToken: payload.accessToken, refreshToken: payload.refreshToken, user: payload.user });
  sessionExpiryNotified = false;
  return payload;
}

export async function logoutCurrentUser() {
  const session = getStoredSession();
  try {
    if (session.accessToken) {
      await apiRequest('/auth/logout', { method: 'POST' });
    }
  } catch {
    // Ignore logout errors and clear local session anyway.
  } finally {
    clearStoredSession();
  }
}

export async function fetchCurrentUser() {
  return apiRequest<{ id?: string; name?: string; email?: string; role?: string }>(`/auth/me`);
}
