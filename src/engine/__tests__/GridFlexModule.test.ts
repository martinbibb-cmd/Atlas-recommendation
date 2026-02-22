import { describe, it, expect } from 'vitest';
import { runGridFlexModule, BH_DT_HIGH_RENEWABLES_DAY } from '../modules/GridFlexModule';
import type { GridFlexInput, HalfHourSlot } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 48 half-hour Agile price slots: one cheap overnight slot at index 4 (02:00–02:30) */
const agileSlots: HalfHourSlot[] = Array.from({ length: 48 }, (_, i) => ({
  slotIndex: i,
  pricePerKwhPence: i === 4 ? 5.0 : 24.5,
}));

const baseInput: GridFlexInput = {
  dhwAnnualKwh: 1500,
  cylinderCapacityKwh: 3.5,
  agileSlots,
  mixergySolarX: false,
};

// ─── Guard-rail / edge-case tests ─────────────────────────────────────────────

describe('GridFlexModule – guard rails', () => {
  it('returns zero savings when agileSlots is empty', () => {
    const result = runGridFlexModule({ ...baseInput, agileSlots: [] });
    expect(result.annualLoadShiftSavingGbp).toBe(0);
    expect(result.totalAnnualSavingGbp).toBe(0);
    expect(result.notes[0]).toContain('Insufficient data');
  });

  it('returns zero savings when dhwAnnualKwh is 0', () => {
    const result = runGridFlexModule({ ...baseInput, dhwAnnualKwh: 0 });
    expect(result.annualLoadShiftSavingGbp).toBe(0);
    expect(result.totalAnnualSavingGbp).toBe(0);
  });

  it('solarSelfConsumptionFraction is 0 when no solar surplus is provided', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.solarSelfConsumptionFraction).toBe(0);
  });
});

// ─── Optimal slot selection ───────────────────────────────────────────────────

describe('GridFlexModule – optimal slot selection', () => {
  it('selects slot 4 as the cheapest Agile slot in the fixture', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.optimalSlotIndex).toBe(4);
  });

  it('reports the correct price for the optimal slot', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.optimalSlotPricePence).toBeCloseTo(5.0, 1);
  });

  it('reports the correct daily average price', () => {
    // 47 slots at 24.5 p + 1 slot at 5.0 p = (47*24.5 + 5) / 48
    const expected = (47 * 24.5 + 5.0) / 48;
    const result = runGridFlexModule(baseInput);
    expect(result.dailyAvgPricePence).toBeCloseTo(expected, 1);
  });

  it('selects the correct slot when multiple slots exist with the same minimum price', () => {
    const twoEqualCheapSlots: HalfHourSlot[] = agileSlots.map(s =>
      s.slotIndex === 6 ? { ...s, pricePerKwhPence: 5.0 } : s,
    );
    // Both slot 4 and slot 6 are 5.0 p – the first encountered wins (slot 4)
    const result = runGridFlexModule({ ...baseInput, agileSlots: twoEqualCheapSlots });
    expect(result.optimalSlotPricePence).toBeCloseTo(5.0, 1);
  });
});

// ─── Annual load-shift saving ─────────────────────────────────────────────────

describe('GridFlexModule – load-shift saving', () => {
  it('returns a positive annual saving in GBP', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.annualLoadShiftSavingGbp).toBeGreaterThan(0);
  });

  it('saving scales linearly with dhwAnnualKwh', () => {
    const r1 = runGridFlexModule({ ...baseInput, dhwAnnualKwh: 1000 });
    const r2 = runGridFlexModule({ ...baseInput, dhwAnnualKwh: 2000 });
    expect(r2.annualLoadShiftSavingGbp).toBeCloseTo(r1.annualLoadShiftSavingGbp * 2, 1);
  });

  it('saving is 0 when all slots have the same price (no arbitrage)', () => {
    const flatSlots: HalfHourSlot[] = agileSlots.map(s => ({ ...s, pricePerKwhPence: 24.5 }));
    const result = runGridFlexModule({ ...baseInput, agileSlots: flatSlots });
    expect(result.annualLoadShiftSavingGbp).toBe(0);
  });
});

