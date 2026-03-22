/**
 * taxonomyParity.test.ts
 *
 * Regression tests for system taxonomy consistency across the codebase.
 *
 * Validates that:
 *   - Mixergy appears in the Day Painter comparison system types
 *   - Mixergy uses stored DHW routing (never on-demand / combi-style)
 *   - The system registry and Day Painter types are aligned
 */

import { describe, it, expect } from 'vitest';
import type { ComparisonSystemType } from '../schema/ScenarioProfileV1';
import { computeSystemHourPhysics } from '../schema/ScenarioProfileV1';
import { SYSTEM_REGISTRY } from '../../lib/system/systemRegistry';
import { computeDrawOff } from '../modules/StoredDhwModule';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return true if the value is a valid ComparisonSystemType.
 * This function exists to let us test type-level membership at runtime
 * without importing the union type directly as a value.
 */
const KNOWN_COMPARISON_TYPES: ComparisonSystemType[] = [
  'combi',
  'stored_vented',
  'stored_unvented',
  'mixergy',
  'mixergy_open_vented',
  'ashp',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('taxonomy parity — Mixergy in Day Painter comparison types', () => {
  it('mixergy is a known ComparisonSystemType', () => {
    expect(KNOWN_COMPARISON_TYPES).toContain('mixergy');
  });

  it('system registry mixergy entry has comparisonSystemTypeId = mixergy', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.comparisonSystemTypeId).toBe('mixergy');
  });

  it('all registry entries with comparisonSystemTypeId are in KNOWN_COMPARISON_TYPES', () => {
    for (const [id, record] of SYSTEM_REGISTRY.entries()) {
      if (record.comparisonSystemTypeId !== undefined) {
        expect(
          KNOWN_COMPARISON_TYPES,
          `Registry entry '${id}' has comparisonSystemTypeId='${record.comparisonSystemTypeId}' which is not in ComparisonSystemType`,
        ).toContain(record.comparisonSystemTypeId as ComparisonSystemType);
      }
    }
  });
});

describe('taxonomy parity — mixergy_open_vented is a known ComparisonSystemType', () => {
  it('mixergy_open_vented is included in KNOWN_COMPARISON_TYPES', () => {
    expect(KNOWN_COMPARISON_TYPES).toContain('mixergy_open_vented');
  });

  it('mixergy_open_vented computeSystemHourPhysics uses stored-boiler physics (same as mixergy)', () => {
    const openVented      = computeSystemHourPhysics('mixergy_open_vented', 3, 2, 12, 2.5, false, 60);
    const mixergyUnvented = computeSystemHourPhysics('mixergy',             3, 2, 12, 2.5, false, 60);
    expect(openVented.qToChKw).toBe(mixergyUnvented.qToChKw);
    expect(openVented.qToDhwKw).toBe(mixergyUnvented.qToDhwKw);
  });
});

describe('taxonomy parity — Mixergy uses stored DHW physics (not on-demand)', () => {
  it('mixergy computeSystemHourPhysics produces qToChKw not zero for CH demand', () => {
    // With CH demand and no DHW, the system should route energy to CH
    const result = computeSystemHourPhysics('mixergy', 5, 0, 12, 2.5, false, 60);
    expect(result.qToChKw).toBeGreaterThan(0);
  });

  it('mixergy computeSystemHourPhysics allows simultaneous CH and DHW', () => {
    // Stored systems serve CH and DHW simultaneously — unlike combi which pauses CH for DHW
    const resultMixergy = computeSystemHourPhysics('mixergy', 3, 3, 12, 2.5, false, 60);
    const resultCombi   = computeSystemHourPhysics('combi',   3, 3, 12, 2.5, false, 60);
    // Combi pauses CH when DHW is active
    expect(resultCombi.qToChKw).toBe(0);
    // Mixergy (stored) does not pause CH
    expect(resultMixergy.qToChKw).toBeGreaterThan(0);
  });

  it('mixergy computeSystemHourPhysics routes DHW from stored reserve, not on-demand', () => {
    // For stored systems, qToDhwKw is served from the cylinder reserve.
    // Physics model: stored boiler outputs CH + DHW simultaneously.
    const result = computeSystemHourPhysics('mixergy', 0, 4, 12, 2.5, false, 60);
    expect(result.qToDhwKw).toBeGreaterThan(0);
  });

  it('mixergy physics are consistent with stored_unvented at the hourly simulation level', () => {
    // At the hourly Day Painter level, Mixergy and stored_unvented share the
    // same physics model. The Mixergy advantage (demand mirroring, stratification)
    // is modelled in deeper engine modules, not at this level.
    const mixergy       = computeSystemHourPhysics('mixergy',       3, 2, 12, 2.5, false, 60);
    const storedUnvented = computeSystemHourPhysics('stored_unvented', 3, 2, 12, 2.5, false, 60);
    expect(mixergy.qToChKw).toBe(storedUnvented.qToChKw);
    expect(mixergy.qToDhwKw).toBe(storedUnvented.qToDhwKw);
  });
});

