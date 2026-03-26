/**
 * presentationAuditFixtures.ts
 *
 * Golden scenario fixture bank for the presentation audit harness.
 *
 * Each fixture represents a distinct, named household scenario covering
 * the major domain cases that the Atlas presentation engine must handle.
 * They are used by presentationAuditHarness.test.ts for rule-based regression
 * checks, difference tests, and scenario snapshot validation.
 *
 * Design rules:
 *   - Every scenario name must be self-documenting.
 *   - Storage type (dhwStorageType) is ALWAYS set explicitly — never left
 *     implicit so that family/storage conflation bugs surface immediately.
 *   - Scenarios must differ in one or more meaningful dimensions from all
 *     other scenarios, so that identical-output detection catches regressions.
 *   - Paired scenarios (SCENARIO_PAIRS) share a base input and differ by
 *     exactly one input dimension, making difference tests precise.
 */

import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Shared base ──────────────────────────────────────────────────────────────

/** Minimal valid base — used as a starting point for derived fixtures. */
const BASE_FIXTURE: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 18,
  mainsDynamicFlowLpmKnown: true,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
  bathroomCount: 1,
};

// ─── Individual scenario fixtures ─────────────────────────────────────────────

/**
 * 1. Low-demand single-person household — combi is well matched.
 *    Distinguishing traits: 1 adult, 1 bath, professional, good mains pressure.
 */
export const SINGLE_PERSON_COMBI_FIT: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 1,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 20,
  demandTimingOverrides: { bathFrequencyPerWeek: 0, simultaneousUseSeverity: 'low' },
  pvStatus: 'none',
};

/**
 * 2. Large family with high simultaneous demand — stored water is well matched.
 *    Distinguishing traits: 5 people, 2 baths, steady_home, high bath frequency.
 */
export const LARGE_FAMILY_STORED_FIT: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 5,
  bathroomCount: 2,
  occupancySignature: 'steady_home',
  highOccupancy: true,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  coldWaterSource: 'mains_true',
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 18,
  demandTimingOverrides: {
    bathFrequencyPerWeek: 5,
    simultaneousUseSeverity: 'high',
    daytimeOccupancy: 'full',
  },
  pvStatus: 'none',
};

/**
 * 3. Open-vented (tank-fed) current DHW system — regular boiler + vented cylinder.
 *    Storage type MUST remain 'open_vented' in the presentation; family MUST NOT
 *    imply storage type.
 */
export const OPEN_VENTED_CURRENT_SYSTEM: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'regular',
  dhwStorageType: 'vented',     // maps to 'open_vented' in presentation
  coldWaterSource: 'loft_tank',
  cwsHeadMetres: 1.2,
  pvStatus: 'none',
};

/**
 * 4. Unvented (mains-pressure) current DHW system — system boiler + unvented cylinder.
 *    Storage type MUST remain 'unvented' in the presentation; must differ from
 *    scenario 3 in every storage-related copy field.
 */
export const UNVENTED_CURRENT_SYSTEM: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  coldWaterSource: 'mains_true',
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 18,
  pvStatus: 'none',
};

/**
 * 5. System boiler + open-vented cylinder (system family, vented storage).
 *    Tests that system family does not automatically imply unvented storage.
 */
export const SYSTEM_BOILER_VENTED: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'vented',     // system boiler with vented cylinder — valid UK installation
  coldWaterSource: 'loft_tank',
  cwsHeadMetres: 1.0,
  pvStatus: 'none',
};

/**
 * 6. Regular boiler + unvented cylinder (regular/open_vented family, unvented storage).
 *    Tests that regular boiler family does not automatically imply open-vented storage.
 */
export const REGULAR_BOILER_UNVENTED: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'regular',
  dhwStorageType: 'unvented',   // regular boiler with unvented cylinder — valid UK installation
  coldWaterSource: 'mains_true',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 18,
  pvStatus: 'none',
};

/**
 * 7. Strong PV, poor demand alignment.
 *    South-facing roof + existing PV, but occupant is out all day (professional).
 *    Solar generation peaks during absent hours → poor alignment.
 *    No stored cylinder → hasStoredHotWater=false → solarStorageOpportunity stays low.
 */
