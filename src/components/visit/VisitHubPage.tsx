/**
 * VisitHubPage
 *
 * The "Visit Hub" — the entry point when opening an existing visit.
 *
 * Sections:
 *   1. Summary header  — address, customer, status badge, last updated
 *   2. Primary action  — Resume (routes to last active step)
 *   3. Secondary actions — Edit survey, View recommendation (conditional)
 *   4. Reports list    — reports linked to this visit, newest first
 *
 * The primary action button routes to:
 *   • the survey stepper when the survey is not yet complete
 *   • the saved report/recommendation when the survey is complete
 */

import { useEffect, useRef, useState } from 'react';
import { getVisit, saveVisit, visitStatusLabel, visitDisplayLabel, isSurveyComplete, type VisitMeta } from '../../lib/visits/visitApi';
import { listReportsForVisit, saveReport } from '../../lib/reports/reportApi';
import { generatePortalToken } from '../../lib/portal/portalToken';
import { buildPortalUrl } from '../../lib/portal/portalUrl';
import { runEngine } from '../../engine/Engine';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import VisitReportsList from './VisitReportsList';
import './VisitHubPage.css';

interface Props {
  visitId: string;
  onBack: () => void;
  /** Route to the full survey stepper (resume / edit). */
  onResumeSurvey: () => void;
  /** Open the in-room presentation for this visit. */
  onOpenPresentation: () => void;
  /** Print the customer summary for this visit. */
  onPrintSummary?: () => void;
  /** Open a specific report by ID. */
  onOpenReport: (reportId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function addressDisplay(meta: VisitMeta): string {
  return visitDisplayLabel(meta);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HubHeader({ meta, onBack, onReferenceChange }: { meta: VisitMeta; onBack: () => void; onReferenceChange: (ref: string) => void }) {
  const label = visitStatusLabel(meta.status);
  const statusKey = meta.status.toLowerCase().replace(/[^a-z_]/g, '_');
  const [editing, setEditing] = useState(false);
  const [draftRef, setDraftRef] = useState(meta.visit_reference ?? '');
  const shortId = meta.id.slice(-8).toUpperCase();

  function handleSave() {
    setEditing(false);
    onReferenceChange(draftRef.trim());
  }  return (
    <div className="visit-hub__header">
      <button
        className="visit-hub__back-btn"
        onClick={onBack}
        aria-label="Back to visit list"
      >
        ←
      </button>
      <div className="visit-hub__header-body">
        {editing ? (
          <div className="visit-hub__ref-edit">
            <label className="visit-hub__ref-label" htmlFor="visit-hub-ref-input">
              Lead reference
            </label>
            <input
              id="visit-hub-ref-input"
              className="visit-hub__ref-input"
              type="text"
              value={draftRef}
              onChange={(e) => setDraftRef(e.target.value)}
              placeholder="e.g. Lead 12345, Job 678"
              aria-label="Lead reference"
              aria-describedby="visit-hub-ref-hint"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                else if (e.key === 'Escape') setEditing(false);
              }}
            />
            <span id="visit-hub-ref-hint" className="visit-hub__ref-hint">
              Add your own lead, job, or customer reference
            </span>
            <button className="visit-hub__ref-save-btn" onClick={handleSave}>Save</button>
            <button className="visit-hub__ref-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <h1 className="visit-hub__address">
            {addressDisplay(meta)}
            <button
              className="visit-hub__ref-edit-btn"
              onClick={() => { setDraftRef(meta.visit_reference ?? ''); setEditing(true); }}
              aria-label={meta.visit_reference ? 'Edit lead reference' : 'Add lead reference'}
              title={meta.visit_reference ? 'Edit lead reference' : 'Add lead reference'}
            >
              {meta.visit_reference ? ' ✏ Edit ref' : ' + Add ref'}
            </button>
          </h1>
        )}
        {meta.visit_reference && (
          <p className="visit-hub__visit-id" aria-label={`Internal visit ID: ${shortId}`}>
            Visit ···{shortId}
          </p>
        )}
        {meta.customer_name && (
          <p className="visit-hub__customer">{meta.customer_name}</p>
        )}
        <div className="visit-hub__meta-row">
          <span
            className={`visit-hub__status-badge visit-hub__status-badge--${statusKey}`}
            aria-label={`Status: ${label}`}
          >
            {label}
          </span>
          <span className="visit-hub__updated">
            Updated {formatRelativeDate(meta.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function HubActions({
  meta,
  onResumeSurvey,
  onOpenPresentation,
  onPrintSummary,
  portalUrl,
  portalLoading,
}: {
  meta: VisitMeta;
  onResumeSurvey: () => void;
  onOpenPresentation: () => void;
  onPrintSummary?: () => void;
  portalUrl?: string;
  portalLoading?: boolean;
}) {
  const surveyDone = isSurveyComplete(meta);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  function handleSendPortal() {
    if (!portalUrl) return;
    // Copy the portal link to clipboard and open it in a new tab concurrently —
    // both actions fire immediately so the advisor can share the link while
    // also previewing what the customer will see.
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }).catch(() => {
      // Clipboard API unavailable — surface the URL so the user can copy manually.
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 3000);
    });
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="visit-hub__actions">
      <button
        className="visit-hub__action-btn visit-hub__action-btn--primary"
        onClick={surveyDone ? onOpenPresentation : onResumeSurvey}
        aria-label={surveyDone ? 'Start in-room presentation' : 'Resume survey'}
      >
        {surveyDone ? '▶ Start in-room presentation' : '▶ Resume survey'}
      </button>

      {surveyDone && (
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={onResumeSurvey}
          aria-label="Edit survey inputs"
        >
          ✏ Edit survey
        </button>
      )}

      {surveyDone && onPrintSummary && (
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={onPrintSummary}
          aria-label="Print summary"
        >
          🖨 Print summary
        </button>
      )}

      {surveyDone && (
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={handleSendPortal}
          aria-label="Send customer portal link"
          data-testid="send-portal-btn"
          disabled={!portalUrl || portalLoading}
          aria-disabled={!portalUrl || portalLoading}
        >
          {portalLoading
            ? '⏳ Preparing portal…'
            : copyState === 'copied'
              ? '✅ Link copied!'
              : copyState === 'failed'
                ? '⚠ Copy failed — check URL'
                : '📤 Send customer portal'}
        </button>
      )}

      {!surveyDone && (
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={onResumeSurvey}
          aria-label="Continue survey"
          disabled
          aria-disabled="true"
        >
          📊 Presentation — complete survey first
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VisitHubPage({
  visitId,
  onBack,
  onResumeSurvey,
  onOpenPresentation,
  onPrintSummary,
  onOpenReport,
}: Props) {
  const [meta, setMeta] = useState<VisitMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | undefined>();
  const [portalLoading, setPortalLoading] = useState(false);
  // Keep the working_payload so we can create a report (for portal) if none exists yet.
  const workingPayloadRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        const { working_payload, ...metaFields } = visit;
        setMeta(metaFields);
        workingPayloadRef.current = working_payload;
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  // Generate a signed portal URL from the latest report for this visit.
  // If no report exists yet and the survey is complete, create one first so
  // the portal is always available after survey completion.
  useEffect(() => {
    if (loading) return; // Wait until the visit is loaded.
    if (!meta || !isSurveyComplete(meta)) return; // Portal only for complete surveys.

    let cancelled = false;
    setPortalLoading(true);

    listReportsForVisit(visitId)
      .then(async (reports) => {
        if (cancelled) return;

        let reportId: string;
        if (reports.length > 0) {
          reportId = reports[0].id;
        } else {
          // No report yet — create one from the working payload so the portal link
          // is available without requiring the user to go through the printout flow.
          const payload = workingPayloadRef.current;
          if (!payload || Object.keys(payload).length === 0) return;
          // The working_payload is persisted as FullSurveyModelV1 by VisitPage — the same
          // two-step cast (unknown → FullSurveyModelV1) used in App.tsx is the correct pattern
          // here since VisitDetail.working_payload is typed as Record<string, unknown>.
          const survey = payload as unknown as FullSurveyModelV1;
          const engineInput = toEngineInput(sanitiseModelForEngine(survey));
          const { engineOutput } = runEngine(engineInput);
          const saved = await saveReport({
            postcode: engineInput.postcode ?? null,
            visit_id: visitId,
            status: 'complete',
            payload: { surveyData: survey, engineInput, engineOutput, decisionSynthesis: null },
          });
          if (cancelled) return;
          reportId = saved.id;
        }

        const token = await generatePortalToken(reportId);
        if (!cancelled) {
          setPortalUrl(buildPortalUrl(reportId, window.location.origin, token));
        }
      })
      .catch((err) => { console.warn('[Atlas] Could not generate portal URL for visit hub:', err); })
      .finally(() => { if (!cancelled) setPortalLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [visitId, meta, loading]);

  function handleReferenceChange(newRef: string) {
    if (!meta) return;
    const trimmed = newRef.trim() || null;
    setMeta({ ...meta, visit_reference: trimmed });
    saveVisit(visitId, { visit_reference: trimmed ?? '' }).catch(() => {/* best effort */});
  }

  if (loading) {
    return (
      <div className="visit-hub__loading" role="status" aria-live="polite">
        Loading visit…
      </div>
    );
  }

  if (error || meta === null) {
    return (
      <div className="visit-hub__error" role="alert">
        <p>Could not load visit{error ? `: ${error}` : '.'}</p>
        <button className="cta-btn" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="visit-hub">
      <HubHeader meta={meta} onBack={onBack} onReferenceChange={handleReferenceChange} />

      <div className="visit-hub__body">
        <HubActions
          meta={meta}
          onResumeSurvey={onResumeSurvey}
          onOpenPresentation={onOpenPresentation}
          onPrintSummary={onPrintSummary}
          portalUrl={portalUrl}
          portalLoading={portalLoading}
        />

        <VisitReportsList visitId={visitId} onOpenReport={onOpenReport} />
      </div>
    </div>
  );
}
