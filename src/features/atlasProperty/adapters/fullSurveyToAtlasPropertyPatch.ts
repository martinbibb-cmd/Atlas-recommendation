/**
 * fullSurveyToAtlasPropertyPatch.ts
 *
 * Derives a partial AtlasPropertyV1 from the Recommendation-side survey truth
 * (FullSurveyModelV1).
 *
 * Architecture note
 * ─────────────────
 * FullSurveyModelV1 is the Atlas Recommendation internal survey model.
 * AtlasPropertyV1 is the canonical cross-app property root owned by
 * @atlas/contracts.
 *
 * This adapter is an intentionally transitional seam: Atlas Mind can now
 * populate the canonical root from existing survey state without touching the
 * engine contracts or the survey UI flow.
 *
 * Provenance rules applied here:
 *   - Household composition headcounts   → 'customer_stated', 'medium'
 *   - Mains-pressure measurements        → 'measured', 'high'
 *   - Boiler / system type from builder  → 'engineer_entered', 'medium'
 *   - Condition diagnostics              → 'observed', 'medium'
 *   - Defaults / derived values          → 'defaulted', 'low'
 */

import type { FieldValue, ProvenanceSource, ConfidenceBand } from '@atlas/contracts';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { AtlasPropertyPatch } from '../types/atlasPropertyAdapter.types';

// ─── FieldValue factory ───────────────────────────────────────────────────────

function fv<T>(
  value: T,
  source: ProvenanceSource = 'engineer_entered',
  confidence: ConfidenceBand = 'medium',
): FieldValue<T> {
  return { value, source, confidence };
}

// ─── System-family mapping ────────────────────────────────────────────────────

type EngineFamilyFamily = 'combi' | 'system' | 'regular' | 'heat_pump' | 'hybrid' | 'unknown';

function mapHeatSourceTypeToFamily(
  heatSourceType: string | undefined,
  engineBoilerType: string | undefined,
): EngineFamilyFamily {
  // Prefer flat currentHeatSourceType from the survey
  switch (heatSourceType) {
    case 'combi':   return 'combi';
    case 'system':  return 'system';
    case 'regular': return 'regular';
    case 'ashp':    return 'heat_pump';
  }
  // Fall back to boiler type from currentSystem.boiler
  switch (engineBoilerType) {
    case 'combi':       return 'combi';
    case 'system':      return 'system';
    case 'regular':     return 'regular';
    case 'back_boiler': return 'regular';
    default:            return 'unknown';
  }
}

type DhwTypeValue = 'combi' | 'vented_cylinder' | 'unvented_cylinder' | 'thermal_store' | 'mixergy' | 'unknown';

function mapDhwStorageTypeToDhwType(
  dhwStorageType: string | undefined,
  builderDhwType: string | null | undefined,
): DhwTypeValue {
  // Prefer flat dhwStorageType from the survey
  switch (dhwStorageType) {
    case 'none':          return 'combi';
    case 'vented':        return 'vented_cylinder';
    case 'unvented':      return 'unvented_cylinder';
    case 'mixergy':       return 'mixergy';
    case 'thermal_store': return 'thermal_store';
  }
  // Fall back to systemBuilder dhwType for finer-grained mapping
  switch (builderDhwType) {
    case 'open_vented':   return 'vented_cylinder';
    case 'unvented':      return 'unvented_cylinder';
    case 'thermal_store': return 'thermal_store';
    default:              break;
  }
  return 'unknown';
}

// ─── Occupancy pattern mapping ────────────────────────────────────────────────

type OccupancyPatternValue = 'usually_out' | 'steady_home' | 'mixed' | 'unknown';

