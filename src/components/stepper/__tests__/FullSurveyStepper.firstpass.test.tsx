/**
 * FullSurveyStepper.firstpass.test.tsx
 *
 * Validates the V2 survey UX requirements:
 *
 *   1. The active survey has exactly 3 canonical steps:
 *      system_builder → usage → services.
 *
 *   2. onComplete is called with a clean EngineInputV2_3 when the user
 *      completes all survey steps — this enables direct routing to the
 *      simulator without stopping at a text-heavy intermediate page.
 *
 *   3. Legacy steps (location/pressure/hydraulic/hot_water/commercial/overlay)
 *      are no longer reachable via the active stepper flow.
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

// ─── V2 step structure ────────────────────────────────────────────────────────

describe('FullSurveyStepper — V2 active step structure', () => {
  it('starts on the System Architecture step (system_builder)', () => {
    render(<FullSurveyStepper onBack={() => {}} />);
    expect(document.querySelector('[data-testid="system-builder-step"]')).not.toBeNull();
  });

  it('advances to the usage (Home) step after completing system_builder', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 1);

    expect(document.querySelector('[data-testid="usage-step"]')).not.toBeNull();
  });

  it('advances to the services step after usage', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 2);

    expect(document.querySelector('[data-testid="services-step"]')).not.toBeNull();
  });

  it('services step contains mains supply inputs', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 2);

    expect(document.querySelector('[data-testid="mains-supply-block"]')).not.toBeNull();
  });

  it('services step shows Run Full Analysis button as the final action', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 2);

    expect(screen.getByRole('button', { name: /Run Full Analysis/i })).toBeTruthy();
  });
});

// ─── onComplete routing ───────────────────────────────────────────────────────

/**
 * Advance through all 3 V2 survey steps and trigger the final action button.
 * Steps 1–2 use "Next →"; step 3 (services) uses "Run Full Analysis →".
 */
async function completeFullSurvey(user: ReturnType<typeof userEvent.setup>) {
  // Steps 1–2: click "Next →"
  for (let i = 0; i < 2; i++) {
    // When on the System Architecture step, fill mandatory fields before advancing.
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      await fillSystemBuilderMinimum(user);
    }
    const nextBtn = screen.getByRole('button', { name: /Next →/ });
    await user.click(nextBtn);
  }
  // Step 3 (services): click "Run Full Analysis →"
  const finalBtn = screen.getByRole('button', { name: /Run Full Analysis/ });
  await user.click(finalBtn);
}

describe('FullSurveyStepper — onComplete routing', () => {
  it('calls onComplete with a clean EngineInputV2_3 after completing all 3 steps', async () => {
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
