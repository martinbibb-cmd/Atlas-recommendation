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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import FullSurveyStepper from '../stepper/FullSurveyStepper';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { getVisit, saveVisit } from '../../lib/visits/visitApi';
import './VisitPage.css';

/** Save state for the autosave indicator. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

interface Props {
  visitId: string;
  onBack: () => void;
  onComplete: (engineInput: EngineInputV2_3) => void;
  onOpenFloorPlan: (surveyResults: Partial<FullSurveyModelV1>) => void;
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

export default function VisitPage({
  visitId,
  onBack,
  onComplete,
  onOpenFloorPlan,
}: Props) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Partial<FullSurveyModelV1> | undefined>();
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing working payload from the visit record on mount.
  useEffect(() => {
    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        const payload = visit.working_payload;
        if (payload && Object.keys(payload).length > 0) {
          setPrefill(payload as Partial<FullSurveyModelV1>);
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
      <div className="visit-page__header">
        <span className="visit-page__id" aria-label={`Visit ${visitId}`}>
          Visit
        </span>
        <SaveStateIndicator state={saveState} />
      </div>
      <FullSurveyStepper
        onBack={onBack}
        prefill={prefill}
        onComplete={handleComplete}
        onOpenFloorPlan={onOpenFloorPlan}
      />
    </div>
  );
}
