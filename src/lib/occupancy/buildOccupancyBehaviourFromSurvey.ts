/**
 * buildOccupancyBehaviourFromSurvey.ts
 *
 * Canonical bridge between the Full Survey lifestyle selection and the
 * simulator/engine demand model.
 *
 * Design rules:
 *   - All values are normalised to [0, 1] for easy tuning.
 *   - No raw internals (OccupancySignature, profile IDs) are exposed to callers.
 *   - `timingOverrides` allow fast optional shaping without re-doing the whole model.
 *   - Each preset produces meaningfully different values — not a mere linear scale.
 *
 * Usage:
 *   const behaviour = buildOccupancyBehaviourFromSurvey('family_young_children');
 *   // behaviour.bathUsageLikelihood  → 0.90  (high — daily bath)
 *   // behaviour.daytimePresence      → 0.40  (partial — parent at home)
 *   // behaviour.simultaneousHotWaterLikelihood → 0.55
 */

import type { DemandPresetId, DemandTimingOverrides } from '../../engine/schema/OccupancyPreset';
import { resolveTimingOverrides } from '../../engine/schema/OccupancyPreset';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Normalised occupancy behaviour descriptor used by the simulator and
 * engine-facing adapters.
 *
 * All numeric fields are in [0, 1]:
 *   0.0 = none / absent / never
 *   1.0 = maximum / always / full
 */
export interface OccupancyBehaviour {
  /** Stable identifier matching the source DemandPresetId. */
  profileId: DemandPresetId;
  /** Short user-facing label for simulator display badges. */
  label: string;
  /**
   * Strength of the morning DHW/heating peak.
   * High → sharp cluster at first-shower hour; low → gentle ramp.
   */
  morningPeakStrength: number;
  /**
   * Strength of the evening DHW/heating peak.
   * High → concentrated demand around evening peak hour; low → diffuse.
   */
  eveningPeakStrength: number;
  /**
   * Fraction of the working-day hours during which the household is present.
   * 0 = fully absent (09–17 all away); 1 = home all day.
   */
  daytimePresence: number;
  /**
   * Frequency of short hot-water draws (handwash, rinse, kitchen tap).
   * 0 = none between main peaks; 1 = very frequent throughout the day.
   */
  shortDrawFrequency: number;
  /**
   * Likelihood that two or more hot-water outlets are active simultaneously.
   * 0 = single outlet only; 1 = routine concurrent use.
   */
  simultaneousHotWaterLikelihood: number;
  /**
   * Likelihood that a bath (large stored-volume draw) is used on a typical day.
   * 0 = never; 1 = daily / multiple baths.
   */
  bathUsageLikelihood: number;
  /**
   * Likelihood that one or more showers are taken on a typical day.
   * 0 = never; 1 = multiple showers every day.
   */
  showerUsageLikelihood: number;
  /**
   * Normalised frequency of kitchen hot-water use throughout the day.
   * 0 = rarely; 1 = very frequent (boiling water, washing up throughout).
   */
  kitchenHotWaterFrequency: number;
  /**
   * How broadly the heating occupancy window is spread across the day.
   * 0 = very narrow (e.g. 1-hour morning spike only);
   * 1 = continuous (heating on from wakeup to bedtime).
   */
  heatingOccupancySpread: number;
}

// ─── Demand-label helpers ─────────────────────────────────────────────────────

/**
 * Returns concise simulator display tags for the current behaviour.
 *
 * These are shown alongside the phase bar so the user can see that the
 * simulator is genuinely using their survey selection.
 *
 * Examples:
 *   ['Family with young children', 'High morning demand', 'Evening bath peak', 'Daytime occupancy partial']
 */
export function buildOccupancyDisplayTags(behaviour: OccupancyBehaviour): string[] {
  const tags: string[] = [behaviour.label];

  if (behaviour.simultaneousHotWaterLikelihood >= 0.60) {
    tags.push('High simultaneous use');
  } else if (behaviour.simultaneousHotWaterLikelihood >= 0.35) {
    tags.push('Moderate simultaneous use');
  }

  if (behaviour.bathUsageLikelihood >= 0.80) {
    tags.push('Daily bath');
  } else if (behaviour.bathUsageLikelihood >= 0.40) {
    tags.push('Occasional bath');
  }

  if (behaviour.showerUsageLikelihood >= 0.90) {
    tags.push('Multiple showers daily');
  }

  if (behaviour.daytimePresence >= 0.80) {
    tags.push('Home all day');
  } else if (behaviour.daytimePresence <= 0.10) {
    tags.push('Daytime occupancy low');
  } else {
    tags.push('Daytime occupancy partial');
  }

  if (behaviour.morningPeakStrength >= 0.90) {
    tags.push('Strong morning peak');
  }

  if (behaviour.eveningPeakStrength >= 0.90) {
    tags.push('Strong evening peak');
  }

  return tags;
}

