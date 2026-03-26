/**
 * FullSurveyStepper.firstpass.test.tsx
 *
 * Validates the first-pass survey UX requirements:
 *
 *   1. Deep explanatory content (flow-demand chart, outlet analysis) is hidden
 *      by default so the user sees only the essential input controls first.
 *
 *   2. Detail toggles reveal the hidden sections when activated.
 *
 *   3. onComplete is called with a clean EngineInputV2_3 when the user
 *      completes all survey steps — this enables direct routing to the
 *      simulator without stopping at a text-heavy intermediate page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullSurveyStepper from '../FullSurveyStepper';

// jsdom does not implement window.scrollTo — stub it.
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fill in the minimum required fields on the System Architecture step so the
 * "Next" button becomes enabled.  Selects combi + plate_hex + radiators_standard.
 */
async function fillSystemBuilderMinimum(user: ReturnType<typeof userEvent.setup>) {
  const heatSource = document.querySelector('[data-testid="heat-source-combi"]') as HTMLElement | null;
  if (heatSource) await user.click(heatSource);
  const dhwType = document.querySelector('[data-testid="dhw-type-plate_hex"]') as HTMLElement | null;
  if (dhwType) await user.click(dhwType);
  const emitter = document.querySelector('[data-testid="emitter-radiators_standard"]') as HTMLElement | null;
  if (emitter) await user.click(emitter);
}

/** Navigate the stepper to the given 0-based step index by clicking Next. */
async function advanceToStep(user: ReturnType<typeof userEvent.setup>, targetIndex: number) {
  for (let i = 0; i < targetIndex; i++) {
    // When on the System Architecture step, fill mandatory fields before advancing.
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      await fillSystemBuilderMinimum(user);
    }
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);
  }
}

// ─── Deep content hidden by default ──────────────────────────────────────────

describe('FullSurveyStepper — deep explanatory content hidden by default', () => {
  it('does not render the hydraulic flow-demand chart on initial mount of step 4', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    // Advance to step 4 (hydraulic — index 3, after the new services step at index 2).
    await advanceToStep(user, 3);

    // The detail section should be absent until the toggle is clicked.
    expect(document.querySelector('[data-testid="survey-hydraulic-detail"]')).toBeNull();
  });

  it('renders the hydraulic detail-toggle button on step 4', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 3);

    expect(document.querySelector('[data-testid="survey-hydraulic-detail-toggle"]')).not.toBeNull();
  });

  it('reveals the hydraulic flow-demand chart when the detail toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 3);

    const toggle = document.querySelector('[data-testid="survey-hydraulic-detail-toggle"]') as HTMLElement;
    await user.click(toggle);

    expect(document.querySelector('[data-testid="survey-hydraulic-detail"]')).not.toBeNull();
  });

  it('does not render the hot-water outlet analysis on initial mount of step 7', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    // Advance to step 7 (hot_water — index 6, with services at index 2 and system_builder at index 4).
    await advanceToStep(user, 6);

    expect(document.querySelector('[data-testid="survey-hotwater-analysis"]')).toBeNull();
  }, 15000);

  it('renders the hot-water analysis toggle button on step 7', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 6);

    expect(document.querySelector('[data-testid="survey-hotwater-analysis-toggle"]')).not.toBeNull();
  }, 15000);

  it('reveals the hot-water outlet analysis when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 6);

    const toggle = document.querySelector('[data-testid="survey-hotwater-analysis-toggle"]') as HTMLElement;
    await user.click(toggle);

    expect(document.querySelector('[data-testid="survey-hotwater-analysis"]')).not.toBeNull();
  }, 15000);
});

// ─── onComplete routing ───────────────────────────────────────────────────────

/**
 * Advance through ALL 9 survey steps and trigger the final action button.
 * Steps 1–8 use "Next →"; step 9 (overlay) uses "Run Full Analysis →".
 */
async function completeFullSurvey(user: ReturnType<typeof userEvent.setup>) {
  // Steps 1–8: click "Next →"
  for (let i = 0; i < 8; i++) {
    // When on the System Architecture step, fill mandatory fields before advancing.
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      await fillSystemBuilderMinimum(user);
    }
    const nextBtn = screen.getByRole('button', { name: /Next →/ });
    await user.click(nextBtn);
  }
  // Step 9 (overlay): click "Run Full Analysis →"
  const finalBtn = screen.getByRole('button', { name: /Run Full Analysis/ });
  await user.click(finalBtn);
}

describe('FullSurveyStepper — onComplete routing', () => {
  it('calls onComplete with a clean EngineInputV2_3 after completing all 9 steps', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} onComplete={onComplete} />);

    await completeFullSurvey(user);

    expect(onComplete).toHaveBeenCalledOnce();

    const engineInput = onComplete.mock.calls[0][0];
    // Must not carry fullSurvey UI extras — these would pollute LabShell's input.
    expect('fullSurvey' in engineInput).toBe(false);
    // Must have the required EngineInputV2_3 fields.
    expect(typeof engineInput.primaryPipeDiameter).toBe('number');
    expect(typeof engineInput.bathroomCount).toBe('number');
    expect(typeof engineInput.heatLossWatts).toBe('number');
  }, 20000);

  it('does NOT enter hub mode when onComplete is provided', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} onComplete={onComplete} />);

    await completeFullSurvey(user);

    // If onComplete is provided, LiveHubPage must not render.
    expect(screen.queryByText(/Atlas Live Output Hub/i)).toBeNull();
  }, 20000);

  it('enters hub mode (LiveHubPage) when onComplete is NOT provided', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await completeFullSurvey(user);

    // Without onComplete, the stepper falls back to LiveHubPage.
    expect(screen.getByText(/Atlas Live Output Hub/i)).toBeTruthy();
  }, 20000);
});
