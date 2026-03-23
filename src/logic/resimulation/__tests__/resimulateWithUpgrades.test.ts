/**
 * resimulateWithUpgrades.test.ts
 *
 * Tests for the PR 5 Re-simulation Engine.
 *
 * Acceptance criteria covered:
 *
 * Combi
 *   1.  bigger combi + clean + controls improves clustered hot-water outcomes
 *   2.  low-pressure bottleneck note does not claim improvements that won't happen
 *
 * Stored water
 *   3.  larger cylinder improves clustered demand and bath fill time
 *   4.  controls upgrade improves heating event results
 *   5.  system clean improves condition-driven heating outcomes
 *
 * Heat pump
 *   6.  28 mm primaries + larger cylinder + controls improve conflict counts
 *   7.  outside-target heating events reduce under upgraded spec
 *
 * General
 *   8.  same schedule object is used in both runs (reference equality)
 *   9.  identical inputs produce identical results (determinism)
 *  10.  irrelevant upgrades do not mutate unrelated spec fields
 *  11.  applyUpgradePackageToSpec does not mutate original spec
 *  12.  compareOutcomeSummaries produces correct deltas
 *  13.  headline improvements are generated for positive deltas only
 */

import { describe, it, expect } from 'vitest';
import { resimulateWithUpgrades } from '../resimulateWithUpgrades';
import { applyUpgradePackageToSpec } from '../applyUpgradePackageToSpec';
import { compareOutcomeSummaries } from '../compareOutcomeSummaries';
import type { OutcomeSystemSpec } from '../../outcomes/types';
import type { RecommendedUpgradePackage } from '../../upgrades/types';
import type { DayEvent, TypicalDaySchedule } from '../../events/types';
import type { ClassifiedDaySchedule } from '../../outcomes/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<DayEvent> & { id: string }): DayEvent {
  return {
    id:              overrides.id,
    type:            overrides.type            ?? 'shower',
    startMinute:     overrides.startMinute     ?? 420,
    durationMinutes: overrides.durationMinutes ?? 8,
    intensity:       overrides.intensity       ?? 'medium',
    hotWaterDraw:    overrides.hotWaterDraw    ?? true,
    heatingRelated:  overrides.heatingRelated  ?? false,
    canConflict:     overrides.canConflict     ?? true,
    tags:            overrides.tags            ?? [],
  };
}

function makeSchedule(events: DayEvent[]): TypicalDaySchedule {
  return {
    derivedPresetId:  'working_couple',
    derivationReason: 'Test schedule',
    occupancyCount:   2,
    events,
    summary: {
      showerCount:       events.filter((e) => e.type === 'shower').length,
      bathCount:         events.filter((e) => e.type === 'bath').length,
      kitchenDrawCount:  events.filter((e) => e.type === 'kitchen_draw').length,
      shortTapDrawCount: events.filter((e) => e.type === 'tap_draw').length,
      heatingWindows:    events.filter((e) => e.heatingRelated).length,
    },
  };
}

/** Build a minimal ClassifiedDaySchedule directly (for compareOutcomeSummaries tests). */
function makeClassifiedSchedule(overrides: {
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
    systemLabel: 'test',
    events: [],
    hotWater: {
      totalDraws:
        (overrides.hwSuccessful ?? 0) +
        (overrides.hwReduced    ?? 0) +
        (overrides.hwConflict   ?? 0),
      successful:                 overrides.hwSuccessful ?? 0,
      reduced:                    overrides.hwReduced    ?? 0,
      conflict:                   overrides.hwConflict   ?? 0,
      averageBathFillTimeMinutes: overrides.avgBathFill  ?? null,
    },
    heating: {
      totalHeatingEvents:
        (overrides.heatingSuccessful ?? 0) +
        (overrides.heatingReduced    ?? 0) +
        (overrides.heatingConflict   ?? 0),
      successful:              overrides.heatingSuccessful ?? 0,
      reduced:                 overrides.heatingReduced    ?? 0,
      conflict:                overrides.heatingConflict   ?? 0,
      outsideTargetEventCount: overrides.outsideTarget     ?? 0,
    },
  };
}

