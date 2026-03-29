/**
 * buildCanonicalPresentation.ts
 *
 * Pure function that derives the structured canonical presentation model from
 * FullEngineResult + EngineInputV2_3.
 *
 * Design rules:
 *   - Every string in the output must originate from a canonical signal.
 *   - No generic copy that does not reference house/home/energy/current-system/
 *     objective signals.
 *   - No Math.random() — entirely deterministic.
 *   - No engine logic re-derived here — all signals come from existing module outputs.
 *
 * The output type CanonicalPresentationModel feeds CanonicalPresentationPage.tsx
 * which renders the multi-page structured recommendation.
 */

import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { ApplianceFamily } from '../../engine/topology/SystemTopology';
import type { DhwArchitecture } from '../../lib/dhw/buildDhwContextFromSurvey';
import type { DhwType } from '../../features/survey/systemBuilder/systemBuilderTypes';
import type { PrioritiesState } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';

export type { DhwArchitecture };

// ─── Output model ─────────────────────────────────────────────────────────────

/**
 * DHW storage configuration — separate from appliance family.
 *
 * open_vented  — tank-fed cylinder, gravity-head supply from a CWS tank
 * unvented     — mains-pressure sealed cylinder
 * thermal_store — thermal store (primary-side hot water store)
 * mixergy      — Mixergy stratified cylinder
 * unknown      — storage type not recorded
 */
export type DhwStorageType =
  | 'open_vented'
  | 'unvented'
  | 'thermal_store'
  | 'mixergy'
  | 'unknown';

/** House signals — fabric, heat loss, infrastructure, PV potential. */
export interface HouseSignal {
  heatLossLabel: string;
  heatLossBand: string;
  pipeworkLabel: string;
  waterSupplyLabel: string;
  pvPotentialLabel: string;
  wallTypeLabel: string;
  insulationLabel: string;
  notes: string[];
  /**
   * Wall type key normalised for HeatParticlesVisual.
   * cavity_unfilled is mapped to cavity_uninsulated (same high heat-loss physics).
   */
  wallTypeKey: 'solid_masonry' | 'cavity_uninsulated' | 'cavity_insulated';
  /**
   * Human-readable roof orientation label for the main usable roof face.
   * null when orientation was not recorded in the survey.
   * Drives solar suitability narrative in both deck and vertical presentation paths.
   */
  roofOrientationLabel: string | null;
  /**
   * Human-readable roof type label — pitched, flat, hipped, etc.
   * null when not recorded.
   */
  roofTypeLabel: string | null;
}

/** Home signals — demand profile, demographics, storage benefit. */
export interface HomeSignal {
  demandProfileLabel: string;
  dailyHotWaterLitres: number;
  dailyHotWaterLabel: string;
  peakSimultaneousOutlets: number;
  peakOutletsLabel: string;
  bathUseIntensityLabel: string;
  occupancyTimingLabel: string;
  storageBenefitLabel: string;
  narrativeSignals: string[];
}

/** Energy signals — PV status, battery, suitability, alignment, opportunity. */
export interface EnergySignal {
  pvStatusLabel: string;
  batteryStatusLabel: string;
  pvSuitabilityLabel: string;
  energyAlignmentLabel: string;
  solarStorageOpportunityLabel: string;
  narrativeSignals: string[];
}

/** Current system signals — type, age, make/model. */
export interface CurrentSystemSignal {
  /**
   * Human-readable system type — null when heat source type was not captured
   * in the survey. Rendering components must treat null as "not recorded" and
   * hide the label rather than falling back to a generic placeholder.
   */
  systemTypeLabel: string | null;
  /**
   * Human-readable age label — null when boiler age was not captured in the
   * survey. Rendering components must treat null as "not recorded" and hide
   * the label rather than showing "Age not recorded" as if it were captured.
   */
  ageLabel: string | null;
  makeModelText: string | undefined;
  outputLabel: string | undefined;
  ageContext: string;
  /** Driving-style visual mode derived from the current heat source type. */
  drivingStyleMode: 'combi' | 'stored' | 'heat_pump';
  /**
   * DHW storage configuration — explicitly separate from appliance family.
   * Derived from input.dhwStorageType; never inferred from heat source type.
   */
  dhwStorageType: DhwStorageType;
  /**
   * Top-level DHW architecture — the primary discriminator for visuals, copy,
   * and requirements.  Derived from dhwStorageType + drivingStyleMode.
   *
   *   on_demand        — combi / no stored DHW
   *   standard_cylinder — vented or unvented potable cylinder
   *   mixergy          — Mixergy stratified cylinder
   *   thermal_store    — stored heat (not stored hot water); DHW via exchanger
   */
  dhwArchitecture: DhwArchitecture;
  /** Canonical current heat source from the survey/model (for image mapping). */
  currentHeatSourceType: EngineInputV2_3['currentHeatSourceType'];
  /** Canonical DHW type from survey/model (for image mapping). */
  systemDhwType?: DhwType;
}

/** Objectives signals — user priorities from expert assumptions and preferences. */
export interface ObjectivesSignal {
  priorities: Array<{ label: string; value: string }>;
}

/** Page 1 — What we know. */
export interface Page1WhatWeKnow {
  house: HouseSignal;
  home: HomeSignal;
  energy: EnergySignal;
  currentSystem: CurrentSystemSignal;
  objectives: ObjectivesSignal;
}

/**
 * Architecture-specific component degradation block (Block B).
 * Describes what degrades in the current system architecture.
 */
export interface ComponentDegradationBlock {
  /** Driving architecture — determines which degradation narrative is shown. */
  architecture: 'combi' | 'stored' | 'heat_pump' | 'other';
  /** Human-readable component name (e.g. "Plate heat exchanger", "Cylinder coil"). */
  componentLabel: string;
  /** What the primary degradation mechanism is for this architecture. */
  degradationMechanism: string;
  /** Inferred condition band from survey evidence, or 'unknown' when absent. */
  conditionBand: 'good' | 'moderate' | 'poor' | 'severe' | 'unknown';
  /** Short human-readable condition label. */
  conditionLabel: string;
}

/**
 * Single circulation / cleanliness signal pill (Block C).
 */
export interface CirculationSignal {
  label: string;
  status: 'ok' | 'warn' | 'unknown';
}

/** Page 1.5 — Contextual ageing / degradation framing (probabilistic). */
export interface Page1_5AgeingContext {
  heading: string;
  ageBandLabel: string;
  /** One-line condition summary based on surveyed signals. */
  conditionSummary: string;
  /**
   * Whether the ageing context is backed by real survey evidence (age recorded
   * or a condition band captured or sludge detected). When false the presentation
   * layer must suppress or replace this slide — never show synthetic health copy
   * derived purely from default age estimates.
   */
  hasRealEvidence: boolean;

  // ── Block A: Efficiency drift ──────────────────────────────────────────────
  /** Which band on the healthy → ageing → neglected path this system sits in. */
  currentEfficiencyBand: 'healthy' | 'ageing' | 'neglected';
  /** Short description of what the current efficiency band means. */
  efficiencyBandDescription: string;

  // ── Block B: Architecture-specific component degradation ─────────────────
  componentDegradation: ComponentDegradationBlock;

  // ── Block C: Circulation / cleanliness signals ────────────────────────────
  circulationSignals: CirculationSignal[];

  // ── What this means in this home ─────────────────────────────────────────
  homeImpacts: string[];

  // ── Likely first improvements (conditional, shown at bottom) ─────────────
  likelyFirstImprovements: string[];

  /** Legacy probabilistic notes — retained for downstream compatibility. */
  probabilisticNotes: string[];
  waterQualityNote: string | undefined;
}

/** Per-option explanation through house/home/energy lens (Page 2). */
export interface AvailableOptionExplanation {
  id: string;
  label: string;
  status: OptionCardV1['status'];
  headline: string;
  whatItIs: string;
  /**
   * Top-level DHW architecture this option would use — the primary discriminator
   * for visuals and wording on the options page.
   *
   *   on_demand        — option delivers hot water on demand (combi)
   *   standard_cylinder — option uses a standard vented or unvented cylinder
   *   mixergy          — option uses a Mixergy stratified cylinder
   *   thermal_store    — not a recommended future option (legacy)
   */
  dhwArchitecture: DhwArchitecture;
  throughHouseNotes: string[];
  throughHomeNotes: string[];
  throughEnergyNotes: string[];
  worksWellWhen: string[];
  limitedWhen: string[];
}

/** Page 2 — Available options. */
export interface Page2AvailableOptions {
  options: AvailableOptionExplanation[];
}

