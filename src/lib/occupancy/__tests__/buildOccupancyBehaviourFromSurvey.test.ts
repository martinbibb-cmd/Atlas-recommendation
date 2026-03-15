/**
 * buildOccupancyBehaviourFromSurvey.test.ts
 *
 * Tests for the canonical occupancy behaviour bridge between Full Survey
 * lifestyle selection and simulator/engine demand model.
 *
 * Covers:
 *   1. All presets produce a valid OccupancyBehaviour
 *   2. Different presets produce meaningfully different demand values
 *   3. High-demand profiles do not produce implausibly low DHW demand
 *   4. Daytime occupancy affects heating spread
 *   5. Timing overrides are applied correctly
 *   6. Display tags reflect the behaviour values
 */
import { describe, it, expect } from 'vitest';
import {
  buildOccupancyBehaviourFromSurvey,
  buildOccupancyDisplayTags,
} from '../buildOccupancyBehaviourFromSurvey';
import type { OccupancyBehaviour } from '../buildOccupancyBehaviourFromSurvey';
import type { DemandPresetId, DemandTimingOverrides } from '../../../engine/schema/OccupancyPreset';
import { DEMAND_PRESETS } from '../../../engine/schema/OccupancyPreset';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNormalised(value: number): boolean {
  return value >= 0 && value <= 1;
}

// ─── 1. All presets produce a valid OccupancyBehaviour ───────────────────────

describe('buildOccupancyBehaviourFromSurvey — all presets', () => {
  it('produces a result for every known DemandPresetId', () => {
    for (const preset of DEMAND_PRESETS) {
      const behaviour = buildOccupancyBehaviourFromSurvey(preset.id);
      expect(behaviour).toBeDefined();
      expect(behaviour.profileId).toBe(preset.id);
    }
  });

  it('all numeric fields are normalised [0, 1]', () => {
    for (const preset of DEMAND_PRESETS) {
      const b = buildOccupancyBehaviourFromSurvey(preset.id);
      expect(isNormalised(b.morningPeakStrength),  `${preset.id}.morningPeakStrength`).toBe(true);
      expect(isNormalised(b.eveningPeakStrength),   `${preset.id}.eveningPeakStrength`).toBe(true);
      expect(isNormalised(b.daytimePresence),       `${preset.id}.daytimePresence`).toBe(true);
      expect(isNormalised(b.shortDrawFrequency),    `${preset.id}.shortDrawFrequency`).toBe(true);
      expect(isNormalised(b.simultaneousHotWaterLikelihood), `${preset.id}.simultaneousHotWaterLikelihood`).toBe(true);
      expect(isNormalised(b.bathUsageLikelihood),   `${preset.id}.bathUsageLikelihood`).toBe(true);
      expect(isNormalised(b.showerUsageLikelihood), `${preset.id}.showerUsageLikelihood`).toBe(true);
      expect(isNormalised(b.kitchenHotWaterFrequency), `${preset.id}.kitchenHotWaterFrequency`).toBe(true);
      expect(isNormalised(b.heatingOccupancySpread), `${preset.id}.heatingOccupancySpread`).toBe(true);
    }
  });

  it('all presets have a non-empty label', () => {
    for (const preset of DEMAND_PRESETS) {
      const b = buildOccupancyBehaviourFromSurvey(preset.id);
      expect(b.label.length).toBeGreaterThan(0);
    }
  });
});

// ─── 2. Different profiles produce meaningfully different DHW patterns ────────

describe('survey lifestyle selection maps to distinct behaviour values', () => {
  it('family_young_children has higher bath usage than shower_heavy', () => {
    const family = buildOccupancyBehaviourFromSurvey('family_young_children');
    const shower = buildOccupancyBehaviourFromSurvey('shower_heavy');
    expect(family.bathUsageLikelihood).toBeGreaterThan(shower.bathUsageLikelihood);
  });

  it('shower_heavy has higher shower usage than bath_heavy', () => {
    const shower = buildOccupancyBehaviourFromSurvey('shower_heavy');
    const bath = buildOccupancyBehaviourFromSurvey('bath_heavy');
    expect(shower.showerUsageLikelihood).toBeGreaterThan(bath.showerUsageLikelihood);
  });

  it('multigenerational has higher simultaneous use than single_working_adult', () => {
    const multi = buildOccupancyBehaviourFromSurvey('multigenerational');
    const single = buildOccupancyBehaviourFromSurvey('single_working_adult');
    expect(multi.simultaneousHotWaterLikelihood).toBeGreaterThan(single.simultaneousHotWaterLikelihood);
  });

  it('retired_couple and home_worker have higher daytime presence than single_working_adult', () => {
    const retired = buildOccupancyBehaviourFromSurvey('retired_couple');
    const homeWorker = buildOccupancyBehaviourFromSurvey('home_worker');
    const singleAdult = buildOccupancyBehaviourFromSurvey('single_working_adult');
    expect(retired.daytimePresence).toBeGreaterThan(singleAdult.daytimePresence);
    expect(homeWorker.daytimePresence).toBeGreaterThan(singleAdult.daytimePresence);
  });

  it('family_teenagers has higher evening peak strength than retired_couple', () => {
    const teens = buildOccupancyBehaviourFromSurvey('family_teenagers');
    const retired = buildOccupancyBehaviourFromSurvey('retired_couple');
    expect(teens.eveningPeakStrength).toBeGreaterThan(retired.eveningPeakStrength);
  });

  it('shower_heavy has higher morning peak strength than weekend_heavy', () => {
    const shower = buildOccupancyBehaviourFromSurvey('shower_heavy');
    const weekend = buildOccupancyBehaviourFromSurvey('weekend_heavy');
    expect(shower.morningPeakStrength).toBeGreaterThan(weekend.morningPeakStrength);
  });
});