export const STRONG_PV_POOR_ALIGNMENT: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 1,
  bathroomCount: 1,
  occupancySignature: 'professional',   // out all day — solar production wasted
  preferCombi: true,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
  roofOrientation: 'south',
  solarShading: 'low',
  roofType: 'pitched',
  pvStatus: 'existing',
  batteryStatus: 'none',
  demandTimingOverrides: { daytimeOccupancy: 'absent' },
};

/**
 * 8. Strong PV, good demand alignment.
 *    South-facing roof + existing PV, occupant home all day (steady_home) with cylinder.
 *    Solar generation aligns with daytime demand → aligned, high solar storage opportunity.
 *    dhwTankType set so PvAssessmentModule recognises stored hot water.
 */
export const STRONG_PV_GOOD_ALIGNMENT: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  occupancySignature: 'steady_home',    // home all day — solar production used
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  dhwTankType: 'standard_unvented',    // required: PvAssessmentModule uses dhwTankType for hasStoredHotWater
  coldWaterSource: 'mains_true',
  roofOrientation: 'south',
  solarShading: 'low',
  roofType: 'pitched',
  pvStatus: 'existing',
  batteryStatus: 'none',
  demandTimingOverrides: { daytimeOccupancy: 'full' },
};

/**
 * 9. Heat pump candidate with poor primary infrastructure.
 *    ASHP current system, but high design heat loss and marginal radiator count.
 *    Tests that heat pump borderline scenarios produce caution rather than pass.
 */
export const HEAT_PUMP_BORDERLINE: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 2,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'ashp',
  dhwStorageType: 'heat_pump_cylinder',
  coldWaterSource: 'mains_true',
  heatLossWatts: 10_000,  // high heat loss — borderline for ASHP efficiency
  radiatorCount: 6,        // fewer radiators → higher flow temperature needed
  returnWaterTemp: 55,     // high return temp — poor for ASHP condensing
  pvStatus: 'none',
};

/**
 * 10. High water hardness + combi boiler — scale risk case.
 *     Norwich postcode (NR) = very_hard water.
 *     Combi with 2 bathrooms surfaces the combined simultaneous + hardness risk.
 */
export const HIGH_HARDNESS_COMBI_RISK: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  postcode: 'NR1 1AA',   // Norwich — very_hard water (320 ppm CaCO₃)
  occupancyCount: 3,
  bathroomCount: 2,
  preferCombi: true,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 18,
  pvStatus: 'none',
};

/**
 * 11. Loft conversion constraining open-vented viability.
 *     Existing loft conversion + future planned conversion eliminates vented cylinder
 *     headroom and loft-tank option.
 */
export const LOFT_CONVERSION_VENTED_CONSTRAINT: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'regular',
  dhwStorageType: 'vented',
  coldWaterSource: 'loft_tank',
  cwsHeadMetres: 0.4,        // very low head — already marginal
  hasLoftConversion: true,
  futureLoftConversion: true,
  pvStatus: 'none',
};

/**
 * 12. Mixergy cylinder current system.
 *     System boiler with a Mixergy stratified cylinder.
 *     Tests that 'mixergy' storage type is correctly preserved through the
 *     presentation layer and not conflated with a standard unvented cylinder.
 */
export const MIXERGY_CURRENT_SYSTEM: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'mixergy',
  dhwTankType: 'mixergy',
  coldWaterSource: 'mains_true',
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 18,
  pvStatus: 'none',
};

/**
 * 13. Thermal store current system.
 *     Regular boiler (or system boiler) feeding a primary-side thermal store.
 *     Hot water is delivered via an indirect coil exchanger — not a direct cylinder.
 *     Tests that thermal_store is presented as its own DHW architecture, separate
 *     from open-vented and unvented cylinder architectures.
 */
export const THERMAL_STORE_CURRENT_SYSTEM: EngineInputV2_3 = {
  ...BASE_FIXTURE,
  occupancyCount: 3,
  bathroomCount: 1,
  preferCombi: false,
  currentHeatSourceType: 'regular',
  dhwStorageType: 'thermal_store',
  coldWaterSource: 'loft_tank',
  cwsHeadMetres: 1.5,
  pvStatus: 'none',
};

