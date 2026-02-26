/**
 * Tests for ScenarioProfileV1 physics helpers.
 *
 * Validates:
 *  - defaultScenarioProfile derives a plausible 24-hour profile from EngineInputV2_3
 *  - applyScenarioOverrides produces deterministic physics for each system archetype
 *  - Combi service-switching: CH drops to 0 during DHW hours
 *  - Combi purge: η goes negative on the first DHW draw after idle
 *  - Combi purge energy scales correctly with timeline resolution (kWh-based constants)
 *  - Shared DemandSliceV1 ensures demand is identical for both system simulations
 *  - ASHP: COP reflects spfMidpoint with cold-morning dip
 *  - Stored systems: no service-switching penalty
 */
import { describe, it, expect } from 'vitest';
import {
  defaultScenarioProfile,
  applyScenarioOverrides,
  assertDemandTimelinesEqual,
  dhwLpmToKw,
  COMBI_PURGE_DUMP_KWH,
  COMBI_PURGE_FUEL_INPUT_KWH,
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
});

// ─── Purge kWh scaling ────────────────────────────────────────────────────────

describe('combi purge — kWh-based constants scale with resolution', () => {
  it('COMBI_PURGE_DUMP_KWH and COMBI_PURGE_FUEL_INPUT_KWH are exported', () => {
    expect(typeof COMBI_PURGE_DUMP_KWH).toBe('number');
    expect(typeof COMBI_PURGE_FUEL_INPUT_KWH).toBe('number');
    expect(COMBI_PURGE_DUMP_KWH).toBeGreaterThan(0);
    expect(COMBI_PURGE_FUEL_INPUT_KWH).toBeGreaterThan(COMBI_PURGE_DUMP_KWH);
  });

  it('purge qDumpKw at 5-min resolution is 12× larger than at 60-min resolution', () => {
    // Same kWh but 5-min slices are 1/12th of an hour, so kW must be 12× higher
    const dhwMixedLpm40_60 = Array(24).fill(0);
    dhwMixedLpm40_60[6] = 3;
    const profile60: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: dhwMixedLpm40_60,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };

    // Build a 5-min resolution profile (288 slices): slice 72 = hour 6 (72 × 5 = 360 min)
    const N5 = 1440 / 5; // 288
    const dhwMixedLpm40_5 = Array(N5).fill(0);
    dhwMixedLpm40_5[72] = 3; // slice 72 = 360 min into day = hour 6 at 5-min resolution
    const profile5: ScenarioProfileV1 = {
      heatIntent: Array(N5).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40: dhwMixedLpm40_5,
      coldLpm: Array(N5).fill(0),
      source: 'measured',
      resolutionMins: 5,
    };

    const out60 = applyScenarioOverrides(BASE_INPUT, profile60, 'combi', 'ashp', SPF_MIDPOINT);
    const out5  = applyScenarioOverrides(BASE_INPUT, profile5,  'combi', 'ashp', SPF_MIDPOINT);

    const dumpKw60 = out60.hourly[6].systemA.qDumpKw;
    const dumpKw5  = out5.hourly[72].systemA.qDumpKw;

    // 5-min kW = kWh / (5/60) = kWh × 12; 60-min kW = kWh / 1
    expect(dumpKw5).toBeCloseTo(dumpKw60 * 12, 5);
  });

  it('purge total energy (kWh) is constant across resolutions', () => {
    // Energy = kW × sliceHours must equal COMBI_PURGE_DUMP_KWH regardless of resolution
    const dhwMixedLpm40 = Array(24).fill(0);
    dhwMixedLpm40[6] = 3;
    const profile: ScenarioProfileV1 = {
      heatIntent: Array(24).fill(0) as HeatIntentLevel[],
      dhwMixedLpm40,
      coldLpm: Array(24).fill(0),
      source: 'measured',
      resolutionMins: 60,
    };
    const out = applyScenarioOverrides(BASE_INPUT, profile, 'combi', 'ashp', SPF_MIDPOINT);
    const dumpKw = out.hourly[6].systemA.qDumpKw;
    const dumpKwh = dumpKw * (60 / 60); // kW × sliceHours
    expect(dumpKwh).toBeCloseTo(COMBI_PURGE_DUMP_KWH, 5);
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
