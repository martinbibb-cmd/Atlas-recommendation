/**
 * systemRegistry.test.ts
 *
 * Regression tests for the canonical system registry.
 *
 * Validates:
 *   - Mixergy is present and correctly modelled as a modifier
 *   - All engine option IDs are represented as standalone systems
 *   - Mixergy has stored DHW architecture (never on-demand)
 *   - Mixergy is compatible only with stored-water base systems
 *   - No recommendation screen omits a valid enabled standalone system
 */

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_REGISTRY,
  STANDALONE_SYSTEMS,
  MODIFIER_SYSTEMS,
  STORED_DHW_SYSTEM_IDS,
  MIXERGY_COMPATIBLE_BASE_IDS,
  MAINS_FED_CYLINDER_SYSTEM_IDS,
} from '../systemRegistry';

// Known engine OptionCardV1 IDs — must all appear in the registry as standalone systems
const ENGINE_OPTION_IDS = [
  'combi',
  'stored_vented',
  'stored_unvented',
  'regular_vented',
  'system_unvented',
  'ashp',
] as const;

describe('systemRegistry — completeness', () => {
  it('contains an entry for every engine option ID', () => {
    for (const id of ENGINE_OPTION_IDS) {
      expect(SYSTEM_REGISTRY.has(id), `Missing registry entry for engine option '${id}'`).toBe(true);
    }
  });

  it('contains an entry for mixergy', () => {
    expect(SYSTEM_REGISTRY.has('mixergy')).toBe(true);
  });

  it('all engine option IDs are standalone (non-modifier) systems', () => {
    for (const id of ENGINE_OPTION_IDS) {
      const record = SYSTEM_REGISTRY.get(id)!;
      expect(record.isModifier, `Engine option '${id}' must not be a modifier`).toBe(false);
    }
  });

  it('STANDALONE_SYSTEMS includes all engine option IDs', () => {
    const standaloneIds = STANDALONE_SYSTEMS.map(s => s.engineOptionId);
    for (const id of ENGINE_OPTION_IDS) {
      expect(standaloneIds, `STANDALONE_SYSTEMS missing engine option '${id}'`).toContain(id);
    }
  });

  it('STANDALONE_SYSTEMS does not include mixergy', () => {
    const standaloneIds = STANDALONE_SYSTEMS.map(s => s.id);
    expect(standaloneIds).not.toContain('mixergy');
  });
});

describe('systemRegistry — Mixergy modifier model', () => {
  it('Mixergy is marked as a modifier', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.isModifier).toBe(true);
  });

  it('Mixergy has stored DHW architecture — never on-demand', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.dhwArchitecture).toBe('stored_dhw');
  });

  it('Mixergy has no standalone engine option ID', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.engineOptionId).toBeUndefined();
  });

  it('Mixergy is in MODIFIER_SYSTEMS', () => {
    const ids = MODIFIER_SYSTEMS.map(m => m.id);
    expect(ids).toContain('mixergy');
  });

  it('MIXERGY_COMPATIBLE_BASE_IDS includes stored_unvented', () => {
    expect(MIXERGY_COMPATIBLE_BASE_IDS).toContain('stored_unvented');
  });

  it('MIXERGY_COMPATIBLE_BASE_IDS includes system_unvented', () => {
    expect(MIXERGY_COMPATIBLE_BASE_IDS).toContain('system_unvented');
  });

  it('MIXERGY_COMPATIBLE_BASE_IDS does not include combi', () => {
    expect(MIXERGY_COMPATIBLE_BASE_IDS).not.toContain('combi');
  });

  it('MIXERGY_COMPATIBLE_BASE_IDS does not include ashp', () => {
    // Heat pump has its own thermal store — Mixergy is not applied on top of ASHP
    expect(MIXERGY_COMPATIBLE_BASE_IDS).not.toContain('ashp');
  });

  it('Mixergy has the mixergy simulator choice ID', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.simulatorChoiceIds).toContain('mixergy');
  });

  it('Mixergy has a comparison system type ID for the Day Painter', () => {
    const mixergy = SYSTEM_REGISTRY.get('mixergy')!;
    expect(mixergy.comparisonSystemTypeId).toBe('mixergy');
  });
});

describe('systemRegistry — DHW architecture classification', () => {
  it('combi has on_demand DHW architecture', () => {
    expect(SYSTEM_REGISTRY.get('combi')!.dhwArchitecture).toBe('on_demand');
  });

  it('all stored systems have stored_dhw architecture', () => {
    const storedIds = ['stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented', 'ashp'] as const;
    for (const id of storedIds) {
      expect(SYSTEM_REGISTRY.get(id)!.dhwArchitecture, `${id} should have stored_dhw`).toBe('stored_dhw');
    }
  });

  it('STORED_DHW_SYSTEM_IDS includes all stored systems', () => {
    expect(STORED_DHW_SYSTEM_IDS).toContain('stored_vented');
    expect(STORED_DHW_SYSTEM_IDS).toContain('stored_unvented');
    expect(STORED_DHW_SYSTEM_IDS).toContain('regular_vented');
    expect(STORED_DHW_SYSTEM_IDS).toContain('system_unvented');
    expect(STORED_DHW_SYSTEM_IDS).toContain('ashp');
  });

  it('STORED_DHW_SYSTEM_IDS does not include combi', () => {
    expect(STORED_DHW_SYSTEM_IDS).not.toContain('combi');
  });

  it('STORED_DHW_SYSTEM_IDS does not include mixergy (modifier, not standalone)', () => {
    expect(STORED_DHW_SYSTEM_IDS).not.toContain('mixergy');
  });
});

describe('systemRegistry — mains-fed cylinder systems', () => {
  it('MAINS_FED_CYLINDER_SYSTEM_IDS includes stored_unvented and system_unvented', () => {
    expect(MAINS_FED_CYLINDER_SYSTEM_IDS).toContain('stored_unvented');
    expect(MAINS_FED_CYLINDER_SYSTEM_IDS).toContain('system_unvented');
  });

  it('MAINS_FED_CYLINDER_SYSTEM_IDS does not include stored_vented (tank-fed cylinder)', () => {
    expect(MAINS_FED_CYLINDER_SYSTEM_IDS).not.toContain('stored_vented');
  });
});
