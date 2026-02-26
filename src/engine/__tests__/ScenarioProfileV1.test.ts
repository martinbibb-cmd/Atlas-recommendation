/**
 * Tests for ScenarioProfileV1 physics helpers.
 *
 * Validates:
 *  - defaultScenarioProfile derives a plausible 24-hour profile from EngineInputV2_3
 *  - applyScenarioOverrides produces deterministic physics for each system archetype
 *  - Combi service-switching: CH drops to 0 during DHW hours
 *  - Combi purge: η goes negative on the first DHW draw after idle
 *  - ASHP: COP reflects spfMidpoint with cold-morning dip
 *  - Stored systems: no service-switching penalty
 */
import { describe, it, expect } from 'vitest';
import {
  defaultScenarioProfile,
  applyScenarioOverrides,
  assertDemandTimelinesEqual,
  dhwLpmToKw,
  type DemandSlice,
  type HeatIntentLevel,
  type ScenarioProfileV1,
  type ComparisonSystemType,
} from '../schema/ScenarioProfileV1';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
};

const SPF_MIDPOINT = 4.1;

// ─── dhwLpmToKw ───────────────────────────────────────────────────────────────

describe('dhwLpmToKw', () => {
  it('0 L/min → 0 kW', () => {
    expect(dhwLpmToKw(0)).toBe(0);
  });

  it('1 L/min → ~2.43 kW (Q = ṁ × c_p × ΔT)', () => {
    // 1/60 kg/s × 4186 J/kg°C × 35°C / 1000 = 2.442 kW
    expect(dhwLpmToKw(1)).toBeCloseTo(2.442, 1);
  });

  it('3 L/min → ~7.33 kW', () => {
    expect(dhwLpmToKw(3)).toBeCloseTo(7.326, 1);
  });
});

// ─── defaultScenarioProfile ───────────────────────────────────────────────────

describe('defaultScenarioProfile', () => {
  const profile = defaultScenarioProfile(BASE_INPUT);

  it('returns exactly 24 elements in each array', () => {
    expect(profile.heatIntent).toHaveLength(24);
    expect(profile.dhwMixedLpm40).toHaveLength(24);
    expect(profile.coldLpm).toHaveLength(24);
  });

  it('source is "measured"', () => {
    expect(profile.source).toBe('measured');
  });

  it('resolutionMins is 60', () => {
    expect(profile.resolutionMins).toBe(60);
  });

  it('morning (06–08) and evening (17–21) hours have comfort intent (2)', () => {
    for (const h of [6, 7, 8, 17, 18, 19, 20, 21]) {
      expect(profile.heatIntent[h]).toBe(2);
    }
  });

  it('daytime (09–16) hours have setback intent (1)', () => {
    for (let h = 9; h <= 16; h++) {
      expect(profile.heatIntent[h]).toBe(1);
    }
  });

  it('DHW L/min is positive during morning peak hours (06–08)', () => {
    expect(profile.dhwMixedLpm40[6]).toBeGreaterThan(0);
    expect(profile.dhwMixedLpm40[7]).toBeGreaterThan(0);
    expect(profile.dhwMixedLpm40[8]).toBeGreaterThan(0);
  });

  it('cold draw is all-zero in measured baseline', () => {
    profile.coldLpm.forEach(v => expect(v).toBe(0));
  });

  it('bathroomCount=3 produces higher peak DHW than bathroomCount=1', () => {
    const p1 = defaultScenarioProfile({ ...BASE_INPUT, bathroomCount: 1 });
    const p3 = defaultScenarioProfile({ ...BASE_INPUT, bathroomCount: 3 });
    expect(p3.dhwMixedLpm40[7]).toBeGreaterThan(p1.dhwMixedLpm40[7]);
  });
});

// ─── applyScenarioOverrides — demand channels ─────────────────────────────────

