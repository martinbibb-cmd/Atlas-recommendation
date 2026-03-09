import { describe, it, expect } from 'vitest';
import { runCombiDhwModuleV1, estimateMorningOverlapProbability, getCombiDhwRampPhase } from '../modules/CombiDhwModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

describe('runCombiDhwModuleV1', () => {
  it('returns pass when pressure is adequate, 1 bathroom, 1 outlet, professional signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, peakConcurrentOutlets: 1 });
    expect(result.verdict.combiRisk).toBe('pass');
    expect(result.flags).toHaveLength(0);
  });

  // ── Rule 1: Pressure lockout ─────────────────────────────────────────────

  it('returns fail when dynamicMainsPressure < 1.0 bar', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 0.8 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-pressure-lockout');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('fail');
    expect(flag!.title).toBe('Combi safety cut-off risk');
  });

  it('dynamicMainsPressureBar alias takes precedence over dynamicMainsPressure', () => {
    // dynamicMainsPressureBar = 0.8 (low) should trigger lockout even though legacy field is fine
    const result = runCombiDhwModuleV1({
      ...baseInput,
      dynamicMainsPressure: 2.5,
      dynamicMainsPressureBar: 0.8,
      peakConcurrentOutlets: 1,
    });
    expect(result.verdict.combiRisk).toBe('fail');
    expect(result.flags.some(f => f.id === 'combi-pressure-lockout')).toBe(true);
  });

  it('dynamicMainsPressureBar alias: adequate pressure passes lockout check', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      dynamicMainsPressure: 0.5, // would fail if used
      dynamicMainsPressureBar: 2.0, // preferred field — should pass
      peakConcurrentOutlets: 1,
    });
    expect(result.flags.some(f => f.id === 'combi-pressure-lockout')).toBe(false);
  });

  it('returns pass when dynamicMainsPressure is exactly 1.0 bar', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 1.0, peakConcurrentOutlets: 1 });
    expect(result.flags.some(f => f.id === 'combi-pressure-lockout')).toBe(false);
  });

  it('detail includes the actual pressure value', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 0.6 });
    const flag = result.flags.find(f => f.id === 'combi-pressure-lockout')!;
    expect(flag.detail).toContain('0.6 bar');
  });

  // ── Rule 2: Simultaneous demand ──────────────────────────────────────────

  it('returns fail when bathroomCount >= 2 even if peakConcurrentOutlets < 2', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 2, peakConcurrentOutlets: 1 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('fail');
    expect(flag!.title).toBe('Hot water starvation likely');
  });

  it('returns fail when peakConcurrentOutlets >= 2 (even with 1 bathroom)', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 2 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand');
    expect(flag).toBeDefined();
  });

  it('returns fail for peakConcurrentOutlets = 3', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 3 });
    expect(result.verdict.combiRisk).toBe('fail');
  });

  it('detail mentions bathroom count when outlets not the trigger', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 3, peakConcurrentOutlets: 1 });
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand')!;
    expect(flag.detail).toContain('3 bathrooms');
  });

  it('detail mentions concurrent outlets when that is the trigger', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 2 });
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand')!;
    expect(flag.detail).toContain('2 concurrent outlets');
  });

  it('adds assumption when peakConcurrentOutlets is not provided', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1 });
    expect(result.assumptions.some(a => a.includes('peakConcurrentOutlets not provided'))).toBe(true);
  });

  // ── Rule 3: Short-draw collapse ──────────────────────────────────────────

  it('adds warn for steady_home signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'steady_home' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('adds warn for "steady" V3 alias', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'steady' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('adds warn for shift_worker signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'shift_worker' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
  });

  it('adds warn for "shift" V3 alias', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'shift' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
  });

  it('no short-draw warn for professional signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'professional' });
    expect(result.flags.some(f => f.id === 'combi-short-draw-collapse')).toBe(false);
  });

  // ── verdict combiRisk = 'warn' when only short-draw flag present ─────────

  it('returns warn (not fail) when only short-draw risk present', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
      dynamicMainsPressure: 2.5,
    });
    expect(result.verdict.combiRisk).toBe('warn');
  });

  // ── Combinations ─────────────────────────────────────────────────────────

  it('fail takes precedence over warn (low pressure + steady_home)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      dynamicMainsPressure: 0.5,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    expect(result.verdict.combiRisk).toBe('fail');
    expect(result.flags.length).toBe(2); // pressure-lockout + short-draw
  });

  // ── Rule 4: Three-person household caution ───────────────────────────────

  it('adds warn for occupancyCount === 3 when no simultaneous-demand fail', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 3,
    });
    const flag = result.flags.find(f => f.id === 'combi-three-person-caution');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.combiRisk).toBe('warn');
  });

  it('occupancyCount === 2 does not add three-person caution', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 2,
    });
    expect(result.flags.some(f => f.id === 'combi-three-person-caution')).toBe(false);
    expect(result.verdict.combiRisk).toBe('pass');
  });

  it('three-person caution is suppressed when simultaneous-demand risk is already flagged', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 1,
      occupancyCount: 3,
    });
    expect(result.flags.some(f => f.id === 'combi-three-person-caution')).toBe(false);
    // bathroomCount >= 2 is now a hard fail
    expect(result.verdict.combiRisk).toBe('fail');
  });

  // ── morningOverlapProbability ─────────────────────────────────────────────

  it('morningOverlapProbability is null when occupancyCount is not provided', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1 });
    expect(result.morningOverlapProbability).toBeNull();
  });

  it('morningOverlapProbability is 0 for a single-person household', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 1 });
    expect(result.morningOverlapProbability).toBe(0);
  });

  it('morningOverlapProbability is > 0 for multi-person households', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 3 });
    expect(result.morningOverlapProbability).toBeGreaterThan(0);
  });

  it('morningOverlapProbability increases with household size', () => {
    const r2 = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 2 });
    const r4 = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 4 });
    expect(r4.morningOverlapProbability!).toBeGreaterThan(r2.morningOverlapProbability!);
  });

  it('morningOverlapProbability is higher with 2 bathrooms vs 1 bathroom (same occupancy)', () => {
    const r1bath = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 3 });
    const r2bath = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 2, occupancyCount: 3 });
    expect(r2bath.morningOverlapProbability!).toBeGreaterThanOrEqual(r1bath.morningOverlapProbability!);
  });

  it('morningOverlapProbability is always in [0, 1]', () => {
    [1, 2, 3, 4, 5].forEach(n => {
      const r = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: n });
      if (r.morningOverlapProbability !== null) {
        expect(r.morningOverlapProbability).toBeGreaterThanOrEqual(0);
        expect(r.morningOverlapProbability).toBeLessThanOrEqual(1);
      }
    });
  });

  it('adds probability context to assumptions when occupancyCount is provided', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, occupancyCount: 3 });
    expect(result.assumptions.some(a => a.includes('Probabilistic DHW overlap'))).toBe(true);
  });
});

