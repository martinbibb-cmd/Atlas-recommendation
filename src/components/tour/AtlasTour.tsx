/**
 * AtlasTour.tsx
 *
 * One-time onboarding tour powered by react-joyride.
 *
 * Shows a guided walkthrough to first-time users highlighting the key
 * surfaces: Fast Choice, Survey inputs, System Lab, What-If, Visual,
 * and the export/print actions.
 *
 * The tour is shown when localStorage.getItem("atlasTourComplete") !== "true".
 * On finish or skip it writes localStorage.setItem("atlasTourComplete", "true")
 * so it never shows again for that user/device.
 *
 * Two contexts are supported:
 *  "landing" — targets the landing-page journey cards (steps 1–2),
 *              tracked by localStorage key "atlasTourLandingComplete".
 *  "lab"     — targets the System Lab tabs and export row (steps 3–6),
 *              tracked by localStorage key "atlasTourComplete".
 *
 * Each context tracks its own completion flag so the lab portion only shows
 * after the user has already seen the landing portion.
 */

import { useState } from 'react';
import Joyride, { type CallBackProps, STATUS, type Step } from 'react-joyride';
import './tour.css';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const LANDING_KEY = 'atlasTourLandingComplete';
const LAB_KEY     = 'atlasTourComplete';

// ─── Step definitions ─────────────────────────────────────────────────────────

const LANDING_STEPS: Step[] = [
  {
    target:  '#fast-choice-card',
    content: 'Quick recommendation for early conversations — ideal before a full site survey.',
    title:   '⚡ Fast Choice',
    disableBeacon: true,
  },
  {
    target:  '#survey-panel',
    content: 'Capture detailed property and system information to raise confidence in the recommendation.',
    title:   '🔬 Full Survey',
  },
];

const LAB_STEPS: Step[] = [
  {
    target:  '#system-lab-tab',
    content: 'Compare heating systems side-by-side using real operating constraints.',
    title:   '🔭 System Lab',
    disableBeacon: true,
  },
  {
    target:  '#what-if-tab',
    content: 'Explore upgrade scenarios and see the cause-and-effect on performance.',
    title:   '🔀 What-If Lab',
  },
  {
    target:  '#visual-tab',
    content: 'Watch how heat and water actually behave under this system.',
    title:   '🎨 Visual',
  },
  {
    target:  '#export-buttons',
    content: 'Generate customer summaries, technical specs, and comparison sheets.',
    title:   '🖨 Export',
  },
];

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
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AtlasTour
 *
 * Mount this component once per surface.  It self-manages its run/stop state
 * via localStorage and never re-shows once dismissed or completed.
 */
export default function AtlasTour({ context }: AtlasTourProps) {
  const storageKey = context === 'landing' ? LANDING_KEY : LAB_KEY;
  const steps      = context === 'landing' ? LANDING_STEPS : LAB_STEPS;

  // The lab tour only starts once the user has completed the landing tour.
  const landingDone = localStorage.getItem(LANDING_KEY) === 'true';
  const thisDone    = localStorage.getItem(storageKey)   === 'true';

  const shouldRun = !thisDone && (context === 'landing' || landingDone);

  const [run, setRun] = useState(shouldRun);

  function handleCallback(data: CallBackProps) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(storageKey, 'true');
      setRun(false);
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