// ─── Named scenario map ───────────────────────────────────────────────────────

/** All golden scenarios keyed by scenario name. */
export const AUDIT_SCENARIOS: Record<string, EngineInputV2_3> = {
  single_person_combi_fit:           SINGLE_PERSON_COMBI_FIT,
  large_family_stored_fit:           LARGE_FAMILY_STORED_FIT,
  open_vented_current_system:        OPEN_VENTED_CURRENT_SYSTEM,
  unvented_current_system:           UNVENTED_CURRENT_SYSTEM,
  system_boiler_vented:              SYSTEM_BOILER_VENTED,
  regular_boiler_unvented:           REGULAR_BOILER_UNVENTED,
  strong_pv_poor_alignment:          STRONG_PV_POOR_ALIGNMENT,
  strong_pv_good_alignment:          STRONG_PV_GOOD_ALIGNMENT,
  heat_pump_borderline:              HEAT_PUMP_BORDERLINE,
  high_hardness_combi_risk:          HIGH_HARDNESS_COMBI_RISK,
  loft_conversion_vented_constraint: LOFT_CONVERSION_VENTED_CONSTRAINT,
  mixergy_current_system:            MIXERGY_CURRENT_SYSTEM,
  thermal_store_current_system:      THERMAL_STORE_CURRENT_SYSTEM,
};

/** Human-readable descriptions for the review surface. */
export const AUDIT_SCENARIO_DESCRIPTIONS: Record<string, string> = {
  single_person_combi_fit:           '1 adult, 1 bath, professional, good pressure — combi is well matched',
  large_family_stored_fit:           '5 people, 2 baths, home all day, high bath use — stored water wins',
  open_vented_current_system:        'Regular boiler + vented cylinder (tank-fed, open-vented DHW)',
  unvented_current_system:           'System boiler + unvented cylinder (mains-fed DHW)',
  system_boiler_vented:              'System boiler family with open-vented storage (family ≠ storage type)',
  regular_boiler_unvented:           'Regular boiler family with unvented storage (family ≠ storage type)',
  strong_pv_poor_alignment:          'South roof + existing PV, but professional (absent all day) → poor alignment',
  strong_pv_good_alignment:          'South roof + existing PV, steady_home (present all day) → good alignment',
  heat_pump_borderline:              'ASHP current, high heat loss, few radiators — borderline infrastructure',
  high_hardness_combi_risk:          'Norwich (very hard water) + combi + 2 baths — combined scale/simultaneous risk',
  loft_conversion_vented_constraint: 'Loft conversion + future conversion + low CWS head — vented viability constrained',
  mixergy_current_system:            'System boiler + Mixergy stratified cylinder — architecture must stay distinct from standard unvented',
  thermal_store_current_system:      'Regular boiler + thermal store (indirect DHW via exchanger) — architecture distinct from direct cylinder',
};

// ─── Paired scenarios for difference tests ────────────────────────────────────

/**
 * Paired scenario definitions — each pair shares a base input and differs by
 * exactly one dimension.  Used for difference tests that assert the presentation
 * changes in the expected dimension when a single input changes.
 */
export interface ScenarioPair {
  name: string;
  description: string;
  /** The dimension that differs between scA and scB. */
  differingDimension: string;
  scA: EngineInputV2_3;
  scB: EngineInputV2_3;
}

const PAIRED_SCENARIO_BASE: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 18,
  mainsDynamicFlowLpmKnown: true,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancyCount: 3,
  bathroomCount: 1,
  occupancySignature: 'steady_home',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'system',
};

