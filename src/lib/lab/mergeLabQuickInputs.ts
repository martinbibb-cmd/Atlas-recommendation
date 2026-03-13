/**
 * mergeLabQuickInputs.ts
 *
 * Merges quick-input panel values with any pre-existing partial engine input
 * and fills remaining required fields with safe technical defaults.
 *
 * The result is a fully valid EngineInputV2_3 that can be passed directly to
 * runEngine() or stored in LabShell for later use.
 *
 * Safe defaults are intentionally conservative (medium mass, typical UK heat
 * loss, standard 22 mm primary).  They do not override values already present
 * in `base`.
 */

import type { EngineInputV2_3, OccupancySignature } from '../../engine/schema/EngineInputV2_3';

// ── Mains performance presets ─────────────────────────────────────────────────

export type MainsPerformance = 'good' | 'borderline' | 'weak';

const MAINS_PRESETS: Record<MainsPerformance, { pressureBar: number; flowLpm: number }> = {
  good:       { pressureBar: 2.5,  flowLpm: 18 },
  borderline: { pressureBar: 1.5,  flowLpm: 12 },
  weak:       { pressureBar: 0.7,  flowLpm:  8 },
};

// ── Quick-input value shape ───────────────────────────────────────────────────

/**
 * Values captured by the LabQuickInputsPanel.
 * All fields are optional — only the ones the user answered are present.
 */
export interface LabQuickValues {
  currentHeatSourceType?: 'combi' | 'system' | 'regular' | 'ashp';
  bathroomCount?: number;
  occupancyCount?: number;
  mainsPerformance?: MainsPerformance;
  primaryPipeDiameter?: 15 | 22 | 28;
  systemPlanType?: 'y_plan' | 's_plan';
  /** Cylinder type — only populated when system requires stored DHW. */
  cylinderType?: 'standard' | 'mixergy' | 'unvented';
}

// ── Merge function ─────────────────────────────────────────────────────────────

/**
 * Produce a complete, valid EngineInputV2_3 by combining:
 *   1. `base`  — partial input already known from Fast Choice / landing
 *   2. `quick` — values the user just entered in the quick-input panel
 *   3. fallbacks — safe technical defaults for any still-absent required fields
 *
 * Quick values win over base values only when the base value is absent.
 * Fallbacks are only applied when neither source provides a value.
 */
export function mergeLabQuickInputs(
  base: Partial<EngineInputV2_3>,
  quick: LabQuickValues,
): EngineInputV2_3 {
  // Resolve system type
  const heatSourceType = base.currentHeatSourceType ?? quick.currentHeatSourceType;

  // Resolve occupancy
  const occupancyCount = base.occupancyCount ?? quick.occupancyCount ?? 2;

  // Derive occupancy signature and highOccupancy from occupancy count when absent
  const occupancySignature: OccupancySignature =
    base.occupancySignature ??
    (occupancyCount >= 5 ? 'steady_home' : 'professional');
  const highOccupancy = base.highOccupancy ?? occupancyCount >= 5;

  // Prefer combi when current system is combi and no explicit override
  const preferCombi =
    base.preferCombi ??
    (heatSourceType === 'combi' ? true : false);

  // Resolve mains data
  let dynamicMainsPressure =
    (base.dynamicMainsPressure != null && base.dynamicMainsPressure > 0)
      ? base.dynamicMainsPressure
      : undefined;
  let mainsDynamicFlowLpm =
    (base.mainsDynamicFlowLpm != null && base.mainsDynamicFlowLpm > 0)
      ? base.mainsDynamicFlowLpm
      : undefined;

  if (dynamicMainsPressure == null && quick.mainsPerformance) {
    const preset = MAINS_PRESETS[quick.mainsPerformance];
    dynamicMainsPressure = preset.pressureBar;
    mainsDynamicFlowLpm  = mainsDynamicFlowLpm ?? preset.flowLpm;
  }
  // Final fallback — use borderline if nothing was provided
  dynamicMainsPressure = dynamicMainsPressure ?? MAINS_PRESETS.borderline.pressureBar;
  mainsDynamicFlowLpm  = mainsDynamicFlowLpm  ?? MAINS_PRESETS.borderline.flowLpm;

  return {
    // ── Location ─────────────────────────────────────────────────────────────
    postcode: base.postcode ?? 'SW1A 1AA',

    // ── Mains ────────────────────────────────────────────────────────────────
    dynamicMainsPressure,
    mainsDynamicFlowLpm,

    // ── Infrastructure ───────────────────────────────────────────────────────
    primaryPipeDiameter:
      base.primaryPipeDiameter ??
      quick.primaryPipeDiameter ??
      22,

    // ── Heat loss ────────────────────────────────────────────────────────────
    heatLossWatts:  base.heatLossWatts  ?? 8000,
    radiatorCount:  base.radiatorCount  ?? 8,
    returnWaterTemp:base.returnWaterTemp ?? 55,
    buildingMass:   base.buildingMass   ?? 'medium',

    // ── Occupancy ────────────────────────────────────────────────────────────
    bathroomCount:     base.bathroomCount ?? quick.bathroomCount ?? 1,
    occupancyCount,
    occupancySignature,
    highOccupancy,

    // ── Preferences ──────────────────────────────────────────────────────────
    preferCombi,
    hasLoftConversion: base.hasLoftConversion ?? false,

    // ── System context ───────────────────────────────────────────────────────
    currentHeatSourceType: heatSourceType,
    systemPlanType: base.systemPlanType ?? quick.systemPlanType,

    // ── Pass through any other fields from base not already listed above ──────
    ...Object.fromEntries(
      Object.entries(base).filter(
        ([k, v]) =>
          v !== undefined &&
          ![
            'postcode',
            'dynamicMainsPressure',
            'mainsDynamicFlowLpm',
            'primaryPipeDiameter',
            'heatLossWatts',
            'radiatorCount',
            'returnWaterTemp',
            'buildingMass',
            'bathroomCount',
            'occupancyCount',
            'occupancySignature',
            'highOccupancy',
            'preferCombi',
            'hasLoftConversion',
            'currentHeatSourceType',
            'systemPlanType',
          ].includes(k),
      ),
    ),
  };
}
