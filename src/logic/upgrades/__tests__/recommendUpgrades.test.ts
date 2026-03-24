/**
 * recommendUpgrades.test.ts
 *
 * Tests for the PR 4 Recommended Upgrades Engine.
 *
 * Acceptance criteria covered:
 *
 * Combi
 *   1.  clustered hot-water demand triggers bigger combi recommendation
 *   2.  low mains pressure does not recommend bigger combi as the sole fix
 *   3.  poor condition triggers system clean and magnetic filter
 *   4.  basic controls trigger controls upgrade
 *
 * Stored water
 *   5.  high demand triggers cylinder size recommendation
 *   6.  stored-water path recommends S-plan controls
 *   7.  poor condition triggers system clean and magnetic filter
 *
 * Heat pump
 *   8.  22 mm primaries trigger 28 mm pipe upgrade
 *   9.  heat pump path recommends larger cylinder
 *  10.  basic controls trigger controls upgrade
 *
 * General
 *  11.  upgrades are deterministic
 *  12.  irrelevant upgrades are omitted per system type
 */

import { describe, it, expect } from 'vitest';
import { recommendUpgrades } from '../recommendUpgrades';
import type { RecommendUpgradesInputs } from '../types';
import type { ClassifiedDayEvent, ClassifiedDaySchedule, OutcomeSystemSpec } from '../../outcomes/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Build a minimal ClassifiedDaySchedule with controllable outcome counts. */
function makeOutcomes(overrides: {
  hwSuccessful?: number;
  hwReduced?: number;
  hwConflict?: number;
  avgBathFill?: number | null;
  heatingSuccessful?: number;
  heatingReduced?: number;
  heatingConflict?: number;
  outsideTarget?: number;
}): ClassifiedDaySchedule {
  return {
    systemLabel: 'test-system',
    events: [],
    hotWater: {
      totalDraws:
        (overrides.hwSuccessful ?? 0) +
        (overrides.hwReduced ?? 0) +
        (overrides.hwConflict ?? 0),
      successful:                overrides.hwSuccessful ?? 0,
      reduced:                   overrides.hwReduced    ?? 0,
      conflict:                  overrides.hwConflict   ?? 0,
      averageBathFillTimeMinutes: overrides.avgBathFill ?? null,
    },
    heating: {
      totalHeatingEvents:
        (overrides.heatingSuccessful ?? 0) +
        (overrides.heatingReduced    ?? 0) +
        (overrides.heatingConflict   ?? 0),
      successful:           overrides.heatingSuccessful ?? 0,
      reduced:              overrides.heatingReduced    ?? 0,
      conflict:             overrides.heatingConflict   ?? 0,
      outsideTargetEventCount: overrides.outsideTarget  ?? 0,
    },
  };
}

/** Clean combi spec — good baseline for combi tests. */
const CLEAN_COMBI: OutcomeSystemSpec = {
  systemType:              'combi',
  heatOutputKw:            24,
  mainsDynamicPressureBar: 1.0,
  controlsQuality:         'good',
  systemCondition:         'clean',
};

/** Stored-water spec — good baseline for stored-water tests. */
const CLEAN_STORED: OutcomeSystemSpec = {
  systemType:               'stored_water',
  hotWaterStorageLitres:    150,
  recoveryRateLitresPerHour: 60,
  heatOutputKw:             18,
  controlsQuality:          'good',
  systemCondition:          'clean',
};

/** Heat-pump spec — good baseline for heat-pump tests. */
const CLEAN_HP: OutcomeSystemSpec = {
  systemType:               'heat_pump',
  hotWaterStorageLitres:    200,
  recoveryRateLitresPerHour: 30,
  heatOutputKw:             10,
  lowTempSuitability:       'high',
  controlsQuality:          'good',
  systemCondition:          'clean',
};

// ─── Combi tests ──────────────────────────────────────────────────────────────

