/**
 * OccupancyPreset.ts
 *
 * User-facing demand presets and optional quick timing-override controls.
 *
 * These are the labels the user sees in the survey. They map onto the internal
 * OccupancySignature values used by the simulation engine.
 *
 * Design rules:
 * - Presets must be realistic household archetypes, not abstract model names.
 * - Timing overrides are fast-tap, optional, and non-destructive.
 * - Mapping to OccupancySignature must never expose internal identifiers.
 */

import type { OccupancySignature } from './EngineInputV2_3';

// ─── User-facing preset identifiers ──────────────────────────────────────────

export type DemandPresetId =
  | 'single_working_adult'
  | 'working_couple'
  | 'family_young_children'
  | 'family_teenagers'
  | 'retired_couple'
  | 'home_worker'
  | 'shift_worker'
  | 'multigenerational'
  | 'bath_heavy'
  | 'shower_heavy'
  | 'weekend_heavy';

// ─── User-facing preset descriptor ───────────────────────────────────────────

export interface DemandPreset {
  /** Stable identifier — stored in engine input. */
  id: DemandPresetId;
  /** Short display label for the preset card. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Emoji badge used in preset card UI. */
  emoji: string;
  /**
   * Default timing hints used by the simulation when the user does not
   * provide explicit overrides.
   */
  defaults: DemandTimingOverrides;
  /**
   * Internal engine signature this preset maps onto.
   * Multiple presets can share a signature — they differ in their timing
   * hints rather than fundamentally different physics branches.
   */
  engineSignature: OccupancySignature;
  /**
   * Indicative demand-style summary shown in the simulator/dashboard.
   */
  demandStyleLabel: string;
}

// ─── Quick timing-override controls ──────────────────────────────────────────

/**
 * Optional fast-tap overrides the user can apply after choosing a preset.
 * All fields are optional; missing values fall through to the preset defaults.
 */
export interface DemandTimingOverrides {
  /** Hour of first morning shower (0–23). */
  firstShowerHour?: number;
  /** Hour of evening hot-water peak (0–23). */
  eveningPeakHour?: number;
  /**
   * How often baths are taken, expressed as events per week.
   * 0 = never, 1 = once/week, 7 = daily.
   */
  bathFrequencyPerWeek?: number;
  /**
   * Relative frequency of kitchen hot-water use (taps, washing-up).
   * 'low' | 'medium' | 'high'
   */
  kitchenHotWaterFrequency?: 'low' | 'medium' | 'high';
  /**
   * Whether the household is substantially present during the working day.
   * Affects the low-period demand fraction and system-sizing pressure.
   */
  daytimeOccupancy?: 'absent' | 'partial' | 'full';
  /**
   * Severity of simultaneous hot-water use events (e.g. two showers at once).
   * 'low' = single outlet only, 'medium' = two outlets occasionally,
   * 'high' = two or more outlets regularly.
   */
  simultaneousUseSeverity?: 'low' | 'medium' | 'high';
}

// ─── Preset catalogue ─────────────────────────────────────────────────────────

