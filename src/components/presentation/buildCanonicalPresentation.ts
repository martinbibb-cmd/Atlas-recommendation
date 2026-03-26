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
  systemTypeLabel: string;
  ageLabel: string;
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

/** Page 1.5 — Contextual ageing / degradation framing (probabilistic). */
export interface Page1_5AgeingContext {
  heading: string;
  ageBandLabel: string;
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
   * DHW storage subtype — used to select the correct cylinder visual.
   * Never inferred from appliance family; must come from explicit input signal.
   * cylinder_charge_mixergy when 'mixergy', cylinder_charge_standard for standard
   * stored types, null/none for combi or unknown.
   */
  dhwStorageType: DhwStorageType;
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
  const type = input.currentHeatSourceType ?? 'other';
  const systemTypeLabel = SYSTEM_TYPE_LABELS[type] ?? type;

  const age = input.currentBoilerAgeYears ?? input.currentSystem?.boiler?.ageYears;
  const ageLabel = age != null ? `${age} ${age === 1 ? 'year' : 'years'} old` : 'Age not recorded';

  const outputKw = input.currentBoilerOutputKw;
  const outputLabel = outputKw != null ? `${outputKw} kW rated output` : undefined;

  // Age context: typical lifespans
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

  return {
    systemTypeLabel,
    ageLabel,
    makeModelText: input.makeModelText,
    outputLabel,
    ageContext,
    drivingStyleMode: systemTypeToDrivingMode(type),
    dhwStorageType: inputDhwStorageTypeToSignal(input.dhwStorageType),
  };
}

function buildObjectivesSignal(input: EngineInputV2_3): ObjectivesSignal {
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

  if (priorities.length === 0) {
    priorities.push({ label: 'Objectives', value: 'No specific priorities recorded — physics-first recommendation applied' });
  }

  return { priorities };
}

// ─── Page 1.5 — Ageing context ────────────────────────────────────────────────

function buildAgeingContext(input: EngineInputV2_3, result: FullEngineResult): Page1_5AgeingContext {
  const type = input.currentHeatSourceType ?? 'other';
  const age = input.currentBoilerAgeYears ?? input.currentSystem?.boiler?.ageYears;

  let heading = 'About your current system';
  let ageBandLabel = 'Age not recorded — typical service-life context applies';
  const notes: string[] = [];

  if (age != null) {
    ageBandLabel = `${age} ${age === 1 ? 'year' : 'years'} old`;

    if (type === 'combi' || type === 'system') {
      if (age < 5) {
        notes.push('Boilers of this age typically retain their original performance characteristics.');
        notes.push('Component wear is not yet a major factor for most makes.');
      } else if (age < 10) {
        notes.push('At this age, most boilers are in the second half of their expected service life.');
        notes.push('Routine servicing should confirm whether efficiency is tracking original spec.');
      } else if (age < 15) {
        notes.push('Boilers of this age may show measurable efficiency reduction compared to when new.');
        notes.push('Heat exchanger scaling, plate HEX fouling, or expansion vessel fatigue are common at this age.');
        notes.push('This is a common decision point — whether to repair or replace.');
      } else {
        notes.push('Boilers beyond 15 years are statistically approaching or past their design life.');
        notes.push('Reliability risk increases significantly — component replacement costs may approach replacement value.');
        notes.push('Not a diagnosis of current condition — age alone is context, not a verdict.');
      }
    } else if (type === 'regular') {
      if (age < 15) {
        notes.push('Regular (open-vented) boilers often have longer service lives than modern condensing boilers.');
        notes.push('The heat exchanger is typically simpler and more tolerant of hard water and sludge.');
      } else {
        notes.push('Long-serving regular boiler — component wear is a realistic consideration at this age.');
        notes.push('Cast-iron heat exchangers in older regular boilers are often still serviceable beyond 20 years.');
      }
    }

    // Water quality context from normalizer
    const hardness = result.normalizer.waterHardnessCategory;
    if (hardness === 'hard' || hardness === 'very_hard') {
      notes.push('Hard water area — limescale accumulation is a factor for any heat exchanger over time.');
    }
  } else {
    notes.push('Without a confirmed age, we can only provide general service-life context.');
    notes.push('Asking for the installation year or make/model allows us to be more specific.');
  }

  notes.push('These observations are probabilistic context — not a diagnosis of the specific boiler.');

  let waterQualityNote: string | undefined;
  const hardness = result.normalizer.waterHardnessCategory;
  if (hardness === 'hard' || hardness === 'very_hard') {
    waterQualityNote = 'Hard water area — limescale accumulation is a factor for any heat exchanger over time.';
  } else if (hardness === 'soft') {
    waterQualityNote = 'Soft water area — scale risk is low but corrosion inhibitor maintenance still matters.';
  }

  return { heading, ageBandLabel, probabilisticNotes: notes, waterQualityNote };
}

