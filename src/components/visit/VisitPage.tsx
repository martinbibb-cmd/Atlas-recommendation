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
 *
 * Note: VisitReportsList (internal diagnostic output) is intentionally NOT rendered
 * here.  Reports are internal QA artefacts only and must not appear in the
 * customer-facing survey path.  See VisitHubPage for the internal-diagnostics section.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import FullSurveyStepper from '../stepper/FullSurveyStepper';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import type { QuoteInput } from '../../features/insightPack/insightPack.types';
import { getVisit, saveVisit, visitStatusLabel, visitDisplayLabel, isVisitCompleted, type VisitMeta } from '../../lib/visits/visitApi';
import './VisitPage.css';

/**
 * Save state for the autosave indicator.
 *
 * State machine:
 *   idle → saving → saved (auto-resets to idle)
 *                 → failed → retrying → saved / failed
 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'retrying';

export interface Props {
  visitId: string;
  onBack: () => void;
  onComplete: (engineInput: EngineInputV2_3) => void;
  /**
   * When provided, "Try in Simulator →" on the InsightLayerPage navigates
   * directly to the simulator surface instead of routing through onComplete
   * (which may pass through the fit-map).  Receives the cleaned EngineInputV2_3
   * built from the current survey state.
   */
  onOpenSimulator?: (engineInput: EngineInputV2_3) => void;
  /**
   * When provided, called after the Quotes step completes with the collected
   * quotes so the parent can open the Atlas Insight Pack presentation.
   */
  onOpenInsightPack?: (engineInput: EngineInputV2_3, quotes: QuoteInput[]) => void;
  /**
   * Optional callback invoked on every step transition with the full survey
   * draft (including fullSurvey.priorities and fullSurvey.heatLoss).
   * Parent components can use this to capture priorities and heat-loss state
   * for the presentation layer without needing to re-run the engine.
   */
  onDraft?: (draft: FullSurveyModelV1) => void;
  onOpenFloorPlan: (surveyResults: Partial<FullSurveyModelV1>) => void;
  floorplanOutput?: DerivedFloorplanOutput;
  /**
   * When provided, the completed-visit locked panel shows a "Review handoff"
   * button that navigates to the VisitHandoffReviewPage.
   */
  onOpenHandoffReview?: () => void;
  /**
   * When provided, called when the surveyor clicks "Open specification" on the
   * Installation Specification step.
   */
  onOpenInstallationSpecification?: () => void;
  /**
   * When provided, the completed-visit locked panel shows a "Reopen visit"
   * button that clears the completion and allows resuming the survey.
   */
  onReopenVisit?: () => void;
}

/** Debounce delay for autosave (ms). */
const AUTOSAVE_DELAY_MS = 1500;

/** How long to keep the "Saved just now" status visible (ms). */
const SAVED_RESET_DELAY_MS = 4000;

// ─── Save-state indicator ────────────────────────────────────────────────────

interface SaveStateIndicatorProps {
  state: SaveState;
  onRetry: () => void;
}

