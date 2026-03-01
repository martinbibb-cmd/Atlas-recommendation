import { describe, it, expect } from 'vitest';
import {
  solveSystemTimeline,
  buildSystemConfig,
  dhwKwFromFlow,
  DHW_COLD_WATER_TEMP_C,
  DHW_TARGET_HOT_TEMP_C,
  SOLVER_STEPS,
  DELTA_T_DESIGN,
  type SolverCoreInput,
  type SolverSystemConfig,
  type DhwSupplyPath,
} from '../../engine/timeline/Solver24hV1';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const DEFAULT_EVENTS = [
  { startMin: 420, endMin: 435, kind: 'sink' as const, intensity: 'med' as const },
  { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
  { startMin: 1200, endMin: 1245, kind: 'dishwasher' as const, intensity: 'low' as const },
];

const baseCore: SolverCoreInput = {
  peakHeatLossKw: 8,
  tauHours: 35,
  outdoorTempC: 5,
  setpointHomeC: 21,
  setpointAwayC: 17,
};

const combiSystem: SolverSystemConfig = {
  systemId: 'on_demand',
  maxKw: 24,
  minKw: 4,
  baseEta: 0.85,
};

const ashpSystem: SolverSystemConfig = {
  systemId: 'ashp',
  maxKw: 8.8, // 8 * 1.1
  designFlowTempBand: 45,
};

// ── Basic output shape ─────────────────────────────────────────────────────────

describe('Solver24hV1 — output shape', () => {
  it('produces exactly 96 steps', () => {
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    expect(result.roomTempC).toHaveLength(SOLVER_STEPS);
    expect(result.heatDeliveredKw).toHaveLength(SOLVER_STEPS);
    expect(result.heatDemandKw).toHaveLength(SOLVER_STEPS);
    expect(result.efficiency).toHaveLength(SOLVER_STEPS);
    expect(result.inputPowerKw).toHaveLength(SOLVER_STEPS);
    expect(result.dhwState).toHaveLength(SOLVER_STEPS);
  });

  it('produces no NaN in any output array', () => {
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    for (const arr of Object.values(result)) {
      for (const v of arr) {
        expect(isNaN(v)).toBe(false);
      }
    }
  });
});

// ── Determinism ────────────────────────────────────────────────────────────────

describe('Solver24hV1 — determinism', () => {
  it('same inputs produce identical series across multiple calls', () => {
    const r1 = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    const r2 = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    expect(r1.roomTempC).toEqual(r2.roomTempC);
    expect(r1.heatDeliveredKw).toEqual(r2.heatDeliveredKw);
    expect(r1.efficiency).toEqual(r2.efficiency);
    expect(r1.inputPowerKw).toEqual(r2.inputPowerKw);
    expect(r1.dhwState).toEqual(r2.dhwState);
  });
});

// ── ASHP efficiency (COP) ──────────────────────────────────────────────────────

describe('Solver24hV1 — ASHP COP > 1', () => {
  it('ASHP efficiency (COP) is always greater than 1', () => {
    const result = solveSystemTimeline(baseCore, ashpSystem, DEFAULT_EVENTS);
    for (const v of result.efficiency) {
      expect(v).toBeGreaterThan(1);
    }
  });

  it('ASHP COP at 35°C flow band is higher than at 50°C flow band', () => {
    const low35 = solveSystemTimeline(baseCore, { ...ashpSystem, designFlowTempBand: 35 }, DEFAULT_EVENTS);
    const high50 = solveSystemTimeline(baseCore, { ...ashpSystem, designFlowTempBand: 50 }, DEFAULT_EVENTS);
    // Mean COP at 35°C should exceed mean COP at 50°C
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(mean(low35.efficiency)).toBeGreaterThan(mean(high50.efficiency));
  });
});

// ── Boiler efficiency (η) ──────────────────────────────────────────────────────

describe('Solver24hV1 — boiler η ≤ 1', () => {
  it('boiler efficiency (η) is always ≤ 1 and > 0', () => {
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    for (const v of result.efficiency) {
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('boiler efficiency is within realistic range [0.55, 0.95]', () => {
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    for (const v of result.efficiency) {
      expect(v).toBeLessThanOrEqual(0.95);
      expect(v).toBeGreaterThanOrEqual(0.55);
    }
  });
});

// ── Thermal inertia (tau) ──────────────────────────────────────────────────────

describe('Solver24hV1 — thermal inertia (tau)', () => {
  it('higher tau produces a higher minimum room temperature (slower cooling)', () => {
    // Run both with NO events and no recovery — pure decay
    const coreShort: SolverCoreInput = { ...baseCore, tauHours: 10 };
    const coreLong:  SolverCoreInput = { ...baseCore, tauHours: 70 };

    // Use a zero-output system to observe pure cooling
    const zeroSystem: SolverSystemConfig = { systemId: 'on_demand', maxKw: 0, minKw: 0, baseEta: 0.85 };

    const shortResult = solveSystemTimeline(coreShort, zeroSystem, []);
    const longResult  = solveSystemTimeline(coreLong,  zeroSystem, []);

    const minShort = Math.min(...shortResult.roomTempC);
    const minLong  = Math.min(...longResult.roomTempC);

    // Higher tau → slower cooling → higher minimum temperature after 24h
    expect(minLong).toBeGreaterThan(minShort);
  });

  it('room temp at end of day is lower for a leakier building (lower tau), all else equal', () => {
    // A leaky building has both higher heat loss AND shorter time constant (lighter mass).
    // τ is the independent input here — lower τ means faster cooling.
    const coreLeaky: SolverCoreInput = { ...baseCore, peakHeatLossKw: 16, tauHours: 10 };
    const coreTight: SolverCoreInput = { ...baseCore, peakHeatLossKw: 4,  tauHours: 70 };

    const noHeat: SolverSystemConfig = { systemId: 'on_demand', maxKw: 0, minKw: 0, baseEta: 0.85 };

    const leakyResult = solveSystemTimeline(coreLeaky, noHeat, []);
    const tightResult = solveSystemTimeline(coreTight, noHeat, []);

    const finalLeaky = leakyResult.roomTempC[95];
    const finalTight = tightResult.roomTempC[95];

    // Leaky building (lower tau) loses heat faster — should end colder
    expect(finalTight).toBeGreaterThan(finalLeaky);
  });
});

// ── Oversize / cycling penalty ────────────────────────────────────────────────

describe('Solver24hV1 — cycling penalty for oversized boilers', () => {
  it('an oversized boiler with low minKw threshold produces more cycling-penalty steps', () => {
    // Oversize: high maxKw, normal minKw → many low-load steps → cycling
    const oversizedSystem: SolverSystemConfig = {
      systemId: 'on_demand',
      maxKw: 60, // 60kW for a 8kW peak loss — very oversized
      minKw: 4,
      baseEta: 0.85,
    };

    // Well-matched: maxKw close to peak load
    const matchedSystem: SolverSystemConfig = {
      systemId: 'on_demand',
      maxKw: 8,
      minKw: 4,
      baseEta: 0.85,
    };

    const oversizedResult = solveSystemTimeline(baseCore, oversizedSystem, DEFAULT_EVENTS);
    const matchedResult   = solveSystemTimeline(baseCore, matchedSystem,   DEFAULT_EVENTS);

    // Count cycling-penalty steps (η lower than baseEta - some threshold)
    const cyclingThreshold = 0.84; // below 0.85 base
    const cyclingStepsOversized = oversizedResult.efficiency.filter(v => v < cyclingThreshold).length;
    const cyclingStepsMatched   = matchedResult.efficiency.filter(v => v < cyclingThreshold).length;

    // Oversized should have at least as many cycling-penalty steps as well-matched
    expect(cyclingStepsOversized).toBeGreaterThanOrEqual(cyclingStepsMatched);
  });

  it('cycling penalty reduces efficiency below base eta', () => {
    // A small required load that falls below minKw should trigger the cycling penalty
    const tinyLoad: SolverCoreInput = {
      ...baseCore,
      peakHeatLossKw: 0.5, // tiny building — always under minKw
    };
    const result = solveSystemTimeline(tinyLoad, combiSystem, []);
    // At least some steps should have efficiency below baseEta due to cycling
    const penaltySteps = result.efficiency.filter(v => v < combiSystem.baseEta!);
    expect(penaltySteps.length).toBeGreaterThan(0);
  });
});

// ── DHW state ────────────────────────────────────────────────────────────────

describe('Solver24hV1 — DHW state', () => {
  it('dhwState is in range [0, 100] at all times', () => {
    const result = solveSystemTimeline(baseCore, ashpSystem, DEFAULT_EVENTS);
    for (const v of result.dhwState) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('combi dhwState is 100 during non-event periods (standby)', () => {
    // No events → combi always in standby (100)
    const result = solveSystemTimeline(baseCore, combiSystem, []);
    for (const v of result.dhwState) {
      expect(v).toBe(100);
    }
  });

  it('stored cylinder soc drops during a DHW draw when boiler capacity is near-fully used for space heat', () => {
    // Use a boiler that is just slightly above space heat requirement (9 kW vs 8 kW peak loss).
    // During a high-intensity bath draw (3 kW), total required = 8 + 3 = 11 kW > 9 kW,
    // so the boiler cannot fully compensate the cylinder draw → cylinder soc drops.
    const tightBoilerSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,   // only 1 kW margin above peak heat loss
      minKw: 4,
      baseEta: 0.85,
    };
    const bathEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const result = solveSystemTimeline(baseCore, tightBoilerSystem, bathEvents);
    // Before bath (index 75 = 18:45): soc should be at or near 100%
    const preEvent  = result.dhwState[75];
    // After bath window (index 79 = 19:45): soc should have dropped
    const postEvent = result.dhwState[79];
    expect(preEvent).toBeGreaterThan(postEvent);
  });
});

// ── buildSystemConfig helper ──────────────────────────────────────────────────

describe('buildSystemConfig', () => {
  it('ASHP maxKw = peakHeatLossKw * 1.1', () => {
    const cfg = buildSystemConfig('ashp', 10, {});
    expect(cfg.maxKw).toBeCloseTo(11, 2);
  });

  it('combi defaults to 24kW', () => {
    const cfg = buildSystemConfig('on_demand', 8, {});
    expect(cfg.maxKw).toBe(24);
  });

  it('stored_vented defaults to 18kW', () => {
    const cfg = buildSystemConfig('stored_vented', 8, {});
    expect(cfg.maxKw).toBe(18);
  });

  it('current + combi currentHeatSourceType resolves to on_demand config', () => {
    const cfg = buildSystemConfig('current', 8, { currentHeatSourceType: 'combi' });
    expect(cfg.systemId).toBe('on_demand');
  });

  it('current + ashp currentHeatSourceType resolves to ashp config', () => {
    const cfg = buildSystemConfig('current', 8, { currentHeatSourceType: 'ashp' });
    expect(cfg.systemId).toBe('ashp');
  });

  it('DELTA_T_DESIGN constant is 16', () => {
    expect(DELTA_T_DESIGN).toBe(16);
  });
});

// ── DHW Supply Path ───────────────────────────────────────────────────────────

describe('Solver24hV1 — DHW supply path: cold_only', () => {
  it('cold_only: DHW hot-water draw series is zero — dhwState stays 100 for combi throughout', () => {
    // DEFAULT_EVENTS includes sink (med), bath (high), and dishwasher.
    // cold_only suppresses all hot-water draws → combi dhwState = 100 at all steps.
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'cold_only');
    for (const v of result.dhwState) {
      expect(v).toBe(100);
    }
  });

  it('cold_only: stored cylinder reserve unchanged (never drawn)', () => {
    const storedSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 18,
      minKw: 4,
      baseEta: 0.85,
    };
    const coldResult = solveSystemTimeline(baseCore, storedSystem, DEFAULT_EVENTS, 'cold_only');
    const hotResult  = solveSystemTimeline(baseCore, storedSystem, DEFAULT_EVENTS, 'hot_water_system');

    // cold_only: cylinder never drawn → min SoC higher than hot_water_system
    const minCold = Math.min(...coldResult.dhwState);
    const minHot  = Math.min(...hotResult.dhwState);
    expect(minCold).toBeGreaterThanOrEqual(minHot);
  });

  it('cold_only: no combi DHW conflict — inputPowerKw at sink step equals hot_water_system non-event step', () => {
    const resultCold = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'cold_only');
    const resultHot  = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'hot_water_system');
    // Step 28 = minute 420 = sink event window
    const inputCold = resultCold.inputPowerKw[28];
    const inputHot  = resultHot.inputPowerKw[28];
    // With hot_water_system, the combi must supply more energy → input power should be higher
    expect(inputHot).toBeGreaterThan(inputCold);
  });
});

describe('Solver24hV1 — DHW supply path: hot_water_system', () => {
  it('hot_water_system: DHW events increase total required kW — inputPowerKw is higher during sink step', () => {
    const resultHot      = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'hot_water_system');
    const resultColdOnly = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'cold_only');
    // Step 28 = minute 420 = sink event window
    const inputHot      = resultHot.inputPowerKw[28];
    const inputColdOnly = resultColdOnly.inputPowerKw[28];
    expect(inputHot).toBeGreaterThan(inputColdOnly);
  });

  it('hot_water_system (default): same result as calling solver with no supply path', () => {
    const resultExplicit = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'hot_water_system');
    const resultDefault  = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    expect(resultExplicit.dhwState).toEqual(resultDefault.dhwState);
    expect(resultExplicit.inputPowerKw).toEqual(resultDefault.inputPowerKw);
  });

  it('bath event draws from stored cylinder (SoC drops during bath window)', () => {
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const bathEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const result = solveSystemTimeline(baseCore, tightSystem, bathEvents, 'hot_water_system');
    const preEvent  = result.dhwState[75];
    const postEvent = result.dhwState[79];
    expect(preEvent).toBeGreaterThan(postEvent);
  });
});