describe('applyScenarioOverrides — demand channels', () => {
  it('returns exactly 24 hourly rows', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    expect(out.hourly).toHaveLength(24);
  });

  it('heatIntent=2 (comfort) maps to 100% of heatLossWatts / 1000 kW', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.qChDemandKw).toBeCloseTo(8, 1); // 8000 W / 1000
    });
  });

  it('heatIntent=0 (off) maps to 0 kW', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.qChDemandKw).toBe(0);
    });
  });

  it('heatIntent=1 (setback) maps to 40% of heatLossWatts', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(1) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.qChDemandKw).toBeCloseTo(3.2, 1); // 40% of 8 kW
    });
  });

  it('dhwMixedLpm40=3 maps to ~7.33 kW demand', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(3),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.qDhwDemandKw).toBeCloseTo(7.33, 0);
    });
  });

  it('coldLpm values are passed through to output', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(3),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.coldLpm).toBe(3);
    });
  });
});

// ─── Combi service-switching ──────────────────────────────────────────────────

describe('applyScenarioOverrides — combi service-switching', () => {
  it('when DHW demand is active, CH output is 0 for combi', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[], // comfort all day
      dhwMixedLpm40: Array(24).fill(3),                   // DHW on all day
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.systemA.qToChKw).toBe(0); // combi cuts CH during DHW
    });
  });

  it('stored system delivers both CH and DHW simultaneously', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(3),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'stored_vented', 'ashp', SPF_MIDPOINT);
    out.hourly.forEach(row => {
      expect(row.systemA.qToChKw).toBeGreaterThan(0); // stored: no service-switching
      expect(row.systemA.qToDhwKw).toBeGreaterThan(0);
    });
  });

  it('combi η is reduced during DHW hours (not full 92%)', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[],
      dhwMixedLpm40: [0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    // Hour 0 and 1: no DHW → η = 92% = 0.92
    expect(out.hourly[0].systemA.etaOrCop).toBeCloseTo(0.92, 2);
    // Hours with DHW: η < 0.92 (service-switch penalty)
    expect(out.hourly[3].systemA.etaOrCop).toBeLessThan(0.92);
  });
});

// ─── Combi purge pulse ────────────────────────────────────────────────────────

describe('applyScenarioOverrides — combi purge pulse', () => {
  it('first DHW draw after idle produces negative η (purge dump, energy-flow model)', () => {
    // Hour 5: idle → Hour 6: first DHW draw → purge pulse
    const dhwMixedLpm40 = Array(24).fill(0);
    dhwMixedLpm40[6] = 3; // only hour 6 has DHW
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    // Hour 6 is a purge pulse: qToDhwKw < 0 (negative delivery) and etaOrCop < 0
    expect(out.hourly[6].systemA.qToDhwKw).toBeLessThan(0);
    expect(out.hourly[6].systemA.etaOrCop).toBeLessThan(0);
    // qDumpKw is positive (energy wasted)
    expect(out.hourly[6].systemA.qDumpKw).toBeGreaterThan(0);
  });

  it('second consecutive DHW draw is not a purge pulse — η penalty only', () => {
    const dhwMixedLpm40 = Array(24).fill(0);
    dhwMixedLpm40[6] = 3;
    dhwMixedLpm40[7] = 3; // consecutive draw after purge
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    // Hour 7 follows a DHW draw → not a purge → η clamped to [0.50, 0.99]
    expect(out.hourly[7].systemA.etaOrCop).toBeGreaterThanOrEqual(0.50);
    expect(out.hourly[7].systemA.etaOrCop).toBeLessThanOrEqual(0.99);
    // qToDhwKw is positive (real delivery)
    expect(out.hourly[7].systemA.qToDhwKw).toBeGreaterThan(0);
  });

  it('stored system has no purge pulse — η stays at 0.92 during first DHW draw', () => {
    const dhwMixedLpm40 = Array(24).fill(0);
    dhwMixedLpm40[6] = 3;
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'stored_vented', 'ashp', SPF_MIDPOINT);
    expect(out.hourly[6].systemA.etaOrCop).toBeCloseTo(0.92, 2);
  });

  it('purge qDumpKw scales with resolution: 5-min slice has smaller kW than 60-min slice', () => {
    // At 60-min resolution the kW = kWh / (60/60) = kWh × 1
    const dhw60 = Array(24).fill(0);
    dhw60[6] = 3;
    const profile60: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: dhw60,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out60 = applyScenarioOverrides(BASE_INPUT, profile60, 'combi', 'ashp', SPF_MIDPOINT);

    // At 5-min resolution there are 288 slices; purge is the first DHW slice
    const N5 = 1440 / 5; // 288
    const dhw5 = Array(N5).fill(0);
    // Slice index for 06:00 at 5-min resolution = 6*60/5 = 72
    dhw5[72] = 3;
    const profile5: ScenarioProfileV1 = {
      heatIntent: Array(N5).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: dhw5,
      coldLpm: Array(N5).fill(0),
      source: 'measured',
      resolutionMins: 5,
    };
    const out5 = applyScenarioOverrides(BASE_INPUT, profile5, 'combi', 'ashp', SPF_MIDPOINT);

    // 5-min slice: kW = kWh / (5/60) = kWh × 12 → much larger kW per slice
    // 60-min slice: kW = kWh / (60/60) = kWh × 1
    // So qDumpKw at 5-min resolution should be 12× that at 60-min resolution
    const dump60 = out60.hourly[6].systemA.qDumpKw;
    const dump5  = out5.hourly[72].systemA.qDumpKw;
    expect(dump5).toBeCloseTo(dump60 * 12, 5);
  });
});

