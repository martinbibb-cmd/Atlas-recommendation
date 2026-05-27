/**
 * systemBuilderToConceptModel.test.ts
 *
 * Unit tests for the systemBuilderToConceptModel converter.
 * Validates that every SystemBuilderState combination maps to the correct
 * SystemConceptModel layers (heat source, controls, DHW, emitters).
 */

import { describe, it, expect } from 'vitest';
import { systemBuilderToConceptModel } from '../systemBuilderToConceptModel';
import type { SystemBuilderState } from '../../../../features/survey/systemBuilder/systemBuilderTypes';
import { INITIAL_SYSTEM_BUILDER_STATE } from '../../../../features/survey/systemBuilder/systemBuilderTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function state(overrides: Partial<SystemBuilderState>): SystemBuilderState {
  return { ...INITIAL_SYSTEM_BUILDER_STATE, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('systemBuilderToConceptModel — heat source mapping', () => {
  it('maps regular to regular_boiler', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'regular', dhwType: 'open_vented' }));
    expect(result.heatSource).toBe('regular_boiler');
  });

  it('maps system to system_boiler', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'unvented' }));
    expect(result.heatSource).toBe('system_boiler');
  });

  it('maps combi to system_boiler (combi is a system_boiler + plate HEX)', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'combi' }));
    expect(result.heatSource).toBe('system_boiler');
    expect(result.hotWaterService).toBe('combi_plate_hex');
  });

  it('maps storage_combi to system_boiler with storage_combi hot water service', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'storage_combi' }));
    expect(result.heatSource).toBe('system_boiler');
    expect(result.hotWaterService).toBe('storage_combi');
  });

  it('falls back to system_boiler for null heatSource', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: null }));
    expect(result.heatSource).toBe('system_boiler');
  });
});

describe('systemBuilderToConceptModel — DHW type mapping', () => {
  it('maps open_vented to vented_cylinder', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'regular', dhwType: 'open_vented' }));
    expect(result.hotWaterService).toBe('vented_cylinder');
  });

  it('maps unvented to unvented_cylinder', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'unvented' }));
    expect(result.hotWaterService).toBe('unvented_cylinder');
  });

  it('maps thermal_store to thermal_store hot water service', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'thermal_store' }));
    expect(result.hotWaterService).toBe('thermal_store');
  });

  it('maps plate_hex to combi_plate_hex', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'plate_hex' }));
    expect(result.hotWaterService).toBe('combi_plate_hex');
  });

  it('maps small_store to unvented_cylinder', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'small_store' }));
    expect(result.hotWaterService).toBe('unvented_cylinder');
  });

  it('combi overrides dhwType and always produces combi_plate_hex', () => {
    // Even if a dhwType is selected alongside combi, the heat source wins
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'combi', dhwType: 'unvented' }),
    );
    expect(result.hotWaterService).toBe('combi_plate_hex');
  });
});

describe('systemBuilderToConceptModel — controls topology mapping', () => {
  it('maps y_plan to y_plan', () => {
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'regular', dhwType: 'open_vented', controlFamily: 'y_plan' }),
    );
    expect(result.controls).toBe('y_plan');
  });

  it('maps s_plan to s_plan', () => {
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'system', dhwType: 'unvented', controlFamily: 's_plan' }),
    );
    expect(result.controls).toBe('s_plan');
  });

  it('maps s_plan_plus to s_plan_multi_zone', () => {
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'system', dhwType: 'unvented', controlFamily: 's_plan_plus' }),
    );
    expect(result.controls).toBe('s_plan_multi_zone');
  });

  it('maps combi_integral to none', () => {
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'system', dhwType: 'plate_hex', controlFamily: 'combi_integral' }),
    );
    expect(result.controls).toBe('none');
  });

  it('combi always produces controls: none regardless of controlFamily', () => {
    const result = systemBuilderToConceptModel(
      state({ heatSource: 'combi', controlFamily: 'y_plan' }),
    );
    expect(result.controls).toBe('none');
  });
});

describe('systemBuilderToConceptModel — emitters mapping', () => {
  it('maps radiators_standard to ["radiators"]', () => {
    const result = systemBuilderToConceptModel(state({ emitters: 'radiators_standard' }));
    expect(result.emitters).toEqual(['radiators']);
  });

  it('maps radiators_designer to ["radiators"]', () => {
    const result = systemBuilderToConceptModel(state({ emitters: 'radiators_designer' }));
    expect(result.emitters).toEqual(['radiators']);
  });

  it('maps underfloor to ["ufh"]', () => {
    const result = systemBuilderToConceptModel(state({ emitters: 'underfloor' }));
    expect(result.emitters).toEqual(['ufh']);
  });

  it('maps mixed to ["mixed"]', () => {
    const result = systemBuilderToConceptModel(state({ emitters: 'mixed' }));
    expect(result.emitters).toEqual(['mixed']);
  });

  it('falls back to radiators for null emitters', () => {
    const result = systemBuilderToConceptModel(state({ emitters: null }));
    expect(result.emitters).toEqual(['radiators']);
  });
});

describe('systemBuilderToConceptModel — traits', () => {
  it('regular_boiler has no integrated pump or expansion', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'regular', dhwType: 'open_vented' }));
    expect(result.traits?.integratedPump).toBe(false);
    expect(result.traits?.integratedExpansion).toBe(false);
    expect(result.traits?.integratedPlateHex).toBe(false);
  });

  it('system_boiler has integrated pump and expansion', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'system', dhwType: 'unvented' }));
    expect(result.traits?.integratedPump).toBe(true);
    expect(result.traits?.integratedExpansion).toBe(true);
    expect(result.traits?.integratedPlateHex).toBe(false);
  });

  it('combi has integrated plate HEX', () => {
    const result = systemBuilderToConceptModel(state({ heatSource: 'combi' }));
    expect(result.traits?.integratedPlateHex).toBe(true);
  });
});