/** Per-option ranking entry (Page 3). */
export interface PhysicsRankingItem {
  rank: number;
  family: string;
  label: string;
  overallScore: number;
  reasonLine: string;
  demandFitNote: string | undefined;
  waterFitNote: string | undefined;
  infrastructureFitNote: string | undefined;
  energyFitNote: string | undefined;
}

/** Page 3 — Physics-first ranking. */
export interface Page3PhysicsRanking {
  items: PhysicsRankingItem[];
}

/** Per-shortlisted-option detail (Pages 4+). */
export interface ShortlistedOptionDetail {
  family: string;
  label: string;
  /**
   * Regulatory / safety items that are not optional — rendered separately
   * from required enabling works so they are never confused with upgrades.
   */
  complianceItems: string[];
  requiredWork: string[];
  bestPerformanceUpgrades: string[];
  /**
   * Solar storage opportunity signal — used for signal-driven visual selection
   * on the shortlist page (cylinder_charge_standard or cylinder_charge_mixergy when high).
   */
  solarStorageOpportunity: string;
  /**
   * Peak simultaneous hot water outlets — used for visual selection
   * (flow_split when >= 2).
   */
  peakSimultaneousOutlets: number;
  /**
   * DHW storage subtype of the current system — retained for backward
   * compatibility and low-level storage type queries.
   * For architecture-first branching, use `dhwArchitecture` instead.
   */
  dhwStorageType: DhwStorageType;
  /**
   * Top-level DHW architecture for this option — the primary discriminator for
   * visuals and wording on the shortlist page.
   *
   *   on_demand        — option delivers hot water on demand (combi)
   *   standard_cylinder — option uses a standard vented or unvented cylinder
   *   mixergy          — option uses a Mixergy stratified cylinder
   *   thermal_store    — option uses a primary thermal store (legacy; not a
   *                      recommended new option — shortlist visual suppressed)
   */
  dhwArchitecture: DhwArchitecture;
  /**
   * Storage benefit signal — used to determine whether a cylinder animation
   * is relevant for this household (avoids showing irrelevant storage visuals
   * for low-demand single-occupancy homes with no solar).
   */
  storageBenefitSignal: string;
}

/** Pages 4+ — Shortlisted option detail. */
export interface Page4PlusShortlistedDetail {
  options: ShortlistedOptionDetail[];
}

/** Final page — Simulator / proof layer. */
export interface FinalPageSimulator {
  homeScenarioDescription: string;
  houseConstraintNotes: string[];
  energyTimingNotes: string[];
  /**
   * Architecture-specific guidance for what to test in the System Simulator.
   * Derived from the top-level DHW architecture so the handoff is physics-first.
   */
  dhwArchitectureNote: string;
  /**
   * Architecture-neutral list of what the user can do in the real System Simulator.
   * Rendered on the handoff page so users know exactly what they are opening.
   */
  simulatorCapabilities: readonly string[];
}

/** Full canonical presentation model. */
export interface CanonicalPresentationModel {
  page1: Page1WhatWeKnow;
  page1_5: Page1_5AgeingContext;
  page2: Page2AvailableOptions;
  page3: Page3PhysicsRanking;
  page4Plus: Page4PlusShortlistedDetail;
  finalPage: FinalPageSimulator;
}

// ─── Display helpers ───────────────────────────────────────────────────────────

const WALL_TYPE_LABELS: Record<string, string> = {
  solid_masonry:   'Solid masonry (high heat loss)',
  // 'cavity_unfilled' is the engine's FabricWallType for an unfilled cavity wall.
  // The stepper survey uses 'cavity_uninsulated' as its UI type; the engine normalises
  // it to 'cavity_unfilled' before running FabricModelModule. Both must be treated as
  // high heat-loss (same physics — empty cavity, no insulation).
  cavity_unfilled: 'Unfilled cavity wall (high heat loss)',
  cavity_filled:   'Filled cavity wall',
  timber_frame:    'Timber frame',
  unknown:         'Wall type not recorded',
};

const INSULATION_LABELS: Record<string, string> = {
  poor:        'Poor insulation',
  moderate:    'Moderate insulation',
  good:        'Good insulation',
  exceptional: 'Exceptional insulation',
  unknown:     'Insulation level not recorded',
};

const HEAT_LOSS_BAND_LABELS: Record<string, string> = {
  very_high: 'Very high heat loss',
  high:      'High heat loss',
  moderate:  'Moderate heat loss',
  low:       'Low heat loss',
  very_low:  'Very low heat loss',
  unknown:   'Heat loss band not modelled',
};

const PV_SUITABILITY_LABELS: Record<string, string> = {
  good:    'Good PV potential',
  fair:    'Fair PV potential',
  limited: 'Limited PV potential',
};

const PV_STATUS_LABELS: Record<string, string> = {
  none:     'No PV installed',
  existing: 'PV panels installed',
  planned:  'PV planned',
};

const BATTERY_STATUS_LABELS: Record<string, string> = {
  none:     'No battery',
  existing: 'Battery installed',
  planned:  'Battery planned',
};

const ALIGNMENT_LABELS: Record<string, string> = {
  aligned:        'Generation well aligned with demand',
  partly_aligned: 'Generation partly aligned with demand',
  poorly_aligned: 'Generation poorly aligned with demand',
};

const STORAGE_OPP_LABELS: Record<string, string> = {
  high:   'High solar storage opportunity',
  medium: 'Medium solar storage opportunity',
  low:    'Low solar storage opportunity',
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  combi:  'Combi boiler',
  system: 'System boiler with cylinder',
  regular: 'Regular (open-vented) boiler',
  ashp:   'Air source heat pump',
  other:  'Other heat source',
};

/**
 * Human-readable labels for compass roof orientations.
 * 'unknown' maps to null — displayed only when orientation was captured.
 */
const ROOF_ORIENTATION_LABELS: Record<string, string> = {
  N:  'Roof faces North',
  NE: 'Roof faces North-East',
  E:  'Roof faces East',
  SE: 'Roof faces South-East',
  S:  'Roof faces South (best solar)',
  SW: 'Roof faces South-West',
  W:  'Roof faces West',
  NW: 'Roof faces North-West',
  // Legacy lowercase aliases from EngineInputV2_3 roofOrientation field
  north:       'Roof faces North',
  east:        'Roof faces East',
  south:       'Roof faces South (best solar)',
  west:        'Roof faces West',
  south_east:  'Roof faces South-East',
  south_west:  'Roof faces South-West',
  mixed:       'Mixed roof orientation',
};

const ROOF_TYPE_LABELS: Record<string, string> = {
  pitched: 'Pitched roof',
  flat:    'Flat roof',
  hipped:  'Hipped roof',
  dormer:  'Dormer roof',
  mixed:   'Mixed roof form',
};

const BATH_INTENSITY_LABELS: Record<string, string> = {
  low:    'Low bath use (shower-only or rare baths)',
  medium: 'Moderate bath use (occasional baths)',
  high:   'Frequent bath use (4+ baths/week)',
};

const TIMING_LABELS: Record<string, string> = {
  daytime_home:  'Typically home during the day',
  away_daytime:  'Typically away 09:00–17:00 (professional pattern)',
  irregular:     'Irregular hours (shift work or variable)',
};

const STORAGE_BENEFIT_LABELS: Record<string, string> = {
  high:   'High benefit from stored hot water vs combi',
  medium: 'Moderate benefit from stored hot water',
  low:    'Low benefit from stored hot water — combi well matched',
};

const OPTION_WHAT_IT_IS: Record<string, string> = {
  combi:           'A combi (combination) boiler heats water on demand — no hot-water cylinder required.',
  stored_vented:   'A system boiler with a vented (tank-fed) cylinder stores hot water, fed from a cold-water tank in the loft.',
  stored_unvented: 'A system boiler with an unvented (mains-pressure) cylinder stores hot water at mains pressure.',
  ashp:            'An air source heat pump extracts heat from outside air to heat your home and hot water.',
  regular_vented:  'A regular (open-vented) boiler works with a hot-water cylinder and cold-water storage tank.',
  system_unvented: 'A system boiler with an unvented cylinder provides mains-pressure stored hot water.',
};

const FAMILY_LABELS: Record<string, string> = {
  combi:       'Combi boiler',
  system:      'System boiler with cylinder',
  heat_pump:   'Air source heat pump',
  regular:     'Regular boiler (vented)',
  open_vented: 'Regular boiler (vented)',
};

// ─── Visual signal helpers ─────────────────────────────────────────────────────