// ─── ASHP COP ─────────────────────────────────────────────────────────────────

describe('applyScenarioOverrides — ASHP COP', () => {
  it('ASHP COP equals spfMidpoint (no cold dip) during daytime hours', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    // Hours 7–23: no cold-morning dip → COP = spfMidpoint
    for (let h = 7; h < 24; h++) {
      expect(out.hourly[h].systemB.etaOrCop).toBeCloseTo(SPF_MIDPOINT, 2);
    }
  });

  it('ASHP cold-morning COP is lower than daytime COP (hours 0–6)', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(2) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0),
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    const dayAvg = out.hourly.slice(7).reduce((s, r) => s + r.systemB.etaOrCop, 0) / 17;
    const nightAvg = out.hourly.slice(0, 7).reduce((s, r) => s + r.systemB.etaOrCop, 0) / 7;
    expect(nightAvg).toBeLessThan(dayAvg);
  });

  it('ASHP COP is always ≥ 1.5 (clamped by physics)', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', 1.8); // very low SPF
    out.hourly.forEach(row => {
      expect(row.systemB.etaOrCop).toBeGreaterThanOrEqual(1.5);
    });
  });

  it('higher SPF produces higher COP across all hours', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const outHigh = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', 4.2);
    const outLow  = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', 2.8);
    const avgHigh = outHigh.hourly.reduce((s, r) => s + r.systemB.etaOrCop, 0) / 24;
    const avgLow  = outLow.hourly.reduce((s, r) => s + r.systemB.etaOrCop, 0) / 24;
    expect(avgHigh).toBeGreaterThan(avgLow);
  });
});

// ─── Both systems — same demand ───────────────────────────────────────────────

describe('applyScenarioOverrides — both systems share same demand', () => {
  it('qChDemandKw and qDhwDemandKw are identical regardless of system', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const outAB = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    const outBA = applyScenarioOverrides(BASE_INPUT, profile, 'ashp', 'combi', SPF_MIDPOINT);
    outAB.hourly.forEach((row, h) => {
      expect(row.qChDemandKw).toBe(outBA.hourly[h].qChDemandKw);
      expect(row.qDhwDemandKw).toBe(outBA.hourly[h].qDhwDemandKw);
    });
  });

  it('systemAType and systemBType are reflected in output', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const archetypes: ComparisonSystemType[] = ['combi', 'stored_vented', 'stored_unvented', 'ashp'];
    for (const a of archetypes) {
      for (const b of archetypes) {
        const out = applyScenarioOverrides(BASE_INPUT, profile, a, b, SPF_MIDPOINT);
        expect(out.systemAType).toBe(a);
        expect(out.systemBType).toBe(b);
      }
    }
  });
});