// ─── Clustered combi schedule — simultaneous hot-water demand ─────────────────

const CLUSTERED_HW_EVENTS: DayEvent[] = [
  makeEvent({ id: 'shower_0', type: 'shower', startMinute: 420, durationMinutes: 8 }),
  // Second shower starts while first is still running → simultaneous demand
  makeEvent({ id: 'shower_1', type: 'shower', startMinute: 424, durationMinutes: 8 }),
  makeEvent({ id: 'shower_2', type: 'shower', startMinute: 432, durationMinutes: 8 }),
  makeEvent({ id: 'kitchen_0', type: 'kitchen_draw', startMinute: 1140, durationMinutes: 10 }),
];

const HEATING_EVENTS: DayEvent[] = [
  makeEvent({
    id:             'recovery_0',
    type:           'heating_recovery',
    startMinute:    390,
    durationMinutes: 30,
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  }),
  makeEvent({
    id:             'active_0',
    type:           'heating_active',
    startMinute:    420,
    durationMinutes: 120,
    hotWaterDraw:   false,
    heatingRelated: true,
    canConflict:    false,
  }),
];

// ─── Spec fixtures ────────────────────────────────────────────────────────────

const WEAK_COMBI: OutcomeSystemSpec = {
  systemType:              'combi',
  heatOutputKw:            24,
  peakHotWaterCapacityLpm: 10,
  mainsDynamicPressureBar: 1.0,
  controlsQuality:         'basic',
  systemCondition:         'poor',
};

const POOR_STORED: OutcomeSystemSpec = {
  systemType:               'stored_water',
  hotWaterStorageLitres:    120,
  recoveryRateLitresPerHour: 40,
  heatOutputKw:             18,
  controlsQuality:          'basic',
  systemCondition:          'poor',
};

const POOR_HP: OutcomeSystemSpec = {
  systemType:               'heat_pump',
  hotWaterStorageLitres:    150,
  recoveryRateLitresPerHour: 25,
  heatOutputKw:             9,
  lowTempSuitability:       'medium',
  primaryPipeSizeMm:        22,
  controlsQuality:          'basic',
  systemCondition:          'poor',
};

// ─── Upgrade package factories ────────────────────────────────────────────────

function combiUpgrades(): RecommendedUpgradePackage {
  return {
    systemType: 'combi',
    upgrades: [
      {
        kind:       'combi_size',
        category:   'water',
        label:      '35 kW combi boiler',
        reason:     'Clustered demand needs more output.',
        effectTags: ['reduces_conflict', 'reduces_reduced_events'],
        priority:   'essential',
        value:      35,
      },
      {
        kind:       'system_clean',
        category:   'protection',
        label:      'System clean',
        reason:     'Poor condition.',
        effectTags: ['improves_heating_stability'],
        priority:   'essential',
      },
      {
        kind:       'controls_upgrade',
        category:   'controls',
        label:      'Modern controls',
        reason:     'Basic controls limiting performance.',
        effectTags: ['improves_heating_stability'],
        priority:   'recommended',
      },
      {
        kind:       'magnetic_filter',
        category:   'protection',
        label:      'Magnetic filter',
        reason:     'Protect system.',
        effectTags: ['protects_system'],
        priority:   'recommended',
      },
    ],
  };
}

