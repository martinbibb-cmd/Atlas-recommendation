/**
 * AtlasTour.tsx
 *
 * One-time onboarding tour powered by react-joyride.
 *
 * Shows a guided walkthrough to first-time users highlighting the key
 * surfaces: Fast Choice, Survey inputs, System Lab, What-If, Visual,
 * and the export/print actions.
 *
 * The tour auto-runs on first visit and never re-shows once dismissed or
 * completed.  It can be replayed manually by passing `run={true}` from a
 * parent (e.g. a "Replay tour" button in the header).
 *
 * Two contexts are supported:
 *  "landing" — targets the landing-page journey cards (steps 1–2).
 *  "lab"     — targets the System Lab tabs and export row (steps 3–6).
 *
 * Both contexts share the single `atlas.tour.seen.v1` key from tourStorage so
 * that skipping/completing either phase marks the whole tour as seen.
 */

import { useState } from 'react';
import Joyride, { type CallBackProps, STATUS } from 'react-joyride';
import { hasSeenAtlasTour, markAtlasTourSeen } from '../../lib/tourStorage';
import { LANDING_TOUR_STEPS, LAB_TOUR_STEPS } from '../../config/atlasTourSteps';
import './tour.css';

// ─── Shared Joyride styles ────────────────────────────────────────────────────

const JOYRIDE_STYLES = {
  options: {
    primaryColor: '#6366f1',
    zIndex: 10000,
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.4)',
    textColor: '#1a202c',
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

type TourContext = 'landing' | 'lab';

interface AtlasTourProps {
  /** Which surface the tour is mounted on. */
  context: TourContext;
  /**
   * Optional controlled run state.  When provided, the component uses this
   * value instead of the localStorage flag (useful for replay).
   */
  run?: boolean;
  /** Called when the tour is closed (finished or skipped). */
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AtlasTour
 *
 * Mount this component once per surface.  When `run` is not provided it
 * self-manages its run/stop state via localStorage and never re-shows once
 * dismissed or completed.  Pass `run={true}` with `onClose` to drive it from
 * a parent (e.g. a "Replay tour" button).
 *
 * If a tour target element is missing from the DOM, react-joyride skips that
 * step automatically so the page remains fully usable.
 */
export default function AtlasTour({ context, run: runProp, onClose }: AtlasTourProps) {
  const steps = context === 'landing' ? LANDING_TOUR_STEPS : LAB_TOUR_STEPS;

  // Uncontrolled mode: auto-run once on first visit.
  const [autoRun, setAutoRun] = useState(() => !hasSeenAtlasTour());

  // If parent supplies `run`, use that; otherwise use internal auto-run state.
  const isControlled = runProp !== undefined;
  const run = isControlled ? runProp : autoRun;

  function handleCallback(data: CallBackProps) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      markAtlasTourSeen();
      if (isControlled) {
        onClose?.();
      } else {
        setAutoRun(false);
      }
    }
  }

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      styles={JOYRIDE_STYLES}
      locale={{
        back:  'Back',
        close: 'Close',
        last:  'Done',
        next:  'Next',
        skip:  'Skip tour',
      }}
    />
  );
}