function mapDaytimeOccupancy(
  daytimeOccupancy: string | undefined,
): OccupancyPatternValue {
  switch (daytimeOccupancy) {
    case 'usually_out':  return 'usually_out';
    case 'usually_home': return 'steady_home';
    case 'irregular':    return 'mixed';
    default:             return 'unknown';
  }
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Derives a partial AtlasPropertyV1 patch from the Recommendation survey model.
 *
 * The output is a patch — not a complete AtlasPropertyV1.  Required root-level
 * fields (version, propertyId, etc.) are intentionally absent.  Compose with
 * other patches using mergeAtlasPropertyPatches() before storing.
 *
 * @param survey  The full survey model from the Atlas Recommendation survey state.
 * @returns       An AtlasPropertyPatch covering property, household,
 *                currentSystem, and partial derived fields.
 */
export function fullSurveyToAtlasPropertyPatch(survey: FullSurveyModelV1): AtlasPropertyPatch {
  const patch: AtlasPropertyPatch = {};

  // ── Property identity ──────────────────────────────────────────────────────

  if (survey.postcode) {
    patch.property = {
      postcode: survey.postcode,
    };
  }

  // ── Household composition ──────────────────────────────────────────────────

  const composition = survey.householdComposition ?? survey.fullSurvey?.usage?.composition;

  if (composition) {
    patch.household = {
      ...patch.household,
      composition: {
        adultCount:                    fv(composition.adultCount,                    'customer_stated', 'medium'),
        childCount0to4:                fv(composition.childCount0to4,                'customer_stated', 'medium'),
        childCount5to10:               fv(composition.childCount5to10,               'customer_stated', 'medium'),
        childCount11to17:              fv(composition.childCount11to17,              'customer_stated', 'medium'),
        youngAdultCount18to25AtHome:   fv(composition.youngAdultCount18to25AtHome,   'customer_stated', 'medium'),
      },
    };
  }

  // ── Household occupancy pattern ────────────────────────────────────────────

  const daytimeOccupancy = survey.fullSurvey?.usage?.daytimeOccupancy;
  if (daytimeOccupancy && daytimeOccupancy !== 'unknown') {
    patch.household = {
      ...patch.household,
      occupancyPattern: fv(mapDaytimeOccupancy(daytimeOccupancy), 'customer_stated', 'medium'),
    };
  }

  // ── Hot water usage ────────────────────────────────────────────────────────

  const bathroomCount = survey.bathroomCount ?? survey.fullSurvey?.usage?.bathroomCount;
  const dhwCondition  = survey.fullSurvey?.dhwCondition;

  if (bathroomCount != null || dhwCondition) {
    const bathPresent = (bathroomCount != null && bathroomCount > 0)
      || (dhwCondition?.currentCylinderPresent === true);

    patch.household = {
      ...patch.household,
      hotWaterUsage: {
        bathPresent: fv(bathPresent, 'engineer_entered', 'medium'),
      },
    };
  }

  // ── Current system ─────────────────────────────────────────────────────────

  const engineBoiler = survey.currentSystem?.boiler;
  const systemBuilder = survey.fullSurvey?.systemBuilder;

  // Use flat survey fields as the primary source for family and dhwType
  const surveyHeatSourceType = survey.currentHeatSourceType;
  const surveyDhwStorageType = survey.dhwStorageType;

  const heatSourceType = engineBoiler?.type ?? systemBuilder?.heatSource ?? undefined;
  const systemFamily = mapHeatSourceTypeToFamily(surveyHeatSourceType, heatSourceType);
  const dhwTypeValue = mapDhwStorageTypeToDhwType(surveyDhwStorageType, systemBuilder?.dhwType);

  patch.currentSystem = {
    family: fv(systemFamily, 'engineer_entered', 'medium'),
    dhwType: fv(dhwTypeValue, 'engineer_entered', 'medium'),
  };

  // Heat source details
  if (engineBoiler || systemBuilder) {
    const pipeSize = survey.primaryPipeDiameter ?? systemBuilder?.primarySize;

    patch.currentSystem.heatSource = {};
    patch.currentSystem.distribution = {};

    if (engineBoiler?.ageYears != null) {
      const currentYear = new Date().getFullYear();
      patch.currentSystem.heatSource.installYear = fv(
        currentYear - engineBoiler.ageYears,
        'engineer_entered',
        'low',
      );
    }

    if (engineBoiler?.nominalOutputKw != null) {
      patch.currentSystem.heatSource.ratedOutputKw = fv(
        engineBoiler.nominalOutputKw,
        'engineer_entered',
        'medium',
      );
    }

    if (typeof pipeSize === 'number') {
      patch.currentSystem.distribution.dominantPipeDiameterMm = fv(
        pipeSize,
        'engineer_entered',
        'medium',
      );
    }

    // Controls from systemBuilder
    if (systemBuilder?.thermostatStyle) {
      const thermostatMap: Record<string, 'mechanical' | 'digital' | 'smart' | 'none' | 'unknown'> = {
        basic:         'mechanical',
        programmable:  'digital',
        smart:         'smart',
        unknown:       'unknown',
      };
      patch.currentSystem.controls = {
        roomThermostatType: fv(
          thermostatMap[systemBuilder.thermostatStyle] ?? 'unknown',
          'engineer_entered',
          'medium',
        ),
      };
    }
  }

  // ── Current system — condition ─────────────────────────────────────────────

  const heatingCondition = survey.fullSurvey?.heatingCondition;
  if (heatingCondition) {
    const hasFaults =
      heatingCondition.radiatorsColdAtBottom === true ||
      heatingCondition.radiatorsHeatingUnevenly === true ||
      heatingCondition.boilerCavitationOrNoise === true ||
      heatingCondition.pumpingOverObserved === true;

    const conditionNotes: string[] = [];
    if (heatingCondition.radiatorsColdAtBottom)    conditionNotes.push('Radiators cold at bottom');
    if (heatingCondition.radiatorsHeatingUnevenly) conditionNotes.push('Radiators heating unevenly');
    if (heatingCondition.boilerCavitationOrNoise)  conditionNotes.push('Boiler cavitation or noise');
    if (heatingCondition.pumpingOverObserved)      conditionNotes.push('Pumping over observed');

    patch.currentSystem = {
      ...patch.currentSystem,
      condition: {
        knownFaults: fv(hasFaults, 'observed', 'medium'),
        notes: conditionNotes.length > 0 ? conditionNotes.join('; ') : undefined,
      },
    };

    // Water quality signals from heating condition diagnostics
    const magneticDebris = heatingCondition.magneticDebrisEvidence === true;
    const sludgeEvidence =
      heatingCondition.radiatorsColdAtBottom === true ||
      heatingCondition.bleedWaterColour === 'brown' ||
      heatingCondition.bleedWaterColour === 'black';

    const visualAssessment: 'clean' | 'slightly_dirty' | 'very_dirty' | 'unknown' =
      sludgeEvidence || magneticDebris ? 'very_dirty' :
      heatingCondition.bleedWaterColour === 'clear' ? 'clean' :
      'unknown';

    patch.currentSystem.waterQuality = {
      visualAssessment: fv(visualAssessment, 'observed', 'medium'),
    };
  }

  // ── Water quality from services step ──────────────────────────────────────

  const waterQuality = survey.fullSurvey?.waterQuality;
  if (waterQuality) {
    patch.currentSystem = {
      ...patch.currentSystem,
      waterQuality: {
        ...patch.currentSystem?.waterQuality,
        tdsPpm: waterQuality.hardnessPpm != null
          ? fv(waterQuality.hardnessPpm, 'imported', 'medium')
          : undefined,
      },
    };
  }

  // ── Derived hydraulics ─────────────────────────────────────────────────────

  const dynamicBar = survey.dynamicMainsPressureBar ?? survey.dynamicMainsPressure;
  const flowLpm    = survey.mainsDynamicFlowLpm;

  if (dynamicBar != null || flowLpm != null) {
    patch.derived = {
      hydraulics: {
        dynamicPressureBar: dynamicBar != null
          ? fv(dynamicBar, 'measured', 'high')
          : undefined,
        mainsFlowLpm: flowLpm != null
          ? fv(flowLpm, 'measured', 'high')
          : undefined,
      },
    };
  }

  return patch;
}