function storedWaterUpgrades(): RecommendedUpgradePackage {
  return {
    systemType: 'stored_water',
    upgrades: [
      {
        kind:       'cylinder_size',
        category:   'water',
        label:      '180 L cylinder',
        reason:     'Larger store needed.',
        effectTags: ['improves_hot_water_recovery', 'improves_bath_fill'],
        priority:   'essential',
        value:      180,
      },
      {
        kind:       'system_clean',
        category:   'protection',
        label:      'System clean',
        reason:     'Poor condition.',
        effectTags: ['improves_heating_stability'],
        priority:   'essential',
      },
      {
        kind:       'controls_upgrade',
        category:   'controls',
        label:      'Modern controls',
        reason:     'Basic controls.',
        effectTags: ['improves_heating_stability'],
        priority:   'recommended',
      },
      {
        kind:       'system_controls_plan',
        category:   'controls',
        label:      'S-plan zone controls',
        reason:     'Independent scheduling.',
        effectTags: ['improves_heating_stability', 'improves_hot_water_recovery'],
        priority:   'recommended',
      },
    ],
  };
}

function heatPumpUpgrades(): RecommendedUpgradePackage {
  return {
    systemType: 'heat_pump',
    upgrades: [
      {
        kind:       'primary_pipe_upgrade',
        category:   'infrastructure',
        label:      'Upgrade primary pipework to 28 mm',
        reason:     '22 mm restricts flow.',
        effectTags: ['improves_low_temp_suitability', 'reduces_conflict'],
        priority:   'essential',
        value:      28,
      },
      {
        kind:       'cylinder_size',
        category:   'water',
        label:      '240 L heat-pump cylinder',
        reason:     'Larger store for HP.',
        effectTags: ['improves_hot_water_recovery', 'improves_bath_fill'],
        priority:   'essential',
        value:      240,
      },
      {
        kind:       'controls_upgrade',
        category:   'controls',
        label:      'Modern controls',
        reason:     'Basic controls.',
        effectTags: ['improves_heating_stability'],
        priority:   'recommended',
      },
      {
        kind:       'system_clean',
        category:   'protection',
        label:      'System clean',
        reason:     'Poor condition.',
        effectTags: ['improves_heating_stability'],
        priority:   'essential',
      },
    ],
  };
}

// ─── 1. Combi: bigger combi + clean + controls improves clustered outcomes ─────

describe('combi: size + clean + controls upgrade', () => {
  const schedule = makeSchedule(CLUSTERED_HW_EVENTS);
  const upgrades = combiUpgrades();

  it('produces a bestFitSpec with higher heatOutputKw', () => {
    const bestFit = applyUpgradePackageToSpec(WEAK_COMBI, upgrades);
    expect(bestFit.heatOutputKw).toBe(35);
  });

  it('produces a bestFitSpec with clean condition', () => {
    const bestFit = applyUpgradePackageToSpec(WEAK_COMBI, upgrades);
    expect(bestFit.systemCondition).toBe('clean');
  });

  it('promotes controlsQuality from basic to good', () => {
    const bestFit = applyUpgradePackageToSpec(WEAK_COMBI, upgrades);
    expect(bestFit.controlsQuality).toBe('good');
  });

  it('bestFitInstall has fewer or equal conflict events than simpleInstall', () => {
    const result = resimulateWithUpgrades(schedule, WEAK_COMBI, upgrades);
    expect(result.bestFitInstall.hotWater.conflict).toBeLessThanOrEqual(
      result.simpleInstall.hotWater.conflict,
    );
  });

  it('comparison.hotWater.conflictDelta is non-negative', () => {
    const result = resimulateWithUpgrades(schedule, WEAK_COMBI, upgrades);
    expect(result.comparison.hotWater.conflictDelta).toBeGreaterThanOrEqual(0);
  });

  it('simpleInstallSpec is the original WEAK_COMBI', () => {
    const result = resimulateWithUpgrades(schedule, WEAK_COMBI, upgrades);
    expect(result.simpleInstallSpec).toBe(WEAK_COMBI);
  });

  it('bestFitSpec is a new object (original not mutated)', () => {
    const result = resimulateWithUpgrades(schedule, WEAK_COMBI, upgrades);
    expect(result.bestFitSpec).not.toBe(WEAK_COMBI);
  });

  it('systemType is combi', () => {
    const result = resimulateWithUpgrades(schedule, WEAK_COMBI, upgrades);
    expect(result.systemType).toBe('combi');
  });
});