describe('Solver24hV1 — DHW supply path: mixed', () => {
  it('mixed: sink draw is partial (60%) — inputPowerKw at sink step is below hot_water_system', () => {
    const resultMixed = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'mixed');
    const resultHot   = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'hot_water_system');
    // Step 28 = minute 420 = sink event window.
    // mixed: combi delivers 60% of sink DHW; hot_water_system: combi delivers 100%.
    // Under combi DHW priority, CH is interrupted so the comparison is purely on DHW output.
    const inputMixed = resultMixed.inputPowerKw[28];
    const inputHot   = resultHot.inputPowerKw[28];
    // 60% DHW draw requires less input than 100% draw
    expect(inputMixed).toBeLessThan(inputHot);
    // mixed delivers some DHW (> 0 input attributed to the event)
    expect(inputMixed).toBeGreaterThan(0);
  });

  it('mixed: bath always draws from hot-water system (same as hot_water_system for bath-only events)', () => {
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const bathOnlyEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const resultMixed = solveSystemTimeline(baseCore, tightSystem, bathOnlyEvents, 'mixed');
    const resultHot   = solveSystemTimeline(baseCore, tightSystem, bathOnlyEvents, 'hot_water_system');
    // Bath draw is identical in both modes → cylinder SoC should match exactly
    expect(resultMixed.dhwState).toEqual(resultHot.dhwState);
  });

  it('mixed: partial sink draws affect stored cylinder reserve (SoC lower than cold_only)', () => {
    // Use a system whose maxKw exactly matches the peak space-heat requirement.
    // This leaves no excess capacity to reheat the cylinder during a sink draw,
    // so the 60% mixed draw is not instantly offset.
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 8, // exactly equal to peak heat loss — no headroom for instant cylinder reheat
      minKw: 4,
      baseEta: 0.85,
    };
    const sinkOnlyEvents = [
      { startMin: 420, endMin: 435, kind: 'sink' as const, intensity: 'med' as const },
    ];
    const resultCold  = solveSystemTimeline(baseCore, tightSystem, sinkOnlyEvents, 'cold_only');
    const resultMixed = solveSystemTimeline(baseCore, tightSystem, sinkOnlyEvents, 'mixed');
    const minCold  = Math.min(...resultCold.dhwState);
    const minMixed = Math.min(...resultMixed.dhwState);
    // mixed draws 60% of the sink → cylinder drains more than cold_only (0%)
    expect(minMixed).toBeLessThan(minCold);
  });
});

