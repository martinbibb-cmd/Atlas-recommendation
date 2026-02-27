/**
 * storySharedBasics.test.ts
 *
 * Tests for:
 *   1. StorySharedBasics type and SHARED_BASICS_KEYS
 *   2. Heat pump viability scenario spec and pure helpers
 *   3. applyHeatPumpViabilityInputs engine mapping
 *   4. outputFocus gates for heat_pump_viability scenario
 *   5. STORY_SCENARIOS registry now contains all three scenarios
 */
import { describe, it, expect } from 'vitest';
import { STORY_SCENARIOS, heatPumpViabilityScenario, SHARED_BASICS_KEYS } from '../scenarioRegistry';
import type { StorySharedBasics } from '../scenarioRegistry';
import {
  deriveHeatPumpFlowTempC,
  estimateHeatPumpCop,
  deriveHeatPumpViabilityVerdict,
} from '../scenarios/heatPumpViability';
import type { HeatPumpViabilityInputs } from '../scenarios/heatPumpViability';
import { applyHeatPumpViabilityInputs } from '../applyScenarioToEngineInput';
import { shouldShowPanel } from '../rendering/shouldShowPanel';

// ── StorySharedBasics ─────────────────────────────────────────────────────────

describe('StorySharedBasics', () => {
  it('SHARED_BASICS_KEYS contains all expected fields', () => {
    const expected: Array<keyof StorySharedBasics> = [
      'occupancyCount',
      'bathroomCount',
      'mainsFlowLpm',
      'mainsFlowUnknown',
      'heatLossWatts',
      'heatLossKnown',
    ];
    for (const key of expected) {
      expect(SHARED_BASICS_KEYS).toContain(key);
    }
  });

  it('merging shared basics into combi defaults uses shared values', () => {
    const shared: StorySharedBasics = { occupancyCount: 4, bathroomCount: 2 };
    // Simulate the merge logic used in CombiSwitchShell initializer
    const defaults = { occupancyCount: 2, bathroomCount: 1 };
    const merged = {
      ...defaults,
      ...(shared.occupancyCount !== undefined && { occupancyCount: shared.occupancyCount }),
      ...(shared.bathroomCount !== undefined && { bathroomCount: shared.bathroomCount }),
    };
    expect(merged.occupancyCount).toBe(4);
    expect(merged.bathroomCount).toBe(2);
  });

  it('merging empty shared basics leaves scenario defaults unchanged', () => {
    const shared: StorySharedBasics = {};
    const defaults = { occupancyCount: 2, bathroomCount: 1 };
    const merged = {
      ...defaults,
      ...(shared.occupancyCount !== undefined && { occupancyCount: shared.occupancyCount }),
      ...(shared.bathroomCount !== undefined && { bathroomCount: shared.bathroomCount }),
    };
    expect(merged.occupancyCount).toBe(2);
    expect(merged.bathroomCount).toBe(1);
  });

  it('switching scenario does not wipe scenario-local controls (storedType)', () => {
    // storedType is not in SHARED_BASICS_KEYS, so it is never synced to shared
    expect(SHARED_BASICS_KEYS).not.toContain('storedType');
  });

  it('mainsFlowLpm is a shared key (synced when known)', () => {
    expect(SHARED_BASICS_KEYS).toContain('mainsFlowLpm');
    expect(SHARED_BASICS_KEYS).toContain('mainsFlowUnknown');
  });

  it('heatLossWatts and heatLossKnown are shared keys', () => {
    expect(SHARED_BASICS_KEYS).toContain('heatLossWatts');
    expect(SHARED_BASICS_KEYS).toContain('heatLossKnown');
  });
});

// ── STORY_SCENARIOS registry ──────────────────────────────────────────────────

