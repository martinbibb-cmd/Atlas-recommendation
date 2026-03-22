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
