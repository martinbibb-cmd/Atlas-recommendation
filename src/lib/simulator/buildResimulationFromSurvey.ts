// src/lib/simulator/buildResimulationFromSurvey.ts
//
// Adapter that builds a full ResimulationResult from a completed survey and
// engine output.
//
// Pipeline:
//   FullSurveyModelV1  → TypicalDaySchedule (PR 2)
//   FullSurveyModelV1  → OutcomeSystemSpec  (simple-install baseline)
//   OutcomeSystemSpec  → ClassifiedDaySchedule (PR 3)
//   ClassifiedDaySchedule → RecommendedUpgradePackage (PR 4)
//   resimulateWithUpgrades(schedule, spec, upgrades) → ResimulationResult (PR 5)
//
// Design rules:
//   - No physics invented here — all logic delegated to the canonical engines.
//   - Graceful fallbacks for every absent survey field.
//   - Identical inputs → identical outputs (no randomness).

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { OutcomeSystemSpec } from '../../logic/outcomes/types';
import type { ResimulationResult } from '../../logic/resimulation/types';
import type { RecommendedUpgradePackage } from '../../logic/upgrades/types';
import type { GenerateTypicalDayScheduleInputs } from '../../logic/events/types';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../../lib/occupancy/deriveProfileFromHouseholdComposition';
import { deriveProfileFromHouseholdComposition } from '../../lib/occupancy/deriveProfileFromHouseholdComposition';
import { generateTypicalDaySchedule } from '../../logic/events/generateTypicalDaySchedule';
import { classifyEventOutcomes } from '../../logic/outcomes/classifyEventOutcomes';
import { recommendUpgrades } from '../../logic/upgrades/recommendUpgrades';
import { resimulateWithUpgrades } from '../../logic/resimulation/resimulateWithUpgrades';
import { buildHeatSourceBehaviour } from '../../engine/modules/HeatSourceBehaviourModel';

// ─── System type mapping ──────────────────────────────────────────────────────

function optionIdToSystemType(
  id: string | undefined,
): OutcomeSystemSpec['systemType'] {
  switch (id) {
    case 'combi':           return 'combi';
    case 'ashp':            return 'heat_pump';
    case 'stored_vented':
    case 'stored_unvented':
    case 'regular_vented':
    case 'system_unvented': return 'stored_water';
    default:                return 'combi';
  }
}

// ─── System label ─────────────────────────────────────────────────────────────

const SYSTEM_TYPE_LABELS: Record<OutcomeSystemSpec['systemType'], string> = {
  combi:        'On-demand hot water',
  stored_water: 'Stored water system',
  heat_pump:    'Heat pump',
};

function systemTypeToLabel(systemType: OutcomeSystemSpec['systemType']): string {
  return SYSTEM_TYPE_LABELS[systemType];
}

// ─── System condition ─────────────────────────────────────────────────────────

function deriveSystemCondition(
  survey: FullSurveyModelV1,
): OutcomeSystemSpec['systemCondition'] {
  const hc = survey.fullSurvey?.heatingCondition;
  const dc = survey.fullSurvey?.dhwCondition;

  const hasSludgeSignal =
    hc?.bleedWaterColour === 'brown' ||
    hc?.bleedWaterColour === 'black' ||
    hc?.magneticDebrisEvidence === true ||
    hc?.radiatorsColdAtBottom === true;

  const hasScaleSignal = dc?.kettlingOrScaleSymptoms === true;

  if (hasSludgeSignal) return 'poor';
  if (hasScaleSignal)  return 'average';
  return 'clean';
}

// ─── Controls quality ─────────────────────────────────────────────────────────

function deriveControlsQuality(
  _survey: FullSurveyModelV1,
): OutcomeSystemSpec['controlsQuality'] {
  // No direct survey field maps to controlsQuality.
  // Use a conservative default — the upgrade engine will flag an upgrade
  // when basic controls are detected.
  return 'basic';
}

// ─── Primary pipe size ────────────────────────────────────────────────────────

function derivePrimaryPipeSizeMm(
  survey: FullSurveyModelV1,
): OutcomeSystemSpec['primaryPipeSizeMm'] {
  const raw = survey.primaryPipeDiameter;
  if (raw === 15 || raw === 22 || raw === 28 || raw === 35) return raw;
  return undefined;
}

// ─── OutcomeSystemSpec builders ───────────────────────────────────────────────

/**
 * Shared property facts derived from the survey (describe the home, not the
 * chosen system family).
 */