// ─── Page 2 — Available options ───────────────────────────────────────────────

function buildOptionExplanation(
  option: OptionCardV1,
  result: FullEngineResult,
  input: EngineInputV2_3,
): AvailableOptionExplanation {
  const demo = result.demographicOutputs;
  const pv = result.pvAssessment;
  const occupancy = input.occupancyCount ?? 2;
  const bathrooms = input.bathroomCount;

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

  // Through-home notes: demand profile, occupancy, bath use, storage benefit
  const throughHomeNotes: string[] = [];

  if (option.id === 'combi') {
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
    // Stored / ASHP
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

  // Through-energy notes: PV status, alignment, storage opportunity
  const throughEnergyNotes: string[] = [];

  if (pv.hasExistingPv) {
    if (option.id === 'stored_unvented' || option.id === 'system_unvented') {
      throughEnergyNotes.push('Existing PV — a solar diverter can use surplus generation to heat water, reducing import.');
    } else if (option.id === 'ashp') {
      throughEnergyNotes.push('Existing PV — ASHP can run preferentially during generation peak, improving economics.');
    } else if (option.id === 'combi') {
      throughEnergyNotes.push('Existing PV — a combi cannot store surplus heat; most generation benefit is lost unless a battery is added.');
    }
  } else if (input.pvStatus === 'planned') {
    if (option.id === 'stored_unvented' || option.id === 'system_unvented') {
      throughEnergyNotes.push('Planned PV — a solar diverter fitted at the same time as new PV is cost-effective and captures surplus generation.');
    } else if (option.id === 'combi') {
      throughEnergyNotes.push('Planned PV — a combi offers no solar storage; planned generation would mostly be exported.');
    }
  } else if (pv.pvSuitability === 'good') {
    throughEnergyNotes.push('Good roof for PV — if solar is added in future, a cylinder would allow storage of surplus generation.');
  }

  if (pv.solarStorageOpportunity === 'high' && (option.id === 'stored_unvented' || option.id === 'system_unvented')) {
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
  return {
    options: options.map(opt => buildOptionExplanation(opt, result, input)),
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
      storageBenefitSignal:      demo.storageBenefitSignal,
    };
  });

  return { options: shortlisted };
}

// ─── Final page — Simulator / proof ───────────────────────────────────────────

function buildFinalPage(
  result: FullEngineResult,
  input: EngineInputV2_3,
): FinalPageSimulator {
  const demo = result.demographicOutputs;
  const pv   = result.pvAssessment;

  const homeScenarioDescription =
    `${input.occupancyCount ?? 2}-person household, ` +
    `${input.bathroomCount} ${input.bathroomCount === 1 ? 'bathroom' : 'bathrooms'}, ` +
    `${demo.demandProfileLabel.toLowerCase()} — ` +
    `${Math.round(demo.dailyHotWaterLitres)} L/day estimated hot-water demand.`;

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
  energyTimingNotes.push('Use the simulator to vary occupancy, bath frequency, and draw timing to validate the recommendation.');

  return {
    homeScenarioDescription,
    houseConstraintNotes,
    energyTimingNotes,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Build the full canonical presentation model from engine outputs.
 *
 * Every field in the returned model is derived from a canonical signal —
 * no generic copy is inserted here.
 */
export function buildCanonicalPresentation(
  result: FullEngineResult,
  input: EngineInputV2_3,
  recommendation?: RecommendationResult,
): CanonicalPresentationModel {
  return {
    page1: {
      house:         buildHouseSignal(result, input),
      home:          buildHomeSignal(result, input),
      energy:        buildEnergySignal(result, input),
      currentSystem: buildCurrentSystemSignal(input),
      objectives:    buildObjectivesSignal(input),
    },
    page1_5: buildAgeingContext(input, result),
    page2:   buildPage2(result, input),
    page3:   buildPage3(result, input, recommendation),
    page4Plus: buildPage4Plus(result, recommendation, input),
    finalPage: buildFinalPage(result, input),
  };
}