describe('combi: clustered hot-water demand', () => {
  it('triggers bigger combi recommendation when shortfall events are present', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_COMBI,
      outcomes:   makeOutcomes({ hwReduced: 2, hwConflict: 1 }),
      // Two bathrooms → concurrent demand profile drives sizing to 35 kW.
      bathroomCount: 2,
    };

    const pkg = recommendUpgrades(inputs);

    expect(pkg.systemType).toBe('combi');
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiUpgrade).toBeDefined();
    expect(combiUpgrade?.value).toBe(35);
    expect(combiUpgrade?.effectTags).toContain('reduces_conflict');
  });

  it('marks combi-size upgrade as essential when shortfall count is ≥ 3', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_COMBI,
      outcomes:   makeOutcomes({ hwReduced: 2, hwConflict: 2 }),
      // Two bathrooms to trigger the concurrent-demand sizing rule.
      bathroomCount: 2,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');

    expect(combiUpgrade?.priority).toBe('essential');
  });

  it('does not recommend bigger combi when zero shortfall events', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_COMBI,
      outcomes:   makeOutcomes({ hwSuccessful: 4 }),
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiUpgrade).toBeUndefined();
  });
});

describe('combi: low mains pressure bottleneck', () => {
  it('surfaces pressure note instead of silently recommending bigger combi', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:              { ...CLEAN_COMBI, mainsDynamicPressureBar: 0.2 },
      outcomes:                makeOutcomes({ hwReduced: 2, hwConflict: 1 }),
      mainsDynamicPressureBar: 0.2,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');

    // Must still be present — but the label must flag the pressure issue
    expect(combiUpgrade).toBeDefined();
    expect(combiUpgrade?.label).toMatch(/[Mm]ains pressure/);
    // It must NOT carry a numeric kW value — that would imply a simple upsize
    expect(typeof combiUpgrade?.value).not.toBe('number');
  });

  it('does not set value to a kW figure when pressure is the bottleneck', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:              { ...CLEAN_COMBI, mainsDynamicPressureBar: 0.25 },
      outcomes:                makeOutcomes({ hwReduced: 3 }),
      mainsDynamicPressureBar: 0.25,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiUpgrade?.value).toBeUndefined();
  });
});

describe('combi: poor condition', () => {
  it('triggers system clean recommendation', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:      { ...CLEAN_COMBI, systemCondition: 'poor' },
      outcomes:        makeOutcomes({ heatingReduced: 2 }),
      systemCondition: 'poor',
    };

    const pkg = recommendUpgrades(inputs);
    const cleanUpgrade = pkg.upgrades.find((u) => u.kind === 'system_clean');
    expect(cleanUpgrade).toBeDefined();
    expect(cleanUpgrade?.priority).toBe('essential');
  });

  it('triggers magnetic filter recommendation', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:      { ...CLEAN_COMBI, systemCondition: 'poor' },
      outcomes:        makeOutcomes({ heatingReduced: 2 }),
      systemCondition: 'poor',
    };

    const pkg = recommendUpgrades(inputs);
    const filterUpgrade = pkg.upgrades.find((u) => u.kind === 'magnetic_filter');
    expect(filterUpgrade).toBeDefined();
    expect(filterUpgrade?.priority).toBe('essential');
  });
});

describe('combi: basic controls', () => {
  it('triggers controls upgrade when heating shortfall exists', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:     { ...CLEAN_COMBI, controlsQuality: 'basic' },
      outcomes:       makeOutcomes({ heatingReduced: 2, outsideTarget: 1 }),
      controlsQuality: 'basic',
    };

    const pkg = recommendUpgrades(inputs);
    const controlsUpgrade = pkg.upgrades.find((u) => u.kind === 'controls_upgrade');
    expect(controlsUpgrade).toBeDefined();
    expect(controlsUpgrade?.effectTags).toContain('improves_heating_stability');
  });

  it('does not trigger controls upgrade when controls are already good', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:     { ...CLEAN_COMBI, controlsQuality: 'good' },
      outcomes:       makeOutcomes({ heatingReduced: 2 }),
      controlsQuality: 'good',
    };

    const pkg = recommendUpgrades(inputs);
    const controlsUpgrade = pkg.upgrades.find((u) => u.kind === 'controls_upgrade');
    expect(controlsUpgrade).toBeUndefined();
  });
});