/**
 * Map a DHW storage type + driving style mode to the top-level DHW
 * architecture discriminator used throughout the presentation layer.
 *
 * Architecture is the primary branching key for visuals, wording, and
 * requirements — never infer it from appliance family alone.
 *
 * Resolution:
 *   thermal_store  → thermal_store  (always, regardless of driving mode)
 *   mixergy        → mixergy
 *   open_vented | unvented → standard_cylinder
 *   unknown + combi mode   → on_demand  (no evidence of stored DHW)
 *   unknown + stored/hp    → standard_cylinder (heat source implies cylinder)
 */
function storageTypeToArchitecture(
  storageType: DhwStorageType,
  drivingStyleMode: 'combi' | 'stored' | 'heat_pump',
): DhwArchitecture {
  if (storageType === 'thermal_store') return 'thermal_store';
  if (storageType === 'mixergy')       return 'mixergy';
  if (storageType === 'open_vented' || storageType === 'unvented') return 'standard_cylinder';
  // unknown storage type — fall back to driving mode as the best available signal
  if (drivingStyleMode === 'combi') return 'on_demand';
  // Both 'stored' (system/regular boiler) and 'heat_pump' always have a cylinder,
  // so standard_cylinder is the correct architecture for both when storage type
  // is unknown.
  return 'standard_cylinder';
}

/**
 * Map a shortlisted-option ID and the current-system DHW storage type to the
 * architecture this OPTION would use if installed.
 *
 * For combi options the architecture is always on_demand.
 * For stored options we use the current-system storage type as a proxy for
 * what cylinder would be recommended (Mixergy homes get Mixergy options).
 * For ASHP options the architecture is always standard_cylinder.
 *
 * Note: thermal_store is never a recommended future option; this function
 * maps all stored non-mixergy options to standard_cylinder.
 *
 * Unrecognised option IDs (e.g. future option families not yet in the enum)
 * fall through to the final stored-option path and inherit the Mixergy signal.
 * This is intentionally conservative — standard_cylinder is the safe default
 * for any stored architecture that is not explicitly classified above.
 */
function optionIdToArchitecture(
  optionId: string,
  dhwStorageType: DhwStorageType,
): DhwArchitecture {
  if (optionId === 'combi') return 'on_demand';
  if (optionId === 'ashp')  return 'standard_cylinder';
  // Stored options (stored_vented, stored_unvented, system_unvented, regular_vented,
  // and any future stored-DHW option IDs): honour the Mixergy signal from the
  // current system so Mixergy households continue to see Mixergy-specific visuals.
  if (dhwStorageType === 'mixergy') return 'mixergy';
  return 'standard_cylinder';
}

/**
 * Map a FabricWallType to the normalised wall type key expected by
 * HeatParticlesVisual. cavity_unfilled (engine type) is treated as
 * cavity_uninsulated — same high heat-loss physics, different label.
 * timber_frame and unknown default to cavity_insulated (low heat-loss
 * appearance) as the safest visual representation.
 */
function wallTypeToVisualKey(
  wallType: string,
): 'solid_masonry' | 'cavity_uninsulated' | 'cavity_insulated' {
  if (wallType === 'solid_masonry') return 'solid_masonry';
  if (wallType === 'cavity_unfilled') return 'cavity_uninsulated';
  if (wallType === 'cavity_filled') return 'cavity_insulated';
  if (wallType === 'timber_frame') return 'cavity_insulated';
  // unknown — default to low-loss visual (cavity_insulated) to avoid
  // overstating heat loss when the wall type has not been recorded.
  return 'cavity_insulated';
}

/**
 * Map currentHeatSourceType to the DrivingStyleMode expected by
 * DrivingStyleVisual. Defaults to 'combi' for unrecognised types
 * because the burst-firing pattern is the most conservative illustration
 * when system behaviour is unknown.
 */
function systemTypeToDrivingMode(
  type: string | undefined,
): 'combi' | 'stored' | 'heat_pump' {
  if (type === 'combi') return 'combi';
  if (type === 'system' || type === 'regular') return 'stored';
  if (type === 'ashp') return 'heat_pump';
  // unknown / other (e.g. electric, district) — default to combi appearance
  return 'combi';
}

/**
 * Map input.dhwStorageType to the DhwStorageType signal used in the
 * presentation layer.  Storage type is NEVER inferred from appliance
 * family — it must be explicitly recorded in the input.
 */
function inputDhwStorageTypeToSignal(
  raw: EngineInputV2_3['dhwStorageType'],
): DhwStorageType {
  if (raw === 'vented') return 'open_vented';
  if (raw === 'unvented') return 'unvented';
  if (raw === 'mixergy') return 'mixergy';
  if (raw === 'thermal_store') return 'thermal_store';
  // heat_pump_cylinder and 'none' do not map to a stored storage type
  return 'unknown';
}

// ─── Page 1 — What we know ─────────────────────────────────────────────────────

function buildHouseSignal(result: FullEngineResult, input: EngineInputV2_3): HouseSignal {
  const fabric = input.building?.fabric;
  const wallType = fabric?.wallType ?? 'unknown';
  const insulation = fabric?.insulationLevel ?? 'unknown';

  const heatLossKw = (input.heatLossWatts / 1000).toFixed(1);
  const fabricResult = result.fabricModelV1;
  const heatLossBand = fabricResult?.heatLossBand ?? 'unknown';

  const pipeDiam = input.primaryPipeDiameter;
  const pipeworkLabel = `${pipeDiam} mm primary pipework`;

  let waterSupplyLabel: string;
  if (input.coldWaterSource === 'mains_true') waterSupplyLabel = 'Mains-fed supply';
  else if (input.coldWaterSource === 'loft_tank') waterSupplyLabel = 'Tank-fed supply (loft tank)';
  else if (input.coldWaterSource === 'mains_shared') waterSupplyLabel = 'Shared mains supply';
  else waterSupplyLabel = 'Water supply not recorded';

  const pvPotentialLabel = PV_SUITABILITY_LABELS[result.pvAssessment.pvSuitability] ?? 'PV potential not assessed';

  const notes: string[] = [];

  if (input.hasLoftConversion) {
    notes.push('Loft conversion present — affects available space and pipework routing.');
  }
  if (input.futureLoftConversion) {
    notes.push('Loft conversion planned — any system choice should account for future routing.');
  }
  if (input.futureAddBathroom) {
    notes.push('Additional bathroom planned — peak simultaneous demand will increase.');
  }
  // cavity_unfilled (engine type) = unfilled cavity — same high heat-loss physics as solid masonry
  if (wallType === 'solid_masonry' || wallType === 'cavity_unfilled') {
    notes.push('High heat-loss wall construction — fabric improvements would reduce running costs for any system.');
  }
  if (fabricResult?.notes) {
    for (const note of fabricResult.notes) {
      notes.push(note);
    }
  }

  return {
    heatLossLabel: `${heatLossKw} kW design heat loss`,
    heatLossBand: HEAT_LOSS_BAND_LABELS[heatLossBand] ?? heatLossBand,
    pipeworkLabel,
    waterSupplyLabel,
    pvPotentialLabel,
    wallTypeLabel: WALL_TYPE_LABELS[wallType] ?? wallType,
    insulationLabel: INSULATION_LABELS[insulation] ?? insulation,
    notes,
    wallTypeKey: wallTypeToVisualKey(wallType),
    // Roof orientation — null when not captured, unknown, or unmapped.
    // We do NOT fall back to raw internal identifiers; use null to hide the field.
    roofOrientationLabel: (input.roofOrientation && input.roofOrientation !== 'unknown')
      ? (ROOF_ORIENTATION_LABELS[input.roofOrientation] ?? null)
      : null,
    // Roof type — null when not captured, unknown, or unmapped.
    roofTypeLabel: (input.roofType && input.roofType !== 'unknown')
      ? (ROOF_TYPE_LABELS[input.roofType] ?? null)
      : null,
  };
}