describe('taxonomy parity — simulator and registry alignment', () => {
  it('mixergy registry entry has simulatorChoiceIds containing mixergy', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.simulatorChoiceIds).toContain('mixergy');
  });

  it('combi registry entry has simulatorChoiceIds containing combi', () => {
    const combi = SYSTEM_REGISTRY.get('combi')!;
    expect(combi.simulatorChoiceIds).toContain('combi');
  });

  it('stored_vented registry entry has simulatorChoiceIds containing open_vented', () => {
    const storedVented = SYSTEM_REGISTRY.get('stored_vented')!;
    expect(storedVented.simulatorChoiceIds).toContain('open_vented');
  });

  it('stored_unvented registry entry has simulatorChoiceIds containing unvented', () => {
    const storedUnvented = SYSTEM_REGISTRY.get('stored_unvented')!;
    expect(storedUnvented.simulatorChoiceIds).toContain('unvented');
  });
});

// ─── Draw-off micro-behaviour: mains-fed vs tank-fed must diverge ─────────────

describe('draw-off micro-behaviour — mixergy vs mixergy_open_vented must diverge', () => {
  it('maxPressureBar is always higher for mains-fed (mixergy) than tank-fed (mixergy_open_vented)', () => {
    // Mains-fed: delivery pressure = mains dynamic pressure (~2.5 bar typical).
    // Tank-fed:  delivery pressure = gravity head × 0.0981 bar/m (~0.039 bar at 0.4 m head).
    // These must NEVER be equal — the hydraulic supply source is fundamentally different.
    const uv = computeDrawOff('mixergy',              2.5, 20,        undefined);
    const ov = computeDrawOff('mixergy_open_vented',  undefined, undefined, 0.4);
    expect(uv.maxPressureBar).not.toBe(ov.maxPressureBar);
    // Mains-fed pressure must be substantially higher than gravity head
    expect(uv.maxPressureBar).toBeGreaterThan(ov.maxPressureBar);
  });

  it('flowStability diverges between adequate mains-fed and borderline tank-fed head', () => {
    // Adequate mains (20 L/min ≥ 18 L/min threshold) → 'stable'
    // Borderline gravity head (0.4 m < 0.5 m adequate threshold) → 'marginal'
    const uv = computeDrawOff('mixergy',              2.5, 20,        undefined);
    const ov = computeDrawOff('mixergy_open_vented',  undefined, undefined, 0.4);
    expect(uv.flowStability).not.toBe(ov.flowStability);
    expect(uv.flowStability).toBe('stable');
    expect(ov.flowStability).toBe('marginal');
  });

  it('maxPressureBar for mixergy_open_vented equals head × 0.0981 bar/m', () => {
    // Assert the physics formula is correctly applied: each metre of head ≈ 0.0981 bar.
    const ov1 = computeDrawOff('mixergy_open_vented', undefined, undefined, 1.0);
    const ov2 = computeDrawOff('mixergy_open_vented', undefined, undefined, 2.0);
    expect(ov1.maxPressureBar).toBeCloseTo(0.0981, 3);
    expect(ov2.maxPressureBar).toBeCloseTo(0.1962, 3);
  });

  it('mixergy (mains-fed) maxPressureBar equals provided mains dynamic pressure', () => {
    const uv = computeDrawOff('mixergy', 3.0, 22);
    expect(uv.maxPressureBar).toBe(3.0);
    expect(uv.flowStability).toBe('stable');
  });

  it('mixergy_open_vented with very low head (< 0.3 m) is flow-limited', () => {
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 0.2);
    expect(ov.flowStability).toBe('limited');
  });

  it('mixergy with low mains flow (< 12 L/min) is flow-limited', () => {
    const uv = computeDrawOff('mixergy', 1.5, 10);
    expect(uv.flowStability).toBe('limited');
  });

  it('stored_vented and mixergy_open_vented share tank-fed physics (both head-governed)', () => {
    // Both tank-fed archetypes use gravity head for pressure and stability.
    const sv = computeDrawOff('stored_vented',       undefined, undefined, 1.0);
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 1.0);
    expect(sv.maxPressureBar).toBe(ov.maxPressureBar);
    expect(sv.flowStability).toBe(ov.flowStability);
  });

  it('stored_unvented and mixergy share mains-fed physics (both mains-governed)', () => {
    // Both mains-fed archetypes use mains pressure for delivery and flow stability.
    const su = computeDrawOff('stored_unvented', 2.5, 20);
    const uv = computeDrawOff('mixergy',         2.5, 20);
    expect(su.maxPressureBar).toBe(uv.maxPressureBar);
    expect(su.flowStability).toBe(uv.flowStability);
  });
});