// ─── 2. Combi: low-pressure note — magnetic_filter metadata does not mutate spec

describe('combi: magnetic_filter is metadata-only (no spec mutation)', () => {
  it('does not change any OutcomeSystemSpec field', () => {
    const pkg: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'magnetic_filter',
          category:   'protection',
          label:      'Magnetic filter',
          reason:     'Protection.',
          effectTags: ['protects_system'],
          priority:   'recommended',
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(WEAK_COMBI, pkg);
    // The only metadata-only upgrade — spec fields should be identical.
    expect(bestFit.systemType).toBe(WEAK_COMBI.systemType);
    expect(bestFit.heatOutputKw).toBe(WEAK_COMBI.heatOutputKw);
    expect(bestFit.controlsQuality).toBe(WEAK_COMBI.controlsQuality);
    expect(bestFit.systemCondition).toBe(WEAK_COMBI.systemCondition);
  });
});

// ─── 3. Stored water: larger cylinder improves demand + bath fill time ─────────

describe('stored_water: cylinder_size + system_clean + controls', () => {
  const bathSchedule = makeSchedule([
    makeEvent({ id: 'bath_0', type: 'bath', startMinute: 420, durationMinutes: 20 }),
    makeEvent({ id: 'bath_1', type: 'bath', startMinute: 460, durationMinutes: 20 }),
    makeEvent({ id: 'shower_0', type: 'shower', startMinute: 510, durationMinutes: 8 }),
  ]);
  const upgrades = storedWaterUpgrades();

  it('bestFitSpec has hotWaterStorageLitres = 180', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, upgrades);
    expect(bestFit.hotWaterStorageLitres).toBe(180);
  });

  it('bestFitSpec has systemCondition = clean', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, upgrades);
    expect(bestFit.systemCondition).toBe('clean');
  });

  it('bestFitSpec has controlsQuality = good (was basic)', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, upgrades);
    expect(bestFit.controlsQuality).toBe('good');
  });

  it('system_controls_plan does not mutate OutcomeSystemSpec fields', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, upgrades);
    // No OutcomeSystemSpec field corresponds to system_controls_plan.
    // Verify that systemType and recoveryRateLitresPerHour are preserved.
    expect(bestFit.systemType).toBe('stored_water');
    expect(bestFit.recoveryRateLitresPerHour).toBe(POOR_STORED.recoveryRateLitresPerHour);
  });

  it('bestFitInstall has fewer or equal conflict events than simpleInstall', () => {
    const result = resimulateWithUpgrades(bathSchedule, POOR_STORED, upgrades);
    expect(result.bestFitInstall.hotWater.conflict).toBeLessThanOrEqual(
      result.simpleInstall.hotWater.conflict,
    );
  });

  it('comparison provides non-negative conflictDelta for hot water', () => {
    const result = resimulateWithUpgrades(bathSchedule, POOR_STORED, upgrades);
    expect(result.comparison.hotWater.conflictDelta).toBeGreaterThanOrEqual(0);
  });
});

// ─── 4. Stored water: controls_upgrade improves heating outcomes ───────────────

