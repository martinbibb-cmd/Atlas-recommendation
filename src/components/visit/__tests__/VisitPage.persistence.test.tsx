/**
 * VisitPage.persistence.test.tsx
 *
 * Tests for Step 7 hot-water persistence, save/retry state machine, and the
 * global ExplainersOverlay (hamburger) in the stepper.
 *
 * Covers:
 *   - onDraft callback fires on step transition with full FullSurveyModelV1
 *   - fullSurvey.dhwCondition fields are NOT stripped in the draft
 *   - compareMixergy is included in fullSurvey on the draft
 *   - compareMixergy is hydrated from prefill.fullSurvey.compareMixergy
 *   - ExplainersOverlay launcher button is present in FullSurveyStepper header
 *   - SaveState type includes 'retrying'
 *   - Step 6 does NOT render the top live-physics strip (PR 3 duplicate removal)
 *   - Step 6 bottom dhw-demand-summary block remains present (PR 3 keep working summary)
 *   - Heating circuit condition fields (pumpingOverObserved, systemCircuitType,
 *     bleedWaterColour, checkbox observations) are preserved in the draft (PR 1)
 *   - Hydrated heatingCondition values are not overwritten by defaults on mount (PR 1)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullSurveyStepper from '../../stepper/FullSurveyStepper';
import GlobalMenuShell from '../../shell/GlobalMenuShell';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { SaveState } from '../VisitPage';

vi.mock('../../../lib/visits/visitApi', () => ({
  getVisit: vi.fn(),
  saveVisit: vi.fn(),
  visitStatusLabel: (s: string) => s,
  visitDisplayLabel: () => 'Test Visit',
}));

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function advanceToStep(user: ReturnType<typeof userEvent.setup>, targetIndex: number) {
  for (let i = 0; i < targetIndex; i++) {
    // When on the System Architecture step, fill mandatory fields before advancing.
    if (document.querySelector('[data-testid="system-builder-step"]')) {
      const heatSource = document.querySelector('[data-testid="heat-source-combi"]') as HTMLElement | null;
      if (heatSource) await user.click(heatSource);
      const dhwType = document.querySelector('[data-testid="dhw-type-plate_hex"]') as HTMLElement | null;
      if (dhwType) await user.click(dhwType);
      const emitter = document.querySelector('[data-testid="emitter-radiators_standard"]') as HTMLElement | null;
      if (emitter) await user.click(emitter);
    }
    await user.click(screen.getByRole('button', { name: /next/i }));
  }
}

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

// ── onDraft persistence tests ─────────────────────────────────────────────────

describe('FullSurveyStepper — onDraft persistence callback', () => {
  it('calls onDraft with full FullSurveyModelV1 including fullSurvey on step transition', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(onDraft).toHaveBeenCalledOnce();
    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    // fullSurvey key must be present — confirms the model is not stripped
    expect(Object.prototype.hasOwnProperty.call(draft, 'fullSurvey')).toBe(true);
  }, 10000);

  it('draft preserves fullSurvey.dhwCondition fields', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        dhwCondition: {
          currentCylinderPresent: true,
          currentCylinderType: 'mixergy',
          dhwUpgradeIntent: 'keep',
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderPresent).toBe(true);
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderType).toBe('mixergy');
    expect(draft.fullSurvey?.dhwCondition?.dhwUpgradeIntent).toBe('keep');
  }, 10000);
});

// ── compareMixergy — state-level persistence (checkbox UI is in legacy hot_water step) ──

describe('FullSurveyStepper — compareMixergy state persists in draft', () => {
  it('compareMixergy=true from prefill is preserved in draft on step transition', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    render(
      <FullSurveyStepper
        onBack={() => {}}
        prefill={{ fullSurvey: { compareMixergy: true } }}
        onDraft={onDraft}
      />
    );

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.compareMixergy).toBe(true);
  }, 10000);

  it('compareMixergy defaults to false when absent from prefill', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.compareMixergy).toBeFalsy();
  }, 10000);
});

// ── Global hamburger (ExplainersOverlay in FullSurveyStepper) ────────────────

describe('FullSurveyStepper — global ExplainersOverlay (hamburger) availability', () => {
  it('renders the Explainers launcher button on step 1', () => {
    render(<GlobalMenuShell><FullSurveyStepper onBack={() => {}} /></GlobalMenuShell>);
    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  });

  it('Explainers button is still present after navigating to step 2', async () => {
    const user = userEvent.setup();
    render(<GlobalMenuShell><FullSurveyStepper onBack={() => {}} /></GlobalMenuShell>);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  }, 10000);

  it('Explainers button is still present on step 3', async () => {
    const user = userEvent.setup();
    render(<GlobalMenuShell><FullSurveyStepper onBack={() => {}} /></GlobalMenuShell>);

    await advanceToStep(user, 2);

    expect(screen.getByRole('button', { name: /explainers/i })).toBeInTheDocument();
  }, 10000);
});

// ── SaveState type test ───────────────────────────────────────────────────────

describe('VisitPage — SaveState includes retrying variant', () => {
  it('SaveState type supports all expected states including retrying', () => {
    const states: SaveState[] = ['idle', 'saving', 'saved', 'failed', 'retrying'];
    expect(states).toContain('retrying');
    expect(states).toHaveLength(5);
  });
});

// ── Step 6 duplicate strip removal (PR 3) ────────────────────────────────────

describe('FullSurveyStepper — Step 6 duplicate live-physics strip removed', () => {
  it('does not render the live-physics overlay panel on Step 6 (usage)', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 1); // usage is now at index 1 in V2 flow

    // The LivePhysicsOverlay has className 'live-physics-overlay' — must be absent on the usage step.
    expect(document.querySelector('.live-physics-overlay')).toBeNull();
  }, 15000);

  it('still renders the dhw-demand-summary block on Step 6 (working bottom summary)', async () => {
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 1); // usage is now at index 1 in V2 flow

    expect(document.querySelector('[data-testid="dhw-demand-summary"]')).not.toBeNull();
  }, 15000);

  it('does not render the live-physics overlay on Step 6 regardless of engine output', async () => {
    // The overlayStepKey is null for 'usage' so the overlay must not be
    // rendered even if the engine has produced output from a previous step.
    const user = userEvent.setup();
    render(<FullSurveyStepper onBack={() => {}} />);

    await advanceToStep(user, 1); // usage is now at index 1 in V2 flow

    // Allow any debounced engine tick to settle.
    await new Promise(r => setTimeout(r, 500));

    expect(document.querySelector('.live-physics-overlay')).toBeNull();
  }, 15000);
});

// ── Heating circuit condition persistence (PR 1) ─────────────────────────────

describe('FullSurveyStepper — heatingCondition fields persist in draft', () => {
  it('draft preserves fullSurvey.heatingCondition.pumpingOverObserved', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        heatingCondition: {
          pumpingOverObserved: true,
          systemCircuitType: 'open_vented',
          bleedWaterColour: 'brown',
          radiatorsColdAtBottom: true,
          radiatorsHeatingUnevenly: false,
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.heatingCondition?.pumpingOverObserved).toBe(true);
    expect(draft.fullSurvey?.heatingCondition?.systemCircuitType).toBe('open_vented');
    expect(draft.fullSurvey?.heatingCondition?.bleedWaterColour).toBe('brown');
    expect(draft.fullSurvey?.heatingCondition?.radiatorsColdAtBottom).toBe(true);
    expect(draft.fullSurvey?.heatingCondition?.radiatorsHeatingUnevenly).toBe(false);
  }, 10000);

  it('hydrated heatingCondition values are not overwritten by defaults on mount', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        heatingCondition: {
          pumpingOverObserved: false,
          bleedWaterColour: 'black',
          magneticDebrisEvidence: true,
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    // Transition step immediately — no user interaction with heating fields.
    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    // Values must match the prefill, not be reset to undefined by defaultInput.
    expect(draft.fullSurvey?.heatingCondition?.pumpingOverObserved).toBe(false);
    expect(draft.fullSurvey?.heatingCondition?.bleedWaterColour).toBe('black');
    expect(draft.fullSurvey?.heatingCondition?.magneticDebrisEvidence).toBe(true);
  }, 10000);

  it('draft preserves fullSurvey.dhwCondition alongside heatingCondition', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      fullSurvey: {
        heatingCondition: {
          pumpingOverObserved: true,
          systemCircuitType: 'sealed',
        },
        dhwCondition: {
          currentCylinderPresent: true,
          currentCylinderType: 'unvented',
          dhwUpgradeIntent: 'replace',
        },
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.fullSurvey?.heatingCondition?.pumpingOverObserved).toBe(true);
    expect(draft.fullSurvey?.heatingCondition?.systemCircuitType).toBe('sealed');
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderPresent).toBe(true);
    expect(draft.fullSurvey?.dhwCondition?.currentCylinderType).toBe('unvented');
    expect(draft.fullSurvey?.dhwCondition?.dhwUpgradeIntent).toBe('replace');
  }, 10000);
});

// ── Fabric controls hydration from prefill (PR 1) ────────────────────────────

describe('FullSurveyStepper — fabric controls hydrate from prefill and are not overwritten', () => {
  it('draft preserves building.fabric fields hydrated from prefill on first step transition', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      building: {
        fabric: {
          wallType: 'cavity_filled',
          insulationLevel: 'good',
          glazing: 'double',
          roofInsulation: 'moderate',
          airTightness: 'tight',
        },
        thermalMass: 'light',
      },
      heatLossWatts: 6000,
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.building?.fabric?.wallType).toBe('cavity_filled');
    expect(draft.building?.fabric?.insulationLevel).toBe('good');
    expect(draft.building?.fabric?.glazing).toBe('double');
    expect(draft.building?.fabric?.roofInsulation).toBe('moderate');
    expect(draft.building?.fabric?.airTightness).toBe('tight');
    expect(draft.building?.thermalMass).toBe('light');
  }, 10000);

  it('mount-time preset effect does not overwrite hydrated building.fabric values', async () => {
    // The preset driven by the default dwelling-form/age-band selectors would
    // normally apply solid_masonry/moderate/single/poor/average/heavy.
    // With a prefill that has different values they must survive mount.
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      building: {
        fabric: {
          wallType: 'timber_frame',
          insulationLevel: 'exceptional',
          glazing: 'triple',
          roofInsulation: 'good',
          airTightness: 'passive',
        },
        thermalMass: 'medium',
      },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    // Transition immediately — no interaction with fabric controls.
    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.building?.fabric?.wallType).toBe('timber_frame');
    expect(draft.building?.fabric?.insulationLevel).toBe('exceptional');
    expect(draft.building?.fabric?.glazing).toBe('triple');
    expect(draft.building?.fabric?.roofInsulation).toBe('good');
    expect(draft.building?.fabric?.airTightness).toBe('passive');
    expect(draft.building?.thermalMass).toBe('medium');
  }, 10000);

  it('houseFrontFacing is hydrated from prefill and not reset to undefined', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      houseFrontFacing: 'south',
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.houseFrontFacing).toBe('south');
  }, 10000);
});

// ── Solar roof fields persistence (PR 6) ────────────────────────────────────

describe('FullSurveyStepper — solar roof fields hydrate from prefill and persist in draft', () => {
  it('roofType is hydrated from prefill and preserved in draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = { roofType: 'pitched' };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.roofType).toBe('pitched');
  }, 10000);

  it('roofOrientation is hydrated from prefill and preserved in draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = { roofOrientation: 'south_west' };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.roofOrientation).toBe('south_west');
  }, 10000);

  it('solarShading is hydrated from prefill and preserved in draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = { solarShading: 'medium' };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.solarShading).toBe('medium');
  }, 10000);

  it('all three roof fields persist together in a single draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      roofType: 'flat',
      roofOrientation: 'south',
      solarShading: 'low',
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.roofType).toBe('flat');
    expect(draft.roofOrientation).toBe('south');
    expect(draft.solarShading).toBe('low');
  }, 10000);
});

// ── disruptionTolerance persistence (PR 7) ──────────────────────────────────

describe('FullSurveyStepper — disruptionTolerance preference persistence', () => {
  it('hydrates preferences.disruptionTolerance from prefill and preserves it in draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      preferences: { disruptionTolerance: 'high' },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.preferences?.disruptionTolerance).toBe('high');
  }, 10000);

  it('draft preserves disruptionTolerance=low when hydrated from prefill', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      preferences: { disruptionTolerance: 'low' },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.preferences?.disruptionTolerance).toBe('low');
  }, 10000);

  it('preserves spacePriority alongside disruptionTolerance in draft', async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const prefill: Partial<FullSurveyModelV1> = {
      preferences: { spacePriority: 'medium', disruptionTolerance: 'high' },
    };
    render(<FullSurveyStepper onBack={() => {}} prefill={prefill} onDraft={onDraft} />);

    await fillSystemBuilderMinimum(user);
    await user.click(screen.getByRole('button', { name: /next/i }));

    const draft: FullSurveyModelV1 = onDraft.mock.calls[0][0];
    expect(draft.preferences?.spacePriority).toBe('medium');
    expect(draft.preferences?.disruptionTolerance).toBe('high');
  }, 10000);
});
