import { describe, it, expect } from 'vitest';
import { runSoftenerWarranty } from '../modules/SoftenerWarranty';
import type { SoftenerWarrantyInput } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const veryHardNoSoftener: SoftenerWarrantyInput = {
  hasSoftener: false,
  waterHardnessCategory: 'very_hard',
  boilerCompatibility: 'wb_8000plus',
};

const veryHardWithSoftenerWb: SoftenerWarrantyInput = {
  hasSoftener: true,
  waterHardnessCategory: 'very_hard',
  boilerCompatibility: 'wb_8000plus',
};

const veryHardWithSoftenerVaillant: SoftenerWarrantyInput = {
  hasSoftener: true,
  waterHardnessCategory: 'very_hard',
  boilerCompatibility: 'vaillant',
};

const softWaterWithSoftener: SoftenerWarrantyInput = {
  hasSoftener: true,
  waterHardnessCategory: 'soft',
};

describe('SoftenerWarranty – DHW scaling tax relief', () => {
  it('clears 11% DHW scaling tax when softener is fitted in very_hard area', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.dhwScalingTaxClearedPct).toBe(11);
  });

  it('clears 11% DHW scaling tax when softener is fitted in hard area', () => {
    const result = runSoftenerWarranty({
      hasSoftener: true,
      waterHardnessCategory: 'hard',
      boilerCompatibility: 'wb_8000plus',
    });
    expect(result.dhwScalingTaxClearedPct).toBe(11);
  });

  it('dhwScalingTaxClearedPct is 0 when no softener is fitted', () => {
    const result = runSoftenerWarranty(veryHardNoSoftener);
    expect(result.dhwScalingTaxClearedPct).toBe(0);
  });

  it('dhwScalingTaxClearedPct is 0 when softener fitted but water is soft', () => {
    const result = runSoftenerWarranty(softWaterWithSoftener);
    expect(result.dhwScalingTaxClearedPct).toBe(0);
  });

  it('dhwScalingTaxClearedPct is 0 when softener fitted but water is moderate', () => {
    const result = runSoftenerWarranty({
      hasSoftener: true,
      waterHardnessCategory: 'moderate',
    });
    expect(result.dhwScalingTaxClearedPct).toBe(0);
  });
});

describe('SoftenerWarranty – WB Softener Edge', () => {
  it('wbEdgeActive is true for WB 8000+ with softener', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.wbEdgeActive).toBe(true);
  });

  it('wbEdgeActive is true when boilerCompatibility is not specified (defaults to compatible)', () => {
    const result = runSoftenerWarranty({
      hasSoftener: true,
      waterHardnessCategory: 'very_hard',
    });
    expect(result.wbEdgeActive).toBe(true);
  });

  it('wbEdgeActive is false when no softener is fitted', () => {
    const result = runSoftenerWarranty(veryHardNoSoftener);
    expect(result.wbEdgeActive).toBe(false);
  });

  it('wbEdgeActive is false for Vaillant even with a softener', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerVaillant);
    expect(result.wbEdgeActive).toBe(false);
  });

  it('emits WB Softener Edge Active note when edge is unlocked', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.notes.some(n => n.includes('WB Softener Edge Active'))).toBe(true);
  });

  it('emits a Softener Conflict warning for Vaillant with softener', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerVaillant);
    expect(result.notes.some(n => n.includes('Softener Conflict'))).toBe(true);
  });
});

describe('SoftenerWarranty – Primary Bypass Rule', () => {
  it('primaryBypassRequired is true when WB edge is active', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.primaryBypassRequired).toBe(true);
  });

  it('primaryBypassRequired is false when no softener is fitted', () => {
    const result = runSoftenerWarranty(veryHardNoSoftener);
    expect(result.primaryBypassRequired).toBe(false);
  });

  it('primaryBypassRule string contains Sentinel X100 reference when required', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.primaryBypassRule).toContain('Sentinel X100');
  });

  it('primaryBypassRule is empty string when bypass is not required', () => {
    const result = runSoftenerWarranty(veryHardNoSoftener);
    expect(result.primaryBypassRule).toBe('');
  });

  it('notes include bypass rule detail when required', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.notes.some(n => n.includes('Primary Bypass Rule'))).toBe(true);
  });
});

describe('SoftenerWarranty – notes', () => {
  it('emits a scaling tax active note when no softener and very_hard water', () => {
    const result = runSoftenerWarranty(veryHardNoSoftener);
    expect(result.notes.some(n => n.includes('DHW Scaling Tax Active'))).toBe(true);
  });

  it('emits a scaling tax cleared note when softener is fitted in hard water', () => {
    const result = runSoftenerWarranty(veryHardWithSoftenerWb);
    expect(result.notes.some(n => n.includes('DHW Scaling Tax Cleared'))).toBe(true);
  });

  it('notes array is always non-empty', () => {
    expect(runSoftenerWarranty(veryHardNoSoftener).notes.length).toBeGreaterThan(0);
    expect(runSoftenerWarranty(veryHardWithSoftenerWb).notes.length).toBeGreaterThan(0);
    expect(runSoftenerWarranty(softWaterWithSoftener).notes.length).toBeGreaterThan(0);
  });
});
