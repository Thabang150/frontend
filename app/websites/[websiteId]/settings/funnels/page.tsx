'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, CheckCircle2, ChevronRight, CirclePlus, Pencil, Trash2, X } from 'lucide-react';
import { AuthGuard } from '../../../../../components/auth-guard';
import { LoadingState } from '../../../../../components/loading-state';
import { useDashboard } from '../../../../../components/dashboard-context';
import { apiRequest, type ApiError } from '../../../../../lib/api';

const supportedEvents = [
  'page_view',
  'session_start',
  'whatsapp_click',
  'phone_click',
  'email_click',
  'form_submission',
  'cta_click',
  'scroll_depth',
  'engagement_time',
  'outbound_click',
  'form_start',
  'form_abandonment',
  'rage_click',
  'dead_click',
  'click',
];

type FunnelStep = {
  key: string;
  name: string;
  eventName: string;
  pagePath?: string;
  pagePathPrefix?: string;
};

type FunnelRecord = {
  key: string;
  name: string;
  active?: boolean;
  steps: FunnelStep[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type FunnelStepEvaluation = {
  key?: string;
  name?: string;
  eventName?: string;
  sessions?: number;
  reachingSessions?: number;
  reachedSessions?: number;
  conversionRate?: number;
  dropOff?: number;
  progression?: number;
  rate?: number;
  [key: string]: unknown;
};

type FunnelEvaluation = {
  funnel?: string;
  key?: string;
  name?: string;
  steps?: FunnelStepEvaluation[];
  rows?: FunnelStepEvaluation[];
  summary?: Record<string, unknown>;
  enteringSessions?: number;
  sessions?: number;
  conversionRate?: number;
  finalSessions?: number;
  [key: string]: unknown;
};

type FunnelDraft = {
  key: string;
  name: string;
  active: boolean;
  steps: FunnelStep[];
};

const toSlug = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'new-funnel';
};

const initialStep = (): FunnelStep => ({
  key: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  eventName: 'page_view',
  pagePath: '',
  pagePathPrefix: '',
});

const createEmptyDraft = (): FunnelDraft => ({
  key: '',
  name: '',
  active: true,
  steps: [initialStep(), initialStep()],
});

const buildDraft = (funnel: FunnelRecord): FunnelDraft => ({
  key: funnel.key ?? '',
  name: funnel.name ?? '',
  active: funnel.active ?? true,
  steps: (funnel.steps ?? []).map((step, index) => ({
    key: step.key ?? `${funnel.key ?? 'step'}-${index + 1}`,
    name: step.name ?? '',
    eventName: step.eventName ?? 'page_view',
    pagePath: step.pagePath ?? '',
    pagePathPrefix: step.pagePathPrefix ?? '',
  })),
});

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatEvent = (eventName?: string) => {
  if (!eventName) return 'Unassigned event';
  return eventName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function normalizeStepRows(source: unknown): FunnelStepEvaluation[] {
  const rows: unknown[] = Array.isArray(source)
    ? source
    : Array.isArray((source as { rows?: unknown[] } | undefined)?.rows)
      ? (source as { rows?: unknown[] }).rows ?? []
      : [];

  return rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      return {
        key: String(record.key ?? record.stepKey ?? record.name ?? record.eventName ?? 'step'),
        name: String(record.name ?? record.title ?? record.label ?? record.eventName ?? 'Step'),
        eventName: String(record.eventName ?? record.event ?? record.type ?? ''),
        sessions: asNumber(record.sessions ?? record.reachedSessions ?? record.count ?? record.value),
        reachingSessions: asNumber(record.reachingSessions ?? record.enteringSessions ?? record.previousSessions),
        dropOff: asNumber(record.dropOff ?? record.dropoff ?? record.droppedOff),
        conversionRate: asNumber(record.conversionRate ?? record.rate ?? record.progress),
        progression: asNumber(record.progression ?? record.percent ?? record.share),
      };
    })
    .filter(Boolean) as FunnelStepEvaluation[];
}

const unifyEvaluation = (payload: FunnelEvaluation | null | undefined) => {
  const steps = normalizeStepRows(payload?.steps ?? payload?.rows ?? []);
  const summary = payload?.summary ?? {};
  const sessionTotal = asNumber(payload?.enteringSessions ?? payload?.sessions ?? summary.enteringSessions ?? summary.sessions);
  const finalTotal = asNumber(payload?.finalSessions ?? summary.finalSessions ?? steps.at(-1)?.sessions ?? steps.at(-1)?.reachingSessions ?? 0);
  const overallRate = asNumber(payload?.conversionRate ?? summary.conversionRate ?? (sessionTotal > 0 ? (finalTotal / sessionTotal) * 100 : 0));

  return { steps, sessionTotal, finalTotal, overallRate };
};

