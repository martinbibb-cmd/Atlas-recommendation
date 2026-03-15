/**
 * derivePerformanceEnablers.ts
 *
 * Maps existing survey / engine-result data into a list of PerformanceEnabler
 * records.  This is a pure derivation layer — it does NOT change engine
 * calculations, recommendation outputs, or scoring.
 *
 * Five enablers are supported:
 *   1. mains_water_suitability  — hydraulic
 *   2. emitter_suitability      — emitters
 *   3. controls_quality         — controls
 *   4. system_protection        — system_health
 *   5. hot_water_fit            — dhw
 *
 * gas_supply has been removed from this list — gas-pipe validation belongs in
 * a dedicated gas-supply workflow, not the main Atlas DHW suitability output.
 *
 * All derivation rules use only data that is already present in
 * FullEngineResult or EngineInputV2_3.  No new engine calls are made.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { PerformanceEnabler } from '../../types/performance';

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * Minimum dynamic flow (L/min) for mains water to be considered adequate
 * for a combi or unvented system.
 */
const MAINS_ADEQUATE_FLOW_LPM = 10;

/**
 * Design flow temperature (°C) above which emitter suitability is treated as
 * a warning: if the system needs this high a flow temp, some radiators may
 * need upgrading for the boiler to condense efficiently.
 */
const HIGH_FLOW_TEMP_WARNING_C = 65;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return true when the primary recommendation string indicates a heat-pump
 * system (i.e. a gas supply is not required).
 */
function isHeatPumpRecommendation(primary: string): boolean {
  return /heat pump|ashp|gshp/i.test(primary);
}

// ─── Individual enabler derivations ──────────────────────────────────────────

function deriveMainsWaterSuitability(result: FullEngineResult): PerformanceEnabler {
  const cws = result.cwsSupplyV1;

  if (!cws.hasMeasurements) {
    return {
      id: 'mains_water_suitability',
      label: 'Mains water suitability',
      status: 'missing',
      detail: 'Mains flow rate has not been confirmed.',
      category: 'hydraulic',
    };
  }

  if (cws.waterConfidence === 'suspect') {
    return {
      id: 'mains_water_suitability',
      label: 'Mains water suitability',
      status: 'warning',
      detail: 'Mains readings look inconsistent — check instrument or units.',
      category: 'hydraulic',
    };
  }

  const flowLpm = cws.dynamic?.flowLpm;

  if (cws.meetsUnventedRequirement) {
    return {
      id: 'mains_water_suitability',
      label: 'Mains water suitability',
      status: 'ok',
      detail: 'Mains flow confirmed adequate for the selected system.',
      category: 'hydraulic',
    };
  }

  if (cws.limitation === 'flow' || (flowLpm !== undefined && flowLpm < MAINS_ADEQUATE_FLOW_LPM)) {
    return {
      id: 'mains_water_suitability',
      label: 'Mains water suitability',
      status: 'warning',
      detail: 'Mains flow may be insufficient — stored hot water may be more reliable.',
      category: 'hydraulic',
    };
  }

  if (cws.limitation === 'pressure') {
    return {
      id: 'mains_water_suitability',
      label: 'Mains water suitability',
      status: 'warning',
      detail: 'Mains pressure may limit unvented system performance.',
      category: 'hydraulic',
    };
  }

  // Flow is measured but limitation is 'none' or 'unknown' and unvented gate not met
  return {
    id: 'mains_water_suitability',
    label: 'Mains water suitability',
    status: 'warning',
    detail: 'Mains supply measured but may not fully meet system requirements.',
    category: 'hydraulic',
  };
}

