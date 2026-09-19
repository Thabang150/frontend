'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, Copy, ExternalLink, Globe, Info, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { AuthGuard } from '../../../../../components/auth-guard';
import { LoadingState } from '../../../../../components/loading-state';
import { useDashboard } from '../../../../../components/dashboard-context';

const asDisplayValue = (value?: string | null) => (typeof value === 'string' && value.trim() ? value : 'Not available');

const makeTrackerSnippet = (trackingId?: string) => {
  if (!trackingId || !trackingId.trim()) return '';
  return `<script src="https://tmtr20-web-tracker.onrender.com/tracker.js" data-site-id="tmtr_${trackingId.trim()}" defer></script>`;
};

const buildDebugUrl = (websiteUrl?: string) => {
  if (!websiteUrl || !websiteUrl.trim()) return null;
  try {
    const url = new URL(websiteUrl);
    url.searchParams.set('tmtr20_debug', 'true');
    return url.toString();
  } catch {
    const suffix = websiteUrl.includes('?') ? '&' : '?';
    return `${websiteUrl}${suffix}tmtr20_debug=true`;
  }
};

const copyText = async (value: string) => {
  if (!value) {
    throw new Error('Nothing to copy.');
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!successful) {
    throw new Error('Clipboard access is unavailable in this browser.');
  }
};