const validateDraft = (draft: FunnelDraft) => {
  const nextErrors: Record<string, string> = {};
  if (!draft.name.trim()) nextErrors.name = 'A funnel name is required.';
  if (!draft.key.trim()) nextErrors.key = 'A funnel key is required.';
  if (draft.steps.length < 2 || draft.steps.length > 5) nextErrors.steps = 'A funnel must contain 2–5 steps.';

  const seenKeys = new Set<string>();
  draft.steps.forEach((step, index) => {
    if (!step.name.trim()) nextErrors[`step-name-${index}`] = 'Step name is required.';
    if (!step.eventName.trim()) nextErrors[`step-event-${index}`] = 'Choose an event for this step.';
    if (!step.key.trim()) nextErrors[`step-key-${index}`] = 'A step key is required.';
    if (step.key.trim() && seenKeys.has(step.key.trim())) nextErrors[`step-key-${index}`] = 'Step keys must be unique.';
    seenKeys.add(step.key.trim());
    if (step.pagePath && step.pagePathPrefix) nextErrors[`step-page-${index}`] = 'Choose either an exact page path or a page path prefix, not both.';
  });

  return nextErrors;
};

export default function FunnelsPage() {
  const { selectedWebsite, dateRange } = useDashboard();
  const [funnels, setFunnels] = useState<FunnelRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<FunnelEvaluation | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<FunnelDraft>(createEmptyDraft());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);

  const selectedFunnel = useMemo(() => funnels.find((funnel) => funnel.key === selectedKey) ?? null, [funnels, selectedKey]);

  const loadFunnels = async () => {
    if (!selectedWebsite?._id) {
      setFunnels([]);
      setSelectedKey(null);
      return;
    }

    setListLoading(true);
    setListError(null);

    try {
      const response = await apiRequest<FunnelRecord[]>(`/websites/${selectedWebsite._id}/funnels`);
      setFunnels(Array.isArray(response) ? response : []);
      setSelectedKey((current) => {
        const nextKey = Array.isArray(response) && response.some((funnel) => funnel.key === current) ? current : response[0]?.key ?? null;
        return nextKey;
      });
    } catch (cause) {
      setListError((cause as ApiError)?.message ?? 'Unable to load funnels.');
    } finally {
      setListLoading(false);
    }
  };

  const loadEvaluation = async () => {
    if (!selectedWebsite?._id || !selectedKey) {
      setEvaluation(null);
      setEvaluationError(null);
      return;
    }

    setEvaluationLoading(true);
    setEvaluationError(null);

    try {
      const response = await apiRequest<FunnelEvaluation>(`/websites/${selectedWebsite._id}/conversions?startDate=${dateRange.from}&endDate=${dateRange.to}&funnel=${selectedKey}`);
      setEvaluation(response ?? null);
    } catch (cause) {
      setEvaluationError((cause as ApiError)?.message ?? 'Unable to load funnel evaluation.');
    } finally {
      setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    void loadFunnels();
  }, [selectedWebsite?._id]);

  useEffect(() => {
    void loadEvaluation();
  }, [selectedWebsite?._id, selectedKey, dateRange.from, dateRange.to]);

  const openCreate = () => {
    setEditingKey(null);
    setDraft(createEmptyDraft());
    setValidationErrors({});
    setEditorOpen(true);
  };

  const openEdit = (funnel: FunnelRecord) => {
    setEditingKey(funnel.key);
    setDraft(buildDraft(funnel));
    setValidationErrors({});
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingKey(null);
    setDraft(createEmptyDraft());
    setValidationErrors({});
  };

  const updateDraft = (updates: Partial<FunnelDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const updateStep = (index: number, field: keyof FunnelStep, value: string) => {
    setDraft((current) => {
      const nextSteps = [...current.steps];
      nextSteps[index] = { ...nextSteps[index], [field]: value };
      return { ...current, steps: nextSteps };
    });
  };

  const addStep = () => {
    if (draft.steps.length >= 5) return;
    setDraft((current) => ({ ...current, steps: [...current.steps, initialStep()] }));
  };

  const removeStep = (index: number) => {
    if (draft.steps.length <= 2) return;
    setDraft((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.steps.length) return;
    setDraft((current) => {
      const nextSteps = [...current.steps];
      const [item] = nextSteps.splice(index, 1);
      nextSteps.splice(nextIndex, 0, item);
      return { ...current, steps: nextSteps };
    });
  };

  const saveFunnel = async () => {
    if (!selectedWebsite?._id) return;

    const errors = validateDraft(draft);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaveBusy(true);

    try {
      const payload = {
        key: draft.key.trim() || toSlug(draft.name),
        name: draft.name.trim(),
        active: draft.active,
        steps: draft.steps.map((step, index) => ({
          key: step.key.trim() || `step-${index + 1}`,
          name: step.name.trim() || `Step ${index + 1}`,
          eventName: step.eventName,
          ...(step.pagePath && !step.pagePathPrefix ? { pagePath: step.pagePath.trim() } : {}),
          ...(step.pagePathPrefix && !step.pagePath ? { pagePathPrefix: step.pagePathPrefix.trim() } : {}),
        })),
      };

      if (editingKey) {
        await apiRequest(`/websites/${selectedWebsite._id}/funnels/${draft.key || editingKey}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/websites/${selectedWebsite._id}/funnels`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      closeEditor();
      await loadFunnels();
      const nextKey = editingKey ?? payload.key;
      setSelectedKey(nextKey);
    } catch (cause) {
      setValidationErrors({ form: (cause as ApiError)?.message ?? 'The funnel could not be saved.' });
    } finally {
      setSaveBusy(false);
    }
  };

  const deleteFunnel = async (funnel: FunnelRecord) => {
    if (!selectedWebsite?._id) return;
    const confirmed = window.confirm(`Delete funnel "${funnel.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await apiRequest(`/websites/${selectedWebsite._id}/funnels/${funnel.key}`, { method: 'DELETE' });
      const nextFunnels = funnels.filter((item) => item.key !== funnel.key);
      setFunnels(nextFunnels);
      setSelectedKey((current) => (current === funnel.key ? nextFunnels[0]?.key ?? null : current));
    } catch (cause) {
      setListError((cause as ApiError)?.message ?? 'The funnel could not be deleted.');
    }
  };

  const evaluationData = unifyEvaluation(evaluation);
  const hasEvaluation = evaluationData.steps.length > 0 || evaluationData.sessionTotal > 0 || evaluationData.finalTotal > 0;

  return (
    <AuthGuard>
      <section className="funnels-page">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">Funnels</p>
            <h2>Funnel builder</h2>
          </div>
          <button type="button" className="primary-button" onClick={openCreate}>
            <CirclePlus size={16} /> Create Funnel
          </button>
        </header>

        {listLoading ? (
          <LoadingState message="Loading funnels..." />
        ) : listError ? (
          <div className="panel-state error-state">
            <BarChart3 size={18} />
            <div>
              <h3>Unable to load funnels</h3>
              <p>{listError}</p>
            </div>
          </div>
        ) : (
          <div className="funnels-layout">
            <aside className="funnels-sidebar panel-block">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">Funnels</p>
                  <h3>Website journeys</h3>
                </div>
              </div>

              {funnels.length === 0 ? (
                <div className="empty-card">
                  <p>No funnels configured.</p>
                  <button type="button" className="primary-button compact" onClick={openCreate}>Create funnel</button>
                </div>
              ) : (
                <div className="funnels-list">
                  {funnels.map((funnel) => (
                    <div key={funnel.key} className={`funnel-list-item ${selectedKey === funnel.key ? 'selected' : ''}`}>
                      <div className="funnel-list-copy">
                        <strong>{funnel.name}</strong>
                        <span>{funnel.steps?.length ?? 0} steps</span>
                      </div>
                      <div className="funnel-list-actions">
                        <button type="button" className="text-button inline" onClick={() => setSelectedKey(funnel.key)}>
                          Open
                        </button>
                        <button type="button" className="icon-button small" onClick={() => openEdit(funnel)} aria-label={`Edit ${funnel.name}`}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="icon-button small danger" onClick={() => void deleteFunnel(funnel)} aria-label={`Delete ${funnel.name}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            <div className="funnels-main">
              {!selectedFunnel ? (
                <div className="panel-state empty-state-panel">
                  <CheckCircle2 size={18} />
                  <div>
                    <h3>No funnel selected</h3>
                    <p>Create a funnel to measure how sessions progress through a visitor journey.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="panel-block funnel-summary-panel">
                    <div className="panel-heading-row">
                      <div>
                        <p className="eyebrow">Selected funnel</p>
                        <h3>{selectedFunnel.name}</h3>
                      </div>
                      <button type="button" className="secondary-button compact" onClick={() => openEdit(selectedFunnel)}>
                        Edit funnel
                      </button>
                    </div>

                    <div className="funnel-summary-grid">
                      <div className="summary-chip compact-chip">
                        <span>Enter sessions</span>
                        <strong>{evaluationData.sessionTotal.toLocaleString()}</strong>
                      </div>
                      <div className="summary-chip compact-chip">
                        <span>Final sessions</span>
                        <strong>{evaluationData.finalTotal.toLocaleString()}</strong>
                      </div>
                      <div className="summary-chip compact-chip">
                        <span>Overall conversion</span>
                        <strong>{evaluationData.overallRate.toFixed(1)}%</strong>
                      </div>
                      <div className="summary-chip compact-chip">
                        <span>Steps</span>
                        <strong>{selectedFunnel.steps.length}</strong>
                      </div>
                    </div>
                  </div>

                  {evaluationLoading ? (
                    <LoadingState message="Evaluating funnel..." />
                  ) : evaluationError ? (
                    <div className="panel-state error-state">
                      <BarChart3 size={18} />
                      <div>
                        <h3>Unable to evaluate funnel</h3>
                        <p>{evaluationError}</p>
                      </div>
                    </div>
                  ) : !hasEvaluation ? (
                    <div className="panel-state empty-state-panel">
                      <CheckCircle2 size={18} />
                      <div>
                        <h3>No funnel activity recorded</h3>
                        <p>This funnel is configured, but no sessions matched its steps during the selected period.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-block">
                      <div className="panel-heading-row">
                        <div>
                          <p className="eyebrow">Evaluation</p>
                          <h3>Step progression</h3>
                        </div>
                      </div>

                      <div className="funnel-visualization">
                        {evaluationData.steps.map((step, index) => {
                          const stepTotal = asNumber(step.sessions ?? step.reachingSessions ?? step.reachedSessions ?? 0);
                          const previousTotal = index > 0 ? asNumber(evaluationData.steps[index - 1].sessions ?? evaluationData.steps[index - 1].reachingSessions ?? evaluationData.steps[index - 1].reachedSessions ?? 0) : stepTotal;
                          const stepRate = previousTotal > 0 ? (stepTotal / previousTotal) * 100 : 0;
                          const dropOff = index > 0 ? Math.max(0, 100 - stepRate) : 0;
                          return (
                            <div key={`${step.key ?? step.name ?? index}`} className="funnel-step-card">
                              <div className="funnel-step-top">
                                <div>
                                  <span className="funnel-step-index">Step {index + 1}</span>
                                  <strong>{step.name || formatEvent(step.eventName)}</strong>
                                </div>
                                <span>{stepTotal.toLocaleString()} sessions</span>
                              </div>
                              <div className="funnel-step-track">
                                <i style={{ width: `${Math.min(100, stepRate || (evaluationData.sessionTotal > 0 ? (stepTotal / Math.max(evaluationData.sessionTotal, 1)) * 100 : 100))}%` }} />
                              </div>
                              <div className="funnel-step-meta">
                                <span>{step.eventName ? formatEvent(step.eventName) : 'Step event'}</span>
                                <span>{stepRate > 0 ? `${stepRate.toFixed(1)}% of previous step` : 'No prior step'}</span>
                              </div>
                              {index > 0 && (
                                <div className="funnel-dropoff">Drop-off: {dropOff.toFixed(1)}%</div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="table-wrap telescope-table">
                        <table className="data-table compact-table">
                          <thead>
                            <tr>
                              <th>Step</th>
                              <th>Event</th>
                              <th>Sessions</th>
                              <th>Progression</th>
                              <th>Drop-off</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evaluationData.steps.map((step, index) => {
                              const stepTotal = asNumber(step.sessions ?? step.reachingSessions ?? step.reachedSessions ?? 0);
                              const previousTotal = index > 0 ? asNumber(evaluationData.steps[index - 1].sessions ?? evaluationData.steps[index - 1].reachingSessions ?? evaluationData.steps[index - 1].reachedSessions ?? 0) : asNumber(evaluationData.sessionTotal);
                              const progression = previousTotal > 0 ? (stepTotal / previousTotal) * 100 : 0;
                              const dropOff = index > 0 ? Math.max(0, 100 - progression) : 0;
                              return (
                                <tr key={`${step.key ?? step.name ?? index}`}>
                                  <td>{step.name || `Step ${index + 1}`}</td>
                                  <td>{formatEvent(step.eventName)}</td>
                                  <td>{stepTotal.toLocaleString()}</td>
                                  <td>{progression > 0 ? `${progression.toFixed(1)}%` : '—'}</td>
                                  <td>{index > 0 ? `${dropOff.toFixed(1)}%` : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {editorOpen && (
          <div className="modal-backdrop" onClick={closeEditor}>
            <div className="modal funnel-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <button type="button" className="icon-button modal-close" onClick={closeEditor} aria-label="Close funnel editor">
                <X size={16} />
              </button>
              <p className="eyebrow">{editingKey ? 'Edit funnel' : 'Create funnel'}</p>
              <h2>{editingKey ? 'Update funnel' : 'Create new funnel'}</h2>

              {validationErrors.form && <div className="form-error">{validationErrors.form}</div>}

              <div className="editor-form-grid">
                <label>
                  Funnel name
                  <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Lead Generation Journey" />
                  {validationErrors.name && <span className="field-error">{validationErrors.name}</span>}
                </label>

                <label>
                  Funnel key
                  <input value={draft.key} onChange={(event) => updateDraft({ key: event.target.value })} placeholder="lead-generation" />
                  {validationErrors.key && <span className="field-error">{validationErrors.key}</span>}
                </label>
              </div>

              <div className="switch-row">
                <span>Active</span>
                <input type="checkbox" checked={draft.active} onChange={(event) => updateDraft({ active: event.target.checked })} />
              </div>

              <div className="steps-editor">
                <div className="steps-header">
                  <h3>Steps</h3>
                  <button type="button" className="secondary-button compact" onClick={addStep} disabled={draft.steps.length >= 5}>
                    Add step
                  </button>
                </div>
                {validationErrors.steps && <div className="field-error">{validationErrors.steps}</div>}

                {draft.steps.map((step, index) => (
                  <div key={step.key || `step-${index}`} className="step-editor-card">
                    <div className="step-editor-header">
                      <strong>Step {index + 1}</strong>
                      <div className="step-controls">
                        <button type="button" className="icon-button small" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label="Move step up">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" className="icon-button small" onClick={() => moveStep(index, 1)} disabled={index === draft.steps.length - 1} aria-label="Move step down">
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" className="icon-button small danger" onClick={() => removeStep(index)} disabled={draft.steps.length <= 2} aria-label="Remove step">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="editor-form-grid">
                      <label>
                        Step name
                        <input value={step.name} onChange={(event) => updateStep(index, 'name', event.target.value)} placeholder="Landing page" />
                        {validationErrors[`step-name-${index}`] && <span className="field-error">{validationErrors[`step-name-${index}`]}</span>}
                      </label>

                      <label>
                        Step key
                        <input value={step.key} onChange={(event) => updateStep(index, 'key', event.target.value)} placeholder="landing" />
                        {validationErrors[`step-key-${index}`] && <span className="field-error">{validationErrors[`step-key-${index}`]}</span>}
                      </label>
                    </div>

                    <label>
                      Event name
                      <select value={step.eventName} onChange={(event) => updateStep(index, 'eventName', event.target.value)}>
                        {supportedEvents.map((eventName) => (
                          <option key={eventName} value={eventName}>{formatEvent(eventName)}</option>
                        ))}
                      </select>
                      {validationErrors[`step-event-${index}`] && <span className="field-error">{validationErrors[`step-event-${index}`]}</span>}
                    </label>

                    <div className="editor-form-grid">
                      <label>
                        Exact page path
                        <input value={step.pagePath ?? ''} onChange={(event) => updateStep(index, 'pagePath', event.target.value)} placeholder="/contact" />
                      </label>

                      <label>
                        Page path prefix
                        <input value={step.pagePathPrefix ?? ''} onChange={(event) => updateStep(index, 'pagePathPrefix', event.target.value)} placeholder="/services/" />
                      </label>
                    </div>
                    {validationErrors[`step-page-${index}`] && <span className="field-error">{validationErrors[`step-page-${index}`]}</span>}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeEditor}>Cancel</button>
                <button type="button" className="primary-button" onClick={() => void saveFunnel()} disabled={saveBusy}>
                  {saveBusy ? 'Saving...' : editingKey ? 'Save changes' : 'Create funnel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AuthGuard>
  );
}
