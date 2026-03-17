/**
 * VisitPage
 *
 * Top-level visit shell.  Shown after "Start new visit" or when a user opens
 * an existing visit.
 *
 * Responsibilities:
 * - Load the visit record from the API (when an existing visitId is provided)
 * - Initialise FullSurveyStepper with any previously saved working payload
 * - Autosave the working payload back to the visit whenever the survey step changes
 * - Route to the Simulator / ExplainersHub on survey completion
 * - Show a compact save-state indicator in the visit header
 * - Render a case summary header (visit ID, status, customer, postcode, report count)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import FullSurveyStepper from '../stepper/FullSurveyStepper';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { getVisit, saveVisit, type VisitMeta } from '../../lib/visits/visitApi';
import VisitReportsList from './VisitReportsList';
import './VisitPage.css';

/** Save state for the autosave indicator. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

interface Props {
  visitId: string;
  onBack: () => void;
  onComplete: (engineInput: EngineInputV2_3) => void;
  onOpenFloorPlan: (surveyResults: Partial<FullSurveyModelV1>) => void;
  onOpenReport: (reportId: string) => void;
  floorplanOutput?: DerivedFloorplanOutput;
}

/** Debounce delay for autosave (ms). */
const AUTOSAVE_DELAY_MS = 1500;

/** How long to keep the "Saved just now" status visible (ms). */
const SAVED_RESET_DELAY_MS = 4000;

// ─── Save-state indicator ────────────────────────────────────────────────────

function SaveStateIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const label =
    state === 'saving' ? '⏳ Saving…'
    : state === 'saved'  ? '✓ Saved just now'
    : '⚠ Save failed';
  return (
    <div
      className={`visit-save-indicator visit-save-indicator--${state}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {label}
    </div>
  );
}

// ─── Visit case summary header ────────────────────────────────────────────────

interface CaseSummaryProps {
  visitId: string;
  meta: VisitMeta | null;
  saveState: SaveState;
  onBack: () => void;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Renders the compact case-shell header shown at the top of every visit. */
function VisitCaseSummary({ visitId, meta, saveState, onBack }: CaseSummaryProps) {
  const shortId = visitId.slice(-8).toUpperCase();

  return (
    <div className="visit-page__header" aria-label="Visit case summary">
      <button
        className="visit-page__back-btn"
        onClick={onBack}
        aria-label="Back to dashboard"
      >
        ←
      </button>

      <div className="visit-case-summary">
        <span
          className="visit-case-summary__id"
          title={`Visit ID: ${visitId}`}
          aria-label={`Visit ID ending ${shortId}`}
        >
          Visit ···{shortId}
        </span>

        {meta && (
          <>
            {(meta.customer_name || meta.postcode) && (
              <span className="visit-case-summary__customer">
                {[meta.customer_name, meta.postcode].filter(Boolean).join(' · ')}
              </span>
            )}

            <span
              className={`visit-case-summary__status visit-case-summary__status--${meta.status}`}
              aria-label={`Status: ${meta.status}`}
            >
              {meta.status}
            </span>

            <span className="visit-case-summary__date" title="Created">
              {formatShortDate(meta.created_at)}
            </span>
          </>
        )}
      </div>

      <SaveStateIndicator state={saveState} />
    </div>
  );
}

export default function VisitPage({
  visitId,
  onBack,
  onComplete,
  onOpenFloorPlan,
  onOpenReport,
}: Props) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Partial<FullSurveyModelV1> | undefined>();
  const [visitMeta, setVisitMeta] = useState<VisitMeta | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing working payload and visit metadata from the API on mount.
  useEffect(() => {
    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        // Save metadata for the case summary header.
        const { working_payload, ...meta } = visit;
        setVisitMeta(meta);
        // Restore survey state from persisted working payload.
        if (working_payload && Object.keys(working_payload).length > 0) {
          setPrefill(working_payload as Partial<FullSurveyModelV1>);
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  /**
   * Debounced autosave — called when the survey completes.
   * Shows save-state feedback to the user.
   */
  const handleComplete = useCallback(
    (engineInput: EngineInputV2_3) => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      if (savedResetTimer.current !== null) clearTimeout(savedResetTimer.current);

      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        saveVisit(visitId, {
          working_payload: engineInput as unknown as Record<string, unknown>,
          current_step: 'complete',
        })
          .then(() => {
            setSaveState('saved');
            setVisitMeta(prev =>
              prev ? { ...prev, status: 'complete', current_step: 'complete' } : prev
            );
            savedResetTimer.current = setTimeout(() => {
              setSaveState('idle');
            }, SAVED_RESET_DELAY_MS);
          })
          .catch(() => {
            setSaveState('failed');
          });
      }, AUTOSAVE_DELAY_MS);
      onComplete(engineInput);
    },
    [visitId, onComplete]
  );

  if (!ready) {
    return (
      <div className="visit-page__loading" role="status" aria-live="polite">
        Loading visit…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="visit-page__error" role="alert">
        <p>Could not load visit: {loadError}</p>
        <button className="cta-btn" onClick={onBack}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="visit-page">
      <VisitCaseSummary
        visitId={visitId}
        meta={visitMeta}
        saveState={saveState}
        onBack={onBack}
      />
      <FullSurveyStepper
        onBack={onBack}
        prefill={prefill}
        onComplete={handleComplete}
        onOpenFloorPlan={onOpenFloorPlan}
      />
      <VisitReportsList visitId={visitId} onOpenReport={onOpenReport} />
    </div>
  );
}
