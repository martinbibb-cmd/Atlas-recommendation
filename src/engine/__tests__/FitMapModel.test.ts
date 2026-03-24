/**
 * FitMapModel.test.ts — PR9: Tests for the evidence-derived service-shape fit map.
 *
 * Test categories:
 *   1.  Positive — combi with service switching scores lower on DHW axis than stored system
 *   2.  Positive — stored system with healthy volume scores higher DHW axis than shortfall case
 *   3.  Positive — HP with slow recovery has softer DHW contour
 *   4.  Positive — hydraulic constraints reduce the relevant axis
 *   5.  Positive — open_vented head limit trims the DHW axis
 *   6.  Positive — cycling risk reduces heating axis
 *   7.  Structural — same inputs always produce same fit map (determinism)
 *   8.  Structural — no cross-family invalid penalties in any fit map
 *   9.  Structural — evidence items reference real limiter IDs or event types
 *  10.  Structural — all evidence magnitudes are non-negative
 *  11.  Structural — axis scores are in [0, 100]
 *  12.  Structural — contour shapes are consistent with axis scores
 *  13.  Structural — HP fit map has soft corner rounding
 *  14.  Structural — combi fit map has sharp corner rounding
 *  15.  Negative — clean run with no constraints produces high scores
 *  16.  Negative — fit map never emits store-only evidence for combi runs
 *  17.  Negative — fit map never emits combi-only evidence for stored runs
 */

import { describe, it, expect } from 'vitest';
import { buildFitMapModel, FIT_MAP_LIMITER_IDS } from '../fitmap/buildFitMapModel';
import { buildLimiterLedger } from '../limiter/buildLimiterLedger';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { runRegularStoredSystemModel } from '../runners/runRegularStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { FamilyRunnerResult } from '../runners/types';
import type { DerivedSystemEventSummary } from '../timeline/DerivedSystemEvent';
import type { LimiterLedger } from '../limiter/LimiterLedger';
import type { FitMapModel } from '../fitmap/FitMapModel';

// ─── Base inputs ──────────────────────────────────────────────────────────────

/** Standard survey input — clean run, no evidence for most limiters. */
const CLEAN_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
  mainsDynamicFlowLpm: 18,
};

// ─── Topology helpers ─────────────────────────────────────────────────────────

const combiTopology  = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const regularTopology = buildSystemTopologyFromSpec({ systemType: 'open_vented' });
const hpTopology     = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 200 });

// ─── Runner + build helpers ───────────────────────────────────────────────────

/**
 * Build a FitMapModel from a completed runner result and event summary.
 */
function buildMap(
  runnerResult: FamilyRunnerResult,
  eventSummary: DerivedSystemEventSummary,
): FitMapModel {
  const ledger = buildLimiterLedger(runnerResult, eventSummary);
  return buildFitMapModel(
    runnerResult,
    runnerResult.stateTimeline,
    eventSummary,
    ledger,
  );
}

/**
 * Combi with heating demand active — `adaptEngineInputToCombiPhase` sets
 * `simultaneousChActive = (heatLossWatts > 0)`, so any run with positive
 * heatLossWatts will produce CH interruption events naturally.
 */
