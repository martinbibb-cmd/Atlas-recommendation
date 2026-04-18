/**
 * FullSurveyStepper.firstpass.test.tsx
 *
 * Validates the V2 survey UX requirements:
 *
 *   1. The active survey has exactly 8 canonical steps:
 *      system_builder → usage → services → building_fabric → heat_loss →
 *      solar_assessment → priorities → insight.
 *
 *   2. onComplete is called with a clean EngineInputV2_3 when the user
 *      completes all survey steps (the insight page "Run Full Analysis" button)
 *      — this enables direct routing to the simulator.
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

  it('services step shows Next button (not Run Full Analysis)', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 2);

    // Services is no longer the last step — its action is "Next →".
    expect(screen.queryByRole('button', { name: /Run Full Analysis/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Next/i })).toBeTruthy();
  });

  it('advances to the building_fabric step after services', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 3);

    expect(document.querySelector('[data-testid="building-fabric-step"]')).not.toBeNull();
  });

  it('advances to the heat_loss step after building_fabric', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 4);

    expect(document.querySelector('[data-testid="heat-loss-step"]')).not.toBeNull();
  });

  it('advances to the solar_assessment step after heat_loss', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 5);

    expect(document.querySelector('[data-testid="solar-assessment-step"]')).not.toBeNull();
  });

  it('advances to the priorities step after solar_assessment', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 6);

    expect(document.querySelector('[data-testid="priorities-step"]')).not.toBeNull();
  });

  it('advances to the insight page after priorities', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 7);

    expect(document.querySelector('[data-testid="insight-layer-page"]')).not.toBeNull();
  });

  it('insight page shows Run Full Analysis button as the final action', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 7);

    expect(screen.getByRole('button', { name: /Run Full Analysis/i })).toBeTruthy();
  });
});

// ─── onComplete routing ───────────────────────────────────────────────────────

/**
 * Advance through all 8 V2 survey steps and trigger the final action button.
 * Steps 1–7 use "Next →"; step 8 (insight) uses "Run Full Analysis →".
 */
async function completeFullSurvey(user: ReturnType<typeof userEvent.setup>) {
  // Steps 1–7: click "Next →"
  for (let i = 0; i < 7; i++) {
    // When on the System Architecture step, fill mandatory fields before advancing.
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      await fillSystemBuilderMinimum(user);
    }
    const nextBtn = screen.getByRole('button', { name: /Next →/ });
    await user.click(nextBtn);
  }
  // Step 8 (insight): click "Run Full Analysis →"
  const finalBtn = screen.getByRole('button', { name: /Run Full Analysis/ });
  await user.click(finalBtn);
}

describe('FullSurveyStepper — onComplete routing', () => {
  it('calls onComplete with a clean EngineInputV2_3 after completing all 8 steps', async () => {
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

// ─── onOpenSimulator routing (regression: Try in Simulator CTA) ───────────────

/**
 * Advance to the insight step without completing the survey.
 */
async function advanceToInsightStep(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 7; i++) {
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      await fillSystemBuilderMinimum(user);
    }
    const nextBtn = screen.getByRole('button', { name: /Next →/ });
    await user.click(nextBtn);
  }
}

describe('FullSurveyStepper — Try in Simulator CTA routing', () => {
  it('renders a "Try in Simulator" button on the insight page when onOpenSimulator is provided', async () => {
    const onOpenSimulator = vi.fn();
    const user = userEvent.setup();
    render(
      <FullSurveyStepper
        onBack={() => {}}
        onOpenSimulator={onOpenSimulator}
      />
    );

    await advanceToInsightStep(user);

    expect(screen.getByRole('button', { name: /Try in Simulator/i })).toBeTruthy();
  }, 20000);

  it('calls onOpenSimulator with EngineInputV2_3 when "Try in Simulator" is clicked', async () => {
    const onOpenSimulator = vi.fn();
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <FullSurveyStepper
        onBack={() => {}}
        onComplete={onComplete}
        onOpenSimulator={onOpenSimulator}
      />
    );

    await advanceToInsightStep(user);
    await user.click(screen.getByRole('button', { name: /Try in Simulator/i }));

    expect(onOpenSimulator).toHaveBeenCalledOnce();
    // onComplete must NOT have been called — this is the key regression guard.
    expect(onComplete).not.toHaveBeenCalled();

    const engineInput = onOpenSimulator.mock.calls[0][0];
    // Must be a clean EngineInputV2_3 — no fullSurvey UI extras.
    expect('fullSurvey' in engineInput).toBe(false);
    expect(typeof engineInput.heatLossWatts).toBe('number');
  }, 20000);

  it('does NOT render "Try in Simulator" button when onOpenSimulator is not provided', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToInsightStep(user);

    expect(screen.queryByRole('button', { name: /Try in Simulator/i })).toBeNull();
  }, 20000);
});

