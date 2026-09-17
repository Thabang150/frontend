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
import {
  ApiError,
  clearStoredSession,
  fetchCurrentUser,
  getStoredSession,
  loginWithEmail,
  logoutCurrentUser,
  refreshAccessToken,
  registerWithEmail,
} from '../lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'refreshing' | 'forbidden' | 'network-error';

export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (credentials: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const session = getStoredSession();
    if (!session.accessToken) {
      setUser(null);
      setAccessToken(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser ?? null);
      setAccessToken(session.accessToken);
      setStatus('authenticated');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setStatus('refreshing');
        const refreshed = await refreshAccessToken().catch(() => null);
        if (refreshed) {
          const reloadedUser = await fetchCurrentUser().catch(() => null);
          setUser(reloadedUser ?? null);
          setAccessToken(refreshed);
          setStatus('authenticated');
          return;
        }

        clearStoredSession();
        setUser(null);
        setAccessToken(null);
        setStatus('unauthenticated');
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setStatus('forbidden');
        return;
      }

      const networkError = error instanceof TypeError || error instanceof Error && /fetch|network/i.test(error.message);
      setStatus(networkError ? 'network-error' : 'unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    const payload = await loginWithEmail(credentials);
    setUser(payload.user as AuthUser);
    setAccessToken(payload.accessToken);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (credentials: { name: string; email: string; password: string }) => {
    const payload = await registerWithEmail(credentials);
    setUser(payload.user as AuthUser);
    setAccessToken(payload.accessToken);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setStatus('unauthenticated');
    await logoutCurrentUser();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const refreshedToken = await refreshAccessToken();
      if (!refreshedToken) {
        setStatus('unauthenticated');
        return false;
      }
      setAccessToken(refreshedToken);
      setStatus('authenticated');
      return true;
    } catch {
      clearStoredSession();
      setUser(null);
      setAccessToken(null);
      setStatus('unauthenticated');
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, accessToken, login, register, logout, refreshSession, refreshUser }),
    [status, user, accessToken, login, register, logout, refreshSession, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