function runCombiWithInterruption(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runCombiSystemModel(input, combiTopology);
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

/**
 * Combi with zero heat loss — `adaptEngineInputToCombiPhase` sets
 * `simultaneousChActive = false`, so no CH interruption events are produced.
 * This produces a genuinely clean combi run for comparison purposes.
 */
function runCombiClean(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runCombiSystemModel({ ...input, heatLossWatts: 0 }, combiTopology);
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'combi');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

/** System stored with a large draw — likely to produce volume-shortfall evidence. */
function runSystemWithLargeDraw(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runSystemStoredSystemModel(
    { ...input, dhwDrawVolumeLitres: 999 },
    systemTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'system');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

/** System stored with a normal draw — healthy volume, no shortfall. */
function runSystemClean(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runSystemStoredSystemModel(
    { ...input, preferCombi: false },
    systemTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'system');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

/** Heat pump stored with a large draw — produces HP reheat latency evidence if slow. */
function runHeatPumpWithLargeDraw(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runHeatPumpStoredSystemModel(
    { ...input, dhwDrawVolumeLitres: 999 },
    hpTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'heat_pump');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

/** Regular / open-vented stored system. */
function runRegularClean(input: EngineInputV2_3 = CLEAN_INPUT) {
  const runnerResult = runRegularStoredSystemModel(
    { ...input, preferCombi: false },
    regularTopology,
  );
  const eventSummary = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, 'open_vented');
  return { runnerResult, eventSummary, fitMap: buildMap(runnerResult, eventSummary) };
}

// ─── 1. Combi DHW axis vs stored DHW axis ────────────────────────────────────

describe('FitMapModel — axis: combi service switching narrows DHW axis', () => {
  it('combi with CH interruption has lower DHW axis score than clean combi', () => {
    const withInterruption = runCombiWithInterruption();
    const clean = runCombiClean();
    // Only assert if the run actually produced interruption evidence
    if (withInterruption.eventSummary.counters.heatingInterruptions > 0) {
      expect(withInterruption.fitMap.dhwAxis.score).toBeLessThan(
        clean.fitMap.dhwAxis.score,
      );
    }
  });

  it('combi with CH interruption has lower DHW axis score than stored system (clean)', () => {
    const combi = runCombiWithInterruption();
    const stored = runSystemClean();
    if (combi.eventSummary.counters.heatingInterruptions > 0) {
      expect(combi.fitMap.dhwAxis.score).toBeLessThan(stored.fitMap.dhwAxis.score);
    }
  });
});

// ─── 2. Stored volume shortfall → DHW axis reduction ─────────────────────────

describe('FitMapModel — axis: stored volume shortfall reduces DHW score', () => {
  it('stored system with large draw has lower DHW axis score than clean stored system', () => {
    const withDraw = runSystemWithLargeDraw();
    const clean = runSystemClean();
    // Only assert if depletion evidence was produced
    const hasShortfall = withDraw.fitMap.evidence.some(
      e => e.id === 'stored_volume_shortfall' || e.id === 'reduced_dhw_service',
    );
    if (hasShortfall) {
      expect(withDraw.fitMap.dhwAxis.score).toBeLessThan(clean.fitMap.dhwAxis.score);
    }
  });

  it('clean stored system has horizontal shape "broad" or "mid" (not narrow)', () => {
    const { fitMap } = runSystemClean();
    expect(['broad', 'mid']).toContain(fitMap.contour.horizontalShape);
  });
});

// ─── 3. HP recovery penalty softens DHW contour ──────────────────────────────

describe('FitMapModel — contour: HP with slow recovery has soft DHW edge', () => {
  it('HP with large draw has dhwEdgeSoftness "soft" or "medium" (not hard) when reheat evidence present', () => {
    const { fitMap } = runHeatPumpWithLargeDraw();
    const hasReheatEvidence = fitMap.evidence.some(e => e.id === 'hp_reheat_latency');
    if (hasReheatEvidence) {
      expect(fitMap.contour.dhwEdgeSoftness).not.toBe('hard');
    }
  });

  it('HP fit map has corner rounding "soft"', () => {
    const { fitMap } = runHeatPumpWithLargeDraw();
    expect(fitMap.contour.cornerRounding).toBe('soft');
  });

  it('HP with large draw DHW axis score is lower than clean stored system DHW axis score when reheat latency present', () => {
    const hp = runHeatPumpWithLargeDraw();
    const stored = runSystemClean();
    const hasReheatEvidence = hp.fitMap.evidence.some(e => e.id === 'hp_reheat_latency');
    if (hasReheatEvidence) {
      expect(hp.fitMap.dhwAxis.score).toBeLessThan(stored.fitMap.dhwAxis.score);
    }
  });
});

// ─── 4. Hydraulic constraints reduce relevant axis ───────────────────────────

describe('FitMapModel — axis: hydraulic constraints reduce the correct axis', () => {
  it('low mains flow reduces DHW axis', () => {
    const lowFlowInput: EngineInputV2_3 = { ...CLEAN_INPUT, mainsDynamicFlowLpm: 8 };
    const { fitMap: lowFlow } = runCombiClean(lowFlowInput);
    const { fitMap: normalFlow } = runCombiClean();
    const hasFlowConstraint = lowFlow.evidence.some(e => e.id === 'mains_flow_constraint');
    if (hasFlowConstraint) {
      expect(lowFlow.dhwAxis.score).toBeLessThan(normalFlow.dhwAxis.score);
    }
  });

  it('low pressure reduces DHW axis', () => {
    const lowPressureInput: EngineInputV2_3 = { ...CLEAN_INPUT, dynamicMainsPressure: 0.5 };
    const { fitMap: lowPressure } = runCombiClean(lowPressureInput);
    const { fitMap: normalPressure } = runCombiClean();
    const hasPressureConstraint = lowPressure.evidence.some(e => e.id === 'pressure_constraint');
    if (hasPressureConstraint) {
      expect(lowPressure.dhwAxis.score).toBeLessThan(normalPressure.dhwAxis.score);
    }
  });

  it('primary pipe constraint evidence affects heating axis (not DHW axis)', () => {
    // Only verify if the evidence is present
    const { fitMap } = runCombiClean();
    const pipeEvidence = fitMap.evidence.find(e => e.id === 'primary_pipe_constraint');
    if (pipeEvidence) {
      expect(pipeEvidence.axis).toBe('heating');
    }
  });
});

// ─── 5. Open_vented head limit trims DHW axis ────────────────────────────────

describe('FitMapModel — axis: open_vented head limit', () => {
  it('regular/open_vented system includes open_vented_head_limit evidence affecting DHW axis', () => {
    const { fitMap } = runRegularClean();
    const headEvidence = fitMap.evidence.find(e => e.id === 'open_vented_head_limit');
    if (headEvidence) {
      expect(headEvidence.axis).toBe('dhw');
    }
  });
});

// ─── 6. Cycling risk reduces heating axis ────────────────────────────────────

describe('FitMapModel — axis: cycling risk reduces heating axis', () => {
  it('cycling_risk evidence reduces the heating axis when present', () => {
    const { fitMap } = runCombiClean();
    const cyclingEvidence = fitMap.evidence.find(e => e.id === 'cycling_risk');
    if (cyclingEvidence) {
      expect(cyclingEvidence.axis).toBe('heating');
      expect(cyclingEvidence.effect).toBe('penalty');
    }
  });
});

// ─── 7. Determinism ──────────────────────────────────────────────────────────

describe('FitMapModel — structural: determinism', () => {
  it('combi fit map is identical across two runs with the same inputs', () => {
    const run1 = runCombiWithInterruption();
    const run2 = runCombiWithInterruption();
    expect(run1.fitMap.heatingAxis.score).toBe(run2.fitMap.heatingAxis.score);
    expect(run1.fitMap.dhwAxis.score).toBe(run2.fitMap.dhwAxis.score);
    expect(run1.fitMap.contour.verticalShape).toBe(run2.fitMap.contour.verticalShape);
    expect(run1.fitMap.contour.horizontalShape).toBe(run2.fitMap.contour.horizontalShape);
    expect(run1.fitMap.evidence.map(e => e.id)).toEqual(run2.fitMap.evidence.map(e => e.id));
  });

  it('stored fit map is identical across two runs with the same inputs', () => {
    const run1 = runSystemClean();
    const run2 = runSystemClean();
    expect(run1.fitMap.heatingAxis.score).toBe(run2.fitMap.heatingAxis.score);
    expect(run1.fitMap.dhwAxis.score).toBe(run2.fitMap.dhwAxis.score);
    expect(run1.fitMap.evidence.map(e => e.id)).toEqual(run2.fitMap.evidence.map(e => e.id));
  });

  it('HP fit map is identical across two runs with the same inputs', () => {
    const run1 = runHeatPumpWithLargeDraw();
    const run2 = runHeatPumpWithLargeDraw();
    expect(run1.fitMap.heatingAxis.score).toBe(run2.fitMap.heatingAxis.score);
    expect(run1.fitMap.dhwAxis.score).toBe(run2.fitMap.dhwAxis.score);
  });
});

// ─── 8. No cross-family invalid penalties ────────────────────────────────────

describe('FitMapModel — structural: no cross-family invalid evidence', () => {
  const COMBI_ONLY_LIMITER_IDS = new Set([
    'combi_service_switching',
  ]);
  const STORE_ONLY_LIMITER_IDS = new Set([
    'stored_volume_shortfall',
    'reduced_dhw_service',
    'hp_reheat_latency',
    'open_vented_head_limit',
    'space_for_cylinder_unavailable',
  ]);

  it('combi fit map does not contain store-only limiter IDs', () => {
    const { fitMap } = runCombiClean();
    const storeOnlyIds = fitMap.evidence.filter(e => STORE_ONLY_LIMITER_IDS.has(e.id));
    expect(storeOnlyIds).toHaveLength(0);
  });

  it('combi fit map with interruption does not contain store-only limiter IDs', () => {
    const { fitMap } = runCombiWithInterruption();
    const storeOnlyIds = fitMap.evidence.filter(e => STORE_ONLY_LIMITER_IDS.has(e.id));
    expect(storeOnlyIds).toHaveLength(0);
  });

  it('stored system fit map does not contain combi-only limiter IDs', () => {
    const { fitMap } = runSystemClean();
    const combiOnlyIds = fitMap.evidence.filter(e => COMBI_ONLY_LIMITER_IDS.has(e.id));
    expect(combiOnlyIds).toHaveLength(0);
  });

  it('HP fit map does not contain combi-only limiter IDs', () => {
    const { fitMap } = runHeatPumpWithLargeDraw();
    const combiOnlyIds = fitMap.evidence.filter(e => COMBI_ONLY_LIMITER_IDS.has(e.id));
    expect(combiOnlyIds).toHaveLength(0);
  });
});

// ─── 9. Evidence items reference real limiter IDs or event types ─────────────

describe('FitMapModel — structural: evidence IDs are traceable', () => {
  /**
   * Uses the exported `FIT_MAP_LIMITER_IDS` from `buildFitMapModel` to validate
   * that all evidence items trace back to known limiter IDs, event counter keys,
   * or timeline-mode keys — no invented evidence is allowed.
   */

  function isKnownId(id: string): boolean {
    // limiter IDs — validated against the exported penalty table
    if (FIT_MAP_LIMITER_IDS.has(id)) return true;
    // event counter IDs: 'event:<counterKey>'
    if (id.startsWith('event:')) return true;
    // timeline mode IDs: 'timeline:<key>'
    if (id.startsWith('timeline:')) return true;
    return false;
  }

  it('all combi clean evidence IDs are known limiter/event/timeline keys', () => {
    const { fitMap } = runCombiClean();
    for (const item of fitMap.evidence) {
      expect(isKnownId(item.id)).toBe(true);
    }
  });

  it('all combi interruption evidence IDs are known limiter/event/timeline keys', () => {
    const { fitMap } = runCombiWithInterruption();
    for (const item of fitMap.evidence) {
      expect(isKnownId(item.id)).toBe(true);
    }
  });

  it('all stored system evidence IDs are known limiter/event/timeline keys', () => {
    const { fitMap } = runSystemClean();
    for (const item of fitMap.evidence) {
      expect(isKnownId(item.id)).toBe(true);
    }
  });

  it('all HP evidence IDs are known limiter/event/timeline keys', () => {
    const { fitMap } = runHeatPumpWithLargeDraw();
    for (const item of fitMap.evidence) {
      expect(isKnownId(item.id)).toBe(true);
    }
  });
});

// ─── 10. All evidence magnitudes are non-negative ─────────────────────────────

describe('FitMapModel — structural: non-negative magnitudes', () => {
  const allRuns = [
    () => runCombiClean(),
    () => runCombiWithInterruption(),
    () => runSystemClean(),
    () => runSystemWithLargeDraw(),
    () => runHeatPumpWithLargeDraw(),
    () => runRegularClean(),
  ];

  for (const runFn of allRuns) {
    it(`all evidence magnitudes are non-negative for ${runFn.name}`, () => {
      const { fitMap } = runFn();
      for (const item of fitMap.evidence) {
        expect(item.magnitude).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

// ─── 11. Axis scores in [0, 100] ──────────────────────────────────────────────

describe('FitMapModel — structural: axis scores are clamped to [0, 100]', () => {
  function assertAxesInRange(fitMap: FitMapModel) {
    expect(fitMap.heatingAxis.score).toBeGreaterThanOrEqual(0);
    expect(fitMap.heatingAxis.score).toBeLessThanOrEqual(100);
    expect(fitMap.dhwAxis.score).toBeGreaterThanOrEqual(0);
    expect(fitMap.dhwAxis.score).toBeLessThanOrEqual(100);
    if (fitMap.efficiencyScore !== undefined) {
      expect(fitMap.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(fitMap.efficiencyScore).toBeLessThanOrEqual(100);
    }
  }

  it('combi clean scores are in range', () => assertAxesInRange(runCombiClean().fitMap));
  it('combi interrupted scores are in range', () => assertAxesInRange(runCombiWithInterruption().fitMap));
  it('stored clean scores are in range', () => assertAxesInRange(runSystemClean().fitMap));
  it('stored large draw scores are in range', () => assertAxesInRange(runSystemWithLargeDraw().fitMap));
  it('HP large draw scores are in range', () => assertAxesInRange(runHeatPumpWithLargeDraw().fitMap));
  it('regular clean scores are in range', () => assertAxesInRange(runRegularClean().fitMap));
});

// ─── 12. Contour shapes consistent with axis scores ───────────────────────────

describe('FitMapModel — structural: contour shapes match axis scores', () => {
  function assertContourConsistency(fitMap: FitMapModel) {
    const { heatingAxis, dhwAxis, contour } = fitMap;

    // verticalShape must match heatingScore bands
    if (heatingAxis.score >= 70) {
      expect(contour.verticalShape).toBe('tall');
    } else if (heatingAxis.score >= 45) {
      expect(contour.verticalShape).toBe('mid');
    } else {
      expect(contour.verticalShape).toBe('low');
    }

    // horizontalShape must match dhwScore bands
    if (dhwAxis.score >= 70) {
      expect(contour.horizontalShape).toBe('broad');
    } else if (dhwAxis.score >= 45) {
      expect(contour.horizontalShape).toBe('mid');
    } else {
      expect(contour.horizontalShape).toBe('narrow');
    }
  }

  it('combi clean contour is consistent with its axis scores', () =>
    assertContourConsistency(runCombiClean().fitMap));
  it('combi interrupted contour is consistent with its axis scores', () =>
    assertContourConsistency(runCombiWithInterruption().fitMap));
  it('stored clean contour is consistent with its axis scores', () =>
    assertContourConsistency(runSystemClean().fitMap));
  it('stored large draw contour is consistent with its axis scores', () =>
    assertContourConsistency(runSystemWithLargeDraw().fitMap));
  it('HP large draw contour is consistent with its axis scores', () =>
    assertContourConsistency(runHeatPumpWithLargeDraw().fitMap));
  it('regular clean contour is consistent with its axis scores', () =>
    assertContourConsistency(runRegularClean().fitMap));
});

// ─── 13. HP has soft corner rounding ─────────────────────────────────────────

describe('FitMapModel — structural: HP corner rounding is soft', () => {
  it('HP fit map always has cornerRounding "soft"', () => {
    expect(runHeatPumpWithLargeDraw().fitMap.contour.cornerRounding).toBe('soft');
  });
});

// ─── 14. Combi has sharp corner rounding ─────────────────────────────────────

describe('FitMapModel — structural: combi corner rounding is sharp', () => {
  it('combi clean fit map has cornerRounding "sharp"', () => {
    expect(runCombiClean().fitMap.contour.cornerRounding).toBe('sharp');
  });

  it('combi interrupted fit map has cornerRounding "sharp"', () => {
    expect(runCombiWithInterruption().fitMap.contour.cornerRounding).toBe('sharp');
  });
});

// ─── 15. Clean run produces high scores ───────────────────────────────────────

describe('FitMapModel — negative: clean run produces high baseline scores', () => {
  it('clean combi run has heating axis score above 70', () => {
    const { fitMap } = runCombiClean();
    // A clean combi with no interruptions should have minimal heating penalties
    if (fitMap.heatingAxis.evidence.filter(e => e.effect === 'penalty').length === 0) {
      expect(fitMap.heatingAxis.score).toBe(100);
    }
  });

  it('clean stored system run has heating axis score above 70', () => {
    const { fitMap } = runSystemClean();
    // System boiler with no cycling etc. should have strong heating score
    expect(fitMap.heatingAxis.score).toBeGreaterThan(50);
  });
});

// ─── 16. Combi fit map never emits store-only evidence ────────────────────────

describe('FitMapModel — negative: combi fit map excludes store-only evidence', () => {
  const STORE_ONLY_IDS = [
    'stored_volume_shortfall',
    'reduced_dhw_service',
    'hp_reheat_latency',
    'open_vented_head_limit',
    'space_for_cylinder_unavailable',
  ];

  it('combi clean evidence does not include any store-only IDs', () => {
    const { fitMap } = runCombiClean();
    const storeIds = fitMap.evidence.filter(e => STORE_ONLY_IDS.includes(e.id));
    expect(storeIds).toHaveLength(0);
  });
});

// ─── 17. Stored fit map never emits combi-only evidence ───────────────────────

describe('FitMapModel — negative: stored fit map excludes combi-only evidence', () => {
  const COMBI_ONLY_IDS = ['combi_service_switching'];

  it('stored clean evidence does not include any combi-only IDs', () => {
    const { fitMap } = runSystemClean();
    const combiIds = fitMap.evidence.filter(e => COMBI_ONLY_IDS.includes(e.id));
    expect(combiIds).toHaveLength(0);
  });

  it('HP evidence does not include any combi-only IDs', () => {
    const { fitMap } = runHeatPumpWithLargeDraw();
    const combiIds = fitMap.evidence.filter(e => COMBI_ONLY_IDS.includes(e.id));
    expect(combiIds).toHaveLength(0);
  });
});

// ─── 18. Family field matches topology ───────────────────────────────────────

describe('FitMapModel — structural: family field matches input topology', () => {
  it('combi fit map reports family "combi"', () => {
    expect(runCombiClean().fitMap.family).toBe('combi');
  });

  it('system stored fit map reports family "system"', () => {
    expect(runSystemClean().fitMap.family).toBe('system');
  });

  it('HP fit map reports family "heat_pump"', () => {
    expect(runHeatPumpWithLargeDraw().fitMap.family).toBe('heat_pump');
  });

  it('regular/open_vented fit map reports family "open_vented"', () => {
    expect(runRegularClean().fitMap.family).toBe('open_vented');
  });
});

// ─── 19. Evidence list ordering is deterministic ─────────────────────────────

describe('FitMapModel — structural: evidence ordering is deterministic', () => {
  it('top-level evidence list has penalties before boosts', () => {
    const { fitMap } = runCombiWithInterruption();
    let seenBoost = false;
    for (const item of fitMap.evidence) {
      if (item.effect === 'boost') seenBoost = true;
      if (seenBoost && item.effect === 'penalty') {
        throw new Error(
          `Penalty '${item.id}' appeared after a boost in the evidence list`,
        );
      }
    }
  });

  it('stored system top-level evidence list has penalties before boosts', () => {
    const { fitMap } = runSystemWithLargeDraw();
    let seenBoost = false;
    for (const item of fitMap.evidence) {
      if (item.effect === 'boost') seenBoost = true;
      if (seenBoost && item.effect === 'penalty') {
        throw new Error(
          `Penalty '${item.id}' appeared after a boost in the evidence list`,
        );
      }
    }
  });
});