function deriveSurveyPropertyFacts(survey: FullSurveyModelV1): {
  mainsDynamicPressureBar: number | undefined;
  heatOutputKw: number | undefined;
  primaryPipeSizeMm: OutcomeSystemSpec['primaryPipeSizeMm'];
  controlsQuality: OutcomeSystemSpec['controlsQuality'];
  systemCondition: OutcomeSystemSpec['systemCondition'];
} {
  const dynBar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure;
  const mainsDynamicPressureBar =
    dynBar != null && dynBar > 0 ? Math.min(Math.max(dynBar, 0.5), 6.0) : undefined;

  const heatOutputKw =
    survey.currentBoilerOutputKw != null && survey.currentBoilerOutputKw > 0
      ? survey.currentBoilerOutputKw
      : undefined;

  return {
    mainsDynamicPressureBar,
    heatOutputKw,
    primaryPipeSizeMm:  derivePrimaryPipeSizeMm(survey),
    controlsQuality:    deriveControlsQuality(survey),
    systemCondition:    deriveSystemCondition(survey),
  };
}

/**
 * Build a combi OutcomeSystemSpec with explicit peak hot-water capacity.
 * A standard 24 kW combi at a 35 °C temperature rise delivers ≈ 11.5 lpm;
 * we seed 12 lpm as the conservative base assumption.
 */
function buildCombiSimpleInstallSpec(survey: FullSurveyModelV1): OutcomeSystemSpec {
  const facts = deriveSurveyPropertyFacts(survey);
  return {
    systemType:              'combi',
    peakHotWaterCapacityLpm: 12,
    ...facts,
  };
}

/**
 * Build a stored-water OutcomeSystemSpec with realistic cylinder and recovery
 * defaults.
 *
 * Defaults:
 *   - 210 L storage  — standard UK unvented cylinder (A-rated, EN 12897)
 *   - 120 L/h recovery — gas boiler indirect coil (~24 kW input, coil losses)
 *
 * Without these values the classifier falls back to 150 L / 60 L/h, which
 * produces extreme conflict counts and implausible bath-fill times for a
 * typical household.
 */
function buildStoredWaterSimpleInstallSpec(survey: FullSurveyModelV1): OutcomeSystemSpec {
  const facts = deriveSurveyPropertyFacts(survey);
  return {
    systemType:                  'stored_water',
    hotWaterStorageLitres:       210,
    recoveryRateLitresPerHour:   120,
    ...facts,
  };
}

/**
 * Build a heat-pump OutcomeSystemSpec with larger store and slower recovery.
 *
 * Defaults:
 *   - 250 L storage  — standard ASHP cylinder
 *   - 30 L/h recovery — heat pumps recover slowly vs gas (~2–3 h full cycle)
 */
function buildHeatPumpSimpleInstallSpec(survey: FullSurveyModelV1): OutcomeSystemSpec {
  const facts = deriveSurveyPropertyFacts(survey);
  return {
    systemType:                'heat_pump',
    hotWaterStorageLitres:     250,
    recoveryRateLitresPerHour: 30,
    ...facts,
    // Heat pumps do not carry a heatOutputKw from the existing gas boiler survey field.
    heatOutputKw: undefined,
  };
}

/**
 * Dispatch to the correct family-aware spec builder.
 *
 * Each family receives a complete base spec so that the outcome classifier
 * always operates on realistic physics, not generic fallbacks.
 */
function buildFamilySpec(
  survey: FullSurveyModelV1,
  proposedSystemType: OutcomeSystemSpec['systemType'],
): OutcomeSystemSpec {
  switch (proposedSystemType) {
    case 'combi':        return buildCombiSimpleInstallSpec(survey);
    case 'stored_water': return buildStoredWaterSimpleInstallSpec(survey);
    case 'heat_pump':    return buildHeatPumpSimpleInstallSpec(survey);
  }
}

// ─── Daytime occupancy + bath use ─────────────────────────────────────────────

function deriveDaytimeOccupancy(survey: FullSurveyModelV1): DaytimeOccupancyPattern {
  const raw = survey.demandTimingOverrides?.daytimeOccupancy;
  if (raw === 'full')    return 'usually_home';
  if (raw === 'partial') return 'irregular';
  return 'usually_out';
}

function deriveBathUsePattern(survey: FullSurveyModelV1): BathUsePattern {
  const freq = survey.demandTimingOverrides?.bathFrequencyPerWeek ?? 0;
  if (freq >= 7) return 'frequent';
  if (freq >= 2) return 'sometimes';
  return 'rare';
}

// ─── Default household composition ───────────────────────────────────────────

const DEFAULT_HOUSEHOLD_COMPOSITION = {
  adultCount:               2,
  youngAdultCount18to25AtHome: 0,
  childCount0to4:           0,
  childCount5to10:          0,
  childCount11to17:         0,
};

// ─── Public result type ───────────────────────────────────────────────────────

