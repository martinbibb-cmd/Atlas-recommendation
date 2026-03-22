import type { FullSurveyModelV1 } from './FullSurveyModelV1';
import {
  inferPlateHexCondition,
  inferCylinderCondition,
  inferDhwUseBand,
  inferBoilerCondition,
} from '../../engine/modules/ComponentConditionModule';
import { normalizeInput } from '../../engine/normalizer/Normalizer';
import { resolveTimingOverrides } from '../../engine/schema/OccupancyPreset';
import type { DemandPresetId } from '../../engine/schema/OccupancyPreset';
import {
  deriveProfileFromHouseholdComposition,
} from '../../lib/occupancy/deriveProfileFromHouseholdComposition';
import type {
  DaytimeOccupancyPattern,
  BathUsePattern,
} from '../../lib/occupancy/deriveProfileFromHouseholdComposition';

/**
 * Cleans and validates a FullSurveyModelV1 before passing it to the engine.
 *
 * - Clamps out-of-range values (boiler age > 50, flow > 60 L/min, static pressure > 10 bar).
 * - Corrects dynamic pressure if it exceeds static pressure.
 * - Bridges flat survey fields (currentBoilerAgeYears, currentHeatSourceType,
 *   currentBoilerOutputKw) into the nested currentSystem.boiler structure that
 *   BoilerEfficiencyModelV1 expects. Existing nested values are never overwritten.
 * - Bridges plate HEX condition from fullSurvey.dhwCondition into plateHexFoulingFactor
 *   and plateHexConditionBand for use by CombiDhwModule. Existing values are not overwritten.
 * - Bridges cylinder condition from fullSurvey.dhwCondition into cylinderInsulationFactor,
 *   cylinderCoilTransferFactor, and cylinderConditionBand for use by StoredDhwModule.
 *   Only runs for stored hot water paths (non-combi). Existing values are not overwritten.
 * - Maps fullSurvey.dhwCondition.softenerPresent → hasSoftener when hasSoftener is not set.
 */