// ─── Preset behaviour catalogue ───────────────────────────────────────────────

/**
 * Intrinsic base behaviour values for each DemandPresetId.
 *
 * These represent the "default" version of each household — before any
 * quick timing overrides are applied.
 */
const PRESET_BASE_BEHAVIOURS: Record<DemandPresetId, Omit<OccupancyBehaviour, 'profileId'>> = {
  single_working_adult: {
    label: 'Single working adult',
    morningPeakStrength: 0.85,
    eveningPeakStrength: 0.80,
    daytimePresence: 0.05,
    shortDrawFrequency: 0.10,
    simultaneousHotWaterLikelihood: 0.05,
    bathUsageLikelihood: 0.10,
    showerUsageLikelihood: 0.90,
    kitchenHotWaterFrequency: 0.25,
    heatingOccupancySpread: 0.30,
  },

  working_couple: {
    label: 'Working couple',
    morningPeakStrength: 0.90,
    eveningPeakStrength: 0.85,
    daytimePresence: 0.05,
    shortDrawFrequency: 0.15,
    simultaneousHotWaterLikelihood: 0.45,
    bathUsageLikelihood: 0.25,
    showerUsageLikelihood: 0.90,
    kitchenHotWaterFrequency: 0.45,
    heatingOccupancySpread: 0.30,
  },

  family_young_children: {
    label: 'Family with young children',
    morningPeakStrength: 0.95,
    eveningPeakStrength: 0.90,
    daytimePresence: 0.40,
    shortDrawFrequency: 0.60,
    simultaneousHotWaterLikelihood: 0.55,
    bathUsageLikelihood: 0.90,
    showerUsageLikelihood: 0.60,
    kitchenHotWaterFrequency: 0.80,
    heatingOccupancySpread: 0.65,
  },

  family_teenagers: {
    label: 'Family with teenagers',
    morningPeakStrength: 0.90,
    eveningPeakStrength: 0.95,
    daytimePresence: 0.20,
    shortDrawFrequency: 0.35,
    simultaneousHotWaterLikelihood: 0.70,
    bathUsageLikelihood: 0.25,
    showerUsageLikelihood: 0.95,
    kitchenHotWaterFrequency: 0.70,
    heatingOccupancySpread: 0.55,
  },

  retired_couple: {
    label: 'Retired couple',
    morningPeakStrength: 0.55,
    eveningPeakStrength: 0.60,
    daytimePresence: 1.00,
    shortDrawFrequency: 0.45,
    simultaneousHotWaterLikelihood: 0.20,
    bathUsageLikelihood: 0.50,
    showerUsageLikelihood: 0.60,
    kitchenHotWaterFrequency: 0.65,
    heatingOccupancySpread: 0.90,
  },

  home_worker: {
    label: 'Home worker',
    morningPeakStrength: 0.65,
    eveningPeakStrength: 0.70,
    daytimePresence: 1.00,
    shortDrawFrequency: 0.50,
    simultaneousHotWaterLikelihood: 0.15,
    bathUsageLikelihood: 0.25,
    showerUsageLikelihood: 0.75,
    kitchenHotWaterFrequency: 0.85,
    heatingOccupancySpread: 0.90,
  },

  shift_worker: {
    label: 'Shift worker',
    morningPeakStrength: 0.50,
    eveningPeakStrength: 0.75,
    daytimePresence: 0.50,
    shortDrawFrequency: 0.25,
    simultaneousHotWaterLikelihood: 0.10,
    bathUsageLikelihood: 0.25,
    showerUsageLikelihood: 0.80,
    kitchenHotWaterFrequency: 0.35,
    heatingOccupancySpread: 0.60,
  },

  multigenerational: {
    label: 'Multigenerational household',
    morningPeakStrength: 0.95,
    eveningPeakStrength: 0.90,
    daytimePresence: 0.70,
    shortDrawFrequency: 0.70,
    simultaneousHotWaterLikelihood: 0.85,
    bathUsageLikelihood: 0.65,
    showerUsageLikelihood: 0.85,
    kitchenHotWaterFrequency: 0.90,
    heatingOccupancySpread: 0.80,
  },

  bath_heavy: {
    label: 'Bath-heavy household',
    morningPeakStrength: 0.55,
    eveningPeakStrength: 0.95,
    daytimePresence: 0.35,
    shortDrawFrequency: 0.20,
    simultaneousHotWaterLikelihood: 0.50,
    bathUsageLikelihood: 1.00,
    showerUsageLikelihood: 0.20,
    kitchenHotWaterFrequency: 0.50,
    heatingOccupancySpread: 0.55,
  },

  shower_heavy: {
    label: 'Shower-heavy household',
    morningPeakStrength: 0.98,
    eveningPeakStrength: 0.65,
    daytimePresence: 0.05,
    shortDrawFrequency: 0.20,
    simultaneousHotWaterLikelihood: 0.75,
    bathUsageLikelihood: 0.05,
    showerUsageLikelihood: 1.00,
    kitchenHotWaterFrequency: 0.35,
    heatingOccupancySpread: 0.30,
  },

  weekend_heavy: {
    label: 'Weekend-heavy household',
    morningPeakStrength: 0.45,
    eveningPeakStrength: 0.50,
    daytimePresence: 0.05,
    shortDrawFrequency: 0.10,
    simultaneousHotWaterLikelihood: 0.15,
    bathUsageLikelihood: 0.10,
    showerUsageLikelihood: 0.70,
    kitchenHotWaterFrequency: 0.20,
    heatingOccupancySpread: 0.25,
  },
};