export interface ResimulationFromSurveyResult {
  /** The full re-simulation result (simple + best-fit + comparison). */
  resimulation: ResimulationResult;
  /** Upgrade package generated for the current system. */
  upgradePackage: RecommendedUpgradePackage;
  /** Human-readable label for the recommended system. */
  recommendedSystemLabel: string;
  /** Short description of why this system path was chosen. */
  fitSummary: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a ResimulationResult from a completed FullSurveyModelV1 and its
 * corresponding EngineOutputV1.
 *
 * Uses the existing PR 2–5 engines exclusively — no new physics logic.
 *
 * @param overrideSystemType - When provided, forces the resimulation pipeline
 *        to use this system type instead of the engine-recommended option.
 *        This allows the events/upgrades panel to be driven by a user-chosen
 *        system family (combi, stored_water, heat_pump).
 *
 * @returns ResimulationFromSurveyResult or null when insufficient data is
 *          available to run the pipeline (e.g. no household composition).
 */
export function buildResimulationFromSurvey(
  survey: FullSurveyModelV1,
  engineOutput: EngineOutputV1,
  overrideSystemType?: OutcomeSystemSpec['systemType'],
): ResimulationFromSurveyResult | null {
  // ── Step 1: Derive household profile ──────────────────────────────────────
  const composition = survey.householdComposition ?? DEFAULT_HOUSEHOLD_COMPOSITION;
  const daytimeOccupancy = deriveDaytimeOccupancy(survey);
  const bathUse = deriveBathUsePattern(survey);

  const profile = deriveProfileFromHouseholdComposition(
    composition,
    daytimeOccupancy,
    bathUse,
  );

  // ── Step 2: Generate the typical day schedule ─────────────────────────────
  const scheduleInputs: GenerateTypicalDayScheduleInputs = {
    derivedPresetId:   profile.derivedPresetId,
    derivationReason:  profile.derivationReason,
    householdComposition: composition,
    daytimeOccupancy,
    bathUse,
  };
  const schedule = generateTypicalDaySchedule(scheduleInputs);

  // ── Step 2.5: Resolve the recommended/proposed option and its system type ──
  //
  // The simpleInstallSpec is built for the *proposed* system (the engine's
  // recommendation), not the current system.  This ensures the upgrade
  // comparison panel always shows the correct family (stored_water, heat_pump,
  // combi) rather than falling back to combi defaults when the current and
  // proposed systems are different families.
  const options = engineOutput.options ?? [];
  const recommendedOption =
    options.find((o) => o.status === 'viable') ??
    options.find((o) => o.status === 'caution') ??
    options[0];

  const proposedSystemType = overrideSystemType ?? optionIdToSystemType(recommendedOption?.id);

  // ── Step 3: Build the family-aware simple-install OutcomeSystemSpec ──────
  const simpleInstallSpecBase = buildFamilySpec(survey, proposedSystemType);

  // Pre-build the heat-source behaviour model once so that all downstream
  // consumers (classifyEventOutcomes, recommendUpgrades, resimulateWithUpgrades)
  // share the same physics-derived outputs.  This is the "single source of
  // truth" wire: survey inputs → heat-source behaviour model → all consumers.
  const heatSourceBehaviour = buildHeatSourceBehaviour(simpleInstallSpecBase);
  const simpleInstallSpec: OutcomeSystemSpec = {
    ...simpleInstallSpecBase,
    heatSourceBehaviour,
  };

  // ── Step 4: Generate the upgrade package for the simple-install system ────
  const simpleInstallOutcomes = classifyEventOutcomes(schedule, simpleInstallSpec);

  const upgradePackage = recommendUpgrades({
    systemSpec:           simpleInstallSpec,
    outcomes:             simpleInstallOutcomes,
    primaryPipeSizeMm:    derivePrimaryPipeSizeMm(survey),
    bathroomCount:        survey.bathroomCount,
    mainsDynamicPressureBar:
      survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure,
    householdComposition: composition,
    systemCondition:      deriveSystemCondition(survey),
    controlsQuality:      deriveControlsQuality(survey),
    bathUse,
    heatSourceBehaviour,
  });

  // ── Step 5: Re-simulate with the upgraded spec ────────────────────────────
  const resimulation = resimulateWithUpgrades(
    schedule,
    simpleInstallSpec,
    upgradePackage,
  );

  // ── Step 6: Derive recommended system metadata ────────────────────────────
  const recommendedSystemLabel =
    overrideSystemType != null
      ? systemTypeToLabel(overrideSystemType)
      : (recommendedOption?.label ?? systemTypeToLabel(proposedSystemType));

  const fitSummary =
    engineOutput.recommendation.secondary ??
    engineOutput.recommendation.primary;

  return {
    resimulation,
    upgradePackage,
    recommendedSystemLabel,
    fitSummary,
  };
}