// ─── Stored water tests ───────────────────────────────────────────────────────

describe('stored water: cylinder size', () => {
  it('recommends cylinder when hot-water shortfall events are present', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   makeOutcomes({ hwReduced: 2, hwConflict: 1 }),
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');

    expect(cylUpgrade).toBeDefined();
    expect(typeof cylUpgrade?.value).toBe('number');
    expect(cylUpgrade?.effectTags).toContain('improves_hot_water_recovery');
  });

  it('marks cylinder upgrade as essential when shortfall ≥ 2', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   makeOutcomes({ hwReduced: 1, hwConflict: 1 }),
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');
    expect(cylUpgrade?.priority).toBe('essential');
  });

  it('recommends a larger cylinder for larger households', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:           CLEAN_STORED,
      outcomes:             makeOutcomes({ hwSuccessful: 3 }),
      householdComposition: {
        adultCount:                  2,
        youngAdultCount18to25AtHome: 0,
        childCount0to4:              0,
        childCount5to10:             2,
        childCount11to17:            1,
      },
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');

    expect(cylUpgrade).toBeDefined();
    // 5-person household → should suggest ≥ 180 L
    expect(cylUpgrade?.value as number).toBeGreaterThanOrEqual(180);
  });
});

describe('stored water: S-plan controls', () => {
  it('recommends S-plan controls for stored-water system', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   makeOutcomes({ hwSuccessful: 2 }),
    };

    const pkg = recommendUpgrades(inputs);
    const planUpgrade = pkg.upgrades.find((u) => u.kind === 'system_controls_plan');

    expect(planUpgrade).toBeDefined();
    expect(planUpgrade?.label).toMatch(/[Ss]-plan/);
    expect(planUpgrade?.effectTags).toContain('improves_heating_stability');
  });
});

describe('stored water: poor condition', () => {
  it('triggers system clean recommendation', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:      { ...CLEAN_STORED, systemCondition: 'poor' },
      outcomes:        makeOutcomes({ heatingReduced: 2 }),
      systemCondition: 'poor',
    };

    const pkg = recommendUpgrades(inputs);
    const cleanUpgrade = pkg.upgrades.find((u) => u.kind === 'system_clean');
    expect(cleanUpgrade).toBeDefined();
  });

  it('triggers magnetic filter recommendation', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:      { ...CLEAN_STORED, systemCondition: 'average' },
      outcomes:        makeOutcomes({ heatingReduced: 3 }),
      systemCondition: 'average',
    };

    const pkg = recommendUpgrades(inputs);
    const filterUpgrade = pkg.upgrades.find((u) => u.kind === 'magnetic_filter');
    expect(filterUpgrade).toBeDefined();
  });
});

// ─── Heat pump tests ──────────────────────────────────────────────────────────

