/**
 * getMissingLabFields.test.ts
 *
 * Validates the helper that identifies which simulation-critical fields are
 * absent from a partial engine input.
 */

import { describe, it, expect } from 'vitest';
import { getMissingLabFields } from '../getMissingLabFields';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid engine input with all quick-form fields present. */
const COMPLETE_INPUT: Partial<EngineInputV2_3> = {
  currentHeatSourceType: 'combi',
  bathroomCount: 1,
  occupancyCount: 2,
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 18,
  primaryPipeDiameter: 22,
  systemPlanType: 'y_plan',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getMissingLabFields', () => {
  it('returns an empty array when all quick fields are present', () => {
    const result = getMissingLabFields(COMPLETE_INPUT);
    expect(result).toHaveLength(0);
  });

  it('returns all fields when input is empty', () => {
    const result = getMissingLabFields({});
    const ids = result.map(f => f.id);
    expect(ids).toContain('systemType');
    expect(ids).toContain('bathroomCount');
    expect(ids).toContain('occupancyCount');
    expect(ids).toContain('mainsPerformance');
    expect(ids).toContain('primaryPipeSize');
    expect(ids).toContain('planType');
    expect(result.length).toBe(6);
  });

  it('flags systemType when currentHeatSourceType is absent', () => {
    const input = { ...COMPLETE_INPUT, currentHeatSourceType: undefined };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('systemType');
  });

  it('does NOT flag systemType when currentHeatSourceType is set', () => {
    const ids = getMissingLabFields(COMPLETE_INPUT).map(f => f.id);
    expect(ids).not.toContain('systemType');
  });

  it('flags bathroomCount when absent', () => {
    const input = { ...COMPLETE_INPUT, bathroomCount: undefined };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('bathroomCount');
  });

  it('flags bathroomCount when 0 (invalid)', () => {
    const input = { ...COMPLETE_INPUT, bathroomCount: 0 };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('bathroomCount');
  });

  it('does NOT flag bathroomCount when set to 1 or more', () => {
    const ids = getMissingLabFields({ ...COMPLETE_INPUT, bathroomCount: 2 }).map(f => f.id);
    expect(ids).not.toContain('bathroomCount');
  });

  it('flags occupancyCount when absent', () => {
    const input = { ...COMPLETE_INPUT, occupancyCount: undefined };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('occupancyCount');
  });

  it('flags mainsPerformance when both pressure and flow are absent', () => {
    const input = {
      ...COMPLETE_INPUT,
      dynamicMainsPressure: undefined,
      mainsDynamicFlowLpm: undefined,
    };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('mainsPerformance');
  });

  it('does NOT flag mainsPerformance when dynamicMainsPressure > 0', () => {
    const ids = getMissingLabFields({ ...COMPLETE_INPUT, mainsDynamicFlowLpm: undefined }).map(f => f.id);
    expect(ids).not.toContain('mainsPerformance');
  });

  it('does NOT flag mainsPerformance when mainsDynamicFlowLpm > 0', () => {
    const ids = getMissingLabFields({ ...COMPLETE_INPUT, dynamicMainsPressure: undefined }).map(f => f.id);
    expect(ids).not.toContain('mainsPerformance');
  });

  it('flags primaryPipeSize when absent', () => {
    const input = { ...COMPLETE_INPUT, primaryPipeDiameter: undefined };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('primaryPipeSize');
  });

  it('flags planType when systemPlanType is absent', () => {
    const input = { ...COMPLETE_INPUT, systemPlanType: undefined };
    const ids = getMissingLabFields(input).map(f => f.id);
    expect(ids).toContain('planType');
  });

  it('does NOT flag planType when systemPlanType is set', () => {
    const ids = getMissingLabFields({ ...COMPLETE_INPUT, systemPlanType: 's_plan' }).map(f => f.id);
    expect(ids).not.toContain('planType');
  });

  it('returns correct label strings', () => {
    const result = getMissingLabFields({});
    const labelMap = Object.fromEntries(result.map(f => [f.id, f.label]));
    expect(labelMap['systemType']).toBe('System type');
    expect(labelMap['bathroomCount']).toBe('Bathrooms');
    expect(labelMap['occupancyCount']).toBe('Occupancy');
    expect(labelMap['mainsPerformance']).toBe('Mains performance');
    expect(labelMap['primaryPipeSize']).toBe('Primary pipe');
    expect(labelMap['planType']).toBe('Heating layout');
  });
});
