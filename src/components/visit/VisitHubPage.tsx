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

import { useEffect, useState } from 'react';
import { getVisit, saveVisit, visitStatusLabel, visitDisplayLabel, isSurveyComplete, type VisitMeta } from '../../lib/visits/visitApi';
import VisitReportsList from './VisitReportsList';
import './VisitHubPage.css';

interface Props {
  visitId: string;
  onBack: () => void;
  /** Route to the full survey stepper (resume / edit). */
  onResumeSurvey: () => void;
  /** Open the saved report/recommendation for this visit. */
  onViewRecommendation: () => void;
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
        {meta.customer_name && meta.address_line_1 && (
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
  onViewRecommendation,
}: {
  meta: VisitMeta;
  onResumeSurvey: () => void;
  onViewRecommendation: () => void;
}) {
  const surveyDone = isSurveyComplete(meta);

  return (
    <div className="visit-hub__actions">
      <button
        className="visit-hub__action-btn visit-hub__action-btn--primary"
        onClick={surveyDone ? onViewRecommendation : onResumeSurvey}
        aria-label={surveyDone ? 'View recommendation' : 'Resume survey'}
      >
        {surveyDone ? '▶ View recommendation' : '▶ Resume survey'}
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

      {!surveyDone && (
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={onResumeSurvey}
          aria-label="Continue survey"
          disabled
          aria-disabled="true"
        >
          📊 Recommendation — complete survey first
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
  onViewRecommendation,
  onOpenReport,
}: Props) {
  const [meta, setMeta] = useState<VisitMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        // Hub only needs metadata fields — cast away working_payload.
        setMeta(visit as VisitMeta);
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
          onViewRecommendation={onViewRecommendation}
        />

        <VisitReportsList visitId={visitId} onOpenReport={onOpenReport} />
      </div>
    </div>
  );
}