function deriveEmitterSuitability(result: FullEngineResult): PerformanceEnabler {
  const { systemOptimization, heatPumpRegime } = result;
  const primary = result.engineOutput.recommendation.primary;

  // Heat pump: use heatPumpRegime flow temp band as the signal.
  if (isHeatPumpRecommendation(primary)) {
    const band = heatPumpRegime.designFlowTempBand;
    if (band === 35) {
      return {
        id: 'emitter_suitability',
        label: 'Emitter suitability',
        status: 'ok',
        detail: 'Emitters suit low-temperature operation — heat pump will perform well.',
        category: 'emitters',
      };
    }
    if (band === 45) {
      return {
        id: 'emitter_suitability',
        label: 'Emitter suitability',
        status: 'warning',
        detail: 'Partial emitter upgrades recommended to achieve target flow temperature.',
        category: 'emitters',
      };
    }
    // band === 50
    return {
      id: 'emitter_suitability',
      label: 'Emitter suitability',
      status: 'warning',
      detail: 'Higher flow temperature likely required — consider emitter upgrades.',
      category: 'emitters',
    };
  }

  // Boiler / combi: use systemOptimization design flow temp.
  const designFlowTempC = systemOptimization.designFlowTempC;

  if (designFlowTempC >= HIGH_FLOW_TEMP_WARNING_C) {
    return {
      id: 'emitter_suitability',
      label: 'Emitter suitability',
      status: 'warning',
      detail: `Design flow temperature is ${designFlowTempC} °C — radiators may need upgrading for efficient condensing operation.`,
      category: 'emitters',
    };
  }

  if (systemOptimization.condensingModeAvailable) {
    return {
      id: 'emitter_suitability',
      label: 'Emitter suitability',
      status: 'ok',
      detail: 'Emitters support condensing operation at the target flow temperature.',
      category: 'emitters',
    };
  }

  return {
    id: 'emitter_suitability',
    label: 'Emitter suitability',
    status: 'warning',
    detail: 'Condensing mode may not be achievable — check radiator sizing and flow temperature.',
    category: 'emitters',
  };
}

function deriveControlsQuality(result: FullEngineResult): PerformanceEnabler {
  const policy = result.systemOptimization.installationPolicy;

  if (policy === 'full_job') {
    return {
      id: 'controls_quality',
      label: 'Controls quality',
      status: 'ok',
      detail: 'Full installation with upgraded controls — system will operate at best efficiency.',
      category: 'controls',
    };
  }

  if (policy === 'high_temp_retrofit') {
    return {
      id: 'controls_quality',
      label: 'Controls quality',
      status: 'warning',
      detail: 'High-temperature retrofit: upgrading controls would improve efficiency and comfort.',
      category: 'controls',
    };
  }

  // Policy unknown or not provided
  return {
    id: 'controls_quality',
    label: 'Controls quality',
    status: 'missing',
    detail: 'Controls specification not confirmed.',
    category: 'controls',
  };
}

function deriveSystemProtection(
  result: FullEngineResult,
  input?: EngineInputV2_3,
): PerformanceEnabler {
  // hasMagneticFilter is an input field (optional boolean).
  // Use input directly when available; fall back to sludge penalty as a proxy.
  const hasMagneticFilter = input?.hasMagneticFilter;

  if (hasMagneticFilter === true) {
    return {
      id: 'system_protection',
      label: 'System protection',
      status: 'ok',
      detail: 'Magnetic / laminar filtration recorded.',
      category: 'system_health',
    };
  }

  if (hasMagneticFilter === false) {
    return {
      id: 'system_protection',
      label: 'System protection',
      status: 'warning',
      detail: 'No magnetic / laminar filtration recorded — recommend fitting a filter.',
      category: 'system_health',
    };
  }

  // Input not supplied — use sludge penalty as a proxy signal.
  const { flowDeratePct, cyclingLossPct } = result.sludgeVsScale;
  if (flowDeratePct > 0 || cyclingLossPct > 0) {
    // Engine computed a sludge penalty, which implies no filter is fitted.
    return {
      id: 'system_protection',
      label: 'System protection',
      status: 'warning',
      detail: 'No magnetic / laminar filtration recorded — recommend fitting a filter.',
      category: 'system_health',
    };
  }

  return {
    id: 'system_protection',
    label: 'System protection',
    status: 'missing',
    detail: 'System protection (magnetic / laminar filter) not confirmed.',
    category: 'system_health',
  };
}