// ─── Rule 5: Large household tests ────────────────────────────────────────────

describe('runCombiDhwModuleV1 — large household rule', () => {
  it('adds fail for occupancyCount >= 4 with 1 bathroom and 1 outlet', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 4,
    });
    const flag = result.flags.find(f => f.id === 'combi-large-household');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('fail');
    expect(result.verdict.combiRisk).toBe('fail');
  });

  it('adds warn for occupancyCount = 7', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 7,
    });
    expect(result.flags.some(f => f.id === 'combi-large-household')).toBe(true);
  });

  it('does NOT add large-household flag when occupancyCount < 4', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 3,
    });
    expect(result.flags.some(f => f.id === 'combi-large-household')).toBe(false);
  });

  it('large-household flag is suppressed when simultaneous-demand fail already raised', () => {
    // outlets >= 2 → fail already; no need to double-warn
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      occupancyCount: 7,
    });
    expect(result.flags.some(f => f.id === 'combi-large-household')).toBe(false);
    expect(result.verdict.combiRisk).toBe('fail');
  });
});

// ─── Rule 6: Mains flow adequacy tests ───────────────────────────────────────

describe('runCombiDhwModuleV1 — mains flow adequacy rule', () => {
  it('adds warn when measured flow < 9 L/min with single outlet', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 6,
      mainsDynamicFlowLpmKnown: true,
    });
    const flag = result.flags.find(f => f.id === 'combi-flow-inadequate');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('does NOT add flow flag when measured flow >= 9 L/min (adequate)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 12,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result.flags.some(f => f.id === 'combi-flow-inadequate')).toBe(false);
  });

  it('adds assumption when mainsDynamicFlowLpm is not provided', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    expect(result.assumptions.some(a => a.includes('Mains dynamic flow not provided'))).toBe(true);
  });

  it('does NOT add flow flag when mainsDynamicFlowLpmKnown is false (estimated value)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 6,
      mainsDynamicFlowLpmKnown: false,
    });
    expect(result.flags.some(f => f.id === 'combi-flow-inadequate')).toBe(false);
  });
});