describe('STORY_SCENARIOS registry', () => {
  it('contains all three scenarios', () => {
    const ids = STORY_SCENARIOS.map(s => s.id);
    expect(ids).toContain('combi_switch');
    expect(ids).toContain('old_boiler_reality');
    expect(ids).toContain('heat_pump_viability');
  });

  it('each scenario still has at most 8 editable fields', () => {
    for (const scenario of STORY_SCENARIOS) {
      expect(scenario.fields.length).toBeLessThanOrEqual(8);
    }
  });
});

// ── deriveHeatPumpFlowTempC ───────────────────────────────────────────────────

describe('deriveHeatPumpFlowTempC', () => {
  it('mostly_doubles returns the lowest flow temp', () => {
    const d = deriveHeatPumpFlowTempC('mostly_doubles');
    const m = deriveHeatPumpFlowTempC('mixed');
    const s = deriveHeatPumpFlowTempC('mostly_singles');
    expect(d).toBeLessThan(m);
    expect(m).toBeLessThan(s);
  });

  it('returns a numeric value for each radiator type', () => {
    expect(typeof deriveHeatPumpFlowTempC('mostly_doubles')).toBe('number');
    expect(typeof deriveHeatPumpFlowTempC('mixed')).toBe('number');
    expect(typeof deriveHeatPumpFlowTempC('mostly_singles')).toBe('number');
  });
});

// ── estimateHeatPumpCop ───────────────────────────────────────────────────────

describe('estimateHeatPumpCop', () => {
  it('returns a higher COP for a lower design flow temperature', () => {
    const copLow  = estimateHeatPumpCop(45);
    const copHigh = estimateHeatPumpCop(55);
    expect(copLow).toBeGreaterThan(copHigh);
  });

  it('clamps COP to between 2.0 and 4.0', () => {
    const extremelyHigh = estimateHeatPumpCop(0);
    const extremelyLow  = estimateHeatPumpCop(200);
    expect(extremelyHigh).toBeLessThanOrEqual(4.0);
    expect(extremelyLow).toBeGreaterThanOrEqual(2.0);
  });

  it('returns a number', () => {
    expect(typeof estimateHeatPumpCop(50)).toBe('number');
  });
});

// ── deriveHeatPumpViabilityVerdict ───────────────────────────────────────────

describe('deriveHeatPumpViabilityVerdict', () => {
  const baseInputs: HeatPumpViabilityInputs = {
    heatLossKnown: false,
    heatLossWatts: 8000,
    radiatorsType: 'mixed',
    primaryPipeDiameterKnown: false,
    primaryPipeDiameter: 22,
    comfortPreference: 'steady_heat',
    outdoorSpace: true,
  };

  it('returns "good" for a favourable property', () => {
    expect(deriveHeatPumpViabilityVerdict(baseInputs)).toBe('good');
  });

  it('returns "limited" when no outdoor space', () => {
    expect(deriveHeatPumpViabilityVerdict({ ...baseInputs, outdoorSpace: false })).toBe('limited');
  });

  it('returns "limited" when mostly singles + fast response', () => {
    expect(deriveHeatPumpViabilityVerdict({
      ...baseInputs,
      radiatorsType: 'mostly_singles',
      comfortPreference: 'fast_response',
    })).toBe('limited');
  });

  it('returns "possible" when mostly singles but steady heat preference', () => {
    expect(deriveHeatPumpViabilityVerdict({
      ...baseInputs,
      radiatorsType: 'mostly_singles',
      comfortPreference: 'steady_heat',
    })).toBe('possible');
  });

  it('returns "possible" when 15 mm pipe diameter', () => {
    expect(deriveHeatPumpViabilityVerdict({
      ...baseInputs,
      primaryPipeDiameter: 15,
    })).toBe('possible');
  });
});

// ── applyHeatPumpViabilityInputs ──────────────────────────────────────────────