function SaveStateIndicator({ state, onRetry }: SaveStateIndicatorProps) {
  if (state === 'idle') return null;

  const isBusy = state === 'saving' || state === 'retrying';
  const label =
    state === 'saving'   ? '⏳ Saving…'
    : state === 'retrying' ? '⏳ Retrying…'
    : state === 'saved'    ? '✓ Saved just now'
    : '⚠ Save failed';

  return (
    <div
      className={`visit-save-indicator visit-save-indicator--${state}`}
      role="status"
      aria-live="polite"
    >
      <span aria-label={label}>{label}</span>
      {state === 'failed' && (
        <button
          className="visit-save-indicator__retry-btn"
          onClick={onRetry}
          disabled={isBusy}
          aria-label="Retry save"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Visit case summary header ────────────────────────────────────────────────

interface CaseSummaryProps {
  visitId: string;
  meta: VisitMeta | null;
  saveState: SaveState;
  onBack: () => void;
  onRetrySave: () => void;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Renders the compact case-shell header shown at the top of every visit. */
function VisitCaseSummary({ visitId, meta, saveState, onBack, onRetrySave }: CaseSummaryProps) {
  const shortId = visitId.slice(-8).toUpperCase();
  const displayLabel = meta ? visitDisplayLabel(meta) : `Visit ···${shortId}`;
  const showIdBelow = meta?.visit_reference != null;

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
          aria-label={showIdBelow ? displayLabel : `Visit ID ending ${shortId}`}
        >
          {displayLabel}
        </span>

        {showIdBelow && (
          <span
            className="visit-case-summary__visit-ref"
            title={`Visit ID: ${visitId}`}
            aria-label={`Visit ID ending ${shortId}`}
          >
            Visit ···{shortId}
          </span>
        )}

        {meta && (
          <>
            {(meta.customer_name || meta.postcode) && (
              <span className="visit-case-summary__customer">
                {[meta.customer_name, meta.postcode].filter(Boolean).join(' · ')}
              </span>
            )}

            <span
              className={`visit-case-summary__status visit-case-summary__status--${meta.status}`}
              aria-label={`Status: ${visitStatusLabel(meta.status)}`}
            >
              {visitStatusLabel(meta.status)}
            </span>

            <span className="visit-case-summary__date" title="Created">
              {formatShortDate(meta.created_at)}
            </span>
          </>
        )}
      </div>

      <SaveStateIndicator state={saveState} onRetry={onRetrySave} />
    </div>
  );
}

export default function VisitPage({
  visitId,
  onBack,
  onComplete,
  onOpenSimulator,
  onOpenInsightPack,
  onDraft,
  onOpenFloorPlan,
  onOpenHandoffReview,
  onOpenInstallationSpecification,
  onReopenVisit,
}: Props) {
  // Derive initial error/ready state from visitId at mount — avoids calling
  // setState synchronously inside an effect (which triggers the
  // react-hooks/set-state-in-effect lint rule).
  const hasInvalidId = !visitId || visitId.trim().length === 0;
  const [loadError, setLoadError] = useState<string | null>(
    hasInvalidId ? 'No visit ID was provided. Please go back and try again.' : null
  );
  const [prefill, setPrefill] = useState<Partial<FullSurveyModelV1> | undefined>();
  const [visitMeta, setVisitMeta] = useState<VisitMeta | null>(null);
  const [ready, setReady] = useState(hasInvalidId);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Canonical payload ref — always holds the most recent raw FullSurveyModelV1
   * draft so that retry can re-submit the latest in-memory state even if a
   * closure captured an earlier value.
   */
  const lastDraftRef = useRef<FullSurveyModelV1 | null>(null);
  /**
   * Whether we are saving at survey completion (marks status as
   * recommendation_ready) vs a mid-survey draft save.
   */
  const isCompleteRef = useRef(false);

  // Load existing working payload and visit metadata from the API on mount.
  useEffect(() => {
    // Skip API call when visitId is absent or empty — initial state already
    // reflects this case via the lazy useState initialisers above.
    if (!visitId || visitId.trim().length === 0) return;

    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        console.info('[Atlas] Visit loaded:', visitId);
        // Save metadata for the case summary header.
        const { working_payload, ...meta } = visit;
        setVisitMeta(meta);
        // Restore survey state from persisted working payload.
        // working_payload is stored as FullSurveyModelV1 (including fullSurvey)
        // so all Step 5 dhwCondition fields are preserved.
        if (working_payload && Object.keys(working_payload).length > 0) {
          setPrefill(working_payload as Partial<FullSurveyModelV1>);
        }
        setReady(true);
        // Mark survey as started (unless it is already complete / further progressed).
        const s = meta.status.toLowerCase();
        if (s === 'new' || s === 'draft') {
          saveVisit(visitId, { status: 'survey_started' }).catch(() => {/* best effort */});
          setVisitMeta(prev => prev ? { ...prev, status: 'survey_started' } : prev);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Atlas] Could not load visit:', { visitId, message });
        setLoadError(message);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  /** Shared persist function — always reads from lastDraftRef so retries use the latest value. */
  const persist = useCallback(
    (isComplete: boolean) => {
      const draft = lastDraftRef.current;
      if (!draft) {
        // No draft available — bail and surface a failure so the indicator
        // doesn't get stuck in 'saving' or 'retrying'.
        setSaveState('failed');
        return;
      }
      // Save raw FullSurveyModelV1 (including fullSurvey.dhwCondition) so that
      // all Step 5 fields survive reload.
      saveVisit(visitId, {
        working_payload: draft as unknown as Record<string, unknown>,
        ...(isComplete
          ? { current_step: 'complete', status: 'recommendation_ready' }
          : {}),
      })
        .then(() => {
          setSaveState('saved');
          if (isComplete) {
            setVisitMeta(prev =>
              prev ? { ...prev, status: 'recommendation_ready', current_step: 'complete' } : prev
            );
          }
          savedResetTimer.current = setTimeout(() => {
            setSaveState('idle');
          }, SAVED_RESET_DELAY_MS);
        })
        .catch(() => {
          setSaveState('failed');
        });
    },
    [visitId]
  );

  /**
   * Retry handler — re-submits the latest canonical draft with real API call.
   * Uses a ref for the busy-guard so the guard reads fresh state even when the
   * callback reference hasn't changed.
   */
  const saveStateRef = useRef<SaveState>('idle');
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  const handleRetrySave = useCallback(() => {
    if (saveStateRef.current === 'saving' || saveStateRef.current === 'retrying') return;
    setSaveState('retrying');
    persist(isCompleteRef.current);
  }, [persist]);

  /**
   * onDraft — called by FullSurveyStepper on every step transition.
   * Debounce-saves the raw FullSurveyModelV1 including fullSurvey extras.
   * Also calls the optional external onDraft so parent components can capture
   * fullSurvey.priorities / fullSurvey.heatLoss for the presentation layer.
   */
  const handleDraft = useCallback(
    (draft: FullSurveyModelV1) => {
      lastDraftRef.current = draft;
      isCompleteRef.current = false;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      if (savedResetTimer.current !== null) clearTimeout(savedResetTimer.current);

      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        persist(false);
      }, AUTOSAVE_DELAY_MS);

      // Propagate to parent so it can capture priorities/heatLoss for the
      // canonical presentation deck (occupied timing, objectives chips, etc.).
      if (onDraft) onDraft(draft);
    },
    [persist, onDraft]
  );

  /**
   * onComplete — called by FullSurveyStepper when the survey finishes.
   * Saves the raw model (for future reload) and passes the engine input
   * to the parent for routing to the simulator.
   */
  const handleComplete = useCallback(
    (engineInput: EngineInputV2_3) => {
      // lastDraftRef.current was set by handleDraft in the same next() call.
      isCompleteRef.current = true;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      if (savedResetTimer.current !== null) clearTimeout(savedResetTimer.current);

      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        persist(true);
      }, AUTOSAVE_DELAY_MS);
      onComplete(engineInput);
    },
    [persist, onComplete]
  );

  /**
   * onOpenInsightPack — called by FullSurveyStepper when the Quotes step
   * completes with quotes present.  Mirrors handleComplete: promotes the
   * visit status to recommendation_ready so the Visit Hub shows the correct
   * state (and so the user is not stuck in a survey→insight loop on return).
   *
   * persist(true) is called immediately (no debounce) so the visit status is
   * written before navigation hands off to the Insight Pack, avoiding a race
   * condition if the user returns to the Visit Hub quickly.
   */
  const handleOpenInsightPack = useCallback(
    (engineInput: EngineInputV2_3, quotes: QuoteInput[]) => {
      isCompleteRef.current = true;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      if (savedResetTimer.current !== null) clearTimeout(savedResetTimer.current);

      setSaveState('saving');
      persist(true);

      if (onOpenInsightPack) onOpenInsightPack(engineInput, quotes);
    },
    [persist, onOpenInsightPack]
  );

  if (!ready) {
    return (
      <div className="visit-page__loading" role="status" aria-live="polite">
        Loading visit…
      </div>
    );
  }

  if (loadError) {
    const isNotFound = loadError === 'Visit not found' || loadError.startsWith('No visit ID');
    return (
      <div className="visit-page__error" role="alert">
        <p>
          {isNotFound
            ? 'No visit record was found. The visit may not have been saved correctly.'
            : `Could not load visit: ${loadError}`}
        </p>
        <button className="cta-btn" onClick={onBack}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  // Locked state — visit has been formally completed; render read-only panel.
  if (visitMeta && isVisitCompleted(visitMeta)) {
    const completedDate = new Date(visitMeta.completed_at!).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return (
      <div className="visit-page">
        <VisitCaseSummary
          visitId={visitId}
          meta={visitMeta}
          saveState={saveState}
          onBack={onBack}
          onRetrySave={handleRetrySave}
        />
        <div className="visit-page__locked" role="status" aria-label="Visit completed">
          <div className="visit-page__locked-icon" aria-hidden="true">✅</div>
          <h2 className="visit-page__locked-heading">Visit completed</h2>
          <p className="visit-page__locked-date">Completed {completedDate}</p>
          <p className="visit-page__locked-hint">
            Survey capture is closed. This visit has been formally completed.
          </p>
          {onOpenHandoffReview && (
            <button
              className="visit-page__locked-handoff-btn"
              onClick={onOpenHandoffReview}
              data-testid="visit-locked-handoff-btn"
            >
              🤝 Review handoff
            </button>
          )}
          {onReopenVisit && (
            <button
              className="visit-page__locked-reopen-btn"
              onClick={onReopenVisit}
              data-testid="visit-locked-reopen-btn"
            >
              🔓 Reopen visit
            </button>
          )}
          <button
            className="visit-page__locked-back-btn"
            onClick={onBack}
          >
            ← Back to hub
          </button>
        </div>
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
        onRetrySave={handleRetrySave}
      />
      <FullSurveyStepper
        onBack={onBack}
        prefill={prefill}
        onComplete={handleComplete}
        onOpenSimulator={onOpenSimulator ?? handleComplete}
        onOpenInsightPack={onOpenInsightPack ? handleOpenInsightPack : undefined}
        onDraft={handleDraft}
        onOpenFloorPlan={onOpenFloorPlan}
        onOpenInstallationSpecification={onOpenInstallationSpecification}
      />
    </div>
  );
}