// ─── 3. High-demand profiles do not produce implausibly low DHW demand ────────

describe('high-demand profiles produce strong DHW demand', () => {
  it('family_young_children: high bath usage (≥ 0.80)', () => {
    const b = buildOccupancyBehaviourFromSurvey('family_young_children');
    expect(b.bathUsageLikelihood).toBeGreaterThanOrEqual(0.80);
  });

  it('family_young_children: high kitchen use (≥ 0.70)', () => {
    const b = buildOccupancyBehaviourFromSurvey('family_young_children');
    expect(b.kitchenHotWaterFrequency).toBeGreaterThanOrEqual(0.70);
  });

  it('multigenerational: very high simultaneous use (≥ 0.70)', () => {
    const b = buildOccupancyBehaviourFromSurvey('multigenerational');
    expect(b.simultaneousHotWaterLikelihood).toBeGreaterThanOrEqual(0.70);
  });

  it('bath_heavy: bath usage likelihood = 1.0 (always)', () => {
    const b = buildOccupancyBehaviourFromSurvey('bath_heavy');
    expect(b.bathUsageLikelihood).toBe(1.0);
  });

  it('shower_heavy: shower usage likelihood = 1.0 (always)', () => {
    const b = buildOccupancyBehaviourFromSurvey('shower_heavy');
    expect(b.showerUsageLikelihood).toBe(1.0);
  });

  it('family_teenagers: simultaneous use ≥ 0.60', () => {
    const b = buildOccupancyBehaviourFromSurvey('family_teenagers');
    expect(b.simultaneousHotWaterLikelihood).toBeGreaterThanOrEqual(0.60);
  });
});

// ─── 4. Daytime occupancy differences affect heating occupancy spread ─────────

describe('daytime occupancy differences affect heating spread', () => {
  it('retired_couple and home_worker have heatingOccupancySpread ≥ 0.80', () => {
    const retired = buildOccupancyBehaviourFromSurvey('retired_couple');
    const homeWorker = buildOccupancyBehaviourFromSurvey('home_worker');
    expect(retired.heatingOccupancySpread).toBeGreaterThanOrEqual(0.80);
    expect(homeWorker.heatingOccupancySpread).toBeGreaterThanOrEqual(0.80);
  });

  it('single_working_adult has heatingOccupancySpread ≤ 0.40', () => {
    const b = buildOccupancyBehaviourFromSurvey('single_working_adult');
    expect(b.heatingOccupancySpread).toBeLessThanOrEqual(0.40);
  });

  it('retired_couple has higher heatingOccupancySpread than single_working_adult', () => {
    const retired = buildOccupancyBehaviourFromSurvey('retired_couple');
    const single = buildOccupancyBehaviourFromSurvey('single_working_adult');
    expect(retired.heatingOccupancySpread).toBeGreaterThan(single.heatingOccupancySpread);
  });

  it('multigenerational has broad heating spread (≥ 0.75)', () => {
    const b = buildOccupancyBehaviourFromSurvey('multigenerational');
    expect(b.heatingOccupancySpread).toBeGreaterThanOrEqual(0.75);
  });
});

// ─── 5. Timing overrides are applied correctly ────────────────────────────────