// ── No double-counting: non-cold solver DHW draw > 0 ─────────────────────────

describe('Solver24hV1 — no double-counting', () => {
  it('hot_water_system DHW draw > 0 and stored cylinder SoC decreases exactly once', () => {
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const bathOnlyEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const result = solveSystemTimeline(baseCore, tightSystem, bathOnlyEvents, 'hot_water_system');
    const preEvent  = result.dhwState[75];
    const postEvent = result.dhwState[79];
    expect(preEvent).toBeGreaterThan(postEvent);
    const inputAtBath = result.inputPowerKw[76];
    const inputBefore = result.inputPowerKw[74];
    expect(inputAtBath).toBeGreaterThanOrEqual(inputBefore);
  });

  it('DhwSupplyPath type is exported and accepts valid values', () => {
    const paths: DhwSupplyPath[] = ['hot_water_system', 'cold_only', 'mixed'];
    for (const path of paths) {
      const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, path);
      expect(result.dhwState).toHaveLength(SOLVER_STEPS);
    }
  });
});

// ── dhwKwFromFlow physics helper ──────────────────────────────────────────────

describe('dhwKwFromFlow — physics helper', () => {
  it('12 L/min at ΔT 35°C yields ~29 kW (one shower hits full combi output)', () => {
    // 0.0697 × 12 × 35 = 29.274 kW — a single shower demands nearly 30 kW
    expect(dhwKwFromFlow(12, 35)).toBeCloseTo(29.3, 0);
  });

  it('24 L/min at ΔT 35°C yields ~58 kW (two simultaneous showers exceed combi capacity)', () => {
    expect(dhwKwFromFlow(24, 35)).toBeCloseTo(58.6, 0);
  });

  it('returns 0 when deltaTc is 0', () => {
    expect(dhwKwFromFlow(12, 0)).toBe(0);
  });

  it('clamps negative deltaTc to 0 (no negative heat transfer)', () => {
    expect(dhwKwFromFlow(12, -10)).toBe(0);
  });

  it('DHW_COLD_WATER_TEMP_C and DHW_TARGET_HOT_TEMP_C yield ΔT 35°C', () => {
    expect(DHW_TARGET_HOT_TEMP_C - DHW_COLD_WATER_TEMP_C).toBe(35);
  });

  it('is proportional to flow — doubling flow doubles kW', () => {
    const kw6  = dhwKwFromFlow(6, 35);
    const kw12 = dhwKwFromFlow(12, 35);
    expect(kw12).toBeCloseTo(kw6 * 2, 5);
  });
});