// ─── Vented flow cap: head also limits achievable flow (flow ∝ √head) ──────────

describe('draw-off micro-behaviour — vented flow cap scales with √head', () => {
  it('ventedMaxFlowLpm is present for tank-fed systems and absent for mains-fed', () => {
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 1.0);
    const uv = computeDrawOff('mixergy',             2.5, 20, undefined);
    expect(ov.ventedMaxFlowLpm).toBeDefined();
    expect(uv.ventedMaxFlowLpm).toBeUndefined();
  });

  it('ventedMaxFlowLpm at nominal head (1.0 m) equals VENTED_BASE_FLOW_LPM (10 L/min)', () => {
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 1.0);
    expect(ov.ventedMaxFlowLpm).toBeCloseTo(10, 1);
  });

  it('ventedMaxFlowLpm scales as √head: doubling head gives √2 × flow', () => {
    const ov1 = computeDrawOff('stored_vented', undefined, undefined, 1.0);
    const ov2 = computeDrawOff('stored_vented', undefined, undefined, 4.0);
    // flow ∝ √head  →  at 4 m head, flow = 10 × √4 = 20 L/min (2×, not 4×)
    expect(ov2.ventedMaxFlowLpm!).toBeCloseTo(ov1.ventedMaxFlowLpm! * 2, 1);
  });

  it('ventedMaxFlowLpm at 0.4 m head is significantly below 10 L/min', () => {
    // 0.4 m head → 10 × √(0.4/1.0) ≈ 6.32 L/min — well below mains-fed delivery
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 0.4);
    expect(ov.ventedMaxFlowLpm).toBeCloseTo(6.32, 1);
    expect(ov.ventedMaxFlowLpm!).toBeLessThan(10);
  });

  it('ventedMaxFlowLpm at borderline head (0.3 m) is substantially reduced', () => {
    // 0.3 m → 10 × √0.3 ≈ 5.48 L/min — confirms flow collapse at very low head
    const ov = computeDrawOff('stored_vented', undefined, undefined, 0.3);
    expect(ov.ventedMaxFlowLpm!).toBeCloseTo(5.48, 1);
  });

  it('stored_vented and mixergy_open_vented return identical ventedMaxFlowLpm at same head', () => {
    const sv = computeDrawOff('stored_vented',       undefined, undefined, 0.8);
    const ov = computeDrawOff('mixergy_open_vented', undefined, undefined, 0.8);
    expect(sv.ventedMaxFlowLpm).toBe(ov.ventedMaxFlowLpm);
  });
});