function buildHomeSignal(result: FullEngineResult, input: EngineInputV2_3): HomeSignal {
  const demo = result.demographicOutputs;
  const occupancy = input.occupancyCount ?? 2;
  const bathrooms = input.bathroomCount;

  const dailyLitres = Math.round(demo.dailyHotWaterLitres);
  const dailyHotWaterLabel = `~${dailyLitres} L/day estimated (${occupancy} ${occupancy === 1 ? 'person' : 'people'}, ${bathrooms} ${bathrooms === 1 ? 'bathroom' : 'bathrooms'})`;

  const outlets = demo.peakSimultaneousOutlets;
  const peakOutletsLabel = outlets === 1
    ? '1 outlet at a time (single-draw profile)'
    : outlets === 2
      ? '2 simultaneous outlets (concurrent draw risk)'
      : `${outlets} simultaneous outlets (high concurrency — combi not suitable)`;

  return {
    demandProfileLabel: demo.demandProfileLabel,
    dailyHotWaterLitres: dailyLitres,
    dailyHotWaterLabel,
    peakSimultaneousOutlets: outlets,
    peakOutletsLabel,
    bathUseIntensityLabel: BATH_INTENSITY_LABELS[demo.bathUseIntensity] ?? demo.bathUseIntensity,
    occupancyTimingLabel:  TIMING_LABELS[demo.occupancyTimingProfile] ?? demo.occupancyTimingProfile,
    storageBenefitLabel:   STORAGE_BENEFIT_LABELS[demo.storageBenefitSignal] ?? demo.storageBenefitSignal,
    narrativeSignals: demo.demographicNarrativeSignals,
  };
}

function buildEnergySignal(result: FullEngineResult, input: EngineInputV2_3): EnergySignal {
  const pv = result.pvAssessment;

  const pvStatusLabel   = PV_STATUS_LABELS[input.pvStatus ?? 'none'] ?? 'PV status not recorded';
  const batteryLabel    = BATTERY_STATUS_LABELS[input.batteryStatus ?? 'none'] ?? 'Battery status not recorded';

  // Distinguish "good roof but no PV" from "existing PV"
  let pvSuitabilityLabel = PV_SUITABILITY_LABELS[pv.pvSuitability] ?? pv.pvSuitability;
  if (pv.pvSuitability === 'good' && !pv.hasExistingPv && input.pvStatus !== 'planned') {
    pvSuitabilityLabel = 'Good PV potential — roof suitable, no panels yet';
  } else if (pv.pvSuitability === 'good' && pv.hasExistingPv) {
    pvSuitabilityLabel = 'Good PV potential — panels already installed';
  } else if (pv.pvSuitability === 'good' && input.pvStatus === 'planned') {
    pvSuitabilityLabel = 'Good PV potential — panels planned for future installation';
  }

  return {
    pvStatusLabel,
    batteryStatusLabel:            batteryLabel,
    pvSuitabilityLabel,
    energyAlignmentLabel:          ALIGNMENT_LABELS[pv.energyDemandAlignment] ?? pv.energyDemandAlignment,
    solarStorageOpportunityLabel:  STORAGE_OPP_LABELS[pv.solarStorageOpportunity] ?? pv.solarStorageOpportunity,
    narrativeSignals: pv.solarNarrativeSignals,
  };
}

function buildCurrentSystemSignal(input: EngineInputV2_3): CurrentSystemSignal {
  // Use the raw type from input — never fall back to 'other' when the type
  // was not captured. 'other' is only used when the user explicitly selected it.
  // For unmapped types (implementation identifiers not in SYSTEM_TYPE_LABELS),
  // return null rather than exposing raw internal identifiers to the UI.
  const type = input.currentHeatSourceType;
  const systemTypeLabel = type != null ? (SYSTEM_TYPE_LABELS[type] ?? null) : null;

  const age = input.currentBoilerAgeYears ?? input.currentSystem?.boiler?.ageYears;
  // ageLabel is null when age was not captured — callers must hide the label
  // rather than rendering "Age not recorded" as if it were real survey data.
  const ageLabel = age != null ? `${age} ${age === 1 ? 'year' : 'years'} old` : null;

  const outputKw = input.currentBoilerOutputKw;
  const outputLabel = outputKw != null ? `${outputKw} kW rated output` : undefined;

  // Age context: typical lifespans (uses explicit type, defaulting to combi-style
  // lifespan guidance only when type is actually a boiler family)
  let ageContext: string;
  if (age == null) {
    ageContext = 'System age unknown — cannot assess remaining life expectancy.';
  } else if (type === 'combi' || type === 'system') {
    if (age < 5)       ageContext = 'Young boiler — typically well within expected service life.';
    else if (age < 10) ageContext = 'Mid-life boiler — performance should be close to original spec.';
    else if (age < 15) ageContext = 'Approaching typical end of expected service life (10–15 years for many combis).';
    else               ageContext = 'Beyond typical service life — reliability risk increases with age.';
  } else if (type === 'regular') {
    if (age < 15)      ageContext = 'Regular boilers often serve longer than combis — mid-life is typical.';
    else               ageContext = 'Long-served regular boiler — component wear is a realistic consideration.';
  } else {
    ageContext = 'System age context not available for this type.';
  }

  const drivingStyleMode = systemTypeToDrivingMode(type);
  const dhwStorageType   = inputDhwStorageTypeToSignal(input.dhwStorageType);

  return {
    systemTypeLabel,
    ageLabel,
    makeModelText: input.makeModelText,
    outputLabel,
    ageContext,
    drivingStyleMode,
    dhwStorageType,
    dhwArchitecture: storageTypeToArchitecture(dhwStorageType, drivingStyleMode),
    currentHeatSourceType: input.currentHeatSourceType,
    systemDhwType:
      dhwStorageType === 'open_vented' ? 'open_vented'
        : dhwStorageType === 'unvented' ? 'unvented'
          : dhwStorageType === 'thermal_store' ? 'thermal_store'
            : undefined,
  };
}

function buildObjectivesSignal(
  input: EngineInputV2_3,
  prioritiesState?: PrioritiesState,
): ObjectivesSignal {
  // When the survey Priorities step has been completed, use those chip selections
  // as the canonical source of objective signals.  The PriorityKey values from
  // the Priorities step are the authoritative customer-facing objectives — they
  // supersede any legacy expertAssumptions / preferences fields.
  if (prioritiesState && prioritiesState.selected.length > 0) {
    const priorities = prioritiesState.selected.map(key => {
      const meta = PRIORITY_META.find(m => m.key === key);
      return meta
        ? { label: `${meta.emoji} ${meta.label}`, value: meta.sub }
        : { label: key, value: '' };
    });
    return { priorities };
  }

  // Fall back to legacy engine-preference fields when no survey priorities are
  // available (e.g. demo inputs or pre-priorities-step engine-only inputs).
  const ea = input.expertAssumptions;
  const pref = input.preferences;
  const priorities: Array<{ label: string; value: string }> = [];

  const space = ea?.spaceSavingPriority ?? pref?.spacePriority ?? null;
  if (space === 'high') priorities.push({ label: 'Space saving', value: 'High priority — must avoid a cylinder if possible' });
  else if (space === 'medium') priorities.push({ label: 'Space saving', value: 'Moderate priority — compact system preferred' });
  else if (space === 'low') priorities.push({ label: 'Space saving', value: 'Not a priority — performance and physics drive the choice' });

  const disruption = ea?.disruptionTolerance ?? pref?.disruptionTolerance ?? null;
  if (disruption === 'low') priorities.push({ label: 'Installation disruption', value: 'Low tolerance — keep enabling works minimal' });
  else if (disruption === 'med' || disruption === 'medium') priorities.push({ label: 'Installation disruption', value: 'Some enabling work acceptable' });
  else if (disruption === 'high') priorities.push({ label: 'Installation disruption', value: 'Open to significant enabling works for best outcome' });

  const dhw = ea?.dhwExperiencePriority ?? null;
  if (dhw === 'high') priorities.push({ label: 'Hot water reliability', value: 'High priority — reliable hot water is essential' });

  const future = ea?.futureReadinessPriority ?? null;
  if (future === 'high') priorities.push({ label: 'Future readiness', value: 'High priority — heat-pump pathway should be considered' });

  const comfort = ea?.comfortVsRunningCost ?? null;
  if (comfort === 'comfort') priorities.push({ label: 'Comfort vs running cost', value: 'Comfort first' });
  else if (comfort === 'cost') priorities.push({ label: 'Comfort vs running cost', value: 'Running cost minimisation' });
  else if (comfort === 'balanced') priorities.push({ label: 'Comfort vs running cost', value: 'Balanced approach' });

  // Do not push a synthetic fallback when no priorities were selected — callers
  // must check priorities.length === 0 and show a truthful neutral state instead
  // of customer-facing placeholder copy.

  return { priorities };
}

// ─── Page 1.5 — Ageing context ────────────────────────────────────────────────