// ─── DHW flow physics (dhwRequiredKw / deliveredFlowLpm) ─────────────────────

describe('runCombiDhwModuleV1 — DHW flow physics', () => {
  it('dhwRequiredKw and deliveredFlowLpm are null when mainsDynamicFlowLpmKnown is false', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 12,
      mainsDynamicFlowLpmKnown: false,
    });
    expect(result.dhwRequiredKw).toBeNull();
    expect(result.deliveredFlowLpm).toBeNull();
    expect(result.flags.some(f => f.id === 'combi-dhw-shortfall')).toBe(false);
  });

  it('dhwRequiredKw ≈ 33.5 kW and shortfall flag raised for 12 L/min at deltaT 40°C', () => {
    // 0.0697 × 12 × 40 ≈ 33.46 kW — exceeds nominal 30 kW combi output
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 12,
      mainsDynamicFlowLpmKnown: true,
      coldWaterTempC: 10,
      combiHotOutTempC: 50, // deltaT = 40°C
    });
    expect(result.dhwRequiredKw).toBeCloseTo(33.46, 1);
    expect(result.flags.some(f => f.id === 'combi-dhw-shortfall')).toBe(true);
    expect(result.deliveredFlowLpm).not.toBeNull();
    // deliveredFlowLpm = 30 / (0.0697 × 40) ≈ 10.75 L/min
    expect(result.deliveredFlowLpm!).toBeCloseTo(10.8, 0);
  });

  it('no shortfall flag and deliveredFlowLpm equals input flow when demand is within capacity', () => {
    // 0.0697 × 5 × 40 ≈ 13.94 kW — within 30 kW combi output
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      mainsDynamicFlowLpm: 5,
      mainsDynamicFlowLpmKnown: true,
      coldWaterTempC: 10,
      combiHotOutTempC: 50, // deltaT = 40°C
    });
    expect(result.flags.some(f => f.id === 'combi-dhw-shortfall')).toBe(false);
    expect(result.deliveredFlowLpm).toBe(5);
  });
});

// ─── Regression tests for specific screenshot scenarios ───────────────────────

describe('runCombiDhwModuleV1 — scenario regressions', () => {
  it('regression #1: 7+ occupants, 1 bath, outlets=1, mainsFlow=12 → warn/fail (not pass)', () => {
    // Previously returned 'pass' (Suitable) — incorrectly
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 7,
      mainsDynamicFlowLpm: 12,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result.verdict.combiRisk).toBe('fail');
    expect(result.flags.some(f => f.id === 'combi-large-household')).toBe(true);
  });

  it('regression #1b: peakConcurrentOutlets=2 (often, 2 bath) → fail as before', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 2,
      occupancyCount: 7,
    });
    expect(result.verdict.combiRisk).toBe('fail');
  });
});

// ─── Phase 3 combi suitability domain expectations ───────────────────────────