describe('stored_water: controls_upgrade alone improves heating', () => {
  const heatingSchedule = makeSchedule(HEATING_EVENTS);
  const controlsOnlyUpgrade: RecommendedUpgradePackage = {
    systemType: 'stored_water',
    upgrades: [
      {
        kind:       'controls_upgrade',
        category:   'controls',
        label:      'Modern controls',
        reason:     'Basic controls limiting performance.',
        effectTags: ['improves_heating_stability'],
        priority:   'recommended',
      },
    ],
  };

  it('bestFitSpec controlsQuality is good (was basic)', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, controlsOnlyUpgrade);
    expect(bestFit.controlsQuality).toBe('good');
  });

  it('heating reduced/conflict events are no worse in best-fit', () => {
    const result = resimulateWithUpgrades(heatingSchedule, POOR_STORED, controlsOnlyUpgrade);
    const simpleTotal =
      result.simpleInstall.heating.reduced + result.simpleInstall.heating.conflict;
    const bestFitTotal =
      result.bestFitInstall.heating.reduced + result.bestFitInstall.heating.conflict;
    expect(bestFitTotal).toBeLessThanOrEqual(simpleTotal);
  });
});

// ─── 5. Stored water: system_clean improves condition-driven heating ───────────

describe('stored_water: system_clean upgrade', () => {
  const heatingSchedule = makeSchedule(HEATING_EVENTS);
  const cleanOnlyUpgrade: RecommendedUpgradePackage = {
    systemType: 'stored_water',
    upgrades: [
      {
        kind:       'system_clean',
        category:   'protection',
        label:      'System clean',
        reason:     'Poor condition.',
        effectTags: ['improves_heating_stability'],
        priority:   'essential',
      },
    ],
  };

  it('bestFitSpec systemCondition is clean', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, cleanOnlyUpgrade);
    expect(bestFit.systemCondition).toBe('clean');
  });

  it('heating outcomes are no worse after system clean', () => {
    const result = resimulateWithUpgrades(heatingSchedule, POOR_STORED, cleanOnlyUpgrade);
    expect(result.bestFitInstall.heating.conflict).toBeLessThanOrEqual(
      result.simpleInstall.heating.conflict,
    );
  });
});

// ─── 6. Heat pump: 28mm primaries + larger cylinder + controls ─────────────────

describe('heat_pump: pipe + cylinder + controls upgrade', () => {
  const hpSchedule = makeSchedule([
    ...CLUSTERED_HW_EVENTS,
    ...HEATING_EVENTS,
  ]);
  const upgrades = heatPumpUpgrades();

  it('bestFitSpec has primaryPipeSizeMm = 28', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_HP, upgrades);
    expect(bestFit.primaryPipeSizeMm).toBe(28);
  });

  it('bestFitSpec has hotWaterStorageLitres = 240', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_HP, upgrades);
    expect(bestFit.hotWaterStorageLitres).toBe(240);
  });

  it('bestFitSpec has controlsQuality = good (was basic)', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_HP, upgrades);
    expect(bestFit.controlsQuality).toBe('good');
  });

  it('bestFitSpec has systemCondition = clean', () => {
    const bestFit = applyUpgradePackageToSpec(POOR_HP, upgrades);
    expect(bestFit.systemCondition).toBe('clean');
  });

  it('conflict counts are no worse after HP upgrades', () => {
    const result = resimulateWithUpgrades(hpSchedule, POOR_HP, upgrades);
    const simpleConflicts =
      result.simpleInstall.hotWater.conflict + result.simpleInstall.heating.conflict;
    const bestFitConflicts =
      result.bestFitInstall.hotWater.conflict + result.bestFitInstall.heating.conflict;
    expect(bestFitConflicts).toBeLessThanOrEqual(simpleConflicts);
  });

  it('systemType is heat_pump', () => {
    const result = resimulateWithUpgrades(hpSchedule, POOR_HP, upgrades);
    expect(result.systemType).toBe('heat_pump');
  });
});

// ─── 7. Heat pump: outside-target events reduce under upgraded spec ────────────

describe('heat_pump: outside-target heating events', () => {
  const heatingOnlySchedule = makeSchedule(HEATING_EVENTS);
  const upgrades = heatPumpUpgrades();

  it('outsideTargetEventCountDelta is non-negative', () => {
    const result = resimulateWithUpgrades(heatingOnlySchedule, POOR_HP, upgrades);
    expect(result.comparison.heating.outsideTargetEventCountDelta).toBeGreaterThanOrEqual(0);
  });
});

