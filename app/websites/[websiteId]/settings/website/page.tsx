'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, LockKeyhole, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../../../components/auth-guard';
import { LoadingState } from '../../../../../components/loading-state';
import { useDashboard, type WebsiteRecord } from '../../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../../lib/api';

const websiteStatuses = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
type WebsiteStatus = (typeof websiteStatuses)[number];

const normalizeStatus = (status?: string): WebsiteStatus => {
  const normalized = status?.toUpperCase();
  return websiteStatuses.includes(normalized as WebsiteStatus) ? normalized as WebsiteStatus : 'ACTIVE';
};

const getErrorMessage = (cause: unknown, fallback: string) => (cause as ApiError)?.message ?? fallback;

export default function WebsiteSettingsPage() {
  const { websites, selectedWebsite, websiteLoading, websiteError, refreshWebsites } = useDashboard();
  const params = useParams<{ websiteId?: string }>();
  const router = useRouter();
  const routeWebsiteId = params?.websiteId;
  const routeMatchesSelection = Boolean(routeWebsiteId && selectedWebsite?._id === routeWebsiteId);
  const routeNotFound = Boolean(routeWebsiteId && !websiteLoading && websites.length > 0 && !websites.some((website) => website._id === routeWebsiteId));

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<WebsiteStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWebsite || !routeMatchesSelection) return;
    setName(selectedWebsite.name ?? '');
    setUrl(selectedWebsite.url ?? '');
    setStatus(normalizeStatus(selectedWebsite.status));
    setSaveMessage(null);
    setSaveError(null);
    setDeleteError(null);
  }, [routeMatchesSelection, selectedWebsite]);

  const saveWebsite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWebsite || saving) return;

    const nextName = name.trim();
    const nextUrl = url.trim();
    if (!nextName) {
      setSaveError('Website name is required.');
      return;
    }

    try {
      const parsedUrl = new URL(nextUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Use an HTTP or HTTPS website URL.');
    } catch {
      setSaveError('Enter a valid website URL, including https:// or http://.');
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    setDeleteError(null);

    try {
      await apiRequest<WebsiteRecord>(`/websites/${selectedWebsite._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName, url: nextUrl, status }),
      });
      await refreshWebsites();
      setSaveMessage('Website settings saved.');
    } catch (cause) {
      setSaveError(getErrorMessage(cause, 'Website settings could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteWebsite = async () => {
    if (!selectedWebsite || deleting) return;
    const confirmed = window.confirm(`Delete "${selectedWebsite.name}"? This will permanently remove it from your dashboard. This action cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/websites/${selectedWebsite._id}`, { method: 'DELETE' });
      await refreshWebsites();
      router.push('/websites');
    } catch (cause) {
      setDeleteError(getErrorMessage(cause, 'The website could not be deleted.'));
      setDeleting(false);
    }
  };

  if (websiteLoading) {
    return <AuthGuard><LoadingState message="Loading website settings..." /></AuthGuard>;
  }

  if (routeNotFound || (routeWebsiteId && !routeMatchesSelection && !selectedWebsite)) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state website-settings-empty">
          <p className="eyebrow">Website Settings</p>
          <h2>Website not found</h2>
          <p>This website is unavailable or you no longer have access to it.</p>
          <button type="button" className="primary-button compact" onClick={() => router.push('/websites')}>Return to websites</button>
        </section>
      </AuthGuard>
    );
  }

  if (!selectedWebsite || !routeMatchesSelection) {
    return (
      <AuthGuard>
        <section className="analytics-empty-state website-settings-empty">
          <p className="eyebrow">Website Settings</p>
          <h2>No website selected</h2>
          <p>Select a website to manage its basic information and status.</p>
        </section>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <section className="website-settings-page">
        <header className="analytics-header website-settings-header">
          <div>
            <p className="eyebrow">Website Settings</p>
            <h2>{selectedWebsite.name}</h2>
            <p className="overview-subtitle">Manage the basic information and status of this website.</p>
          </div>
          <span className={`status-pill website-status-pill ${status.toLowerCase()}`}>{status}</span>
        </header>

        {websiteError && <div className="panel-state error-state website-settings-alert"><AlertTriangle size={16} /><p>{websiteError}</p></div>}
        {saveError && <div className="panel-state error-state website-settings-alert"><AlertTriangle size={16} /><p>{saveError}</p></div>}
        {deleteError && <div className="panel-state error-state website-settings-alert"><AlertTriangle size={16} /><p>{deleteError}</p></div>}
        {saveMessage && <div className="panel-state success-state website-settings-alert"><CheckCircle2 size={16} /><p>{saveMessage}</p></div>}

        <form className="website-settings-form" onSubmit={saveWebsite}>
          <section className="panel-block website-settings-panel">
            <div className="panel-heading-row"><div><p className="eyebrow">Information</p><h3>Website information</h3></div></div>
            <div className="settings-form-grid">
              <label className="settings-field"><span>Website name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label className="settings-field"><span>Website URL</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required /></label>
            </div>
          </section>

          <section className="panel-block website-settings-panel">
            <div className="panel-heading-row"><div><p className="eyebrow">Status</p><h3>Website status</h3></div></div>
            <div className="settings-form-grid status-settings-grid">
              <label className="settings-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as WebsiteStatus)}>{websiteStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <p className="settings-help">Use the status values supported by TMTR20. Archived websites are removed from the active website selector.</p>
            </div>
          </section>

          <section className="panel-block website-settings-panel">
            <div className="panel-heading-row"><div><p className="eyebrow">Tracking information</p><h3>Read-only website record</h3></div><LockKeyhole size={16} className="panel-icon" /></div>
            <div className="readonly-settings-grid">
              <div><span>Tracking ID</span><strong>{selectedWebsite.trackingId ? `tmtr_${selectedWebsite.trackingId}` : 'Not available'}</strong></div>
              <div><span>Domain</span><strong>{selectedWebsite.domain || 'Not available'}</strong></div>
              <div><span>Current URL</span><strong>{selectedWebsite.url || 'Not available'}</strong></div>
            </div>
            <a className="settings-link" href={`/websites/${selectedWebsite._id}/settings/tracking`}>Manage tracker installation <ExternalLink size={14} /></a>
          </section>

          <div className="website-settings-actions"><button type="submit" className="primary-button" disabled={saving || deleting}>{saving ? 'Saving...' : 'Save changes'}</button></div>
        </form>

        <section className="panel-block website-danger-zone">
          <div><p className="eyebrow">Danger zone</p><h3>Delete this website</h3><p>Deleting <strong>{selectedWebsite.name}</strong> removes it from your dashboard. This action requires explicit confirmation and cannot be undone.</p></div>
          <button type="button" className="danger-button" onClick={() => void deleteWebsite()} disabled={deleting}><Trash2 size={15} />{deleting ? 'Deleting...' : 'Delete website'}</button>
        </section>
      </section>
    </AuthGuard>
  );
}