// ── Combi DHW priority dispatch ───────────────────────────────────────────────

describe('Solver24hV1 — combi DHW priority (CH interrupted during DHW events)', () => {
  const sinkMedEvents = [
    { startMin: 420, endMin: 435, kind: 'sink' as const, intensity: 'med' as const },
  ];
  const bathHighEvents = [
    { startMin: 420, endMin: 435, kind: 'bath' as const, intensity: 'high' as const },
  ];

  it('combi heatDeliveredKw during DHW event reflects DHW kW (not spaceHeat + DHW)', () => {
    // sink med: 0.0697 × 4 × 35 ≈ 9.76 kW — combi delivers DHW only
    const result = solveSystemTimeline(baseCore, combiSystem, sinkMedEvents);
    // Step 28 = minute 420 = sink event window
    // With DHW priority, delivered = min(maxKw, dhwKw) ≈ 9.76 kW, not spaceHeat + 9.76
    const deliveredAtEvent = result.heatDeliveredKw[28];
    expect(deliveredAtEvent).toBeCloseTo(9.76, 0); // DHW kW only
    expect(deliveredAtEvent).toBeLessThan(combiSystem.maxKw!);
  });

  it('bath high event: delivered kW is capped at combi maxKw (shortfall produced)', () => {
    // bath high: 0.0697 × 12 × 35 ≈ 29.3 kW > combiSystem.maxKw (24 kW)
    const result = solveSystemTimeline(baseCore, combiSystem, bathHighEvents);
    const deliveredAtEvent = result.heatDeliveredKw[28];
    expect(deliveredAtEvent).toBeCloseTo(combiSystem.maxKw!, 1);
  });

  it('bath high: dhwShortfallKw > 0 when DHW demand exceeds combi maxKw', () => {
    // Demand ~29.3 kW, maxKw = 24 → shortfall ≈ 5.3 kW
    const result = solveSystemTimeline(baseCore, combiSystem, bathHighEvents);
    const shortfall = result.dhwShortfallKw[28];
    expect(shortfall).toBeGreaterThan(0);
    expect(shortfall).toBeCloseTo(29.3 - 24, 0);
  });

  it('sink med: dhwShortfallKw = 0 when DHW demand is within combi maxKw', () => {
    // sink med ≈ 9.76 kW < 24 kW → no shortfall
    const result = solveSystemTimeline(baseCore, combiSystem, sinkMedEvents);
    expect(result.dhwShortfallKw[28]).toBe(0);
  });

  it('stored system: dhwShortfallKw is always 0 (cylinder buffers demand)', () => {
    const storedSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const result = solveSystemTimeline(baseCore, storedSystem, bathHighEvents);
    for (const v of result.dhwShortfallKw) {
      expect(v).toBe(0);
    }
  });

  it('dhwShortfallKw array has 96 entries and no NaN', () => {
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS);
    expect(result.dhwShortfallKw).toHaveLength(SOLVER_STEPS);
    for (const v of result.dhwShortfallKw) {
      expect(isNaN(v)).toBe(false);
    }
  });

  it('combi dhwState < 100 during bath high event (capacity-limited)', () => {
    // bath high ~29.3 kW > 24 kW maxKw → partial service → dhwState < 100
    const result = solveSystemTimeline(baseCore, combiSystem, bathHighEvents);
    expect(result.dhwState[28]).toBeLessThan(100);
  });

  it('combi dhwState = 100 during sink med event (demand within capacity)', () => {
    // sink med ~9.76 kW < 24 kW → fully served
    const result = solveSystemTimeline(baseCore, combiSystem, sinkMedEvents);
    expect(result.dhwState[28]).toBeCloseTo(100, 1);
  });
});