describe('timing overrides modulate base behaviour', () => {
  it('daytimeOccupancy=absent clamps daytimePresence to ≤ 0.10', () => {
    const overrides: DemandTimingOverrides = { daytimeOccupancy: 'absent' };
    const b = buildOccupancyBehaviourFromSurvey('retired_couple', overrides);
    expect(b.daytimePresence).toBeLessThanOrEqual(0.10);
  });

  it('daytimeOccupancy=full raises daytimePresence to ≥ 0.85', () => {
    const overrides: DemandTimingOverrides = { daytimeOccupancy: 'full' };
    const b = buildOccupancyBehaviourFromSurvey('single_working_adult', overrides);
    expect(b.daytimePresence).toBeGreaterThanOrEqual(0.85);
  });

  it('simultaneousUseSeverity=high raises simultaneousHotWaterLikelihood to ≥ 0.70', () => {
    const overrides: DemandTimingOverrides = { simultaneousUseSeverity: 'high' };
    const b = buildOccupancyBehaviourFromSurvey('single_working_adult', overrides);
    expect(b.simultaneousHotWaterLikelihood).toBeGreaterThanOrEqual(0.70);
  });

  it('simultaneousUseSeverity=low clamps simultaneousHotWaterLikelihood to ≤ 0.25', () => {
    const overrides: DemandTimingOverrides = { simultaneousUseSeverity: 'low' };
    const b = buildOccupancyBehaviourFromSurvey('multigenerational', overrides);
    expect(b.simultaneousHotWaterLikelihood).toBeLessThanOrEqual(0.25);
  });

  it('bathFrequencyPerWeek=0 produces bathUsageLikelihood=0', () => {
    const overrides: DemandTimingOverrides = { bathFrequencyPerWeek: 0 };
    const b = buildOccupancyBehaviourFromSurvey('bath_heavy', overrides);
    expect(b.bathUsageLikelihood).toBe(0);
  });

  it('bathFrequencyPerWeek=7 produces bathUsageLikelihood=1.0', () => {
    const overrides: DemandTimingOverrides = { bathFrequencyPerWeek: 7 };
    const b = buildOccupancyBehaviourFromSurvey('single_working_adult', overrides);
    expect(b.bathUsageLikelihood).toBe(1.0);
  });

  it('kitchenHotWaterFrequency=low clamps kitchenHotWaterFrequency to ≤ 0.30', () => {
    const overrides: DemandTimingOverrides = { kitchenHotWaterFrequency: 'low' };
    const b = buildOccupancyBehaviourFromSurvey('home_worker', overrides);
    expect(b.kitchenHotWaterFrequency).toBeLessThanOrEqual(0.30);
  });

  it('overrides do not change non-overridden fields', () => {
    const noOverride = buildOccupancyBehaviourFromSurvey('family_young_children');
    const withOverride = buildOccupancyBehaviourFromSurvey('family_young_children', {
      daytimeOccupancy: 'absent',
    });
    // morning/evening peak strengths should be unchanged
    expect(withOverride.morningPeakStrength).toBe(noOverride.morningPeakStrength);
    expect(withOverride.eveningPeakStrength).toBe(noOverride.eveningPeakStrength);
    expect(withOverride.showerUsageLikelihood).toBe(noOverride.showerUsageLikelihood);
  });
});

// ─── 6. Display tags reflect behaviour values ─────────────────────────────────

describe('buildOccupancyDisplayTags', () => {
  it('first tag is always the profile label', () => {
    const b = buildOccupancyBehaviourFromSurvey('family_young_children');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags[0]).toBe('Family with young children');
  });

  it('multigenerational includes "High simultaneous use" tag', () => {
    const b = buildOccupancyBehaviourFromSurvey('multigenerational');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags).toContain('High simultaneous use');
  });

  it('bath_heavy includes "Daily bath" tag', () => {
    const b = buildOccupancyBehaviourFromSurvey('bath_heavy');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags).toContain('Daily bath');
  });

  it('shower_heavy includes "Multiple showers daily" tag', () => {
    const b = buildOccupancyBehaviourFromSurvey('shower_heavy');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags).toContain('Multiple showers daily');
  });

  it('retired_couple and home_worker include "Home all day" tag', () => {
    for (const id of ['retired_couple', 'home_worker'] as DemandPresetId[]) {
      const b = buildOccupancyBehaviourFromSurvey(id);
      const tags = buildOccupancyDisplayTags(b);
      expect(tags).toContain('Home all day');
    }
  });

  it('single_working_adult includes "Daytime occupancy low" tag', () => {
    const b = buildOccupancyBehaviourFromSurvey('single_working_adult');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags).toContain('Daytime occupancy low');
  });

  it('family_young_children includes "Strong morning peak" tag', () => {
    const b = buildOccupancyBehaviourFromSurvey('family_young_children');
    const tags = buildOccupancyDisplayTags(b);
    expect(tags).toContain('Strong morning peak');
  });

  it('every preset produces at least 2 tags', () => {
    for (const preset of DEMAND_PRESETS) {
      const b = buildOccupancyBehaviourFromSurvey(preset.id);
      const tags = buildOccupancyDisplayTags(b);
      expect(tags.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── 7. All presets produce distinct demand profiles (no accidental duplicates) ─

describe('all 11 presets have distinct behaviour fingerprints', () => {
  it('no two presets have identical (bath, shower, simultaneous) values', () => {
    const fingerprints = DEMAND_PRESETS.map(p => {
      const b = buildOccupancyBehaviourFromSurvey(p.id);
      return `${b.bathUsageLikelihood}:${b.showerUsageLikelihood}:${b.simultaneousHotWaterLikelihood}:${b.daytimePresence}`;
    });
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(DEMAND_PRESETS.length);
  });
});