/** Derive the efficiency drift band from age and condition signals. */
function deriveEfficiencyBand(
  age: number | undefined,
  boilerConditionBand: string | undefined,
): 'healthy' | 'ageing' | 'neglected' {
  // Condition evidence takes priority over age alone
  if (boilerConditionBand === 'poor' || boilerConditionBand === 'severe') return 'neglected';
  if (boilerConditionBand === 'moderate') return 'ageing';
  // Fall back to age-based heuristic
  if (age == null) return 'ageing'; // unknown age — assume mid-life context
  if (age >= 15) return 'neglected';
  if (age >= 8)  return 'ageing';
  return 'healthy';
}

/** Derive the component degradation block from architecture and condition signals. */
function deriveComponentDegradation(
  type: string,
  age: number | undefined,
  plateHexConditionBand: string | undefined,
  cylinderConditionBand: string | undefined,
): ComponentDegradationBlock {
  if (type === 'combi') {
    const rawBand = plateHexConditionBand ?? deriveConditionBandFromAge(age, 'combi');
    const conditionBand = rawBand as ComponentDegradationBlock['conditionBand'];
    return {
      architecture:        'combi',
      componentLabel:      'Plate heat exchanger (plate HEX)',
      degradationMechanism: 'Limescale and mineral deposits narrow the water channels in the plate HEX over time, reducing hot-water output and increasing energy needed per litre.',
      conditionBand,
      conditionLabel:      conditionBandToLabel(conditionBand),
    };
  }

  if (type === 'system' || type === 'regular') {
    const rawBand = cylinderConditionBand ?? deriveConditionBandFromAge(age, 'stored');
    const conditionBand = rawBand as ComponentDegradationBlock['conditionBand'];
    return {
      architecture:        'stored',
      componentLabel:      'Cylinder heating coil',
      degradationMechanism: 'Sludge and scale accumulate on the coil over time, reducing heat transfer efficiency and slowing cylinder recovery. Circulation can also be impaired by magnetite build-up in the primary circuit.',
      conditionBand,
      conditionLabel:      conditionBandToLabel(conditionBand),
    };
  }

  if (type === 'ashp') {
    return {
      architecture:        'heat_pump',
      componentLabel:      'Heat pump refrigerant circuit',
      degradationMechanism: 'Heat pump performance degrades gradually as refrigerant charge decreases or evaporator coil becomes restricted. Cylinder coil fouling follows the same pattern as stored systems.',
      conditionBand:       'unknown',
      conditionLabel:      'Not assessed',
    };
  }

  return {
    architecture:        'other',
    componentLabel:      'Heat source',
    degradationMechanism: 'Component wear accumulates with age — servicing history and observed performance are the primary indicators.',
    conditionBand:       'unknown',
    conditionLabel:      'Not assessed',
  };
}

/** Estimate a rough condition band from age alone when no survey evidence exists. */
function deriveConditionBandFromAge(
  age: number | undefined,
  _architecture: 'combi' | 'stored',
): 'good' | 'moderate' | 'poor' | 'unknown' {
  if (age == null) return 'unknown';
  if (age >= 15)  return 'poor';
  if (age >= 8)   return 'moderate';
  return 'good';
}

function conditionBandToLabel(band: ComponentDegradationBlock['conditionBand']): string {
  switch (band) {
    case 'good':    return 'Good — performing close to spec';
    case 'moderate': return 'Moderate — some performance reduction likely';
    case 'poor':    return 'Poor — noticeable degradation';
    case 'severe':  return 'Severe — significant degradation';
    default:        return 'Not assessed';
  }
}

/** Build circulation/cleanliness signal pills from available survey signals. */
function buildCirculationSignals(
  age: number | undefined,
  hardness: string,
  hasMagneticFilter: boolean | undefined,
  hasSoftener: boolean | undefined,
): CirculationSignal[] {
  const signals: CirculationSignal[] = [];

  // Magnetic filter
  if (hasMagneticFilter === true) {
    signals.push({ label: 'Magnetic filter fitted', status: 'ok' });
  } else if (hasMagneticFilter === false && (age ?? 0) >= 5) {
    signals.push({ label: 'No magnetic filter', status: 'warn' });
  } else {
    signals.push({ label: 'Magnetic filter: not recorded', status: 'unknown' });
  }

  // Water hardness
  if (hardness === 'very_hard') {
    signals.push({ label: 'Very hard water area', status: 'warn' });
  } else if (hardness === 'hard') {
    signals.push({ label: 'Hard water area', status: 'warn' });
  } else if (hardness === 'moderate') {
    signals.push({ label: 'Moderate water hardness', status: 'ok' });
  } else {
    signals.push({ label: 'Soft water area', status: 'ok' });
  }

  // Softener
  if ((hardness === 'hard' || hardness === 'very_hard')) {
    if (hasSoftener === true) {
      signals.push({ label: 'Water softener fitted', status: 'ok' });
    } else {
      signals.push({ label: 'No water softener', status: 'warn' });
    }
  }

  return signals;
}

/** Build "what this means in your home" bullets from architecture and condition. */
function buildHomeImpacts(
  type: string,
  efficiencyBand: 'healthy' | 'ageing' | 'neglected',
  hardness: string,
): string[] {
  const impacts: string[] = [];

  if (efficiencyBand === 'healthy') {
    impacts.push('Hot water and heating output close to original specification.');
    impacts.push('Running costs tracking near-new levels.');
    if (type === 'combi') {
      impacts.push('Plate HEX delivering near-rated flow at this age.');
    } else {
      impacts.push('Cylinder recovery time within expected range.');
    }
  } else if (efficiencyBand === 'ageing') {
    if (type === 'combi') {
      impacts.push('Hot water may take longer to reach temperature at taps.');
      impacts.push('Peak flow rate may be below original specification.');
    } else {
      impacts.push('Cylinder recovery after peak demand may be slower than when new.');
      impacts.push('Standing losses may have increased — cylinder holds heat less well.');
    }
    impacts.push('Efficiency drift tends to increase running costs over time.');
    impacts.push('More frequent cycling is a common symptom at this age.');
  } else {
    if (type === 'combi') {
      impacts.push('Reduced hot-water output — plate HEX restriction likely.');
    } else {
      impacts.push('Noticeably slower cylinder recovery after demand.');
      impacts.push('Increased standing losses from insulation and coil degradation.');
    }
    impacts.push('Higher running cost tendency — efficiency significantly below original spec.');
    impacts.push('Increased cycling and wear accelerates further degradation.');
    if (hardness === 'hard' || hardness === 'very_hard') {
      impacts.push('Hard water area — scale accumulation is likely contributing to performance loss.');
    }
  }

  return impacts;
}

/** Build conditional "likely first improvements" based on condition signals. */
function buildLikelyImprovements(
  type: string,
  age: number | undefined,
  efficiencyBand: 'healthy' | 'ageing' | 'neglected',
  hardness: string,
  hasMagneticFilter: boolean | undefined,
  hasSoftener: boolean | undefined,
): string[] {
  const improvements: string[] = [];

  // Annual service is always relevant
  improvements.push('Annual service — confirms current performance against spec.');

  // Magnetic filter where absent and age warrants it
  if (!hasMagneticFilter && (age ?? 0) >= 5) {
    improvements.push('Fit a magnetic filter — captures sludge before it circulates.');
  }

  // Architecture-specific descaling
  if (efficiencyBand !== 'healthy') {
    if (type === 'combi' && (age ?? 0) >= 8) {
      improvements.push('Plate HEX inspection / descale — recovers lost flow performance.');
    }
    if ((type === 'system' || type === 'regular') && (age ?? 0) >= 8) {
      improvements.push('Cylinder coil check — identifies fouling before it worsens.');
    }
  }

  // Chemical inhibitor top-up
  if (efficiencyBand !== 'healthy') {
    improvements.push('Check and top up corrosion inhibitor — protects the primary circuit.');
  }

  // Chemical clean when moderate+ degradation in hard water
  if (efficiencyBand !== 'healthy' && (hardness === 'hard' || hardness === 'very_hard') && !hasSoftener) {
    improvements.push('Chemical clean — removes scale and sludge build-up in hard water areas.');
  }

  // Powerflush only when genuinely justified
  if (efficiencyBand === 'neglected' && (age ?? 0) >= 12) {
    improvements.push('System powerflush — consider when radiator cold spots or sludge are confirmed.');
  }

  return improvements;
}