describe('applyHeatPumpViabilityInputs', () => {
  const baseInputs: HeatPumpViabilityInputs = {
    heatLossKnown: false,
    heatLossWatts: 12000,
    radiatorsType: 'mixed',
    primaryPipeDiameterKnown: false,
    primaryPipeDiameter: 28,
    comfortPreference: 'steady_heat',
    outdoorSpace: true,
  };

  it('uses default 8000 W heat loss when heatLossKnown is false', () => {
    const result = applyHeatPumpViabilityInputs(baseInputs);
    expect(result.heatLossWatts).toBe(8000);
  });

  it('uses provided heat loss when heatLossKnown is true', () => {
    const result = applyHeatPumpViabilityInputs({ ...baseInputs, heatLossKnown: true });
    expect(result.heatLossWatts).toBe(12000);
  });

  it('uses default 22 mm pipe when primaryPipeDiameterKnown is false', () => {
    const result = applyHeatPumpViabilityInputs(baseInputs);
    expect(result.primaryPipeDiameter).toBe(22);
  });

  it('uses provided pipe diameter when primaryPipeDiameterKnown is true', () => {
    const result = applyHeatPumpViabilityInputs({ ...baseInputs, primaryPipeDiameterKnown: true });
    expect(result.primaryPipeDiameter).toBe(28);
  });

  it('maps outdoor space to availableSpace "ok"', () => {
    const result = applyHeatPumpViabilityInputs({ ...baseInputs, outdoorSpace: true });
    expect(result.availableSpace).toBe('ok');
  });

  it('maps no outdoor space to availableSpace "tight"', () => {
    const result = applyHeatPumpViabilityInputs({ ...baseInputs, outdoorSpace: false });
    expect(result.availableSpace).toBe('tight');
  });
});

// ── heat_pump_viability outputFocus gates ─────────────────────────────────────

describe('shouldShowPanel — heat_pump_viability scenario focus', () => {
  const focus = heatPumpViabilityScenario.outputFocus;

  it('shows hydraulics', () => {
    expect(shouldShowPanel(focus, 'hydraulics')).toBe(true);
  });

  it('shows efficiency_graph', () => {
    expect(shouldShowPanel(focus, 'efficiency_graph')).toBe(true);
  });

  it('shows inputs_summary', () => {
    expect(shouldShowPanel(focus, 'inputs_summary')).toBe(true);
  });

  it('hides band_ladder', () => {
    expect(shouldShowPanel(focus, 'band_ladder')).toBe(false);
  });

  it('hides recovery_steps', () => {
    expect(shouldShowPanel(focus, 'recovery_steps')).toBe(false);
  });

  it('hides demand_graph', () => {
    expect(shouldShowPanel(focus, 'demand_graph')).toBe(false);
  });
});

// ── heat_pump_viability scenario spec ─────────────────────────────────────────

describe('heatPumpViabilityScenario spec', () => {
  it('has correct id', () => {
    expect(heatPumpViabilityScenario.id).toBe('heat_pump_viability');
  });

  it('compareDefaults has ashp as systemA', () => {
    expect(heatPumpViabilityScenario.compareDefaults.systemA).toBe('ashp');
  });

  it('escalation is not allowed in V1', () => {
    expect(heatPumpViabilityScenario.escalationAllowed).toBe(false);
  });

  it('has at most 8 editable fields', () => {
    expect(heatPumpViabilityScenario.fields.length).toBeLessThanOrEqual(8);
  });

  it('defaults are valid HeatPumpViabilityInputs', () => {
    const d = heatPumpViabilityScenario.defaults;
    expect(typeof d.heatLossKnown).toBe('boolean');
    expect(d.heatLossWatts).toBeGreaterThan(0);
    expect(['mostly_doubles', 'mixed', 'mostly_singles']).toContain(d.radiatorsType);
    expect(typeof d.primaryPipeDiameterKnown).toBe('boolean');
    expect([15, 22, 28]).toContain(d.primaryPipeDiameter);
    expect(['steady_heat', 'fast_response']).toContain(d.comfortPreference);
    expect(typeof d.outdoorSpace).toBe('boolean');
  });
});
