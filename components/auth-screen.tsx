'use client';

import { ArrowUpRight, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './auth-provider';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ name: form.name, email: form.email, password: form.password });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to authenticate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-mark">
          <img src="/TMTR20-double-infinity.png" alt="TMTR20" />
          <strong>TMTR20</strong>
        </div>

        <div className="visual-copy">
          <p className="eyebrow">WEBSITE INTELLIGENCE</p>
          <h1>Monitor performance with clarity.</h1>
          <p>One command centre for website traffic, health, conversion performance, and executive reporting.</p>
        </div>

        <div className="signal-card">
          <span className="signal-dot" />
          <span>LIVE SIGNAL</span>
          <strong>Operational visibility.</strong>
          <span>Track. Measure. Improve.</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-mark standalone">
            <img src="/TMTR20-double-infinity.png" alt="TMTR20" />
            <strong>TMTR20</strong>
          </div>

          <p className="eyebrow">WORKSPACE ACCESS</p>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="muted">
            {mode === 'login'
              ? 'Sign in to see how your websites are performing.'
              : 'Start collecting useful signals from your websites.'}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Your name"
                />
              </label>
            )}

            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="you@company.com"
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                placeholder="At least 8 characters"
              />
            </label>

            {error && (
              <div className="form-error">
                <CircleAlert size={16} />
                {error}
              </div>
            )}

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              <ArrowUpRight size={17} />
            </button>
          </form>

          <button className="text-button" onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))} type="button">
            {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}