// ─── Override application ─────────────────────────────────────────────────────

/**
 * Apply resolved timing overrides on top of the base behaviour.
 *
 * Timing overrides can modulate:
 *   - `daytimePresence`               from `daytimeOccupancy`
 *   - `simultaneousHotWaterLikelihood` from `simultaneousUseSeverity`
 *   - `bathUsageLikelihood`            from `bathFrequencyPerWeek`
 *   - `kitchenHotWaterFrequency`       from `kitchenHotWaterFrequency`
 */
function applyTimingOverrides(
  base: OccupancyBehaviour,
  resolved: Required<DemandTimingOverrides>,
): OccupancyBehaviour {
  const daytimePresence: number = (() => {
    switch (resolved.daytimeOccupancy) {
      case 'absent':  return Math.min(base.daytimePresence, 0.10);
      case 'partial': return Math.min(Math.max(base.daytimePresence, 0.30), 0.60);
      case 'full':    return Math.max(base.daytimePresence, 0.85);
    }
  })();

  const simultaneousHotWaterLikelihood: number = (() => {
    switch (resolved.simultaneousUseSeverity) {
      case 'low':    return Math.min(base.simultaneousHotWaterLikelihood, 0.25);
      case 'medium': return Math.min(Math.max(base.simultaneousHotWaterLikelihood, 0.30), 0.65);
      case 'high':   return Math.max(base.simultaneousHotWaterLikelihood, 0.70);
    }
  })();

  // bathFrequencyPerWeek → normalised bath usage (0 = never, 14 = twice daily)
  const bathUsageLikelihood = Math.min(1, resolved.bathFrequencyPerWeek / 7);

  const kitchenHotWaterFrequency: number = (() => {
    switch (resolved.kitchenHotWaterFrequency) {
      case 'low':    return Math.min(base.kitchenHotWaterFrequency, 0.30);
      case 'medium': return Math.min(Math.max(base.kitchenHotWaterFrequency, 0.40), 0.65);
      case 'high':   return Math.max(base.kitchenHotWaterFrequency, 0.75);
    }
  })();

  return {
    ...base,
    daytimePresence,
    simultaneousHotWaterLikelihood,
    bathUsageLikelihood,
    kitchenHotWaterFrequency,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a normalised OccupancyBehaviour from a DemandPresetId and optional
 * timing overrides.
 *
 * This is the single point of truth that translates a user's lifestyle
 * card selection into the continuous behaviour values consumed by the
 * simulator and engine adapters.
 *
 * @param presetId   - The DemandPresetId the user selected in the Full Survey.
 * @param overrides  - Optional fast-tap timing overrides (from the survey
 *                     "Quick demand shaping" section).
 */
export function buildOccupancyBehaviourFromSurvey(
  presetId: DemandPresetId,
  overrides?: DemandTimingOverrides,
): OccupancyBehaviour {
  const base: OccupancyBehaviour = {
    profileId: presetId,
    ...PRESET_BASE_BEHAVIOURS[presetId],
  };

  if (overrides == null) return base;

  const resolved = resolveTimingOverrides(presetId, overrides);
  return applyTimingOverrides(base, resolved);
}