describe('runCombiDhwModuleV1 — Phase 3 domain rule expectations', () => {
  it('occupancy 4, 1 bath, 1 outlet, professional signature → combiRisk fail', () => {
    // Occupancy >=4 triggers the large-household hard gate
    const result = runCombiDhwModuleV1({
      ...baseInput,
      occupancyCount: 4,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'professional',
    });
    expect(result.flags.some(f => f.id === 'combi-large-household')).toBe(true);
    expect(result.verdict.combiRisk).toBe('fail');
  });

  it('occupancy ≤ 2, 1 bath → combiRisk pass (single household)', () => {
    [1, 2].forEach(occupancyCount => {
      const result = runCombiDhwModuleV1({
        ...baseInput,
        occupancyCount,
        bathroomCount: 1,
        peakConcurrentOutlets: 1,
      });
      expect(result.verdict.combiRisk).toBe('pass');
    });
  });

  it('occupancy 3, 1 bath → combiRisk warn (borderline demand — three-person caution)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      occupancyCount: 3,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    expect(result.verdict.combiRisk).toBe('warn');
    expect(result.flags.some(f => f.id === 'combi-three-person-caution')).toBe(true);
  });

  it('bathroomCount >= 2 → combiRisk fail (hard simultaneous demand gate)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 1,
    });
    expect(result.verdict.combiRisk).toBe('fail');
    expect(result.flags.some(f => f.id === 'combi-simultaneous-demand')).toBe(true);
  });

  it('peakConcurrentOutlets >= 2 → combiRisk fail (hard simultaneous-demand gate)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 2,
    });
    expect(result.verdict.combiRisk).toBe('fail');
  });
});

// ─── estimateMorningOverlapProbability unit tests ─────────────────────────────

describe('estimateMorningOverlapProbability', () => {
  it('returns null when occupancyCount is undefined', () => {
    expect(estimateMorningOverlapProbability(undefined, 1)).toBeNull();
  });

  it('returns null when occupancyCount is 0', () => {
    expect(estimateMorningOverlapProbability(0, 1)).toBeNull();
  });

  it('returns 0 for a single occupant (no pairs possible)', () => {
    expect(estimateMorningOverlapProbability(1, 1)).toBe(0);
  });

  it('returns a positive probability for 2 occupants', () => {
    expect(estimateMorningOverlapProbability(2, 1)).toBeGreaterThan(0);
  });

  it('probability is bounded to [0, 0.99]', () => {
    // High occupancy + 2 bathrooms → should not exceed 0.99
    const p = estimateMorningOverlapProbability(10, 2);
    expect(p!).toBeLessThanOrEqual(0.99);
    expect(p!).toBeGreaterThanOrEqual(0);
  });

  it('2-bathroom model yields higher probability than 1-bathroom for same occupancy', () => {
    const p1 = estimateMorningOverlapProbability(3, 1);
    const p2 = estimateMorningOverlapProbability(3, 2);
    expect(p2!).toBeGreaterThanOrEqual(p1!);
  });
});

// ─── getCombiDhwRampPhase ─────────────────────────────────────────────────────

describe('getCombiDhwRampPhase', () => {
  it('returns ignition_purge at 0 s (tap just opened)', () => {
    expect(getCombiDhwRampPhase(0)).toBe('ignition_purge');
  });

  it('returns ignition_purge at 1 s (within 0–2 s window)', () => {
    expect(getCombiDhwRampPhase(1)).toBe('ignition_purge');
  });

  it('returns temperature_ramp at exactly 2 s (boundary)', () => {
    expect(getCombiDhwRampPhase(2)).toBe('temperature_ramp');
  });

  it('returns temperature_ramp at 4 s (within 2–6 s window)', () => {
    expect(getCombiDhwRampPhase(4)).toBe('temperature_ramp');
  });

  it('returns stabilising at exactly 6 s (boundary)', () => {
    expect(getCombiDhwRampPhase(6)).toBe('stabilising');
  });

  it('returns stabilising at 8 s (within 6–10 s window)', () => {
    expect(getCombiDhwRampPhase(8)).toBe('stabilising');
  });

  it('returns steady at exactly 10 s (boundary)', () => {
    expect(getCombiDhwRampPhase(10)).toBe('steady');
  });

  it('returns steady at 60 s (long draw)', () => {
    expect(getCombiDhwRampPhase(60)).toBe('steady');
  });
});