function buildAgeingContext(input: EngineInputV2_3, result: FullEngineResult): Page1_5AgeingContext {
  const type = input.currentHeatSourceType ?? 'other';
  const age = input.currentBoilerAgeYears ?? input.currentSystem?.boiler?.ageYears;
  const hardness = result.normalizer.waterHardnessCategory;
  const systemCondition = input.boilerConditionBand ?? input.cylinderConditionBand ?? input.plateHexConditionBand;
  const noMagFilter = input.hasMagneticFilter === false;
  const sludgeDetected = ((result.sludgeVsScale?.flowDeratePct ?? 0) > 0.03) || ((result.sludgeVsScale?.primarySludgeCostGbp ?? 0) > 10);
  const poorPerformance = systemCondition === 'poor' || systemCondition === 'severe' || sludgeDetected;

  // Real evidence requires at least one of: explicit age, condition band, or sludge signal.
  // Without any of these the efficiency/condition copy would be purely synthetic.
  const hasRealEvidence = age != null || systemCondition != null || sludgeDetected;

  const ageEstimate = age
    ?? (systemCondition === 'poor' || systemCondition === 'severe' ? 15 : systemCondition === 'moderate' ? 10 : 6);

  let heading = 'Systems like yours typically show these condition patterns over time';
  let ageBandLabel = age != null
    ? `${age} ${age === 1 ? 'year' : 'years'} old`
    : `Estimated service-life band: around ${ageEstimate} years`;
  const notes: string[] = [];

  if (ageEstimate != null) {
    if (age == null) {
      notes.push(`Age not recorded — using a condition-led service-life estimate (~${ageEstimate} years).`);
    }

    if (type === 'combi' || type === 'system') {
      if (ageEstimate < 5) {
        notes.push('Boilers of this age typically retain their original performance characteristics.');
        notes.push('Component wear is not yet a major factor for most makes.');
      } else if (ageEstimate < 10) {
        notes.push('At this age, most boilers are in the second half of their expected service life.');
        notes.push('Routine servicing should confirm whether efficiency is tracking original spec.');
      } else if (ageEstimate < 15) {
        notes.push('Boilers of this age may show measurable efficiency reduction compared to when new.');
        notes.push('Heat exchanger scaling, plate HEX fouling, or expansion vessel fatigue are common at this age.');
        notes.push('This is a common decision point — whether to repair or replace.');
      } else {
        notes.push('Boilers beyond 15 years are statistically approaching or past their design life.');
        notes.push('Reliability risk increases significantly — component replacement costs may approach replacement value.');
        notes.push('Not a diagnosis of current condition — age alone is context, not a verdict.');
      }
    } else if (type === 'regular') {
      if (ageEstimate < 15) {
        notes.push('Regular (open-vented) boilers often have longer service lives than modern condensing boilers.');
        notes.push('The heat exchanger is typically simpler and more tolerant of hard water and sludge.');
      } else {
        notes.push('Long-serving regular boiler — component wear is a realistic consideration at this age.');
        notes.push('Cast-iron heat exchangers in older regular boilers are often still serviceable beyond 20 years.');
      }
    }

    // Water quality context from normalizer
    if (hardness === 'hard' || hardness === 'very_hard') {
      notes.push('Hard water area — limescale accumulation is a factor for any heat exchanger over time.');
    }
  }

  notes.push('These observations are probabilistic context — not a diagnosis of the specific boiler.');

  let waterQualityNote: string | undefined;
  if (hardness === 'hard' || hardness === 'very_hard') {
    waterQualityNote = 'Hard water area — limescale accumulation is a factor for any heat exchanger over time.';
  } else if (hardness === 'soft') {
    waterQualityNote = 'Soft water area — scale risk is low but corrosion inhibitor maintenance still matters.';
  }

  // ── New PR10 fields ────────────────────────────────────────────────────────

  const efficiencyBand = deriveEfficiencyBand(ageEstimate, systemCondition);
  const conditionLine = poorPerformance
    ? 'Condition and maintenance signals indicate avoidable degradation is already present.'
    : noMagFilter
      ? 'No magnetic filter is recorded, so cleanliness risks are elevated even if comfort is currently acceptable.'
      : 'Condition signals are broadly stable with maintenance opportunities to hold performance.';

  const conditionSummaryMap: Record<typeof efficiencyBand, string> = {
    healthy:   `Condition signals place this system in the healthy band. ${conditionLine}`,
    ageing:    `Condition signals place this system in the ageing band. ${conditionLine}`,
    neglected: `Condition signals place this system in the neglected band. ${conditionLine}`,
  };

  const efficiencyBandDescriptionMap: Record<typeof efficiencyBand, string> = {
    healthy:   'Efficiency is likely tracking near original spec. Component wear is a minor factor at this stage.',
    ageing:    'Efficiency typically drops 5–15% over this period due to scale, sludge, and cycling wear. Servicing can slow the drift.',
    neglected: 'Efficiency is likely significantly below original spec. Scale, sludge, and component fatigue compound each other at this stage.',
  };

  const componentDegradation = deriveComponentDegradation(
    type, ageEstimate, input.plateHexConditionBand, input.cylinderConditionBand,
  );

  const circulationSignals = buildCirculationSignals(
    ageEstimate, hardness, input.hasMagneticFilter, input.hasSoftener,
  );

  const homeImpacts = buildHomeImpacts(type, efficiencyBand, hardness);
  if (noMagFilter) homeImpacts.unshift('Without a magnetic filter, primary sludge can reduce radiator output and increase cycling losses.');
  if (sludgeDetected) homeImpacts.unshift('Observed sludge/scale signals suggest slower warm-up and poorer circulation at peak demand.');

  const likelyFirstImprovements = buildLikelyImprovements(
    type, ageEstimate, efficiencyBand, hardness, input.hasMagneticFilter, input.hasSoftener,
  );

  return {
    heading,
    ageBandLabel,
    hasRealEvidence,
    conditionSummary:          conditionSummaryMap[efficiencyBand],
    currentEfficiencyBand:     efficiencyBand,
    efficiencyBandDescription: efficiencyBandDescriptionMap[efficiencyBand],
    componentDegradation,
    circulationSignals,
    homeImpacts,
    likelyFirstImprovements,
    probabilisticNotes:        notes,
    waterQualityNote,
  };
}

// ─── Page 2 — Available options ───────────────────────────────────────────────