export const DEMAND_PRESETS: DemandPreset[] = [
  {
    id: 'single_working_adult',
    label: 'Single working adult',
    description: 'Away 09:00–17:00, single morning/evening peak',
    emoji: '💼',
    engineSignature: 'professional',
    demandStyleLabel: 'Single occupancy · Morning and evening peaks',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 18,
      bathFrequencyPerWeek: 1,
      kitchenHotWaterFrequency: 'low',
      daytimeOccupancy: 'absent',
      simultaneousUseSeverity: 'low',
    },
  },
  {
    id: 'working_couple',
    label: 'Working couple',
    description: 'Both away daytime, double morning/evening peak',
    emoji: '👫',
    engineSignature: 'professional',
    demandStyleLabel: 'Working couple · Double-peak pattern',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 18,
      bathFrequencyPerWeek: 2,
      kitchenHotWaterFrequency: 'medium',
      daytimeOccupancy: 'absent',
      simultaneousUseSeverity: 'medium',
    },
  },
  {
    id: 'family_young_children',
    label: 'Family with young children',
    description: 'High morning demand, bath at bedtime, continuous weekday presence',
    emoji: '👨‍👩‍👧',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Family · High morning demand · Evening bath peak',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 19,
      bathFrequencyPerWeek: 7,
      kitchenHotWaterFrequency: 'high',
      daytimeOccupancy: 'partial',
      simultaneousUseSeverity: 'medium',
    },
  },
  {
    id: 'family_teenagers',
    label: 'Family with teenagers',
    description: 'Long showers, high simultaneous demand, evening peak',
    emoji: '👨‍👩‍👦‍👦',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Family · High simultaneous use · Evening shower peak',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 20,
      bathFrequencyPerWeek: 2,
      kitchenHotWaterFrequency: 'high',
      daytimeOccupancy: 'partial',
      simultaneousUseSeverity: 'high',
    },
  },
  {
    id: 'retired_couple',
    label: 'Retired couple',
    description: 'Continuous occupancy, spread demand, low peak severity',
    emoji: '👴👵',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Retired couple · Continuous low-level demand',
    defaults: {
      firstShowerHour: 8,
      eveningPeakHour: 17,
      bathFrequencyPerWeek: 3,
      kitchenHotWaterFrequency: 'medium',
      daytimeOccupancy: 'full',
      simultaneousUseSeverity: 'low',
    },
  },
  {
    id: 'home_worker',
    label: 'Home worker',
    description: 'Present all day, moderate spread demand, kitchen use throughout',
    emoji: '🏡',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Home worker · Spread demand · Kitchen use throughout',
    defaults: {
      firstShowerHour: 8,
      eveningPeakHour: 18,
      bathFrequencyPerWeek: 2,
      kitchenHotWaterFrequency: 'high',
      daytimeOccupancy: 'full',
      simultaneousUseSeverity: 'low',
    },
  },
  {
    id: 'shift_worker',
    label: 'Shift worker',
    description: 'Irregular hours, offset peaks, unpredictable schedule',
    emoji: '🌙',
    engineSignature: 'shift_worker',
    demandStyleLabel: 'Shift worker · Offset and irregular demand',
    defaults: {
      firstShowerHour: 10,
      eveningPeakHour: 22,
      bathFrequencyPerWeek: 2,
      kitchenHotWaterFrequency: 'medium',
      daytimeOccupancy: 'partial',
      simultaneousUseSeverity: 'low',
    },
  },
  {
    id: 'multigenerational',
    label: 'Multigenerational household',
    description: 'Multiple adults, high simultaneous demand, continuous occupancy',
    emoji: '🏘️',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Multigenerational · High simultaneous use · Continuous demand',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 19,
      bathFrequencyPerWeek: 5,
      kitchenHotWaterFrequency: 'high',
      daytimeOccupancy: 'full',
      simultaneousUseSeverity: 'high',
    },
  },
  {
    id: 'bath_heavy',
    label: 'Bath-heavy household',
    description: 'Frequent baths, large cylinder demand, evening peak',
    emoji: '🛁',
    engineSignature: 'steady_home',
    demandStyleLabel: 'Bath-heavy · High stored water demand',
    defaults: {
      firstShowerHour: 7,
      eveningPeakHour: 20,
      bathFrequencyPerWeek: 14,
      kitchenHotWaterFrequency: 'medium',
      daytimeOccupancy: 'partial',
      simultaneousUseSeverity: 'medium',
    },
  },
  {
    id: 'shower_heavy',
    label: 'Shower-heavy household',
    description: 'Multiple daily showers, high flow-rate demand, morning peak',
    emoji: '🚿',
    engineSignature: 'professional',
    demandStyleLabel: 'Shower-heavy · High flow-rate demand · Morning peak',
    defaults: {
      firstShowerHour: 6,
      eveningPeakHour: 18,
      bathFrequencyPerWeek: 0,
      kitchenHotWaterFrequency: 'medium',
      daytimeOccupancy: 'absent',
      simultaneousUseSeverity: 'high',
    },
  },
  {
    id: 'weekend_heavy',
    label: 'Weekend-heavy household',
    description: 'Light weekday demand, high weekend use',
    emoji: '📅',
    engineSignature: 'professional',
    demandStyleLabel: 'Weekend-heavy · Low weekday · High weekend demand',
    defaults: {
      firstShowerHour: 9,
      eveningPeakHour: 19,
      bathFrequencyPerWeek: 3,
      kitchenHotWaterFrequency: 'low',
      daytimeOccupancy: 'absent',
      simultaneousUseSeverity: 'low',
    },
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Look up a preset by its id. Returns undefined when the id is not found. */
export function findDemandPreset(id: DemandPresetId): DemandPreset | undefined {
  return DEMAND_PRESETS.find(p => p.id === id);
}

/**
 * Resolve the engine OccupancySignature from a preset id.
 * Falls back to 'professional' for unknown ids so the engine never sees an
 * invalid value.
 */
export function presetToEngineSignature(id: DemandPresetId): OccupancySignature {
  return findDemandPreset(id)?.engineSignature ?? 'professional';
}

/**
 * Merge timing overrides on top of preset defaults, returning a complete
 * DemandTimingOverrides object with no undefined fields.
 *
 * All presets in the DEMAND_PRESETS catalogue define a complete defaults
 * object; the hardcoded fallback only activates for unknown ids.
 */
export function resolveTimingOverrides(
  presetId: DemandPresetId,
  overrides?: DemandTimingOverrides,
): Required<DemandTimingOverrides> {
  const defaults = findDemandPreset(presetId)?.defaults ?? DEMAND_PRESETS[0].defaults;
  return {
    firstShowerHour:          overrides?.firstShowerHour          ?? defaults.firstShowerHour!,
    eveningPeakHour:          overrides?.eveningPeakHour          ?? defaults.eveningPeakHour!,
    bathFrequencyPerWeek:     overrides?.bathFrequencyPerWeek     ?? defaults.bathFrequencyPerWeek!,
    kitchenHotWaterFrequency: overrides?.kitchenHotWaterFrequency ?? defaults.kitchenHotWaterFrequency!,
    daytimeOccupancy:         overrides?.daytimeOccupancy         ?? defaults.daytimeOccupancy!,
    simultaneousUseSeverity:  overrides?.simultaneousUseSeverity  ?? defaults.simultaneousUseSeverity!,
  };
}

/**
 * Returns the display label for the selected demand style.
 * Shown in the simulator / dashboard.
 */
export function getDemandStyleLabel(presetId: DemandPresetId): string {
  return findDemandPreset(presetId)?.demandStyleLabel ?? presetId;
}
