/**
 * ReportPage
 *
 * Renders a saved Atlas report from persisted payload.
 * Fetches the report by ID from GET /api/reports/:id and passes the stored
 * engine output + survey data to DecisionSynthesisPage.
 *
 * This is the target of share links and QR codes (e.g. /report/:id).
 * It renders the recommendation from the persisted snapshot, not live state.
 *
 * Lifecycle actions available:
 *   - Mark complete — advances status from draft → complete
 *   - Archive       — moves status to archived
 *   - Duplicate     — creates a new draft copy of this report
 */

import { useCallback, useEffect, useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import {
  getReport,
  updateReport,
  duplicateReport,
  type ReportMeta,
} from '../../lib/reports/reportApi';
import DecisionSynthesisPage from '../advice/DecisionSynthesisPage';
import { buildCompareSeedFromSurvey } from '../../lib/simulator/buildCompareSeedFromSurvey';
import './ReportPage.css';

interface Props {
  reportId: string;
  onBack?: () => void;
  /** Called with the new report ID after a successful duplicate. */
  onDuplicated?: (newReportId: string) => void;
}

// ─── Lifecycle actions panel ──────────────────────────────────────────────────

interface LifecyclePanelProps {
  meta: ReportMeta;
  onStatusChange: (newStatus: string) => void;
  onDuplicate: () => void;
}

function ReportLifecyclePanel({ meta, onStatusChange, onDuplicate }: LifecyclePanelProps) {
  const [actionState, setActionState] = useState<'idle' | 'working' | 'error'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    setActionState('working');
    setActionError(null);
    try {
      await updateReport(meta.id, { status: newStatus });
      onStatusChange(newStatus);
      setActionState('idle');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setActionState('error');
    }
  }

  async function handleDuplicate() {
    setActionState('working');
    setActionError(null);
    try {
      await onDuplicate();
      setActionState('idle');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setActionState('error');
    }
  }

  const isBusy = actionState === 'working';

  return (
    <div className="report-lifecycle-panel" aria-label="Report lifecycle actions">
      <div className="report-lifecycle-panel__actions">
        {meta.status === 'draft' && (
          <button
            className="report-lifecycle-panel__btn report-lifecycle-panel__btn--complete"
            onClick={() => handleStatusChange('complete')}
            disabled={isBusy}
            aria-label="Mark report as complete"
          >
            ✓ Mark complete
          </button>
        )}
        {meta.status === 'complete' && (
          <button
            className="report-lifecycle-panel__btn report-lifecycle-panel__btn--archive"
            onClick={() => handleStatusChange('archived')}
            disabled={isBusy}
            aria-label="Archive this report"
          >
            Archive
          </button>
        )}
        <button
          className="report-lifecycle-panel__btn report-lifecycle-panel__btn--duplicate"
          onClick={handleDuplicate}
          disabled={isBusy}
          aria-label="Duplicate this report as a new draft"
        >
          Duplicate
        </button>
      </div>
      {isBusy && (
        <span className="report-lifecycle-panel__status" role="status" aria-live="polite">
          Working…
        </span>
      )}
      {actionState === 'error' && actionError && (
        <span className="report-lifecycle-panel__error" role="alert">
          {actionError}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportPage({ reportId, onBack, onDuplicated }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReport(reportId)
      .then((report) => {
        if (cancelled) return;
        const { payload, ...reportMeta } = report;

        // Guard: engineOutput must be present for the report to be renderable.
        if (!payload?.engineOutput) {
          throw new Error(
            'This report snapshot is incomplete: the engine output is missing. ' +
            'The report may have been saved from an older version of the tool.',
          );
        }

        setMeta(reportMeta);
        setEngineOutput(payload.engineOutput);
        setSurveyData(payload.surveyData ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const handleDuplicate = useCallback(async () => {
    const result = await duplicateReport(reportId);
    if (onDuplicated) {
      onDuplicated(result.id);
    }
  }, [reportId, onDuplicated]);

  if (loading) {
    return (
      <div className="report-page__loading" role="status" aria-live="polite">
        Loading report…
      </div>
    );
  }

  if (error || engineOutput == null) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return (
      <div className="report-page__error" role="alert">
        <p className="report-page__error-headline">
          {isNotFound ? 'Report not found' : 'Report could not be loaded'}
        </p>
        <p className="report-page__error-detail">
          {error ?? 'The report payload is missing or incomplete.'}
        </p>
        {isNotFound && (
          <p className="report-page__error-hint">
            This may happen if the report ID is incorrect or if the report has been deleted.
          </p>
        )}
        {onBack && (
          <button className="cta-btn" onClick={onBack}>
            ← Back to home
          </button>
        )}
      </div>
    );
  }

  // Build compare seed from saved survey + engine output if available.
  const compareSeed =
    surveyData != null
      ? buildCompareSeedFromSurvey(surveyData, engineOutput)
      : undefined;

  return (
    <div className="report-page">
      {/* Shared report banner */}
      <div className="report-page__banner" aria-label="Shared report" data-print-hide>
        <span className="report-page__banner-label">
          📋 Heating system report
        </span>
        {meta?.postcode && (
          <span className="report-page__banner-postcode">{meta.postcode}</span>
        )}
        {meta?.created_at && (
          <span className="report-page__banner-date">
            {new Date(meta.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
        {onBack && (
          <button
            className="report-page__home-btn"
            onClick={onBack}
            aria-label="Back to home"
          >
            ← Home
          </button>
        )}
      </div>

      {/* Report metadata strip */}
      {meta && (
        <dl className="report-page__meta-strip" aria-label="Report details">
          <div className="report-page__meta-item">
            <dt>Report ID</dt>
            <dd className="report-page__meta-id">{meta.id}</dd>
          </div>
          <div className="report-page__meta-item">
            <dt>Generated</dt>
            <dd>
              {new Date(meta.created_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </dd>
          </div>
          {meta.visit_id && (
            <div className="report-page__meta-item">
              <dt>Visit</dt>
              <dd className="report-page__meta-id">{meta.visit_id}</dd>
            </div>
          )}
          <div className="report-page__meta-item">
            <dt>Status</dt>
            <dd>
              <span
                className={`report-page__status-badge report-page__status-badge--${meta.status}`}
              >
                {meta.status}
              </span>
            </dd>
          </div>
        </dl>
      )}

      {/* Lifecycle actions (hidden on print) */}
      {meta && (
        <div data-print-hide>
          <ReportLifecyclePanel
            meta={meta}
            onStatusChange={(newStatus) =>
              setMeta((prev) => (prev ? { ...prev, status: newStatus } : prev))
            }
            onDuplicate={handleDuplicate}
          />
        </div>
      )}

      <DecisionSynthesisPage
        engineOutput={engineOutput}
        surveyData={surveyData ?? undefined}
        compareSeed={compareSeed}
        reportReference={reportId}
      />
    </div>
  );
}
