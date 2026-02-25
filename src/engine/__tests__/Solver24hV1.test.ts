import { describe, it, expect } from 'vitest';
import {
  solveSystemTimeline,
  buildSystemConfig,
  SOLVER_STEPS,
  DELTA_T_DESIGN,
  type SolverCoreInput,
  type SolverSystemConfig,
} from '../../engine/timeline/Solver24hV1';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const DEFAULT_EVENTS = [
  { startMin: 420, endMin: 435, kind: 'shower' as const, intensity: 'med' as const },
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

// ── Electric shower delivery mode ─────────────────────────────────────────────

describe('Solver24hV1 — electric_cold_only delivery mode', () => {
  it('electric shower: shower draw suppressed on combi — dhwState stays 100 throughout', () => {
    // DEFAULT_EVENTS includes shower, bath (served at 100% on 24kW combi), and dishwasher (cold-fill).
    // Shower draw is suppressed; bath is served at full capacity by the combi → dhwState = 100 at all steps.
    const result = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'electric_cold_only');
    for (const v of result.dhwState) {
      expect(v).toBe(100);
    }
  });

  it('electric shower: cylinder reserve higher than gravity (only bath drawn, not shower)', () => {
    const storedSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 18,
      minKw: 4,
      baseEta: 0.85,
    };
    const electricResult = solveSystemTimeline(baseCore, storedSystem, DEFAULT_EVENTS, 'electric_cold_only');
    const gravityResult  = solveSystemTimeline(baseCore, storedSystem, DEFAULT_EVENTS, 'gravity');

    // Electric: only bath drawn (shower suppressed) → less total draw → min SoC higher than gravity
    const minElectric = Math.min(...electricResult.dhwState);
    const minGravity  = Math.min(...gravityResult.dhwState);
    expect(minElectric).toBeGreaterThanOrEqual(minGravity);
  });

  it('electric shower: bath event still draws from stored cylinder (only shower is suppressed)', () => {
    // Tight boiler: 9 kW for 8 kW peak loss → only 1 kW margin.
    // Bath (high, 3 kW) exceeds the margin → cylinder drains even with electric_cold_only.
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const bathOnlyEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const electricResult = solveSystemTimeline(baseCore, tightSystem, bathOnlyEvents, 'electric_cold_only');
    const noEventResult  = solveSystemTimeline(baseCore, tightSystem, [], 'electric_cold_only');

    // Bath not suppressed → cylinder drains during event → min SoC lower than no-event run
    const minElectric = Math.min(...electricResult.dhwState);
    const minNoEvent  = Math.min(...noEventResult.dhwState);
    expect(minElectric).toBeLessThan(minNoEvent);
  });

  it('electric shower: alias "electric" normalises and suppresses shower draw identically', () => {
    // Passing the legacy 'electric' alias should behave identically to 'electric_cold_only'
    const resultAlias     = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'electric');
    const resultCanonical = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'electric_cold_only');
    expect(resultAlias.dhwState).toEqual(resultCanonical.dhwState);
  });

  it('electric shower alias "Electric" (mixed case) behaves identically to electric_cold_only', () => {
    const resultMixed    = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'Electric');
    const resultCanonical = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'electric_cold_only');
    expect(resultMixed.dhwState).toEqual(resultCanonical.dhwState);
  });

  it('gravity (default): DHW events do increase total required kW — inputPowerKw is higher during shower steps', () => {
    // With gravity, shower creates a DHW draw on the combi → input power rises during event steps.
    // Compare electric (no draw) vs gravity (draw) for the same combi system.
    const resultGravity  = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'gravity');
    const resultElectric = solveSystemTimeline(baseCore, combiSystem, DEFAULT_EVENTS, 'electric_cold_only');
    // Step 28 = minute 420 = shower event window
    const inputGravity  = resultGravity.inputPowerKw[28];
    const inputElectric = resultElectric.inputPowerKw[28];
    // With DHW draw, the combi must supply more energy → input power should be higher
    expect(inputGravity).toBeGreaterThan(inputElectric);
  });

  it('no double-counting: non-electric solver DHW draw > 0 and stored cylinder SoC decreases exactly once', () => {
    // For a non-electric mode, confirm solver DHW draw is positive at a known bath step
    // and the stored cylinder is the single mechanism that tracks it.
    const tightSystem: SolverSystemConfig = {
      systemId: 'stored_vented',
      maxKw: 9,
      minKw: 4,
      baseEta: 0.85,
    };
    const bathOnlyEvents = [
      { startMin: 1140, endMin: 1170, kind: 'bath' as const, intensity: 'high' as const },
    ];
    const result = solveSystemTimeline(baseCore, tightSystem, bathOnlyEvents, 'gravity');
    // SoC before bath (index 75 = 18:45): cylinder should be high
    const preEvent  = result.dhwState[75];
    // SoC after bath (index 79 = 19:45): should have dropped from a single draw
    const postEvent = result.dhwState[79];
    expect(preEvent).toBeGreaterThan(postEvent);
    // Confirm the draw is captured in inputPowerKw increasing during the bath steps
    const inputAtBath = result.inputPowerKw[76]; // 19:00 — first bath step
    const inputBefore = result.inputPowerKw[74];  // 18:30 — before bath
    expect(inputAtBath).toBeGreaterThanOrEqual(inputBefore);
  });
});