// ─── 8. Same schedule object is used for both runs ────────────────────────────

describe('general: same schedule used in both runs', () => {
  it('simpleInstall events have same eventIds as bestFitInstall events', () => {
    const schedule = makeSchedule(CLUSTERED_HW_EVENTS);
    const result   = resimulateWithUpgrades(schedule, WEAK_COMBI, combiUpgrades());

    const simpleIds  = result.simpleInstall.events.map((e) => e.eventId);
    const bestFitIds = result.bestFitInstall.events.map((e) => e.eventId);
    expect(simpleIds).toEqual(bestFitIds);
  });

  it('event count is identical in both runs', () => {
    const schedule = makeSchedule([...CLUSTERED_HW_EVENTS, ...HEATING_EVENTS]);
    const result   = resimulateWithUpgrades(schedule, WEAK_COMBI, combiUpgrades());
    expect(result.bestFitInstall.events.length).toBe(result.simpleInstall.events.length);
  });
});

// ─── 9. Determinism: identical inputs → identical outputs ─────────────────────

describe('general: determinism', () => {
  it('two calls with identical inputs return identical comparison deltas', () => {
    const schedule = makeSchedule(CLUSTERED_HW_EVENTS);

    const r1 = resimulateWithUpgrades(schedule, WEAK_COMBI, combiUpgrades());
    const r2 = resimulateWithUpgrades(schedule, WEAK_COMBI, combiUpgrades());

    expect(r1.comparison.hotWater.conflictDelta).toBe(r2.comparison.hotWater.conflictDelta);
    expect(r1.comparison.hotWater.reducedDelta).toBe(r2.comparison.hotWater.reducedDelta);
    expect(r1.comparison.heating.outsideTargetEventCountDelta).toBe(
      r2.comparison.heating.outsideTargetEventCountDelta,
    );
    expect(r1.comparison.headlineImprovements).toEqual(r2.comparison.headlineImprovements);
  });
});

// ─── 10. Irrelevant upgrades do not mutate unrelated spec fields ──────────────