function buildOptionExplanation(
  option: OptionCardV1,
  result: FullEngineResult,
  input: EngineInputV2_3,
  dhwStorageType: DhwStorageType,
): AvailableOptionExplanation {
  const demo = result.demographicOutputs;
  const pv = result.pvAssessment;
  const occupancy = input.occupancyCount ?? 2;
  const bathrooms = input.bathroomCount;

  // Determine the DHW architecture this option would use — the primary discriminator.
  const dhwArchitecture = optionIdToArchitecture(option.id, dhwStorageType);

  // Through-house notes: fabric, heat loss, pipework, infrastructure
  const throughHouseNotes: string[] = [];

  if (option.id === 'combi') {
    const heatLossKw = input.heatLossWatts / 1000;
    if (heatLossKw > 14) {
      throughHouseNotes.push(`Heat loss of ${heatLossKw.toFixed(1)} kW is above a typical combi's safe range — oversizing risk.`);
    } else {
      throughHouseNotes.push(`Heat loss of ${heatLossKw.toFixed(1)} kW is within range for a combi.`);
    }
    throughHouseNotes.push('No cylinder space required — frees up airing cupboard.');
  } else if (option.id === 'stored_vented') {
    throughHouseNotes.push('Requires a cold-water storage tank (loft) and hot-water cylinder.');
    if (input.cwsHeadMetres != null && input.cwsHeadMetres < 0.5) {
      throughHouseNotes.push(`CWS head of ${input.cwsHeadMetres.toFixed(1)} m is low — gravity pressure will be marginal.`);
    }
  } else if (option.id === 'stored_unvented' || option.id === 'system_unvented') {
    throughHouseNotes.push('Requires cylinder space (airing cupboard or plant room).');
    throughHouseNotes.push('Mains-pressure hot water — no loft tank needed.');
  } else if (option.id === 'ashp') {
    throughHouseNotes.push('Requires outdoor unit space (typically 1 m² footprint).');
    throughHouseNotes.push('Works best with low-temperature emitters (underfloor heating or large radiators).');
    const heatLossKw = input.heatLossWatts / 1000;
    throughHouseNotes.push(`Heat loss of ${heatLossKw.toFixed(1)} kW determines ASHP sizing — emitter adequacy must be confirmed.`);
  } else if (option.id === 'regular_vented') {
    throughHouseNotes.push('Requires loft tank and hot-water cylinder — needs adequate roof space.');
  }

  // Through-home notes: branch on DHW architecture first.
  const throughHomeNotes: string[] = [];

  if (dhwArchitecture === 'on_demand') {
    if (demo.peakSimultaneousOutlets >= 2) {
      throughHomeNotes.push(`In your home, ${demo.peakSimultaneousOutlets} simultaneous outlets are expected — a combi may not sustain both at full pressure.`);
    } else {
      throughHomeNotes.push(`In your home, single-outlet draw profile suits a combi's on-demand delivery.`);
    }
    if (occupancy >= 4) {
      throughHomeNotes.push(`${occupancy} people with ${bathrooms} ${bathrooms === 1 ? 'bathroom' : 'bathrooms'} — high demand concentration at peak times.`);
    }
    if (demo.storageBenefitSignal === 'high') {
      throughHomeNotes.push('Your household profile indicates high benefit from stored water — a combi is likely to struggle here.');
    }
  } else {
    // standard_cylinder, mixergy, or standard ASHP cylinder
    const litres = Math.round(demo.dailyHotWaterLitres);
    throughHomeNotes.push(`Estimated demand of ~${litres} L/day helps size the cylinder correctly for this household.`);
    if (demo.bathUseIntensity === 'high') {
      throughHomeNotes.push('Frequent bath use increases cylinder volume requirement — a larger cylinder is advisable.');
    }
    if (demo.occupancyTimingProfile === 'daytime_home') {
      throughHomeNotes.push('Daytime presence allows midday cylinder top-up — recovery profile works well for this household.');
    } else if (demo.occupancyTimingProfile === 'away_daytime') {
      throughHomeNotes.push('Professional absence pattern — cylinder charges overnight and at evening peak; recovery must keep up.');
    }
  }

  // Through-energy notes: branch on DHW architecture first.
  const throughEnergyNotes: string[] = [];

  if (pv.hasExistingPv) {
    if (dhwArchitecture === 'standard_cylinder' || dhwArchitecture === 'mixergy') {
      throughEnergyNotes.push('Existing PV — a solar diverter can use surplus generation to heat water, reducing import.');
    } else if (option.id === 'ashp') {
      throughEnergyNotes.push('Existing PV — ASHP can run preferentially during generation peak, improving economics.');
    } else if (dhwArchitecture === 'on_demand') {
      throughEnergyNotes.push('Existing PV — a combi cannot store surplus heat; most generation benefit is lost unless a battery is added.');
    }
  } else if (input.pvStatus === 'planned') {
    if (dhwArchitecture === 'standard_cylinder' || dhwArchitecture === 'mixergy') {
      throughEnergyNotes.push('Planned PV — a solar diverter fitted at the same time as new PV is cost-effective and captures surplus generation.');
    } else if (dhwArchitecture === 'on_demand') {
      throughEnergyNotes.push('Planned PV — a combi offers no solar storage; planned generation would mostly be exported.');
    }
  } else if (pv.pvSuitability === 'good') {
    throughEnergyNotes.push('Good roof for PV — if solar is added in future, a cylinder would allow storage of surplus generation.');
  }

  if (pv.solarStorageOpportunity === 'high' && (dhwArchitecture === 'standard_cylinder' || dhwArchitecture === 'mixergy')) {
    throughEnergyNotes.push('Solar storage opportunity is high for this option — PV surplus capture is efficient with a cylinder.');
  }

  // Works well when / limited when: use the heat plane bullets as supporting context
  const worksWellWhen = option.heat.status === 'ok'
    ? option.heat.bullets.slice(0, 3)
    : [];
  const limitedWhen = option.heat.status !== 'ok'
    ? option.heat.bullets.slice(0, 3)
    : option.dhw.status !== 'ok' ? option.dhw.bullets.slice(0, 2) : [];

  const whatItIs = OPTION_WHAT_IT_IS[option.id] ?? option.headline;

  return {
    id: option.id,
    label: option.label,
    status: option.status,
    headline: option.headline,
    whatItIs,
    dhwArchitecture,
    throughHouseNotes,
    throughHomeNotes,
    throughEnergyNotes,
    worksWellWhen: worksWellWhen.slice(0, 3),
    limitedWhen:   limitedWhen.slice(0, 3),
  };
}

function buildPage2(
  result: FullEngineResult,
  input: EngineInputV2_3,
): Page2AvailableOptions {
  const options = result.engineOutput.options ?? [];
  const dhwStorageType = inputDhwStorageTypeToSignal(input.dhwStorageType);
  return {
    options: options.map(opt => buildOptionExplanation(opt, result, input, dhwStorageType)),
  };
}

// ─── Page 3 — Physics-first ranking ───────────────────────────────────────────

function buildRankingReasonLine(
  family: string,
  result: FullEngineResult,
  input: EngineInputV2_3,
): string {
  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;

  if (family === 'combi') {
    if (demo.peakSimultaneousOutlets >= 2) {
      return `In your home, ${demo.peakSimultaneousOutlets} simultaneous outlets and ${input.bathroomCount} bathrooms limit combi suitability.`;
    }
    if (demo.storageBenefitSignal === 'high') {
      return `Your household profile (${input.occupancyCount ?? 2} people, high demand) benefits more from stored water than a combi provides.`;
    }
    return `Single-bathroom, low-concurrency household — combi delivers on-demand hot water without surplus cylinder.`;
  }

  if (family === 'system' || family === 'stored') {
    const litres = Math.round(demo.dailyHotWaterLitres);
    if (pv.hasExistingPv && pv.solarStorageOpportunity === 'high') {
      return `Stored water for ${input.occupancyCount ?? 2} people (~${litres} L/day) with existing PV — solar surplus captured in cylinder.`;
    }
    return `Stored water for ${input.occupancyCount ?? 2} people (~${litres} L/day) — recovery profile matches ${demo.occupancyTimingProfile.replace(/_/g, ' ')} pattern.`;
  }

  if (family === 'heat_pump') {
    const heatLossKw = (input.heatLossWatts / 1000).toFixed(1);
    if (pv.hasExistingPv) {
      return `ASHP with existing PV: ${heatLossKw} kW heat loss; low-temperature emitters and solar-preferential scheduling align well.`;
    }
    return `ASHP: ${heatLossKw} kW heat loss; emitter adequacy and low return temperatures are the key site-specific checks.`;
  }

  if (family === 'open_vented' || family === 'regular') {
    return `Regular/open-vented system: cylinder and loft tank present; gravity pressure is the key constraint.`;
  }

  return `Candidate assessed against house (${(input.heatLossWatts / 1000).toFixed(1)} kW), home (${input.occupancyCount ?? 2} people), and energy signals.`;
}

function buildPage3(
  result: FullEngineResult,
  input: EngineInputV2_3,
  recommendation: RecommendationResult | undefined,
): Page3PhysicsRanking {
  if (!recommendation) {
    return { items: [] };
  }

  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;

  // Collect all candidates with scores — sort by overallScore descending
  const allDecisions = [
    recommendation.bestOverall,
    ...Object.values(recommendation.bestByObjective),
  ].filter((d): d is NonNullable<typeof d> => d != null);

  // Deduplicate by family; keep highest score per family
  const familyMap = new Map<ApplianceFamily, { family: ApplianceFamily; score: number }>();
  for (const d of allDecisions) {
    const existing = familyMap.get(d.family);
    if (!existing || d.overallScore > existing.score) {
      familyMap.set(d.family, { family: d.family, score: d.overallScore });
    }
  }

  // Also add disqualified candidates at the bottom
  const disqualifiedFamilies = new Set(recommendation.disqualifiedCandidates.map(d => d.family));
  for (const d of recommendation.disqualifiedCandidates) {
    if (!familyMap.has(d.family)) {
      familyMap.set(d.family, { family: d.family, score: 0 });
    }
  }

  const sorted = [...familyMap.values()].sort((a, b) => b.score - a.score);

  const items: PhysicsRankingItem[] = sorted.map((entry, index) => {
    const isDisqualified = disqualifiedFamilies.has(entry.family);
    const label = FAMILY_LABELS[entry.family] ?? entry.family;

    // Demand fit note
    let demandFitNote: string | undefined;
    if (entry.family === 'combi') {
      demandFitNote = demo.peakSimultaneousOutlets >= 2
        ? `Simultaneous draw risk (${demo.peakSimultaneousOutlets} outlets)`
        : `Single-draw profile — combi fit`;
    } else {
      demandFitNote = `~${Math.round(demo.dailyHotWaterLitres)} L/day demand — cylinder sizing key`;
    }

    // Water fit note
    let waterFitNote: string | undefined;
    if (entry.family === 'combi') {
      const dynamicBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
      if (dynamicBar != null) {
        waterFitNote = dynamicBar >= 1.5
          ? `Mains ${dynamicBar} bar — adequate for combi`
          : `Mains ${dynamicBar} bar — low; combi flow rate constrained`;
      }
    } else if (entry.family === 'system') {
      waterFitNote = `Stored water buffers mains demand — less pressure-sensitive`;
    }

    // Infrastructure fit note
    let infrastructureFitNote: string | undefined;
    if (entry.family === 'heat_pump') {
      infrastructureFitNote = `${(input.heatLossWatts / 1000).toFixed(1)} kW — emitter adequacy check required`;
    } else if (entry.family === 'combi') {
      infrastructureFitNote = input.hasLoftConversion ? 'Loft conversion: check pipework routing' : undefined;
    }

    // Energy fit note
    let energyFitNote: string | undefined;
    if (pv.hasExistingPv && entry.family !== 'combi') {
      energyFitNote = `Existing PV: solar storage opportunity ${pv.solarStorageOpportunity}`;
    } else if (pv.pvSuitability === 'good' && !pv.hasExistingPv && entry.family !== 'combi') {
      energyFitNote = `Good roof for PV — future solar diverter would work well`;
    } else if (entry.family === 'combi' && pv.hasExistingPv) {
      energyFitNote = `Existing PV: combi cannot store solar surplus`;
    }

    return {
      rank: index + 1,
      family: entry.family,
      label,
      overallScore: entry.score,
      reasonLine: isDisqualified
        ? `Not recommended — hard constraint prevents use in this home`
        : buildRankingReasonLine(entry.family, result, input),
      demandFitNote,
      waterFitNote,
      infrastructureFitNote,
      energyFitNote,
    };
  });

  return { items };
}