describe('heat pump: primary pipe upgrade', () => {
  it('recommends 28 mm primaries when current bore is 22 mm', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       { ...CLEAN_HP, primaryPipeSizeMm: 22 },
      outcomes:         makeOutcomes({ hwSuccessful: 2 }),
      primaryPipeSizeMm: 22,
    };

    const pkg = recommendUpgrades(inputs);
    const pipeUpgrade = pkg.upgrades.find((u) => u.kind === 'primary_pipe_upgrade');

    expect(pipeUpgrade).toBeDefined();
    expect(pipeUpgrade?.value).toBe(28);
    expect(pipeUpgrade?.effectTags).toContain('improves_low_temp_suitability');
    expect(pipeUpgrade?.effectTags).toContain('reduces_conflict');
  });

  it('marks pipe upgrade as essential when flow-constraint events are present', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       { ...CLEAN_HP, primaryPipeSizeMm: 15 },
      outcomes:         makeOutcomes({ hwConflict: 1, heatingConflict: 1 }),
      primaryPipeSizeMm: 15,
    };

    const pkg = recommendUpgrades(inputs);
    const pipeUpgrade = pkg.upgrades.find((u) => u.kind === 'primary_pipe_upgrade');
    expect(pipeUpgrade?.priority).toBe('essential');
  });

  it('does not recommend pipe upgrade when primaries are already 28 mm', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       { ...CLEAN_HP, primaryPipeSizeMm: 28 },
      outcomes:         makeOutcomes({ hwConflict: 1 }),
      primaryPipeSizeMm: 28,
    };

    const pkg = recommendUpgrades(inputs);
    const pipeUpgrade = pkg.upgrades.find((u) => u.kind === 'primary_pipe_upgrade');
    expect(pipeUpgrade).toBeUndefined();
  });
});

describe('heat pump: cylinder sizing', () => {
  it('recommends a heat-pump-sized cylinder', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_HP,
      outcomes:   makeOutcomes({ hwSuccessful: 2 }),
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');

    expect(cylUpgrade).toBeDefined();
    // Heat pump should recommend ≥ 210 L
    expect(cylUpgrade?.value as number).toBeGreaterThanOrEqual(210);
    expect(cylUpgrade?.label).toMatch(/heat-pump/i);
  });
});

describe('heat pump: basic controls', () => {
  it('triggers controls upgrade when controls are basic and heating shortfall exists', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:     { ...CLEAN_HP, controlsQuality: 'basic' },
      outcomes:       makeOutcomes({ heatingReduced: 1, outsideTarget: 2 }),
      controlsQuality: 'basic',
    };

    const pkg = recommendUpgrades(inputs);
    const controlsUpgrade = pkg.upgrades.find((u) => u.kind === 'controls_upgrade');
    expect(controlsUpgrade).toBeDefined();
  });
});

// ─── General tests ────────────────────────────────────────────────────────────

describe('general: deterministic output', () => {
  it('produces identical packages for identical inputs', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       { ...CLEAN_HP, primaryPipeSizeMm: 22, controlsQuality: 'basic' },
      outcomes:         makeOutcomes({ hwReduced: 1, heatingReduced: 2, outsideTarget: 1 }),
      primaryPipeSizeMm: 22,
      controlsQuality:  'basic',
    };

    const pkg1 = recommendUpgrades(inputs);
    const pkg2 = recommendUpgrades(inputs);

    expect(pkg1).toEqual(pkg2);
  });
});

describe('general: irrelevant upgrades are omitted', () => {
  it('combi package does not include cylinder_size upgrade', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_COMBI,
      outcomes:   makeOutcomes({ hwSuccessful: 3 }),
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');
    expect(cylUpgrade).toBeUndefined();
  });

  it('combi package does not include primary_pipe_upgrade', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       CLEAN_COMBI,
      outcomes:         makeOutcomes({ hwSuccessful: 3 }),
      primaryPipeSizeMm: 15,
    };

    const pkg = recommendUpgrades(inputs);
    const pipeUpgrade = pkg.upgrades.find((u) => u.kind === 'primary_pipe_upgrade');
    expect(pipeUpgrade).toBeUndefined();
  });

  it('combi package does not include system_controls_plan', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_COMBI,
      outcomes:   makeOutcomes({ hwSuccessful: 3 }),
    };

    const pkg = recommendUpgrades(inputs);
    const planUpgrade = pkg.upgrades.find((u) => u.kind === 'system_controls_plan');
    expect(planUpgrade).toBeUndefined();
  });

  it('heat pump package does not include combi_size upgrade', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_HP,
      outcomes:   makeOutcomes({ hwConflict: 2 }),
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiUpgrade).toBeUndefined();
  });

  it('stored water package does not include combi_size upgrade', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   makeOutcomes({ hwConflict: 2 }),
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');
    expect(combiUpgrade).toBeUndefined();
  });

  it('stored water package does not include primary_pipe_upgrade', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:        CLEAN_STORED,
      outcomes:          makeOutcomes({ hwSuccessful: 2 }),
      primaryPipeSizeMm: 15,
    };

    const pkg = recommendUpgrades(inputs);
    const pipeUpgrade = pkg.upgrades.find((u) => u.kind === 'primary_pipe_upgrade');
    expect(pipeUpgrade).toBeUndefined();
  });
});