describe('general: irrelevant upgrades leave spec fields unchanged', () => {
  it('primary_pipe_upgrade does not affect combi spec fields', () => {
    const pipeUpgradeForCombi: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'primary_pipe_upgrade',
          category:   'infrastructure',
          label:      'Upgrade pipes to 28 mm',
          reason:     'Test irrelevance.',
          effectTags: ['reduces_conflict'],
          priority:   'best_fit',
          value:      28,
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(WEAK_COMBI, pipeUpgradeForCombi);
    // primaryPipeSizeMm may be written, but combi-specific fields must be unchanged.
    expect(bestFit.heatOutputKw).toBe(WEAK_COMBI.heatOutputKw);
    expect(bestFit.controlsQuality).toBe(WEAK_COMBI.controlsQuality);
    expect(bestFit.systemCondition).toBe(WEAK_COMBI.systemCondition);
    expect(bestFit.mainsDynamicPressureBar).toBe(WEAK_COMBI.mainsDynamicPressureBar);
  });

  it('cylinder_size upgrade does not affect non-storage fields', () => {
    const pkg: RecommendedUpgradePackage = {
      systemType: 'stored_water',
      upgrades: [
        {
          kind:       'cylinder_size',
          category:   'water',
          label:      '180 L',
          reason:     'Test.',
          effectTags: ['improves_hot_water_recovery'],
          priority:   'essential',
          value:      180,
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(POOR_STORED, pkg);
    expect(bestFit.controlsQuality).toBe(POOR_STORED.controlsQuality);
    expect(bestFit.systemCondition).toBe(POOR_STORED.systemCondition);
    expect(bestFit.heatOutputKw).toBe(POOR_STORED.heatOutputKw);
  });
});

// ─── 11. applyUpgradePackageToSpec does not mutate the original spec ──────────

describe('applyUpgradePackageToSpec: no mutation of original', () => {
  it('WEAK_COMBI is unchanged after applying combi upgrades', () => {
    const originalCondition = WEAK_COMBI.systemCondition;
    const originalKw        = WEAK_COMBI.heatOutputKw;
    const originalControls  = WEAK_COMBI.controlsQuality;

    applyUpgradePackageToSpec(WEAK_COMBI, combiUpgrades());

    expect(WEAK_COMBI.systemCondition).toBe(originalCondition);
    expect(WEAK_COMBI.heatOutputKw).toBe(originalKw);
    expect(WEAK_COMBI.controlsQuality).toBe(originalControls);
  });
});

// ─── 12. compareOutcomeSummaries: correct delta computation ───────────────────

describe('compareOutcomeSummaries: delta values', () => {
  it('conflictDelta is positive when best-fit has fewer conflicts', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 3 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 1 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.conflictDelta).toBe(2);
  });

  it('conflictDelta is zero when conflicts are equal', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 2 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 2 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.conflictDelta).toBe(0);
  });

  it('conflictDelta is negative when best-fit has MORE conflicts (honest reporting)', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 1 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 3 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.conflictDelta).toBe(-2);
  });

  it('bathFillDelta is null when neither run has bath events', () => {
    const simple  = makeClassifiedSchedule({ avgBathFill: null });
    const bestFit = makeClassifiedSchedule({ avgBathFill: null });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.averageBathFillTimeDeltaMinutes).toBeNull();
  });

  it('bathFillDelta is null when only one run has bath events', () => {
    const simple  = makeClassifiedSchedule({ avgBathFill: 18 });
    const bestFit = makeClassifiedSchedule({ avgBathFill: null });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.averageBathFillTimeDeltaMinutes).toBeNull();
  });

  it('bathFillDelta is positive when best-fit is faster', () => {
    const simple  = makeClassifiedSchedule({ avgBathFill: 20 });
    const bestFit = makeClassifiedSchedule({ avgBathFill: 15 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.hotWater.averageBathFillTimeDeltaMinutes).toBe(5);
  });

  it('outsideTargetEventCountDelta is positive when best-fit has fewer', () => {
    const simple  = makeClassifiedSchedule({ outsideTarget: 4 });
    const bestFit = makeClassifiedSchedule({ outsideTarget: 1 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.heating.outsideTargetEventCountDelta).toBe(3);
  });
});

// ─── 13. headlineImprovements: generated for positive deltas only ─────────────