export const SCENARIO_PAIRS: ScenarioPair[] = [
  // ── PV status differences ─────────────────────────────────────────────────
  {
    name: 'pv_none_vs_existing',
    description: 'Same home — no PV vs. existing PV on a south roof',
    differingDimension: 'pvStatus',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'none',
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      roofOrientation: 'south',
      solarShading: 'low',
      roofType: 'pitched',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'existing',
    },
  },
  {
    name: 'pv_none_vs_planned',
    description: 'Same home — no PV vs. planned PV',
    differingDimension: 'pvStatus (none→planned)',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'none',
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'planned',
    },
  },
  // ── DHW storage type differences ─────────────────────────────────────────
  {
    name: 'open_vented_vs_unvented',
    description: 'Same home — open-vented vs. unvented current DHW',
    differingDimension: 'dhwStorageType',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      coldWaterSource: 'loft_tank',
      cwsHeadMetres: 1.2,
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
    },
  },
  // ── Occupancy differences ─────────────────────────────────────────────────
  {
    name: 'one_person_vs_five_people',
    description: 'Same house — 1 person vs. 5 people',
    differingDimension: 'occupancyCount',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 1,
      bathroomCount: 1,
      occupancySignature: 'professional',  // single adult, out all day
      highOccupancy: false,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      demandTimingOverrides: { simultaneousUseSeverity: 'low', bathFrequencyPerWeek: 0 },
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 5,
      bathroomCount: 2,
      occupancySignature: 'steady_home',   // large family, home all day
      highOccupancy: true,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      demandTimingOverrides: { simultaneousUseSeverity: 'high', bathFrequencyPerWeek: 5 },
    },
  },
  // ── Low vs. high simultaneous demand ─────────────────────────────────────
  {
    name: 'low_vs_high_simultaneous',
    description: 'Same family size — single outlet vs. high simultaneous demand',
    differingDimension: 'simultaneousUseSeverity / bathroomCount',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 3,
      bathroomCount: 1,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      demandTimingOverrides: { simultaneousUseSeverity: 'low' },
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 3,
      bathroomCount: 2,
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      demandTimingOverrides: { simultaneousUseSeverity: 'high' },
    },
  },
  // ── DHW architecture: standard cylinder vs Mixergy ───────────────────────
  {
    name: 'standard_cylinder_vs_mixergy',
    description: 'Same home — standard unvented cylinder vs. Mixergy stratified cylinder',
    differingDimension: 'dhwStorageType (unvented→mixergy)',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'none',
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'system',
      dhwStorageType: 'mixergy',
      dhwTankType: 'mixergy',
      coldWaterSource: 'mains_true',
      pvStatus: 'none',
    },
  },
  // ── DHW architecture: standard cylinder vs thermal store ─────────────────
  {
    name: 'standard_cylinder_vs_thermal_store',
    description: 'Same home — standard unvented cylinder vs. thermal store (indirect DHW)',
    differingDimension: 'dhwStorageType (unvented→thermal_store)',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      pvStatus: 'none',
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      currentHeatSourceType: 'regular',
      dhwStorageType: 'thermal_store',
      coldWaterSource: 'loft_tank',
      cwsHeadMetres: 1.5,
      pvStatus: 'none',
    },
  },
  // ── Combi-friendly vs stored-friendly demand profile ─────────────────────
  {
    name: 'combi_friendly_vs_stored_friendly',
    description: 'Combi-friendly home (1 person, 1 bath, professional) vs. stored-friendly (3 people, 2 baths, steady_home)',
    differingDimension: 'occupancyCount / bathroomCount / occupancySignature',
    scA: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 1,
      bathroomCount: 1,
      occupancySignature: 'professional',
      highOccupancy: false,
      preferCombi: true,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'none',
      dynamicMainsPressure: 2.5,
      mainsDynamicFlowLpm: 20,
      mainsDynamicFlowLpmKnown: true,
      demandTimingOverrides: { simultaneousUseSeverity: 'low', bathFrequencyPerWeek: 0 },
      pvStatus: 'none',
    },
    scB: {
      ...PAIRED_SCENARIO_BASE,
      occupancyCount: 3,
      bathroomCount: 2,
      occupancySignature: 'steady_home',
      highOccupancy: false,
      preferCombi: false,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      coldWaterSource: 'mains_true',
      demandTimingOverrides: { simultaneousUseSeverity: 'high', bathFrequencyPerWeek: 3 },
      pvStatus: 'none',
    },
  },
];