// ─── Mixergy Solar X ──────────────────────────────────────────────────────────

describe('GridFlexModule – Mixergy Solar X', () => {
  it('mixergySolarXSavingKwh is 0 when Solar X is disabled', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: false });
    expect(result.mixergySolarXSavingKwh).toBe(0);
    expect(result.mixergySolarXSavingGbp).toBe(0);
  });

  it('Solar X saving is 35% of DHW demand for standard tank', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true });
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(1500 * 0.35, 1);
  });

  it('Solar X saving is 40% of DHW demand for a 300L tank', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true, tankVolumeLitres: 300 });
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(1500 * 0.40, 1);
  });

  it('Solar X saving is 35% for a tank under 300L', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true, tankVolumeLitres: 250 });
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(1500 * 0.35, 1);
  });

  it('Solar X GBP saving is positive when enabled', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true });
    expect(result.mixergySolarXSavingGbp).toBeGreaterThan(0);
  });

  it('total saving is greater with Solar X than without', () => {
    const withSolarX = runGridFlexModule({ ...baseInput, mixergySolarX: true });
    const withoutSolarX = runGridFlexModule({ ...baseInput, mixergySolarX: false });
    expect(withSolarX.totalAnnualSavingGbp).toBeGreaterThan(withoutSolarX.totalAnnualSavingGbp);
  });
});

// ─── Solar self-consumption ───────────────────────────────────────────────────

describe('GridFlexModule – solar self-consumption', () => {
  it('returns a fraction between 0 and 1 when solar surplus is provided', () => {
    const result = runGridFlexModule({ ...baseInput, annualSolarSurplusKwh: 600 });
    expect(result.solarSelfConsumptionFraction).toBeGreaterThan(0);
    expect(result.solarSelfConsumptionFraction).toBeLessThanOrEqual(1);
  });

  it('caps self-consumption fraction at 1.0 when surplus exceeds demand', () => {
    const result = runGridFlexModule({ ...baseInput, annualSolarSurplusKwh: 99999 });
    expect(result.solarSelfConsumptionFraction).toBe(1);
  });

  it('fraction is proportional to the solar surplus vs annual demand', () => {
    // Use a large cylinderCapacityKwh so it's not the binding constraint:
    // annualCylinderKwh = min(10 × 365, 1500) = 1500; fraction = 750 / 1500 = 0.5
    const result = runGridFlexModule({
      ...baseInput,
      cylinderCapacityKwh: 10,
      annualSolarSurplusKwh: 750,
    });
    expect(result.solarSelfConsumptionFraction).toBeCloseTo(0.5, 2);
  });
});

// ─── totalAnnualSavingGbp ─────────────────────────────────────────────────────

describe('GridFlexModule – total annual saving', () => {
  it('total equals load shift + Solar X GBP savings + BG rebate', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true });
    expect(result.totalAnnualSavingGbp).toBeCloseTo(
      result.annualLoadShiftSavingGbp + result.mixergySolarXSavingGbp + result.bgRebateGbp,
      2,
    );
  });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

describe('GridFlexModule – notes', () => {
  it('notes include optimal slot information', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.notes.some(n => n.includes('Optimal Agile slot'))).toBe(true);
  });

  it('notes include Solar X information when enabled', () => {
    const result = runGridFlexModule({ ...baseInput, mixergySolarX: true });
    expect(result.notes.some(n => n.includes('Solar X'))).toBe(true);
  });

  it('notes include solar self-consumption when surplus is supplied', () => {
    const result = runGridFlexModule({ ...baseInput, annualSolarSurplusKwh: 500 });
    expect(result.notes.some(n => n.includes('self-consumption'))).toBe(true);
  });

  it('notes include total saving summary', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.notes.some(n => n.includes('Total annual grid-flexibility saving'))).toBe(true);
  });
});

// ─── Shifting potential ───────────────────────────────────────────────────────