describe('general: upgrade structure', () => {
  it('every upgrade has required fields populated', () => {
    const inputs: RecommendUpgradesInputs = {
      systemSpec:       { ...CLEAN_HP, primaryPipeSizeMm: 22, controlsQuality: 'basic' },
      outcomes:         makeOutcomes({ hwReduced: 1, heatingReduced: 2, outsideTarget: 1 }),
      primaryPipeSizeMm: 22,
      controlsQuality:  'basic',
      systemCondition:  'poor',
    };

    const pkg = recommendUpgrades(inputs);

    for (const upgrade of pkg.upgrades) {
      expect(upgrade.kind).toBeTruthy();
      expect(upgrade.category).toBeTruthy();
      expect(upgrade.label.length).toBeGreaterThan(0);
      expect(upgrade.reason.length).toBeGreaterThan(0);
      expect(upgrade.effectTags.length).toBeGreaterThan(0);
      expect(['essential', 'recommended', 'best_fit']).toContain(upgrade.priority);
    }
  });
});

// ─── Physics-based combi sizing ───────────────────────────────────────────────

describe('combi: physics-based sizing replaces fixed 35 kW heuristic', () => {
  it('2-bathroom concurrent demand profile drives 35 kW recommendation', () => {
    // Physics: 2 outlets × 6 lpm adequate = 12 lpm total;
    // P = 12 × 4.186 × 40 / 60 ≈ 33.5 kW → 35 kW standard band.
    const inputs: RecommendUpgradesInputs = {
      systemSpec:    { ...CLEAN_COMBI, heatOutputKw: 24 },
      outcomes:      makeOutcomes({ hwReduced: 1, hwConflict: 1 }),
      bathroomCount: 2,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');

    expect(combiUpgrade).toBeDefined();
    // Physics-derived target: 35 kW (not the old fixed heuristic).
    expect(combiUpgrade?.value).toBe(35);
  });

  it('single-bathroom combi (24 kW) does not recommend upsizing when demand profile is met', () => {
    // Physics: 1 outlet × 8 lpm; P = 8 × 4.186 × 40 / 60 ≈ 22.3 kW → 24 kW is adequate.
    // The shortfall has a different root cause; combi upsizing is not appropriate.
    const inputs: RecommendUpgradesInputs = {
      systemSpec:    { ...CLEAN_COMBI, heatOutputKw: 24 },
      outcomes:      makeOutcomes({ hwReduced: 1, hwConflict: 1 }),
      bathroomCount: 1,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');

    // 24 kW meets the single-outlet demand profile (~23 kW required).
    // ruleCombiSize must not fire for this scenario.
    expect(combiUpgrade).toBeUndefined();
  });

  it('undersized combi (15 kW) triggers upsizing even for single bathroom', () => {
    // A 15 kW combi delivers ~5.4 lpm at 40°C rise — below the 8 lpm single-outlet floor.
    const inputs: RecommendUpgradesInputs = {
      systemSpec:    { ...CLEAN_COMBI, heatOutputKw: 15 },
      outcomes:      makeOutcomes({ hwReduced: 2 }),
      bathroomCount: 1,
    };

    const pkg = recommendUpgrades(inputs);
    const combiUpgrade = pkg.upgrades.find((u) => u.kind === 'combi_size');

    expect(combiUpgrade).toBeDefined();
    // 15 kW is below single-outlet floor (23 kW required); recommend 24 kW band.
    expect(combiUpgrade?.value).toBe(24);
  });
});

// ─── Peak clustered demand cylinder sizing ────────────────────────────────────

describe('cylinder: peak clustered demand as primary sizing driver', () => {
  it('cylinder recommendation uses peak cluster demand when event volume data is available', () => {
    // Three back-to-back showers: 3 × 72 L = 216 L gross demand.
    // CLEAN_STORED recovery rate = 60 L/h = 1 L/min.
    // Gaps: shower1 ends min 428, shower2 starts min 429 → 1 min gap → 1 L recovery.
    //       shower2 ends min 437, shower3 starts min 438 → 1 min gap → 1 L recovery.
    // Inter-event recovery: 2 L total.
    // Net cluster demand: 216 − 2 = 214 L.
    // +20 L safety margin = 234 L → rounds to 250 L standard band.
    // vs occupancy-based for 2 adults: 150 L.
    const events: ClassifiedDayEvent[] = [
      {
        eventId: 'e1', type: 'shower', startMinute: 420, durationMinutes: 8,
        result: 'conflict', reason: '', tags: [],
        metrics: { requiredLitres: 72, usableLitresBeforeDraw: 150,
                   recoveryDuringDrawLitres: 0, servedFraction: 0.7, drawRateLpm: 9 },
      },
      {
        eventId: 'e2', type: 'shower', startMinute: 429, durationMinutes: 8,
        result: 'conflict', reason: '', tags: [],
        metrics: { requiredLitres: 72, usableLitresBeforeDraw: 90,
                   recoveryDuringDrawLitres: 1, servedFraction: 0.6, drawRateLpm: 9 },
      },
      {
        eventId: 'e3', type: 'shower', startMinute: 438, durationMinutes: 8,
        result: 'reduced', reason: '', tags: [],
        metrics: { requiredLitres: 72, usableLitresBeforeDraw: 30,
                   recoveryDuringDrawLitres: 1, servedFraction: 0.4, drawRateLpm: 9 },
      },
    ];
    const schedule: ClassifiedDaySchedule = {
      systemLabel: 'test-system',
      events,
      hotWater: {
        totalDraws: 3, successful: 0, reduced: 1, conflict: 2,
        simultaneousEventCount: 0, averageBathFillTimeMinutes: null,
      },
      heating: {
        totalHeatingEvents: 0, successful: 0, reduced: 0, conflict: 0,
        outsideTargetEventCount: 0,
      },
    };

    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   schedule,
      householdComposition: {
        adultCount: 2, youngAdultCount18to25AtHome: 0,
        childCount0to4: 0, childCount5to10: 0, childCount11to17: 0,
      },
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');

    expect(cylUpgrade).toBeDefined();
    // Peak cluster path: ≈ 234 L → 250 L band — well above occupancy floor (150 L).
    expect(cylUpgrade?.value as number).toBeGreaterThan(150);
  });

  it('cylinder falls back to occupancy sizing when no shortfall events exist', () => {
    // No shortfall → demand data does not activate the peak-demand path.
    // Occupancy-based sizing is used as the sole driver.
    const inputs: RecommendUpgradesInputs = {
      systemSpec: CLEAN_STORED,
      outcomes:   makeOutcomes({ hwSuccessful: 4 }),
      householdComposition: {
        adultCount: 2, youngAdultCount18to25AtHome: 0,
        childCount0to4: 0, childCount5to10: 0, childCount11to17: 0,
      },
    };

    const pkg = recommendUpgrades(inputs);
    const cylUpgrade = pkg.upgrades.find((u) => u.kind === 'cylinder_size');

    // No essential upsizing without shortfall evidence.
    if (cylUpgrade) {
      expect(cylUpgrade.priority).not.toBe('essential');
    }
  });
});
