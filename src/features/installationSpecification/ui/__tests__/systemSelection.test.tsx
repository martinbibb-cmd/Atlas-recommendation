/**
 * systemSelection.test.tsx
 *
 * Unit tests for the installation specification UI type helper functions
 * exported from installationSpecificationUiTypes.ts.
 *
 * These tests verify the mapping/predicate functions in isolation, without
 * rendering any React components.
 *
 * Coverage:
 *   1.  heatSourceToFamily — maps all known labels to the correct QuoteSystemFamily.
 *   2.  isBoilerHeatSource — returns true for boiler types, false otherwise.
 *   3.  isCombiHeatSource — returns true only for combi/storage_combi.
 *   4.  isProposedCombi — returns true only for proposed combi/storage_combi.
 *   5.  isGasBoilerProposedHeatSource — returns true for gas boiler families.
 *   6.  currentHeatSourceToKind — maps UI labels to HeatSourceKindV1 values.
 *   7.  proposedHeatSourceToKind — maps UI labels to HeatSourceKindV1 values.
 *   8.  currentHotWaterToKind — maps UI labels to HotWaterKindV1 values.
 *   9.  proposedHotWaterToKind — maps UI labels to HotWaterKindV1 values.
 */

import { describe, it, expect } from 'vitest';
import {
  heatSourceToFamily,
  isBoilerHeatSource,
  isCombiHeatSource,
  isProposedCombi,
  isGasBoilerProposedHeatSource,
  currentHeatSourceToKind,
  proposedHeatSourceToKind,
  currentHotWaterToKind,
  proposedHotWaterToKind,
} from '../installationSpecificationUiTypes';
import type {
  UiCurrentHeatSourceLabel,
  UiProposedHeatSourceLabel,
  UiCurrentHotWaterLabel,
  UiProposedHotWaterLabel,
} from '../installationSpecificationUiTypes';

// ─── 1. heatSourceToFamily ────────────────────────────────────────────────────

describe('heatSourceToFamily — current heat source labels', () => {
  it('combi_boiler → combi', () => {
    expect(heatSourceToFamily('combi_boiler')).toBe('combi');
  });

  it('storage_combi → system_stored', () => {
    expect(heatSourceToFamily('storage_combi')).toBe('system_stored');
  });

  it('system_boiler → system_stored', () => {
    expect(heatSourceToFamily('system_boiler')).toBe('system_stored');
  });

  it('regular_boiler → regular_stored', () => {
    expect(heatSourceToFamily('regular_boiler')).toBe('regular_stored');
  });

  it('heat_pump → heat_pump', () => {
    expect(heatSourceToFamily('heat_pump')).toBe('heat_pump');
  });

  it('warm_air → unknown', () => {
    expect(heatSourceToFamily('warm_air')).toBe('unknown');
  });

  it('back_boiler → unknown', () => {
    expect(heatSourceToFamily('back_boiler')).toBe('unknown');
  });

  it('direct_electric → unknown', () => {
    expect(heatSourceToFamily('direct_electric')).toBe('unknown');
  });

  it('other_heat_source → unknown', () => {
    expect(heatSourceToFamily('other_heat_source')).toBe('unknown');
  });

  it('none → unknown', () => {
    expect(heatSourceToFamily('none')).toBe('unknown');
  });
});

describe('heatSourceToFamily — proposed heat source labels', () => {
  it('combi_boiler → combi', () => {
    expect(heatSourceToFamily('combi_boiler')).toBe('combi');
  });

  it('system_boiler → system_stored', () => {
    expect(heatSourceToFamily('system_boiler')).toBe('system_stored');
  });

  it('regular_boiler → regular_stored', () => {
    expect(heatSourceToFamily('regular_boiler')).toBe('regular_stored');
  });

  it('heat_pump → heat_pump', () => {
    expect(heatSourceToFamily('heat_pump')).toBe('heat_pump');
  });

  it('other_approved → unknown', () => {
    expect(heatSourceToFamily('other_approved')).toBe('unknown');
  });
});

// ─── 2. isBoilerHeatSource ────────────────────────────────────────────────────

describe('isBoilerHeatSource', () => {
  const trueLabels: UiCurrentHeatSourceLabel[] = [
    'combi_boiler',
    'regular_boiler',
    'system_boiler',
    'storage_combi',
    'back_boiler',
  ];
  const falseLabels: UiCurrentHeatSourceLabel[] = [
    'heat_pump',
    'warm_air',
    'direct_electric',
    'other_heat_source',
    'none',
  ];

  trueLabels.forEach((label) => {
    it(`returns true for "${label}"`, () => {
      expect(isBoilerHeatSource(label)).toBe(true);
    });
  });

  falseLabels.forEach((label) => {
    it(`returns false for "${label}"`, () => {
      expect(isBoilerHeatSource(label)).toBe(false);
    });
  });
});

// ─── 3. isCombiHeatSource ─────────────────────────────────────────────────────

describe('isCombiHeatSource', () => {
  it('returns true for combi_boiler', () => {
    expect(isCombiHeatSource('combi_boiler')).toBe(true);
  });

  it('returns true for storage_combi', () => {
    expect(isCombiHeatSource('storage_combi')).toBe(true);
  });

  it('returns false for regular_boiler', () => {
    expect(isCombiHeatSource('regular_boiler')).toBe(false);
  });

  it('returns false for system_boiler', () => {
    expect(isCombiHeatSource('system_boiler')).toBe(false);
  });

  it('returns false for heat_pump', () => {
    expect(isCombiHeatSource('heat_pump')).toBe(false);
  });

  it('returns false for none', () => {
    expect(isCombiHeatSource('none')).toBe(false);
  });
});

// ─── 4. isProposedCombi ───────────────────────────────────────────────────────