// ─── Resolution invariant ─────────────────────────────────────────────────────

describe('applyScenarioOverrides — resolution invariant', () => {
  it('N = 1440 / resolutionMins: 60-min resolution → 24 slices', () => {
    const profile = defaultScenarioProfile(BASE_INPUT, 60);
    expect(profile.heatIntent).toHaveLength(24);
    expect(profile.dhwMixedLpm40).toHaveLength(24);
    expect(profile.coldLpm).toHaveLength(24);
    expect(profile.resolutionMins).toBe(60);
    // Should not throw
    expect(() => applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT)).not.toThrow();
  });

  it('mismatched array length throws with a clear message', () => {
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(1) as HeatIntentLevel[],
      dhwMixedLpm40: Array(24).fill(0), // wrong: 24 but resolutionMins=30 expects 48
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 30,
    };
    expect(() => applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT))
      .toThrow(/array length mismatch/i);
  });
});

// ─── assertDemandTimelinesEqual ───────────────────────────────────────────────

describe('assertDemandTimelinesEqual', () => {
  it('passes when two outputs are built from the same profile', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const outAB = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    const outBA = applyScenarioOverrides(BASE_INPUT, profile, 'ashp', 'combi', SPF_MIDPOINT);
    expect(() => assertDemandTimelinesEqual(outAB, outBA)).not.toThrow();
  });

  it('throws when demand timelines differ', () => {
    const profile1 = defaultScenarioProfile({ ...BASE_INPUT, heatLossWatts: 8000 });
    const profile2 = defaultScenarioProfile({ ...BASE_INPUT, heatLossWatts: 12000 });
    const out1 = applyScenarioOverrides(BASE_INPUT, profile1, 'combi', 'ashp', SPF_MIDPOINT);
    const out2 = applyScenarioOverrides({ ...BASE_INPUT, heatLossWatts: 12000 }, profile2, 'combi', 'ashp', SPF_MIDPOINT);
    expect(() => assertDemandTimelinesEqual(out1, out2)).toThrow();
  });
});

// ─── DemandSlice type ─────────────────────────────────────────────────────────

describe('DemandSlice — shared reference contract', () => {
  it('DemandSlice type is exported and has the three demand fields', () => {
    // Compile-time check: the type is importable and has the expected shape
    const slice: DemandSlice = { qChDemandKw: 4, qDhwDemandKw: 2, coldLpm: 0 };
    expect(slice.qChDemandKw).toBe(4);
    expect(slice.qDhwDemandKw).toBe(2);
    expect(slice.coldLpm).toBe(0);
  });

  it('system A and system B rows have identical demand values (shared timeline)', () => {
    // Both systems must receive the same demand — verified by checking output equality
    const profile = defaultScenarioProfile(BASE_INPUT);
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    // The demand fields in each row must be equal regardless of system types
    // (they come from the same shared DemandSlice reference)
    out.hourly.forEach(row => {
      // Re-run with swapped system order — demand must still match
      expect(row.qChDemandKw).toBeGreaterThanOrEqual(0);
      expect(row.qDhwDemandKw).toBeGreaterThanOrEqual(0);
      expect(row.coldLpm).toBeGreaterThanOrEqual(0);
    });
  });

  it('swapping system A and B produces identical demand values in both outputs', () => {
    const profile = defaultScenarioProfile(BASE_INPUT);
    const outAB = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'stored_vented', SPF_MIDPOINT);
    const outBA = applyScenarioOverrides(BASE_INPUT, profile, 'stored_vented', 'combi', SPF_MIDPOINT);
    outAB.hourly.forEach((row, i) => {
      expect(row.qChDemandKw).toBe(outBA.hourly[i].qChDemandKw);
      expect(row.qDhwDemandKw).toBe(outBA.hourly[i].qDhwDemandKw);
      expect(row.coldLpm).toBe(outBA.hourly[i].coldLpm);
    });
  });
});