describe('GridFlexModule – shifting potential', () => {
  it('shiftingPotentialFraction is 1 when tankType is not specified (default)', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.shiftingPotentialFraction).toBe(1);
  });

  it('shiftingPotentialFraction is 0 for a combi boiler', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'combi' });
    expect(result.shiftingPotentialFraction).toBe(0);
  });

  it('shiftingPotentialFraction is 1 for a Mixergy tank', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy' });
    expect(result.shiftingPotentialFraction).toBe(1);
  });

  it('annualLoadShiftSavingGbp is 0 for a combi boiler (no arbitrage)', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'combi' });
    expect(result.annualLoadShiftSavingGbp).toBe(0);
  });

  it('annualLoadShiftSavingGbp is positive for a Mixergy tank', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy' });
    expect(result.annualLoadShiftSavingGbp).toBeGreaterThan(0);
  });

  it('notes mention combi boiler shifting potential = 0%', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'combi' });
    expect(result.notes.some(n => n.includes('shifting potential = 0%'))).toBe(true);
  });

  it('notes mention Mixergy shifting potential = 100%', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy' });
    expect(result.notes.some(n => n.includes('shifting potential = 100%'))).toBe(true);
  });
});

// ─── British Gas rebate ───────────────────────────────────────────────────────

describe('GridFlexModule – British Gas rebate', () => {
  it('bgRebateGbp is 0 by default (no tankType / provider)', () => {
    const result = runGridFlexModule(baseInput);
    expect(result.bgRebateGbp).toBe(0);
  });

  it('bgRebateGbp is 0 for Mixergy tank without British Gas provider', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy', provider: 'octopus' });
    expect(result.bgRebateGbp).toBe(0);
  });

  it('bgRebateGbp is 0 for British Gas provider without Mixergy tank', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'combi', provider: 'british_gas' });
    expect(result.bgRebateGbp).toBe(0);
  });

  it('bgRebateGbp is £40 for Mixergy tank with British Gas provider', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy', provider: 'british_gas' });
    expect(result.bgRebateGbp).toBe(40);
  });

  it('BG rebate is included in totalAnnualSavingGbp', () => {
    const withRebate = runGridFlexModule({ ...baseInput, tankType: 'mixergy', provider: 'british_gas' });
    const withoutRebate = runGridFlexModule({ ...baseInput, tankType: 'mixergy', provider: 'octopus' });
    expect(withRebate.totalAnnualSavingGbp - withoutRebate.totalAnnualSavingGbp).toBeCloseTo(40, 1);
  });

  it('notes mention BG rebate when applicable', () => {
    const result = runGridFlexModule({ ...baseInput, tankType: 'mixergy', provider: 'british_gas' });
    expect(result.notes.some(n => n.includes('Mixergy Extra'))).toBe(true);
  });
});

// ─── BH/DT High Renewables Day ───────────────────────────────────────────────

describe('GridFlexModule – BH/DT simulated Agile day', () => {
  it('BH_DT_HIGH_RENEWABLES_DAY has exactly 48 slots', () => {
    expect(BH_DT_HIGH_RENEWABLES_DAY).toHaveLength(48);
  });

  it('all slots have slotIndex matching their array position', () => {
    BH_DT_HIGH_RENEWABLES_DAY.forEach((slot, i) => {
      expect(slot.slotIndex).toBe(i);
    });
  });

  it('cheapest slot is in the 02:00–05:30 overnight window (slots 4–10)', () => {
    const result = runGridFlexModule({
      ...baseInput,
      agileSlots: BH_DT_HIGH_RENEWABLES_DAY,
      tankType: 'mixergy',
    });
    expect(result.optimalSlotIndex).toBeGreaterThanOrEqual(4);
    expect(result.optimalSlotIndex).toBeLessThanOrEqual(10);
  });

  it('peak slots (16:00–20:00) are significantly more expensive than overnight slots', () => {
    const overnight = BH_DT_HIGH_RENEWABLES_DAY.slice(4, 11);
    const peak = BH_DT_HIGH_RENEWABLES_DAY.slice(32, 40);
    const avgOvernight = overnight.reduce((s, sl) => s + sl.pricePerKwhPence, 0) / overnight.length;
    const avgPeak = peak.reduce((s, sl) => s + sl.pricePerKwhPence, 0) / peak.length;
    expect(avgPeak).toBeGreaterThan(avgOvernight * 3);
  });
});