function deriveHotWaterFit(
  result: FullEngineResult,
  input?: EngineInputV2_3,
): PerformanceEnabler {
  const hasOccupancy = input?.occupancyCount != null;
  const hasBathrooms = input?.bathroomCount != null;

  if (!hasOccupancy || !hasBathrooms) {
    return {
      id: 'hot_water_fit',
      label: 'Hot water suitability',
      status: 'missing',
      detail: 'Occupancy or bathroom data missing — hot water fit cannot be confirmed.',
      category: 'dhw',
    };
  }

  const primary = result.engineOutput.recommendation.primary.toLowerCase();
  const isStoredOrMixergy = /stored|mixergy|cylinder|system boiler/i.test(primary);
  const isCombi = /combi/i.test(primary) && !isStoredOrMixergy;

  if (isCombi) {
    const combiRisk = result.combiDhwV1.verdict.combiRisk;
    if (combiRisk === 'fail') {
      return {
        id: 'hot_water_fit',
        label: 'Hot water suitability',
        status: 'warning',
        detail: 'Combi may struggle with simultaneous demand — consider stored hot water.',
        category: 'dhw',
      };
    }
    if (combiRisk === 'warn') {
      return {
        id: 'hot_water_fit',
        label: 'Hot water suitability',
        status: 'warning',
        detail: 'Combi may experience reduced flow under concurrent demand.',
        category: 'dhw',
      };
    }
    return {
      id: 'hot_water_fit',
      label: 'Hot water suitability',
      status: 'ok',
      detail: 'Combi suits occupancy and usage profile.',
      category: 'dhw',
    };
  }

  if (isStoredOrMixergy) {
    const storedRisk = result.storedDhwV1.verdict.storedRisk;
    if (storedRisk === 'warn') {
      return {
        id: 'hot_water_fit',
        label: 'Hot water suitability',
        status: 'warning',
        detail: 'Stored system has sizing or space concerns — review cylinder selection.',
        category: 'dhw',
      };
    }
    return {
      id: 'hot_water_fit',
      label: 'Hot water suitability',
      status: 'ok',
      detail: 'Stored hot water arrangement suits occupancy and usage profile.',
      category: 'dhw',
    };
  }

  // Recommendation is not clearly combi or stored — derive from module verdicts.
  const combiRisk = result.combiDhwV1.verdict.combiRisk;
  const storedRisk = result.storedDhwV1.verdict.storedRisk;
  if (combiRisk === 'fail' && storedRisk === 'pass') {
    return {
      id: 'hot_water_fit',
      label: 'Hot water suitability',
      status: 'ok',
      detail: 'Stored hot water arrangement suits occupancy and usage profile.',
      category: 'dhw',
    };
  }
  if (combiRisk !== 'fail' && storedRisk === 'warn') {
    return {
      id: 'hot_water_fit',
      label: 'Hot water suitability',
      status: 'warning',
      detail: 'Hot water arrangement may have sizing or comfort limitations.',
      category: 'dhw',
    };
  }

  return {
    id: 'hot_water_fit',
    label: 'Hot water suitability',
    status: 'ok',
    detail: 'Hot water arrangement appears suitable for confirmed occupancy.',
    category: 'dhw',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive a list of PerformanceEnabler records from current engine result and
 * optional survey input.
 *
 * This function is pure — it does not mutate its arguments and makes no
 * external calls.  It is safe to call on every render.
 *
 * @param result  Full engine result (required).
 * @param input   Original engine input / survey model (optional but improves
 *                derivation quality for hasMagneticFilter, occupancyCount, etc.)
 */
export function derivePerformanceEnablers(
  result: FullEngineResult,
  input?: EngineInputV2_3,
): PerformanceEnabler[] {
  return [
    deriveMainsWaterSuitability(result),
    deriveEmitterSuitability(result),
    deriveControlsQuality(result),
    deriveSystemProtection(result, input),
    deriveHotWaterFit(result, input),
  ];
}