describe('isProposedCombi', () => {
  it('returns true for combi_boiler', () => {
    expect(isProposedCombi('combi_boiler')).toBe(true);
  });

  it('returns true for storage_combi', () => {
    expect(isProposedCombi('storage_combi')).toBe(true);
  });

  it('returns false for system_boiler', () => {
    expect(isProposedCombi('system_boiler')).toBe(false);
  });

  it('returns false for regular_boiler', () => {
    expect(isProposedCombi('regular_boiler')).toBe(false);
  });

  it('returns false for heat_pump', () => {
    expect(isProposedCombi('heat_pump')).toBe(false);
  });

  it('returns false for other_approved', () => {
    expect(isProposedCombi('other_approved')).toBe(false);
  });
});

// ─── 5. isGasBoilerProposedHeatSource ─────────────────────────────────────────

describe('isGasBoilerProposedHeatSource', () => {
  const trueLabels: UiProposedHeatSourceLabel[] = [
    'combi_boiler',
    'regular_boiler',
    'system_boiler',
    'storage_combi',
  ];
  const falseLabels: UiProposedHeatSourceLabel[] = [
    'heat_pump',
    'other_approved',
  ];

  trueLabels.forEach((label) => {
    it(`returns true for "${label}"`, () => {
      expect(isGasBoilerProposedHeatSource(label)).toBe(true);
    });
  });

  falseLabels.forEach((label) => {
    it(`returns false for "${label}"`, () => {
      expect(isGasBoilerProposedHeatSource(label)).toBe(false);
    });
  });
});

// ─── 6. currentHeatSourceToKind ──────────────────────────────────────────────

describe('currentHeatSourceToKind', () => {
  it('maps combi_boiler to combi_boiler kind', () => {
    expect(currentHeatSourceToKind('combi_boiler')).toBe('combi_boiler');
  });

  it('maps regular_boiler to regular_boiler kind', () => {
    expect(currentHeatSourceToKind('regular_boiler')).toBe('regular_boiler');
  });

  it('maps system_boiler to system_boiler kind', () => {
    expect(currentHeatSourceToKind('system_boiler')).toBe('system_boiler');
  });

  it('maps storage_combi to storage_combi kind', () => {
    expect(currentHeatSourceToKind('storage_combi')).toBe('storage_combi');
  });

  it('maps heat_pump to heat_pump kind', () => {
    expect(currentHeatSourceToKind('heat_pump')).toBe('heat_pump');
  });

  it('maps warm_air to warm_air kind', () => {
    expect(currentHeatSourceToKind('warm_air')).toBe('warm_air');
  });

  it('maps back_boiler to back_boiler kind', () => {
    expect(currentHeatSourceToKind('back_boiler')).toBe('back_boiler');
  });

  it('maps direct_electric to direct_electric kind', () => {
    expect(currentHeatSourceToKind('direct_electric')).toBe('direct_electric');
  });

  it('maps other_heat_source to other kind', () => {
    expect(currentHeatSourceToKind('other_heat_source')).toBe('other');
  });

  it('maps none to none kind', () => {
    expect(currentHeatSourceToKind('none')).toBe('none');
  });
});

// ─── 7. proposedHeatSourceToKind ─────────────────────────────────────────────

describe('proposedHeatSourceToKind', () => {
  it('maps combi_boiler to combi_boiler kind', () => {
    expect(proposedHeatSourceToKind('combi_boiler')).toBe('combi_boiler');
  });

  it('maps regular_boiler to regular_boiler kind', () => {
    expect(proposedHeatSourceToKind('regular_boiler')).toBe('regular_boiler');
  });

  it('maps system_boiler to system_boiler kind', () => {
    expect(proposedHeatSourceToKind('system_boiler')).toBe('system_boiler');
  });

  it('maps storage_combi to storage_combi kind', () => {
    expect(proposedHeatSourceToKind('storage_combi')).toBe('storage_combi');
  });

  it('maps heat_pump to heat_pump kind', () => {
    expect(proposedHeatSourceToKind('heat_pump')).toBe('heat_pump');
  });

  it('maps other_approved to other kind', () => {
    expect(proposedHeatSourceToKind('other_approved')).toBe('other');
  });
});

// ─── 8. currentHotWaterToKind ─────────────────────────────────────────────────

describe('currentHotWaterToKind', () => {
  const cases: Array<[UiCurrentHotWaterLabel, string]> = [
    ['no_cylinder',            'none'],
    ['vented_cylinder',        'vented_cylinder'],
    ['unvented_cylinder',      'unvented_cylinder'],
    ['thermal_store',          'thermal_store'],
    ['mixergy_or_stratified',  'mixergy_or_stratified'],
    ['integrated_store',       'integrated_store'],
    ['other_hot_water',        'other'],
  ];

  cases.forEach(([input, expected]) => {
    it(`maps ${input} to ${expected}`, () => {
      expect(currentHotWaterToKind(input)).toBe(expected);
    });
  });
});

// ─── 9. proposedHotWaterToKind ────────────────────────────────────────────────

describe('proposedHotWaterToKind', () => {
  const cases: Array<[UiProposedHotWaterLabel, string]> = [
    ['retain_existing',        'existing_retained'],
    ['vented_cylinder',        'vented_cylinder'],
    ['unvented_cylinder',      'unvented_cylinder'],
    ['mixergy_or_stratified',  'mixergy_or_stratified'],
    ['thermal_store',          'thermal_store'],
    ['heat_pump_cylinder',     'heat_pump_cylinder'],
    ['no_stored_hot_water',    'none'],
  ];

  cases.forEach(([input, expected]) => {
    it(`maps ${input} to ${expected}`, () => {
      expect(proposedHotWaterToKind(input)).toBe(expected);
    });
  });
});