// ─── Plate HEX fouling factor tests ──────────────────────────────────────────

describe('runCombiDhwModuleV1 — plate HEX fouling factor', () => {
  it('clean plate HEX (foulingFactor=1.0) leaves maxQtoDhwKwDerated unchanged from scale derate', () => {
    const dhwDerate = 0.10;
    const clean = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 1.0 }, dhwDerate);
    // Expected: 30 * (1 - 0.10) * 1.0 = 27.0
    expect(clean.maxQtoDhwKwDerated).toBeCloseTo(27.0, 1);
  });

  it('degraded plate HEX (foulingFactor=0.8) reduces maxQtoDhwKwDerated', () => {
    const dhwDerate = 0.10;
    const degraded = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.8 }, dhwDerate);
    // Expected: 30 * (1 - 0.10) * 0.80 = 21.6
    expect(degraded.maxQtoDhwKwDerated).toBeCloseTo(21.6, 1);
  });

  it('severely fouled plate HEX (foulingFactor=0.7) applies maximum degradation', () => {
    const dhwDerate = 0.0;
    const severe = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.7 }, dhwDerate);
    // Expected: 30 * 1.0 * 0.70 = 21.0
    expect(severe.maxQtoDhwKwDerated).toBeCloseTo(21.0, 1);
  });

  it('degraded plate HEX produces lower maxQtoDhwKwDerated than clean HEX', () => {
    const derate = 0.05;
    const clean    = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 1.0 }, derate);
    const moderate = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.90 }, derate);
    const poor     = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.80 }, derate);
    const severe   = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.70 }, derate);

    expect(moderate.maxQtoDhwKwDerated).toBeLessThan(clean.maxQtoDhwKwDerated);
    expect(poor.maxQtoDhwKwDerated).toBeLessThan(moderate.maxQtoDhwKwDerated);
    expect(severe.maxQtoDhwKwDerated).toBeLessThan(poor.maxQtoDhwKwDerated);
  });

  it('fouling factor is included in result when plateHexFoulingFactor is provided', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.80 }, 0);
    expect(result.plateHexFoulingFactor).toBe(0.80);
  });

  it('plateHexConditionBand is surfaced in result when provided on input', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      plateHexFoulingFactor: 0.80,
      plateHexConditionBand: 'poor',
    }, 0);
    expect(result.plateHexConditionBand).toBe('poor');
  });

  it('plateHexFoulingFactor absent when not provided on input', () => {
    const result = runCombiDhwModuleV1({ ...baseInput }, 0);
    expect(result.plateHexFoulingFactor).toBeUndefined();
  });

  it('fouling assumption text is added when foulingFactor < 1.0', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.70 }, 0);
    const hasPlateHexAssumption = result.assumptions.some(a => a.includes('Plate HEX Fouling'));
    expect(hasPlateHexAssumption).toBe(true);
  });

  it('no fouling assumption text when foulingFactor = 1.0', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 1.0 }, 0);
    const hasPlateHexAssumption = result.assumptions.some(a => a.includes('Plate HEX Fouling'));
    expect(hasPlateHexAssumption).toBe(false);
  });

  it('combined scale derate + fouling factor: severe fouling in hard water reduces output significantly', () => {
    // Scale derate 0.20 (hard water, typical max from SludgeVsScaleModule)
    // Fouling factor 0.70 (severe)
    // Expected: 30 * (1 - 0.20) * 0.70 = 16.8 kW
    const result = runCombiDhwModuleV1({ ...baseInput, plateHexFoulingFactor: 0.70 }, 0.20);
    expect(result.maxQtoDhwKwDerated).toBeCloseTo(16.8, 1);
  });

  it('backward-compatible: no plateHexFoulingFactor on input → derate from scale only', () => {
    const withDerate = runCombiDhwModuleV1({ ...baseInput }, 0.10);
    // No fouling factor — only scale derate: 30 * (1 - 0.10) = 27.0
    expect(withDerate.maxQtoDhwKwDerated).toBeCloseTo(27.0, 1);
  });
});