export default function TrackingSettingsPage() {
  const { selectedWebsite, websiteLoading, websiteError, refreshWebsites } = useDashboard();
  const [copyCodeState, setCopyCodeState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyIdState, setCopyIdState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyMessage, setCopyMessage] = useState<string>('');

  const trackerId = selectedWebsite?.trackingId?.trim();
  const trackerSnippet = useMemo(() => makeTrackerSnippet(trackerId), [trackerId]);
  const debugUrl = useMemo(() => buildDebugUrl(selectedWebsite?.url), [selectedWebsite?.url]);
  const hasTrackingId = Boolean(trackerId);
  const websiteStatus = (selectedWebsite?.status ?? 'Unknown').toUpperCase();
  const trackingConfigured = hasTrackingId ? 'Configured' : 'Not configured';
  const trackingVerified = hasTrackingId ? 'Verification unavailable' : 'Verification unavailable';

  useEffect(() => {
    setCopyCodeState('idle');
    setCopyIdState('idle');
    setCopyMessage('');
  }, [selectedWebsite?._id]);

  const copiedCode = async () => {
    if (!trackerSnippet) {
      setCopyCodeState('error');
      setCopyMessage('No tracking snippet is available for the current website.');
      return;
    }

    try {
      await copyText(trackerSnippet);
      setCopyCodeState('copied');
      setCopyMessage('Copied');
      window.setTimeout(() => setCopyCodeState('idle'), 1800);
      window.setTimeout(() => setCopyMessage(''), 2200);
    } catch (error) {
      setCopyCodeState('error');
      setCopyMessage(error instanceof Error ? error.message : 'Copy failed.');
    }
  };

  const copiedTrackingId = async () => {
    if (!trackerId) {
      setCopyIdState('error');
      setCopyMessage('No tracking ID is available for the current website.');
      return;
    }

    try {
      await copyText(trackerId);
      setCopyIdState('copied');
      setCopyMessage('Copied');
      window.setTimeout(() => setCopyIdState('idle'), 1800);
      window.setTimeout(() => setCopyMessage(''), 2200);
    } catch (error) {
      setCopyIdState('error');
      setCopyMessage(error instanceof Error ? error.message : 'Copy failed.');
    }
  };

  if (!selectedWebsite) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state">
          <p className="eyebrow">Tracking</p>
          <h2>No website selected</h2>
          <p>Select a website to review its tracking setup, snippet, and installation status.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="tracking-page">
        <header className="analytics-header tracking-header">
          <div>
            <p className="eyebrow">Tracking</p>
            <h2>{selectedWebsite.name}</h2>
            <p className="overview-subtitle">Website tracking setup, installation guidance, and verification checks.</p>
          </div>

          <div className="tracking-header-actions">
            <button type="button" className="secondary-button compact" onClick={() => void refreshWebsites()}>
              Refresh
            </button>
          </div>
        </header>

        {websiteError && (
          <div className="panel-state error-state tracking-alert">
            <AlertTriangle size={16} />
            <p>{websiteError}</p>
          </div>
        )}

        {websiteLoading && !selectedWebsite ? (
          <LoadingState message="Loading tracking setup..." />
        ) : (
          <>
            <div className="tracking-summary-grid">
              <article className="panel-block tracking-card">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Status</p>
                    <h3>Tracking configuration</h3>
                  </div>
                  {hasTrackingId ? <CheckCircle2 size={18} className="panel-icon success-icon" /> : <ShieldAlert size={18} className="panel-icon warning-icon" />}
                </div>
                <div className="tracking-status-row">
                  <span className={`status-pill ${hasTrackingId ? 'configured' : 'not-configured'}`}>{trackingConfigured}</span>
                  <span className="status-pill neutral">{trackingVerified}</span>
                </div>
                <div className="tracking-meta-stack">
                  <div><span>Website</span><strong>{selectedWebsite.name}</strong></div>
                  <div><span>URL</span><strong>{asDisplayValue(selectedWebsite.url)}</strong></div>
                  <div><span>Domain</span><strong>{asDisplayValue(selectedWebsite.domain)}</strong></div>
                </div>
              </article>

              <article className="panel-block tracking-card">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Tracking ID</p>
                    <h3>{hasTrackingId ? `tmtr_${trackerId}` : 'Not available'}</h3>
                  </div>
                  <button type="button" className="secondary-button compact" onClick={() => void copiedTrackingId()} disabled={!trackerId}>
                    <Copy size={15} />
                    {copyIdState === 'copied' ? 'Copied' : 'Copy tracking ID'}
                  </button>
                </div>
                <div className="tracking-meta-stack compact">
                  <div><span>Tracking status</span><strong>{hasTrackingId ? 'ID present' : 'No usable tracking ID'}</strong></div>
                  <div><span>Website status</span><strong>{websiteStatus || 'Unknown'}</strong></div>
                  <div><span>Install state</span><strong>{hasTrackingId ? 'Ready for installation' : 'Awaiting tracker setup'}</strong></div>
                </div>
              </article>
            </div>

            <section className="panel-block tracking-code-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Installation snippet</p>
                  <h3>Tracker code</h3>
                </div>
                <button type="button" className="primary-button compact" onClick={() => void copiedCode()} disabled={!trackerSnippet}>
                  <Clipboard size={15} />
                  {copyCodeState === 'copied' ? 'Copied' : 'Copy tracking code'}
                </button>
              </div>

              {!trackerSnippet ? (
                <div className="panel-state empty-state-panel tracking-empty">
                  <Info size={18} />
                  <p>No tracking ID is available for this website. Create or update the website record to generate a tracking ID before installing the script.</p>
                </div>
              ) : (
                <pre className="code-block" aria-label="Tracking installation script"><code>{trackerSnippet}</code></pre>
              )}

              {copyMessage && (
                <p className="copy-feedback" aria-live="polite">{copyMessage}</p>
              )}
            </section>

            <div className="tracking-layout">
              <section className="panel-block tracking-panel">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Installation</p>
                    <h3>Setup instructions</h3>
                  </div>
                  <Globe size={16} className="panel-icon" />
                </div>

                <div className="tracking-instruction-list">
                  <div>
                    <h4>Standard website</h4>
                    <p>Place the tracking snippet in the site&apos;s <strong>&lt;head&gt;</strong> before the page content loads.</p>
                  </div>
                  <div>
                    <h4>Next.js / React</h4>
                    <p>Insert the script in the root layout or a shared app shell so it loads on each page without creating a second tracking implementation.</p>
                  </div>
                  <div>
                    <h4>WordPress / CMS</h4>
                    <p>Add the snippet in your header or custom code area for the active website, then refresh the page and check for activity in the dashboard.</p>
                  </div>
                </div>
              </section>

              <section className="panel-block tracking-panel">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">Verification</p>
                    <h3>Check installation</h3>
                  </div>
                  <ShieldCheck size={16} className="panel-icon" />
                </div>

                <div className="tracking-verification">
                  <p className="muted-copy">No direct backend verification endpoint was found in the current frontend/backend contract. The tracker is verified by watching the website&apos;s traffic appear in the existing Overview and Behaviour data after install.</p>
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => {
                      if (debugUrl) {
                        window.open(debugUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }

                      setCopyMessage('No public URL is available for this website, so manual verification is required.');
                    }}
                  >
                    <Sparkles size={15} />
                    Verify tracking
                  </button>
                  {debugUrl && (
                    <div className="debug-link-row">
                      <code>{debugUrl}</code>
                      <a href={debugUrl} target="_blank" rel="noreferrer" className="text-button inline">
                        Open debug URL <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="panel-block tracking-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Troubleshooting</p>
                  <h3>Common issues</h3>
                </div>
              </div>

              <div className="tracking-issues">
                <ul>
                  <li>Check that the snippet is installed on the correct website and that the active website record uses the intended tracking ID.</li>
                  <li>Confirm the website is not paused or archived before expecting new events to be accepted.</li>
                  <li>Verify the browser is loading the page after the script has been added and the site is publicly reachable.</li>
                  <li>If data still is not appearing, review the website in Overview or Behaviour after a real page visit.</li>
                </ul>
              </div>
            </section>

            <section className="panel-block tracking-panel">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Privacy</p>
                  <h3>Tracker boundaries</h3>
                </div>
              </div>

              <div className="tracking-notes">
                <p>The current tracker does not collect form values, passwords, keystrokes, screenshots, raw cursor paths, or session video. It is intended for website traffic, behavioural activity, and conversion signal collection only.</p>
                <p>Once tracking is active, TMTR20 can use the data collected from this website in the existing Overview, Behaviour, Conversions, Health, and Intelligence views.</p>
              </div>
            </section>
          </>
        )}
      </section>
    </AuthGuard>
  );
}