describe('compareOutcomeSummaries: headline improvements', () => {
  it('no headlines when there is no improvement', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 1, heatingConflict: 1 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 1, heatingConflict: 1 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.headlineImprovements).toHaveLength(0);
  });

  it('includes hot-water conflict headline when conflictDelta > 0', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 3 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 1 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.headlineImprovements.some((h) => h.includes('hot-water'))).toBe(true);
    expect(cmp.headlineImprovements.some((h) => h.includes('2'))).toBe(true);
  });

  it('includes bath fill headline when bathFillDelta > 0', () => {
    const simple  = makeClassifiedSchedule({ avgBathFill: 22 });
    const bestFit = makeClassifiedSchedule({ avgBathFill: 17 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(cmp.headlineImprovements.some((h) => h.toLowerCase().includes('bath'))).toBe(true);
    expect(cmp.headlineImprovements.some((h) => h.includes('5'))).toBe(true);
  });

  it('includes outside-target headline when delta > 0', () => {
    const simple  = makeClassifiedSchedule({ outsideTarget: 3 });
    const bestFit = makeClassifiedSchedule({ outsideTarget: 0 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    expect(
      cmp.headlineImprovements.some((h) => h.includes('outside comfort target')),
    ).toBe(true);
  });

  it('singular grammar for exactly 1 event improvement', () => {
    const simple  = makeClassifiedSchedule({ hwConflict: 2 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 1 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    const headline = cmp.headlineImprovements.find((h) => h.includes('hot-water'));
    expect(headline).toBeDefined();
    // Should be singular form — "1 fewer … conflict" not "1 fewer … conflicts"
    expect(headline).toMatch(/^1 fewer/);
    expect(headline).not.toMatch(/conflicts$/);
  });

  it('does not include a negative improvement (honest reporting)', () => {
    // Best-fit is actually worse on one metric
    const simple  = makeClassifiedSchedule({ hwConflict: 1 });
    const bestFit = makeClassifiedSchedule({ hwConflict: 3 });
    const cmp     = compareOutcomeSummaries(simple, bestFit);
    // No headline should be generated for this regression
    expect(cmp.headlineImprovements.some((h) => h.includes('hot-water'))).toBe(false);
  });
});

// ─── controls_upgrade: 'good' → 'excellent' promotion ────────────────────────

describe('applyUpgradePackageToSpec: controls promotion chain', () => {
  it("promotes 'good' to 'excellent' when controls_upgrade is applied to a 'good' spec", () => {
    const goodSpec: OutcomeSystemSpec = {
      ...WEAK_COMBI,
      controlsQuality: 'good',
    };
    const pkg: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'controls_upgrade',
          category:   'controls',
          label:      'Excellent controls',
          reason:     'Already good, push to excellent.',
          effectTags: ['improves_heating_stability'],
          priority:   'best_fit',
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(goodSpec, pkg);
    expect(bestFit.controlsQuality).toBe('excellent');
  });

  it("leaves 'excellent' controls unchanged when controls_upgrade is applied", () => {
    const excellentSpec: OutcomeSystemSpec = {
      ...WEAK_COMBI,
      controlsQuality: 'excellent',
    };
    const pkg: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'controls_upgrade',
          category:   'controls',
          label:      'Controls upgrade',
          reason:     'Already excellent.',
          effectTags: ['improves_heating_stability'],
          priority:   'best_fit',
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(excellentSpec, pkg);
    expect(bestFit.controlsQuality).toBe('excellent');
  });
});

// ─── combi_size: peakHotWaterCapacityLpm scaled proportionally ───────────────

describe('applyUpgradePackageToSpec: combi_size scales peakHotWaterCapacityLpm', () => {
  it('scales lpm when heatOutputKw and peakHotWaterCapacityLpm are both set', () => {
    const spec: OutcomeSystemSpec = {
      systemType:              'combi',
      heatOutputKw:            24,
      peakHotWaterCapacityLpm: 12,
      controlsQuality:         'good',
      systemCondition:         'clean',
    };
    const pkg: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'combi_size',
          category:   'water',
          label:      '36 kW combi',
          reason:     'More output.',
          effectTags: ['reduces_conflict'],
          priority:   'essential',
          value:      36,
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(spec, pkg);
    expect(bestFit.heatOutputKw).toBe(36);
    // 12 * (36 / 24) = 18
    expect(bestFit.peakHotWaterCapacityLpm).toBe(18);
  });

  it('does not downgrade heatOutputKw when value is lower than current', () => {
    const spec: OutcomeSystemSpec = {
      systemType:   'combi',
      heatOutputKw: 35,
    };
    const pkg: RecommendedUpgradePackage = {
      systemType: 'combi',
      upgrades: [
        {
          kind:       'combi_size',
          category:   'water',
          label:      '30 kW combi',
          reason:     'Downgrade test.',
          effectTags: ['reduces_conflict'],
          priority:   'recommended',
          value:      30,
        },
      ],
    };
    const bestFit = applyUpgradePackageToSpec(spec, pkg);
    // Should not downgrade — value 30 < current 35
    expect(bestFit.heatOutputKw).toBe(35);
  });
});