// ─── Pages 4+ — Shortlisted option detail ─────────────────────────────────────

function buildPage4Plus(
  result: FullEngineResult,
  recommendation: RecommendationResult | undefined,
  input: EngineInputV2_3,
): Page4PlusShortlistedDetail {
  if (!recommendation) {
    return { options: [] };
  }

  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;
  const dhwStorageType = inputDhwStorageTypeToSignal(input.dhwStorageType);

  // Shortlist: best overall + viable options from OptionCardV1
  const options = result.engineOutput.options ?? [];
  const viableOptions = options.filter(opt => opt.status !== 'rejected');

  const shortlisted: ShortlistedOptionDetail[] = viableOptions.map(opt => {
    const req = opt.typedRequirements;
    return {
      family: opt.id,
      label: opt.label,
      // Compliance items are never upgrades — they are regulatory requirements.
      complianceItems:           req?.complianceRequired ?? [],
      requiredWork:              req?.mustHave ?? [],
      bestPerformanceUpgrades:   [...(req?.likelyUpgrades ?? []), ...(req?.niceToHave ?? [])],
      // Signal fields for visual selection — never inferred from family alone.
      solarStorageOpportunity:   pv.solarStorageOpportunity,
      peakSimultaneousOutlets:   demo.peakSimultaneousOutlets,
      dhwStorageType,
      // Architecture is the primary discriminator for visuals and wording.
      dhwArchitecture:           optionIdToArchitecture(opt.id, dhwStorageType),
      storageBenefitSignal:      demo.storageBenefitSignal,
    };
  });

  return { options: shortlisted };
}

// ─── Final page — Simulator / proof ───────────────────────────────────────────

/**
 * Map a DHW architecture to the short human-readable label used in
 * homeScenarioDescription on the final/simulator page.
 */
function dhwArchitectureToLabel(architecture: DhwArchitecture): string {
  switch (architecture) {
    case 'on_demand':         return 'on-demand hot water (combi)';
    case 'standard_cylinder': return 'stored hot water via cylinder';
    case 'mixergy':           return 'stored hot water via Mixergy cylinder';
    case 'thermal_store':     return 'thermal store system';
  }
}

/**
 * Map a DHW architecture to the architecture-specific note shown on the
 * final/simulator page — tells the user what task to actually try in the
 * System Simulator for their specific architecture.
 *
 * Notes are task-based ("try...") so the System Simulator handoff is
 * actionable, not just descriptive.
 */
function dhwArchitectureToSimulatorNote(architecture: DhwArchitecture): string {
  switch (architecture) {
    case 'on_demand':
      return 'On-demand hot water (combi) — in the System Simulator, try overlapping tap use and short hot-water draws to test flow rate and simultaneous-demand behaviour.';
    case 'standard_cylinder':
      return 'Stored hot water via cylinder — in the System Simulator, try a bath or back-to-back hot-water draws to test cylinder sizing and recovery time.';
    case 'mixergy':
      return 'Mixergy stratified cylinder — in the System Simulator, try how stored hot water is built from the top down to test demand-mirroring behaviour and reduced cycling.';
    case 'thermal_store':
      return 'Thermal store system — in the System Simulator, try how hot water depends on stored heat and high primary temperature to verify the 75–85 °C primary requirement and DHW draw via exchanger.';
  }
}

function buildFinalPage(
  result: FullEngineResult,
  input: EngineInputV2_3,
  dhwArchitecture: DhwArchitecture,
): FinalPageSimulator {
  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;

  const homeScenarioDescription =
    `${input.occupancyCount ?? 2}-person household, ` +
    `${input.bathroomCount} ${input.bathroomCount === 1 ? 'bathroom' : 'bathrooms'}, ` +
    `${demo.demandProfileLabel.toLowerCase()} — ` +
    `${Math.round(demo.dailyHotWaterLitres)} L/day estimated hot-water demand, ` +
    `${dhwArchitectureToLabel(dhwArchitecture)}.`;

  const houseConstraintNotes: string[] = [
    `Design heat loss: ${(input.heatLossWatts / 1000).toFixed(1)} kW — determines system sizing.`,
  ];
  if (input.primaryPipeDiameter) {
    houseConstraintNotes.push(`Primary pipework: ${input.primaryPipeDiameter} mm — affects flow temperature and cycling risk.`);
  }
  if (input.hasLoftConversion) {
    houseConstraintNotes.push('Loft conversion present — space and routing constraints apply.');
  }

  const energyTimingNotes: string[] = [];
  if (pv.hasExistingPv) {
    energyTimingNotes.push(`Existing PV with ${pv.energyDemandAlignment.replace(/_/g, ' ')} energy-demand alignment — test the diverter scenario in the simulator.`);
  } else if (pv.pvSuitability === 'good') {
    energyTimingNotes.push('Good roof — test the "add PV + diverter" scenario to see the storage opportunity.');
  }
  if (pv.batteryPlanned) {
    energyTimingNotes.push('Battery present/planned — test the battery charge-shift scenario.');
  }
  energyTimingNotes.push('Use the System Simulator to vary occupancy, bath frequency, and draw timing to validate the recommendation.');

  const simulatorCapabilities: readonly string[] = [
    'Full system diagram',
    'Live tap controls — turn outlets on and off',
    'Hot-water draw behaviour and recovery',
    'Heating response and system cycling',
  ];

  return {
    homeScenarioDescription,
    houseConstraintNotes,
    energyTimingNotes,
    dhwArchitectureNote: dhwArchitectureToSimulatorNote(dhwArchitecture),
    simulatorCapabilities,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Build the full canonical presentation model from engine outputs.
 *
 * Every field in the returned model is derived from a canonical signal —
 * no generic copy is inserted here.
 *
 * @param prioritiesState — Optional survey Priorities step state.  When provided,
 *   the selected PriorityKey chips are used as the canonical source for the
 *   objectives signal, superseding any legacy expertAssumptions / preferences
 *   fields on the engine input.
 */
export function buildCanonicalPresentation(
  result: FullEngineResult,
  input: EngineInputV2_3,
  recommendation?: RecommendationResult,
  prioritiesState?: PrioritiesState,
): CanonicalPresentationModel {
  const currentSystem = buildCurrentSystemSignal(input);
  return {
    page1: {
      house:         buildHouseSignal(result, input),
      home:          buildHomeSignal(result, input),
      energy:        buildEnergySignal(result, input),
      currentSystem,
      objectives:    buildObjectivesSignal(input, prioritiesState),
    },
    page1_5: buildAgeingContext(input, result),
    page2:   buildPage2(result, input),
    page3:   buildPage3(result, input, recommendation),
    page4Plus: buildPage4Plus(result, recommendation, input),
    finalPage: buildFinalPage(result, input, currentSystem.dhwArchitecture),
  };
}
