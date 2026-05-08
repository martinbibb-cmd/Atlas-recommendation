import type { FullSurveyModelV1 } from './FullSurveyModelV1';
import type { EngineInputV2_3, FabricWallType, FabricInsulationLevel, FabricGlazing, FabricRoofInsulation } from '../../engine/schema/EngineInputV2_3';
import {
  inferPlateHexCondition,
  inferCylinderCondition,
  inferDhwUseBand,
  inferBoilerCondition,
} from '../../engine/modules/ComponentConditionModule';
import { normalizeInput } from '../../engine/normalizer/Normalizer';
import { resolveTimingOverrides, presetToEngineSignature } from '../../engine/schema/OccupancyPreset';
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
 * - Bridges fullSurvey.systemBuilder into flat engine fields and currentSystem structure
 *   (currentHeatSourceType, currentBoilerAgeYears, emitterType, systemPlanType,
 *   pipingTopology, hasMagneticFilter, systemAgeYears, dhwStorageType, and the extended
 *   currentSystem.* architecture fields). Existing values are never overwritten.
 *   Also bridges shower fields (currentShowerType, electricShowerPresent, pumpedShowerPresent)
 *   and cylinder volume (cylinderVolumeL → cylinderVolumeLitres for regular/system boiler paths).
 *   Runs cylinder condition inference from systemBuilder cylinder data when fullSurvey.dhwCondition
 *   is absent and the current heat source is not a combi.
 * - Bridges flat survey fields (currentBoilerAgeYears, currentHeatSourceType,
 *   currentBoilerOutputKw) into the nested currentSystem.boiler structure that
 *   BoilerEfficiencyModelV1 expects. Existing nested values are never overwritten.
 * - Bridges plate HEX condition from fullSurvey.dhwCondition into plateHexFoulingFactor
 *   and plateHexConditionBand for use by CombiDhwModule. Existing values are not overwritten.
 * - Bridges cylinder condition from fullSurvey.dhwCondition into cylinderInsulationFactor,
 *   cylinderCoilTransferFactor, and cylinderConditionBand for use by StoredDhwModule.
 *   Only runs for stored hot water paths (non-combi). Existing values are not overwritten.
 * - Maps fullSurvey.dhwCondition.softenerPresent → hasSoftener when hasSoftener is not set.
 * - Wires systemAgeYears from currentBoilerAgeYears so that SystemConditionInferenceModule
 *   can use actual age (rather than zero) when no direct symptoms are present.
 * - Bridges fullSurvey.heatLoss.shellModel.settings fields into building.fabric.*
 *   (wallType → FabricWallType, loftInsulation → roofInsulation and insulationLevel,
 *   glazingType → glazing) and thermalMass → building.thermalMass for FabricModelModule.
 *   Also syncs thermalMass → buildingMass for LifestyleSimulationModule.
 *   Existing building.fabric values (wallType, roofInsulation, glazing, insulationLevel) are not overwritten.
 * - Bridges fullSurvey.heatLoss.shellModel.settings.dwellingType → dwellingType (snake_case)
 *   so the engine knows the property form. Flats suppress 'planned' solar status.
 * - Bridges fullSurvey.heatLoss.buildingBearingDeg → buildingBearingDeg when not already set.
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

  // Sync calculator-derived heat loss from fullSurvey.heatLoss into the
  // canonical heatLossWatts field.  fullSurvey.heatLoss.estimatedPeakHeatLossW
  // is the authoritative source when it is present — it always wins over the
  // root field, which may carry a stale or default value from a previous
  // session or an older saved draft.  The stepper also syncs this live via
  // useEffect, but sanitiseModelForEngine must be self-contained so that
  // saved/prefilled models are always correct regardless of how they reach
  // the engine.
  const surveyHeatLossW = sanitised.fullSurvey?.heatLoss?.estimatedPeakHeatLossW;
  if (surveyHeatLossW != null) {
    sanitised.heatLossWatts = surveyHeatLossW;
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
    // Derive the representative measured flow from multi-point readings when the
    // single-point fields are not already set.
    //
    // Trust boundary:
    //   - Prefer the 0-bar full-bore reading (maximum measured incoming supply).
    //   - Fall back to retained-flow readings only when full-bore is unavailable.
    //   - Never silently transform a full-bore measured value into a retained-flow
    //     display value.
    const fr = sanitised.mains.flowReadings;
    if (fr && sanitised.mainsDynamicFlowLpm === undefined) {
      const FLOW_TEST_PRESSURES: { pressureBar: number; flow: number | undefined }[] = [
        { pressureBar: 0,   flow: fr.at0BarLpm },
        { pressureBar: 1,   flow: fr.at1BarLpm },
        { pressureBar: 2,   flow: fr.at2BarLpm },
        { pressureBar: 0.5, flow: fr.at0p5BarLpm },
      ];
      const firstAvailableReading = FLOW_TEST_PRESSURES.find(p => p.flow !== undefined);
      if (firstAvailableReading && firstAvailableReading.flow !== undefined) {
        sanitised.mainsDynamicFlowLpm = firstAvailableReading.flow;
        sanitised.mainsDynamicFlowLpmKnown = true;
        sanitised.mainsPressureRecorded = true;
        if (sanitised.dynamicMainsPressureBar === undefined) {
          sanitised.dynamicMainsPressureBar = firstAvailableReading.pressureBar;
          sanitised.dynamicMainsPressure = firstAvailableReading.pressureBar;
        }
      }
    }
  }

  // ── Water quality user override ──────────────────────────────────────────
  // When the surveyor has explicitly confirmed or measured the local water
  // hardness in the services step (source === 'user'), promote it to
  // waterHardnessCategoryOverride so the Normalizer uses it instead of the
  // postcode-derived estimate.  Postcode lookups (source === 'lookup') are
  // not promoted — they're no better than what the Normalizer already derives.
  // Never overwrite an already-explicit override on the model.
  if (sanitised.waterHardnessCategoryOverride === undefined) {
    const wq = sanitised.fullSurvey?.waterQuality;
    if (
      wq != null &&
      wq.source === 'user' &&
      wq.hardnessBand !== 'unknown'
    ) {
      sanitised.waterHardnessCategoryOverride = wq.hardnessBand as 'soft' | 'moderate' | 'hard' | 'very_hard';
    }
  }

  // ── System builder → engine input bridge ─────────────────────────────────
  // Propagates all fields captured in the system-architecture step into their
  // corresponding EngineInputV2_3 home. Only runs when fullSurvey.systemBuilder
  // is present. Existing values on the sanitised model are never overwritten.
  const sb = sanitised.fullSurvey?.systemBuilder;
  if (sb !== undefined) {
    // Flat engine fields
    if (sanitised.currentHeatSourceType === undefined && sb.heatSource != null) {
      // storage_combi is a combi variant — map to engine's 'combi' type
      const heatSourceMap: Record<string, EngineInputV2_3['currentHeatSourceType']> = {
        combi:          'combi',
        system:         'system',
        regular:        'regular',
        storage_combi:  'combi', // storage combi is still a combi for engine purposes
      };
      sanitised.currentHeatSourceType = heatSourceMap[sb.heatSource];
    }
    if (sanitised.currentBoilerAgeYears === undefined && sb.boilerAgeYears != null) {
      sanitised.currentBoilerAgeYears = sb.boilerAgeYears;
    }

    // emitterType — map system-builder granular emitters to engine's 3-value set
    if (sanitised.emitterType === undefined && sb.emitters != null) {
      sanitised.emitterType =
        sb.emitters === 'underfloor'           ? 'ufh'       :
        sb.emitters === 'mixed'                ? 'mixed'     :
        'radiators'; // radiators_standard + radiators_designer
    }

    // systemPlanType — map control family to two-value engine enum (where possible)
    if (sanitised.systemPlanType === undefined && sb.controlFamily != null) {
      if (sb.controlFamily === 'y_plan')        sanitised.systemPlanType = 'y_plan';
      if (sb.controlFamily === 's_plan' || sb.controlFamily === 's_plan_plus') {
        sanitised.systemPlanType = 's_plan';
      }
      // combi_integral, thermal_store, unknown — no equivalent in systemPlanType
    }

    // pipingTopology — map system-builder layout to engine topology enum
    if (sanitised.pipingTopology === undefined && sb.layout != null) {
      if (sb.layout === 'two_pipe')   sanitised.pipingTopology = 'two_pipe';
      if (sb.layout === 'one_pipe')   sanitised.pipingTopology = 'one_pipe';
      if (sb.layout === 'microbore')  sanitised.pipingTopology = 'microbore';
      // manifold and unknown — no direct engine topology equivalent
    }

    // primaryPipeDiameter from system builder pipe size
    if (sanitised.primaryPipeDiameter === undefined && sb.primarySize != null && sb.primarySize !== 'unknown') {
      sanitised.primaryPipeDiameter = sb.primarySize;
    }

    // hasMagneticFilter from condition signals
    if (sanitised.hasMagneticFilter === undefined && sb.magneticFilter != null) {
      if (sb.magneticFilter === 'fitted')     sanitised.hasMagneticFilter = true;
      if (sb.magneticFilter === 'not_fitted') sanitised.hasMagneticFilter = false;
      // 'unknown' → leave hasMagneticFilter undefined
    }

    // dhwStorageType — map system-builder DHW type to engine storage type
    if (sanitised.dhwStorageType === undefined && sb.dhwType != null) {
      const dhwTypeMap: Record<string, EngineInputV2_3['dhwStorageType']> = {
        open_vented:  'vented',
        unvented:     'unvented',
        thermal_store:'thermal_store',
        plate_hex:    'none',       // combi plate HEX = no stored DHW
        small_store:  'unvented',   // storage combi integral store
      };
      const mapped = dhwTypeMap[sb.dhwType];
      if (mapped !== undefined) sanitised.dhwStorageType = mapped;
    }

    // Extended currentSystem architecture fields
    const existingCurrentSystem = sanitised.currentSystem ?? {};
    sanitised.currentSystem = {
      ...existingCurrentSystem,
      // Preserve existing boiler sub-object — do not overwrite
      boiler:            existingCurrentSystem.boiler,
      emittersType:      existingCurrentSystem.emittersType      ?? sb.emitters         ?? undefined,
      pipeLayout:        existingCurrentSystem.pipeLayout        ?? sb.layout           ?? undefined,
      controlFamily:     existingCurrentSystem.controlFamily     ?? sb.controlFamily    ?? undefined,
      thermostatStyle:   existingCurrentSystem.thermostatStyle   ?? sb.thermostatStyle  ?? undefined,
      programmerType:    existingCurrentSystem.programmerType    ?? sb.programmerType   ?? undefined,
      sedbukBand:        existingCurrentSystem.sedbukBand        ?? sb.sedbukBand       ?? undefined,
      serviceHistory:    existingCurrentSystem.serviceHistory    ?? sb.serviceHistory   ?? undefined,
      heatingSystemType: existingCurrentSystem.heatingSystemType ?? sb.heatingSystemType ?? undefined,
      pipeworkAccess:    existingCurrentSystem.pipeworkAccess    ?? sb.pipeworkAccess   ?? undefined,
      conditionSignals: existingCurrentSystem.conditionSignals ?? (
        (sb.bleedWaterColour != null || sb.radiatorPerformance != null ||
         sb.circulationIssues != null || sb.magneticFilter != null || sb.cleaningHistory != null)
          ? {
              bleedWaterColour:    sb.bleedWaterColour    ?? undefined,
              radiatorPerformance: sb.radiatorPerformance ?? undefined,
              circulationIssues:   sb.circulationIssues   ?? undefined,
              magneticFilter:      sb.magneticFilter      ?? undefined,
              cleaningHistory:     sb.cleaningHistory     ?? undefined,
            }
          : undefined
      ),
    };

    // Shower compatibility fields — bridged from system builder into flat engine
    // fields so buildShowerCompatibilityNotes (called inside the engine) receives
    // the surveyed shower data.  Existing explicit values are never overwritten.
    if (sanitised.currentShowerType === undefined && sb.currentShowerType != null) {
      sanitised.currentShowerType = sb.currentShowerType;
    }
    if (sanitised.electricShowerPresent === undefined && sb.electricShowerPresent != null) {
      sanitised.electricShowerPresent = sb.electricShowerPresent;
    }
    if (sanitised.pumpedShowerPresent === undefined && sb.pumpedShowerPresent != null) {
      sanitised.pumpedShowerPresent = sb.pumpedShowerPresent;
    }

    // Cylinder volume from system builder — bridge to cylinderVolumeLitres when
    // not already set from dhwCondition.currentCylinderVolumeLitres.
    // Only meaningful for regular and system boiler paths (which have a cylinder).
    const hasCylinderPath = sb.heatSource === 'regular' || sb.heatSource === 'system';
    if (
      hasCylinderPath &&
      sanitised.cylinderVolumeLitres === undefined &&
      sb.cylinderVolumeL != null
    ) {
      sanitised.cylinderVolumeLitres = sb.cylinderVolumeL;
    }
  }


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

  // ── System builder cylinder condition inference fallback ──────────────────
  // When fullSurvey.dhwCondition is absent but fullSurvey.systemBuilder has
  // cylinder data (ageBand, insulationType, condition), run a lightweight
  // cylinder condition inference using the system-builder observations.
  // This covers the common survey path where the surveyor records cylinder
  // details in the System Builder step rather than the DHW Condition step.
  // Only runs when cylinderInsulationFactor has not already been set above.
  // Only runs for stored hot water paths (non-combi).
  const sbForCylinder = sanitised.fullSurvey?.systemBuilder;
  const isStoredPathForSb = sanitised.currentHeatSourceType !== 'combi';
  if (
    dc === undefined &&
    isStoredPathForSb &&
    sanitised.cylinderInsulationFactor === undefined &&
    sbForCylinder !== undefined
  ) {
    const hasSbCylinder = sbForCylinder.heatSource === 'regular' || sbForCylinder.heatSource === 'system';
    if (hasSbCylinder) {
      // Map SystemBuilder cylinderInsulationType to CylinderInputs.cylinderType.
      // Most values pass through directly; only 'copper_bare' is renamed to 'copper'.
      const cylinderTypeFromSb: 'modern_factory' | 'foam_lagged' | 'copper' | 'mixergy' | 'unknown' =
        sbForCylinder.cylinderInsulationType === 'copper_bare'
          ? 'copper'
          : (sbForCylinder.cylinderInsulationType ?? 'unknown') as 'modern_factory' | 'foam_lagged' | 'mixergy' | 'unknown';

      // Map SystemBuilder cylinderAgeBand to CylinderInputs.ageBand.
      // CylinderAgeBand: 'under_5' | '5_to_10' | '10_to_15' | 'over_15' | 'unknown'
      const sbAgeBandMap: Record<string, '<5' | '5-10' | '10-20' | '20+'> = {
        under_5:    '<5',
        '5_to_10':  '5-10',
        '10_to_15': '10-20',
        over_15:    '20+',
      };
      const ageBandFromSb = sbForCylinder.cylinderAgeBand != null &&
        sbForCylinder.cylinderAgeBand !== 'unknown'
        ? sbAgeBandMap[sbForCylinder.cylinderAgeBand]
        : undefined;

      // Map SystemBuilder cylinderCondition to retentionBand.
      // CylinderCondition: 'good' | 'average' | 'poor' | 'unknown' — pass through directly.
      // ('fair' and 'bad' are not valid CylinderCondition values so no extra aliases needed.)
      const retentionBandFromSb: 'good' | 'average' | 'poor' | undefined =
        sbForCylinder.cylinderCondition === 'good'    ? 'good'    :
        sbForCylinder.cylinderCondition === 'average' ? 'average' :
        sbForCylinder.cylinderCondition === 'poor'    ? 'poor'    :
        undefined;

      const hasSbCylinderEvidence =
        cylinderTypeFromSb !== 'unknown' ||
        ageBandFromSb !== undefined ||
        retentionBandFromSb !== undefined;

      if (hasSbCylinderEvidence) {
        const normalizerResultSb = normalizeInput(sanitised);
        const waterConditionSb = {
          hardnessBand: normalizerResultSb.waterHardnessCategory as 'soft' | 'moderate' | 'hard' | 'very_hard',
          softenerPresent: sanitised.hasSoftener ?? false,
        };
        const occupancySb = sanitised.occupancyCount ?? 2;
        const bathroomCountSb = sanitised.bathroomCount ?? 1;
        const peakOutletsSb = sanitised.peakConcurrentOutlets;
        const usageConditionSb = {
          dhwUseBand: inferDhwUseBand(occupancySb, bathroomCountSb, peakOutletsSb),
          occupancy: occupancySb,
          simultaneousUseLikely: (peakOutletsSb ?? 0) >= 2,
        };

        const cylConditionSb = inferCylinderCondition(
          waterConditionSb,
          usageConditionSb,
          {
            cylinderType: cylinderTypeFromSb,
            ageBand: ageBandFromSb,
            retentionBand: retentionBandFromSb,
          },
        );

        sanitised.cylinderInsulationFactor = cylConditionSb.insulationFactor;
        sanitised.cylinderCoilTransferFactor = cylConditionSb.coilTransferFactor;
        sanitised.cylinderConditionBand = cylConditionSb.conditionBand;
      }
    }
  }

  // ── fullSurvey.heatLoss roof / solar bridge ───────────────────────────────
  // Map the heat-loss step's internal compass format and shading codes to the
  // engine root fields consumed by PvAssessmentModule and FutureEnergyOpportunitiesModule.
  // Existing explicit root values are never overwritten (explicit always wins).
  const hl = sanitised.fullSurvey?.heatLoss;
  if (hl !== undefined) {
    // roofOrientation: CompassOrientation ('N'|'NE'|…) → engine format
    if (sanitised.roofOrientation === undefined && hl.roofOrientation !== undefined) {
      const orientationMap: Record<string, EngineInputV2_3['roofOrientation']> = {
        N:       'north',
        NE:      'north',   // no north_east in engine schema — conservative
        E:       'east',
        SE:      'south_east',
        S:       'south',
        SW:      'south_west',
        W:       'west',
        NW:      'north',   // no north_west in engine schema — conservative
        unknown: 'unknown',
      };
      const mapped = orientationMap[hl.roofOrientation];
      if (mapped !== undefined) sanitised.roofOrientation = mapped;
    }

    // roofType: HeatLossState types → engine root types
    if (sanitised.roofType === undefined && hl.roofType !== undefined) {
      const roofTypeMap: Record<string, EngineInputV2_3['roofType']> = {
        pitched: 'pitched',
        flat:    'flat',
        hipped:  'pitched',   // hipped is a form of pitched roof
        dormer:  'pitched',   // dormer sits on a pitched roof
        unknown: 'unknown',
      };
      const mapped = roofTypeMap[hl.roofType];
      if (mapped !== undefined) sanitised.roofType = mapped;
    }

    // shadingLevel → solarShading
    if (sanitised.solarShading === undefined && hl.shadingLevel !== undefined) {
      const shadingMap: Record<string, EngineInputV2_3['solarShading']> = {
        little_or_none: 'low',
        some:           'medium',
        heavy:          'high',
        unknown:        'unknown',
      };
      const mapped = shadingMap[hl.shadingLevel];
      if (mapped !== undefined) sanitised.solarShading = mapped;
    }

    // pvStatus and batteryStatus have identical value sets — pass through directly
    if (sanitised.pvStatus === undefined && hl.pvStatus !== undefined) {
      sanitised.pvStatus = hl.pvStatus;
    }
    if (sanitised.batteryStatus === undefined && hl.batteryStatus !== undefined) {
      sanitised.batteryStatus = hl.batteryStatus;
    }

    // perimeterM — stored computed value from the closed shell polygon
    if (sanitised.perimeterM === undefined && hl.perimeterM !== undefined) {
      sanitised.perimeterM = hl.perimeterM;
    }

    // groundFloorAreaM2 — stored computed value from the closed shell polygon
    if (sanitised.groundFloorAreaM2 === undefined && hl.groundFloorAreaM2 !== undefined) {
      sanitised.groundFloorAreaM2 = hl.groundFloorAreaM2;
    }

    // buildingBearingDeg — numeric compass bearing from the floor-plan compass control
    if (sanitised.buildingBearingDeg === undefined && hl.buildingBearingDeg !== undefined) {
      sanitised.buildingBearingDeg = hl.buildingBearingDeg;
    }

    // ── Shell settings → building.fabric bridge ──────────────────────────
    // Map the heat-loss calculator's shell settings into the structured
    // building.fabric input that FabricModelModule consumes.
    // Existing explicit values in building.fabric are never overwritten.
    const ss = hl.shellModel?.settings;
    if (ss !== undefined) {
      // Ensure building.fabric exists before assigning sub-fields.
      if (sanitised.building === undefined) {
        sanitised.building = {};
      }
      if (sanitised.building.fabric === undefined) {
        sanitised.building.fabric = {};
      }
      const fabric = sanitised.building.fabric;

      // wallType: calculator string → FabricWallType
      if (fabric.wallType === undefined && ss.wallType !== undefined) {
        const wallTypeMap: Record<string, FabricWallType | undefined> = {
          solidBrick:        'solid_masonry',
          cavityUninsulated: 'cavity_unfilled',
          cavityPartialFill: 'cavity_filled',
          cavityFullFill:    'cavity_filled',
          timberFrame:       'timber_frame',
          solidStone:        'solid_masonry',
        };
        const mapped = wallTypeMap[ss.wallType];
        if (mapped !== undefined) fabric.wallType = mapped;
      }

      // loftInsulation → roofInsulation: FabricRoofInsulation
      if (fabric.roofInsulation === undefined && ss.loftInsulation !== undefined) {
        const roofInsulationMap: Record<string, FabricRoofInsulation | undefined> = {
          none:            'poor',
          mm100:           'moderate',
          mm200:           'good',
          mm270plus:       'good',
          // Flat-specific: a heated flat above means the ceiling loses minimal heat —
          // equivalent to well-insulated loft in terms of fabric heat loss.
          neighbourHeated: 'good',
        };
        const mapped = roofInsulationMap[ss.loftInsulation];
        if (mapped !== undefined) fabric.roofInsulation = mapped;
      }

      // glazingType → glazing: FabricGlazing
      if (fabric.glazing === undefined && ss.glazingType !== undefined) {
        const glazingMap: Record<string, FabricGlazing | undefined> = {
          single:       'single',
          doubleOld:    'double',
          doubleArated: 'double',
          triple:       'triple',
        };
        const mapped = glazingMap[ss.glazingType];
        if (mapped !== undefined) fabric.glazing = mapped;
      }

      // insulationLevel: derive from loftInsulation as a proxy for overall insulation quality.
      // Loft insulation depth is used as the primary proxy because it is the single largest
      // contributor to fabric heat loss in UK dwellings (SAP 2012 / BRE guidance).
      //   none            → 'poor'     (uninsulated loft; typically pre-1976 construction)
      //   mm100           → 'moderate' (minimum recommended pre-2003 UK building regs)
      //   mm200           → 'good'     (post-2003 UK building regs minimum, ~270 mm recommended)
      //   mm270plus       → 'good'     (current UK building regs recommended; 'exceptional' would
      //                                 require additional fabric measures beyond loft alone)
      //   neighbourHeated → 'good'     (flat-specific: heated neighbour above — ceiling heat loss
      //                                 is minimal; treated as equivalent to well-insulated loft)
      if (fabric.insulationLevel === undefined && ss.loftInsulation !== undefined) {
        const insulationLevelMap: Record<string, FabricInsulationLevel | undefined> = {
          none:            'poor',
          mm100:           'moderate',
          mm200:           'good',
          mm270plus:       'good',
          neighbourHeated: 'good',
        };
        const mapped = insulationLevelMap[ss.loftInsulation];
        if (mapped !== undefined) fabric.insulationLevel = mapped;
      }

      // thermalMass → building.thermalMass (FabricThermalMass): used by FabricModelModule
      // Note: building.thermalMass is distinct from the top-level buildingMass used by
      // LifestyleSimulationModule — both can be set independently.
      if (sanitised.building.thermalMass === undefined && ss.thermalMass !== undefined) {
        const massMap: Record<string, 'light' | 'medium' | 'heavy' | undefined> = {
          light:  'light',
          medium: 'medium',
          heavy:  'heavy',
        };
        const mapped = massMap[ss.thermalMass];
        if (mapped !== undefined) sanitised.building.thermalMass = mapped;
      }

      // buildingMass → top-level EngineInputV2_3.buildingMass used by LifestyleSimulationModule.
      // Keep in sync with the shell model thermal mass so the lifestyle simulation uses the
      // user-entered value rather than the static engine default.
      if (ss.thermalMass === 'light' || ss.thermalMass === 'medium' || ss.thermalMass === 'heavy') {
        sanitised.buildingMass = ss.thermalMass;
      }

      // dwellingType: calculator camelCase → engine snake_case
      // Propagates property form so the engine can apply flat-specific rules.
      if (sanitised.dwellingType === undefined && ss.dwellingType !== undefined) {
        const dwellingTypeMap: Record<string, EngineInputV2_3['dwellingType']> = {
          detached:     'detached',
          semi:         'semi',
          endTerrace:   'end_terrace',
          midTerrace:   'mid_terrace',
          flatGround:   'flat_ground',
          flatMid:      'flat_mid',
          flatPenthouse: 'flat_penthouse',
        };
        const mapped = dwellingTypeMap[ss.dwellingType];
        if (mapped !== undefined) sanitised.dwellingType = mapped;
      }
    }

    // ── Solar blocked for flats ───────────────────────────────────────────────
    // Flats do not have independent roof access for solar installation.
    // When the dwelling type is a flat, clear any 'planned' solar status so the
    // engine does not treat solar as a viable opportunity for this property.
    // 'existing' is preserved — communal or pre-installed solar may be present.
    const isFlat = sanitised.dwellingType === 'flat_ground' ||
                   sanitised.dwellingType === 'flat_mid' ||
                   sanitised.dwellingType === 'flat_penthouse';
    if (isFlat) {
      if (sanitised.pvStatus === 'planned') sanitised.pvStatus = 'none';
      if (sanitised.batteryStatus === 'planned') sanitised.batteryStatus = 'none';
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

    // cylinderInstallLocation → engine field of the same name
    if (sanitised.cylinderInstallLocation === undefined && dcc.cylinderInstallLocation !== undefined) {
      sanitised.cylinderInstallLocation = dcc.cylinderInstallLocation;
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

  // ── systemAgeYears → condition inference bridge ──────────────────────────
  // SystemConditionInferenceModule uses systemAgeYears as a proxy for sludge
  // risk and scale risk when direct symptom observations are absent. Wire the
  // captured boiler age into systemAgeYears so that age-based risk scaling
  // works correctly from survey data rather than always defaulting to zero.
  // Existing explicit values are never overwritten.
  if (sanitised.systemAgeYears === undefined) {
    const boilerAge = sanitised.currentSystem?.boiler?.ageYears ?? sanitised.currentBoilerAgeYears;
    if (boilerAge !== undefined) {
      sanitised.systemAgeYears = boilerAge;
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
  // Priority for daytimeOccupancy: demandTimingOverrides (explicit engine override)
  // > fullSurvey.usage.daytimeOccupancy (Usage step survey answer) > default.
  // Priority for bathUse: demandTimingOverrides.bathFrequencyPerWeek > fullSurvey.usage.bathUse > default.
  if (sanitised.householdComposition != null) {
    const dto = sanitised.demandTimingOverrides;
    const usageStep = sanitised.fullSurvey?.usage;

    // Derive daytime pattern — demandTimingOverrides takes priority; fall back to
    // the Usage step answer stored in fullSurvey.usage.daytimeOccupancy.
    const daytimePattern: DaytimeOccupancyPattern =
      dto?.daytimeOccupancy === 'full'    ? 'usually_home' :
      dto?.daytimeOccupancy === 'partial' ? 'irregular' :
      dto?.daytimeOccupancy === 'absent'  ? 'usually_out' :
      usageStep?.daytimeOccupancy === 'usually_home' ? 'usually_home' :
      usageStep?.daytimeOccupancy === 'irregular'    ? 'irregular' :
      'usually_out';

    // Derive bath use — demandTimingOverrides takes priority; fall back to the
    // Usage step answer stored in fullSurvey.usage.bathUse.
    const bathUse: BathUsePattern =
      dto?.bathFrequencyPerWeek != null
        ? (dto.bathFrequencyPerWeek >= 7 ? 'frequent' : dto.bathFrequencyPerWeek >= 2 ? 'sometimes' : 'rare')
        : usageStep?.bathUse === 'frequent'  ? 'frequent' :
          usageStep?.bathUse === 'sometimes' ? 'sometimes' :
          'rare';

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
      // Keep occupancySignature in sync with the derived preset so that
      // DemographicsAssessmentModule.deriveOccupancyTimingProfile produces the
      // correct timing label (daytime_home / away_daytime / irregular).
      // Without this, the signature stays as the survey default ('professional')
      // even when composition implies a stay-at-home or shift-worker pattern.
      sanitised.occupancySignature = presetToEngineSignature(derived.derivedPresetId);
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

  // ── Survey priorities → preferences.selectedPriorities ──────────────────
  // Populate preferences.selectedPriorities from fullSurvey.priorities.selected
  // so the recommendation engine can derive scenario-specific objective weights.
  // Existing preferences are preserved; only selectedPriorities is set when the
  // survey priorities step has been completed and selectedPriorities is not
  // already set on the model.
  const surveyPriorities = sanitised.fullSurvey?.priorities?.selected;
  if (surveyPriorities != null && surveyPriorities.length > 0) {
    if (sanitised.preferences == null) {
      sanitised.preferences = { selectedPriorities: surveyPriorities };
    } else if (sanitised.preferences.selectedPriorities == null) {
      sanitised.preferences = {
        ...sanitised.preferences,
        selectedPriorities: surveyPriorities,
      };
    }
  }

  // ── Survey priorities → future plans engine fields ────────────────────────
  // Propagate futureLoftConversion and futureAddBathroom from the Priorities
  // step into the root EngineInputV2_3 fields.  Existing explicit values are
  // never overwritten (explicit wins).
  const sp = sanitised.fullSurvey?.priorities;
  if (sp != null) {
    if (sanitised.futureLoftConversion === undefined && sp.futureLoftConversion != null) {
      sanitised.futureLoftConversion = sp.futureLoftConversion;
    }
    if (sanitised.futureAddBathroom === undefined && sp.futureAddBathroom != null) {
      sanitised.futureAddBathroom = sp.futureAddBathroom;
    }
  }

  // ── Survey disruption tolerance → preferences.disruptionTolerance ─────────
  // Map the customer's stated disruption tolerance from the Priorities step
  // into UserPreferencesV1.disruptionTolerance for the recommendation engine.
  // Existing preference values are never overwritten.
  if (sp != null && sp.disruptionTolerance !== 'unknown' && sp.disruptionTolerance != null) {
    const tolMap: Record<Exclude<typeof sp.disruptionTolerance, 'unknown'>, 'low' | 'medium' | 'high'> = {
      'minimal':       'low',
      'some_ok':       'medium',
      'open_to_major': 'high',
    };
    const mappedTol = tolMap[sp.disruptionTolerance as Exclude<typeof sp.disruptionTolerance, 'unknown'>];
    if (mappedTol !== undefined) {
      if (sanitised.preferences == null) {
        sanitised.preferences = { disruptionTolerance: mappedTol };
      } else if (sanitised.preferences.disruptionTolerance == null) {
        sanitised.preferences = {
          ...sanitised.preferences,
          disruptionTolerance: mappedTol,
        };
      }
    }
  }

  // ── Survey budget sensitivity → preferences.budgetSensitivity ─────────────
  // Map the customer's stated budget sensitivity from the Priorities step into
  // UserPreferencesV1.budgetSensitivity for the recommendation engine.
  // Existing preference values are never overwritten.
  if (sp != null && sp.budgetSensitivity != null && sp.budgetSensitivity !== 'unknown') {
    if (sanitised.preferences == null) {
      sanitised.preferences = { budgetSensitivity: sp.budgetSensitivity };
    } else if (sanitised.preferences.budgetSensitivity == null) {
      sanitised.preferences = {
        ...sanitised.preferences,
        budgetSensitivity: sp.budgetSensitivity,
      };
    }
  }

  // ── Survey heat pump interest → expertAssumptions.futureReadinessPriority ──
  // When the customer has explicitly stated interest in a heat pump in future,
  // promote expertAssumptions.futureReadinessPriority to 'high' so the
  // recommendation engine surfaces heat-pump-compatible pathways prominently.
  // Existing expert assumptions are never overwritten (surveyor judgement wins).
  if (sp?.heatPumpInterest === true && sanitised.expertAssumptions?.futureReadinessPriority == null) {
    sanitised.expertAssumptions = {
      ...sanitised.expertAssumptions,
      futureReadinessPriority: 'high',
    };
  }

  // ── Customer-reported hot-water issues → simultaneousDrawSeverity ──────────
  // When the customer reports running out of hot water or being unable to use
  // multiple outlets simultaneously, treat the draw severity as 'high'.
  // This raises the simultaneous-demand stress applied by CombiDhwModule and
  // CylinderSizingModule even when occupancy/bathroom data alone would not trigger it.
  // Existing explicit values are never overwritten.
  if (sanitised.simultaneousDrawSeverity == null && sp != null) {
    const demandIssueReported =
      sp.runsOutOfHotWater === true ||
      sp.canUseMultipleTaps === false;
    if (demandIssueReported) {
      sanitised.simultaneousDrawSeverity = 'high';
    }
  }

  // ── Customer-reported room heating issue → conditionSignals.radiatorPerformance ──
  // When the customer reports that not all rooms reach temperature (allRoomsReachTemperature
  // === false), treat this as evidence of cold-spot behaviour in the circuit.
  // This allows buildCustomerNeedResolution.detectColdSpots to surface the appropriate
  // "rooms don't heat properly" need resolution without requiring a direct surveyor observation.
  // Only applied when conditionSignals.radiatorPerformance has not already been set from
  // a direct surveyor observation (direct observation always wins).
  if (
    sp?.allRoomsReachTemperature === false &&
    sanitised.currentSystem?.conditionSignals?.radiatorPerformance == null
  ) {
    const existingCs = sanitised.currentSystem ?? {};
    sanitised.currentSystem = {
      ...existingCs,
      conditionSignals: {
        ...existingCs.conditionSignals,
        radiatorPerformance: 'some_cold_spots',
      },
    };
  }

  return sanitised;
}