export function sanitiseModelForEngine(model: FullSurveyModelV1): FullSurveyModelV1 {
  const sanitised: FullSurveyModelV1 = { ...model };
  if (sanitised.currentBoilerAgeYears !== undefined && sanitised.currentBoilerAgeYears > 50) {
    sanitised.currentBoilerAgeYears = undefined;
  }
  if (sanitised.mainsDynamicFlowLpm !== undefined && sanitised.mainsDynamicFlowLpm > 60) {
    sanitised.mainsDynamicFlowLpm = undefined;
  }
  if (sanitised.staticMainsPressureBar !== undefined && sanitised.staticMainsPressureBar > 10) {
    sanitised.staticMainsPressureBar = 10;
  }
  const dynamicPressure = sanitised.dynamicMainsPressureBar ?? sanitised.dynamicMainsPressure;
  if (
    sanitised.staticMainsPressureBar !== undefined
    && dynamicPressure !== undefined
    && dynamicPressure > sanitised.staticMainsPressureBar
  ) {
    sanitised.dynamicMainsPressureBar = undefined;
    sanitised.dynamicMainsPressure = sanitised.staticMainsPressureBar;
  }

  // Propagate mains nested object into flat fields when the flat fields are absent.
  // This ensures that data arriving via the mapper (mapSurveyToEngineInput) is also
  // visible to modules that read the legacy flat fields.
  if (sanitised.mains) {
    if (sanitised.mains.staticPressureBar !== undefined && sanitised.staticMainsPressureBar === undefined) {
      sanitised.staticMainsPressureBar = sanitised.mains.staticPressureBar;
    }
    if (sanitised.mains.dynamicPressureBar !== undefined && sanitised.dynamicMainsPressureBar === undefined) {
      sanitised.dynamicMainsPressureBar = sanitised.mains.dynamicPressureBar;
    }
    if (sanitised.mains.flowRateLpm !== undefined && sanitised.mainsDynamicFlowLpm === undefined) {
      sanitised.mainsDynamicFlowLpm = sanitised.mains.flowRateLpm;
      sanitised.mainsDynamicFlowLpmKnown = true;
    }
  }

  // Bridge flat survey fields into currentSystem.boiler so the engine's
  // BoilerEfficiencyModelV1 can apply age-decay and oversize calculations.
  // currentHeatSourceType only covers boiler-based systems (combi/system/regular).
  const boilerType = sanitised.currentHeatSourceType === 'combi'
    || sanitised.currentHeatSourceType === 'system'
    || sanitised.currentHeatSourceType === 'regular'
    ? sanitised.currentHeatSourceType as 'combi' | 'system' | 'regular'
    : undefined;

  if (boilerType !== undefined || sanitised.currentBoilerAgeYears !== undefined || sanitised.currentBoilerOutputKw !== undefined) {
    const existingBoiler = sanitised.currentSystem?.boiler ?? {};
    sanitised.currentSystem = {
      ...sanitised.currentSystem,
      boiler: {
        ...existingBoiler,
        type: existingBoiler.type ?? boilerType,
        ageYears: existingBoiler.ageYears ?? sanitised.currentBoilerAgeYears,
        nominalOutputKw: existingBoiler.nominalOutputKw ?? sanitised.currentBoilerOutputKw,
      },
    };
  }

  // ── Plate HEX condition bridge ────────────────────────────────────────────
  // Map fullSurvey.dhwCondition plate HEX evidence → plateHexFoulingFactor and
  // plateHexConditionBand on the sanitised engine input. These are consumed by
  // CombiDhwModule to reduce effective DHW output when degradation is inferred.
  //
  // Only runs when fullSurvey.dhwCondition is present and the model is a combi
  // or the heat source type has not been specified (to avoid penalising stored systems).
  // Existing plateHexFoulingFactor values are never overwritten (explicit wins).
  const dc = sanitised.fullSurvey?.dhwCondition;
  const isCombiOrUnknown = !sanitised.currentHeatSourceType
    || sanitised.currentHeatSourceType === 'combi';

  if (dc !== undefined && isCombiOrUnknown && sanitised.plateHexFoulingFactor === undefined) {
    // Derive water condition from postcode hardness (same as Normalizer)
    const normalizerResult = normalizeInput(sanitised);
    const waterCondition = {
      hardnessBand: normalizerResult.waterHardnessCategory as 'soft' | 'moderate' | 'hard' | 'very_hard',
      softenerPresent: dc.softenerPresent ?? sanitised.hasSoftener ?? false,
    };

    // Derive usage from occupancy + bathrooms + peak outlets
    const occupancy = sanitised.occupancyCount ?? 2;
    const bathroomCount = sanitised.bathroomCount ?? 1;
    const peakOutlets = sanitised.peakConcurrentOutlets;
    const usageCondition = {
      dhwUseBand: inferDhwUseBand(occupancy, bathroomCount, peakOutlets),
      occupancy,
      simultaneousUseLikely: (peakOutlets ?? 0) >= 2,
    };

    // Derive plate HEX age from available sources (boiler age is the same appliance)
    const plateHexAgeYears = typeof dc.plateHexAgeYears === 'number'
      ? dc.plateHexAgeYears
      : sanitised.currentSystem?.boiler?.ageYears ?? sanitised.currentBoilerAgeYears;

    const hexCondition = inferPlateHexCondition(
      waterCondition,
      usageCondition,
      {
        applianceAgeYears: plateHexAgeYears,
        hotWaterPerformanceBand: dc.hotWaterPerformanceBand,
      },
    );

    sanitised.plateHexFoulingFactor = hexCondition.foulingFactor;
    sanitised.plateHexConditionBand = hexCondition.conditionBand;
  }

  // ── Cylinder condition bridge ─────────────────────────────────────────────
  // Map fullSurvey.dhwCondition cylinder evidence → cylinderInsulationFactor,
  // cylinderCoilTransferFactor, and cylinderConditionBand on the sanitised engine
  // input. These are consumed by StoredDhwModule to model standing loss increase
  // and reduced reheat performance when cylinder degradation is inferred.
  //
  // Only runs for stored hot water paths (non-combi). If the current heat source
  // is a combi, cylinder condition is irrelevant.
  // Existing cylinderInsulationFactor values are never overwritten (explicit wins).
  const isStoredPath = sanitised.currentHeatSourceType !== 'combi';

  if (dc !== undefined && isStoredPath && sanitised.cylinderInsulationFactor === undefined) {
    const normalizerResult = normalizeInput(sanitised);
    const waterCondition = {
      hardnessBand: normalizerResult.waterHardnessCategory as 'soft' | 'moderate' | 'hard' | 'very_hard',
      softenerPresent: dc.softenerPresent ?? sanitised.hasSoftener ?? false,
    };

    const occupancy = sanitised.occupancyCount ?? 2;
    const bathroomCount = sanitised.bathroomCount ?? 1;
    const peakOutlets = sanitised.peakConcurrentOutlets;
    const usageCondition = {
      dhwUseBand: inferDhwUseBand(occupancy, bathroomCount, peakOutlets),
      occupancy,
      simultaneousUseLikely: (peakOutlets ?? 0) >= 2,
    };

    // Map survey age estimate to the engine's ageBand format
    const ageBandMap: Record<string, '<5' | '5-10' | '10-20' | '20+'> = {
      under_5:   '<5',
      '5_to_10': '5-10',
      '10_to_15': '10-20',
      over_15:   '20+',
    };
    const ageBand = dc.cylinderAgeEstimate && dc.cylinderAgeEstimate !== 'unknown'
      ? ageBandMap[dc.cylinderAgeEstimate]
      : undefined;

    // Only run cylinder inference when at least one cylinder evidence field is present.
    // Without any cylinder data (type, age, retention) the bridge would produce only defaults
    // which adds noise without adding information.
    const hasCylinderEvidence =
      (dc.cylinderType !== undefined && dc.cylinderType !== 'unknown')
      || ageBand !== undefined
      || dc.cylinderRetentionBand !== undefined;

    if (hasCylinderEvidence) {
      const cylCondition = inferCylinderCondition(
        waterCondition,
        usageCondition,
        {
          cylinderType: dc.cylinderType ?? 'unknown',
          ageBand,
          retentionBand: dc.cylinderRetentionBand,
        },
      );

      sanitised.cylinderInsulationFactor = cylCondition.insulationFactor;
      sanitised.cylinderCoilTransferFactor = cylCondition.coilTransferFactor;
      sanitised.cylinderConditionBand = cylCondition.conditionBand;
    }
  }

  // ── softenerPresent → hasSoftener bridge ─────────────────────────────────
  // Map fullSurvey.dhwCondition.softenerPresent into the top-level hasSoftener
  // field consumed by MetallurgyEdgeModule. Does not overwrite an existing value.
  if (
    sanitised.hasSoftener === undefined
    && sanitised.fullSurvey?.dhwCondition?.softenerPresent !== undefined
  ) {
    sanitised.hasSoftener = sanitised.fullSurvey.dhwCondition.softenerPresent;
  }

  // ── Current cylinder bridge ───────────────────────────────────────────────
  // Propagate survey-layer current cylinder fields into engine-input fields that
  // StoredDhwModule consumes.  Existing explicit values are never overwritten.
  const dcc = sanitised.fullSurvey?.dhwCondition;
  if (dcc !== undefined) {
    // currentCylinderPresent → engine field of the same name
    if (sanitised.currentCylinderPresent === undefined && dcc.currentCylinderPresent !== undefined) {
      sanitised.currentCylinderPresent = dcc.currentCylinderPresent;
    }

    // currentCylinderVolumeLitres (number only) → cylinderVolumeLitres
    if (
      sanitised.cylinderVolumeLitres === undefined
      && typeof dcc.currentCylinderVolumeLitres === 'number'
    ) {
      sanitised.cylinderVolumeLitres = dcc.currentCylinderVolumeLitres;
    }

    // currentCwsHeadMetres (number only) → cwsHeadMetres
    if (
      sanitised.cwsHeadMetres === undefined
      && typeof dcc.currentCwsHeadMetres === 'number'
    ) {
      sanitised.cwsHeadMetres = dcc.currentCwsHeadMetres;
    }
  }

  // ── Boiler condition bridge ───────────────────────────────────────────────
  // Derives boiler condition band from age, condensing status, and surveyor-
  // observed heating circuit symptoms. Stored as boilerConditionBand for use
  // by BoilerEfficiencyModelV1 and surfaced in the Component condition section.
  //
  // Boiler condition covers combustion/modulation/condensing/cycling degradation.
  // It is distinct from plate HEX fouling (DHW side) and cylinder condition.
  //
  // Only runs when at least one boiler signal is present. Existing values are not
  // overwritten (explicit wins).
  if (sanitised.boilerConditionBand === undefined) {
    const boilerAge = sanitised.currentSystem?.boiler?.ageYears ?? sanitised.currentBoilerAgeYears;
    const condensing = sanitised.currentSystem?.boiler?.condensing;
    const hc = sanitised.fullSurvey?.heatingCondition;

    const hasBoilerSignal = boilerAge !== undefined || condensing !== undefined;

    if (hasBoilerSignal) {
      const boilerCondition = inferBoilerCondition({
        ageYears: boilerAge,
        condensing,
        boilerCavitationOrNoise: hc?.boilerCavitationOrNoise,
        repeatedPumpOrValveReplacements: hc?.repeatedPumpOrValveReplacements,
      });
      sanitised.boilerConditionBand = boilerCondition.conditionBand;
    }
  }

  // ── Household composition → source of truth enforcement ──────────────────
  // When householdComposition is present, occupancyCount and demandPreset are
  // derived fields.  The composition is the authoritative source; any
  // previously stored values are overwritten unless demandPresetIsManualOverride
  // is explicitly set to true (surveyor-initiated manual override).
  //
  // Derivation sequence:
  //   householdComposition + daytimeOccupancy + bathUse
  //     → derivedPresetId + occupancyCount
  //
  // daytimeOccupancyPattern is back-mapped from demandTimingOverrides when
  // present (mirrors the forward mapping in adaptFullSurveyToSimulatorInputs).
  if (sanitised.householdComposition != null) {
    const dto = sanitised.demandTimingOverrides;

    const daytimePattern: DaytimeOccupancyPattern =
      dto?.daytimeOccupancy === 'full'
        ? 'usually_home'
        : dto?.daytimeOccupancy === 'partial'
          ? 'irregular'
          : 'usually_out';

    const bathUse: BathUsePattern =
      (dto?.bathFrequencyPerWeek ?? 0) >= 7
        ? 'frequent'
        : (dto?.bathFrequencyPerWeek ?? 0) >= 2
          ? 'sometimes'
          : 'rare';

    const derived = deriveProfileFromHouseholdComposition(
      sanitised.householdComposition,
      daytimePattern,
      bathUse,
    );

    // occupancyCount is always derived from composition.
    sanitised.occupancyCount = derived.occupancyCount;

    // demandPreset is derived unless the surveyor has explicitly overridden it.
    if (!sanitised.demandPresetIsManualOverride) {
      sanitised.demandPreset = derived.derivedPresetId;
    }
  }

  // ── Auto-derive peakConcurrentOutlets from demand preset when not set ────
  // If the user has selected a demand preset in Step 4 (Lifestyle) but has not
  // explicitly set peakConcurrentOutlets in Step 5 (Hot Water), infer a value
  // from the preset's simultaneousUseSeverity so the engine can correctly
  // assess combi simultaneous-demand stress.
  //   high   → 2 (two or more simultaneous outlets likely — hard fail gate)
  //   medium → 2 (borderline; engine flags but doesn't hard-fail on outlets alone)
  //   low    → 1 (single outlet; no simultaneous risk from this dimension)
  if (sanitised.peakConcurrentOutlets == null && sanitised.demandPreset != null) {
    const timing = resolveTimingOverrides(sanitised.demandPreset as DemandPresetId);
    if (timing.simultaneousUseSeverity === 'high' || timing.simultaneousUseSeverity === 'medium') {
      sanitised.peakConcurrentOutlets = 2;
    } else {
      sanitised.peakConcurrentOutlets = 1;
    }
  }

  return sanitised;
}
