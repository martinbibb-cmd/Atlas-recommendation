/**
 * buildSuggestedImplementationPack.ts — Deterministic generator for the
 * Suggested Implementation Pack.
 *
 * Purpose:
 *   Translate recommendation → implementation intent for surveyor/engineer use.
 *
 * Architecture:
 *   AtlasDecisionV1 + CustomerSummaryV1 + EngineOutputV1 + EngineInputV2_3Contract
 *     → [this function] → SuggestedImplementationPackV1
 *
 * Design rules:
 *   1. All output derives from supplied inputs — no invented facts.
 *   2. No new recommendation logic — only projection and intent derivation.
 *   3. No customer-facing language (no benefit framing, no value claims).
 *   4. Deterministic — same inputs always produce same output.
 *   5. Qualifications are separated from customer value at the type level.
 *   6. Unresolved risks must always surface; they must never be suppressed.
 *   7. NOT customer-facing. NOT quote pricing. NOT compliance pass/fail.
 *      NOT final engineering design.
 */

import type { AtlasDecisionV1 } from '../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../contracts/EngineOutputV1';
import type { EngineInputV2_3Contract } from '../contracts/EngineInputV2_3';
import type {
  SuggestedImplementationPackV1,
  HeatSourceSection,
  HotWaterSection,
  HydraulicComponentsSection,
  ControlsSection,
  WaterQualitySection,
  SafetyComplianceSection,
  PipeworkSection,
  CommissioningSection,
  FutureReadySection,
  SuggestedComponent,
  UnresolvedRisk,
  RequiredQualification,
  RequiredComplianceItem,
  RequiredValidation,
} from './SuggestedImplementationPackV1';

// ─── Scan data (optional) ─────────────────────────────────────────────────────

/**
 * Minimal scan data interface — wraps any available capture from a site visit.
 * All fields are optional; the pack generates conservatively when data is absent.
 */
export interface ScanDataInput {
  /** Whether a loft inspection was completed during the visit. */
  loftInspected?: boolean;
  /** Whether a boiler flue inspection was completed. */
  flueInspected?: boolean;
  /** Whether the primary pipework was traced / inspected. */
  pipeworkInspected?: boolean;
  /** Engineer notes from the site visit (free-form). */
  engineerNotes?: string;
}

// ─── Build input ──────────────────────────────────────────────────────────────

export interface BuildImplementationPackInput {
  atlasDecision: AtlasDecisionV1;
  customerSummary: CustomerSummaryV1;
  engineOutput: EngineOutputV1;
  surveyInput: EngineInputV2_3Contract;
  scanData?: ScanDataInput;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deduplicates an array of objects by a key field, preserving first occurrence. */
function deduplicateById<T extends { readonly id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Collects all UnresolvedRisk items from sections into a flat deduplicated list. */
function collectRisks(sections: Array<{ unresolvedRisks: readonly UnresolvedRisk[] }>): readonly UnresolvedRisk[] {
  return deduplicateById(sections.flatMap((s) => s.unresolvedRisks));
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHeatSourceSection(
  input: BuildImplementationPackInput,
): HeatSourceSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;

  // Derive recommended family from scenarioId
  let recommendedFamily = 'gas_system_boiler';
  let label = 'Gas system boiler';

  if (scenarioId === 'combi') {
    recommendedFamily = 'gas_combi_boiler';
    label = 'Gas combi boiler';
  } else if (scenarioId === 'ashp' || scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    recommendedFamily = 'ashp';
    label = 'Air source heat pump';
  } else if (scenarioId.includes('regular')) {
    recommendedFamily = 'gas_regular_boiler';
    label = 'Gas regular (heat-only) boiler';
  }

  const peakHeatLossKw = surveyInput.property.peakHeatLossKw;
  const pipeSizeMm = surveyInput.infrastructure.primaryPipeSizeMm;

  const components: SuggestedComponent[] = [];
  const sizingRationale: string[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // Boiler sizing guidance from peak heat loss
  if (peakHeatLossKw > 0) {
    // Apply a 10 % uplift to account for DHW simultaneous demand and
    // distribution losses — standard sizing margin
    const minKw = Math.ceil(peakHeatLossKw * 1.1);

    if (recommendedFamily === 'ashp') {
      components.push({
        id: 'ashp_unit',
        description: 'Air source heat pump (outdoor unit + cylinder)',
        suggestedSpec: `Minimum ${minKw} kW output at design outdoor temperature (typically −3 °C UK)`,
        rationale: `Peak heat loss ${peakHeatLossKw} kW — 10 % sizing margin applied for distribution losses`,
        confidence: 'suggested',
      });
      sizingRationale.push(
        `Peak heat loss: ${peakHeatLossKw} kW`,
        `Suggested minimum heat pump output: ${minKw} kW at design conditions`,
        'Flow temperature target: ≤55 °C for adequate condensing-regime operation',
      );
      installNotes.push(
        'Confirm emitter sizing supports target flow temperature — radiator review required before specifying heat pump output',
        'Assess outdoor unit location for adequate airflow clearance and noise compliance',
        'Confirm condensate and defrost drainage route from outdoor unit',
      );
    } else {
      components.push({
        id: 'replacement_boiler',
        description: label,
        suggestedSpec: `${minKw}–${Math.ceil(peakHeatLossKw * 1.25)} kW range — confirm against measured heat loss`,
        rationale: `Peak heat loss ${peakHeatLossKw} kW — sizing band includes 10–25 % margin for DHW uplift and distribution losses`,
        confidence: 'suggested',
      });
      sizingRationale.push(
        `Peak heat loss: ${peakHeatLossKw} kW`,
        `Suggested boiler output range: ${minKw}–${Math.ceil(peakHeatLossKw * 1.25)} kW`,
        'Final sizing must be confirmed by the installing engineer against measured or confirmed heat loss',
      );
    }
  } else {
    unresolvedRisks.push({
      id: 'heat_loss_not_confirmed',
      description: 'Peak heat loss not confirmed from survey data',
      resolution: 'Carry out heat loss calculation or take measurements on site to determine correct boiler/heat pump output',
      severity: 'required',
    });
  }

  if (pipeSizeMm === 15) {
    unresolvedRisks.push({
      id: 'microbore_primary',
      description: '15 mm primary pipework detected — may limit achievable flow rate',
      resolution: 'Verify primary pipe bore on site; assess whether upsizing to 22 mm is required for the specified heat output',
      severity: 'advisory',
    });
  }

  if (recommendedFamily === 'ashp') {
    unresolvedRisks.push({
      id: 'emitter_review_required',
      description: 'Emitter suitability for heat pump flow temperatures has not been confirmed',
      resolution: 'Carry out radiator sizing review against target flow temperature (typically 45–55 °C) before final system selection',
      severity: 'required',
    });
  }

  return {
    recommendedFamily,
    label,
    suggestedComponents: components,
    sizingRationale,
    installNotes,
    unresolvedRisks,
  };
}

function buildHotWaterSection(
  input: BuildImplementationPackInput,
): HotWaterSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const dhwArch = surveyInput.dhw.architecture;

  // Determine DHW strategy from scenario and architecture
  let strategy: HotWaterSection['strategy'] = 'unknown';

  if (scenarioId === 'combi') {
    strategy = 'on_demand';
  } else if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    // Heat pump scenarios always use a dedicated cylinder regardless of dhwArch
    strategy = 'heat_pump_cylinder';
  } else if (dhwArch === 'stored_mixergy') {
    strategy = 'stored_mixergy';
  } else if (dhwArch === 'stored_standard') {
    strategy = 'stored_unvented';
  } else if (scenarioId.includes('vented') && !scenarioId.includes('unvented')) {
    strategy = 'stored_vented';
  } else if (scenarioId.includes('unvented') || scenarioId.includes('system') || scenarioId.includes('regular')) {
    strategy = 'stored_unvented';
  } else if (dhwArch === 'on_demand') {
    strategy = 'on_demand';
  }

  const components: SuggestedComponent[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];
  let expansionManagement: string[] | undefined;
  let dischargeRequirements: string[] | undefined;

  const peakConcurrentOutlets = surveyInput.occupancy.peakConcurrentOutlets;

  // Cylinder sizing guidance — use peakConcurrentOutlets as a proxy for household demand
  if (strategy === 'stored_unvented' || strategy === 'stored_mixergy' || strategy === 'heat_pump_cylinder') {
    let minVolumeL = 150;
    let specNote = '150–180 L';

    if (peakConcurrentOutlets >= 3) {
        minVolumeL = 210;
        specNote = '210–250 L (3+ peak concurrent outlets)';
      } else if (peakConcurrentOutlets === 2) {
        minVolumeL = 180;
        specNote = '180–210 L (2 peak concurrent outlets)';
      } else {
        minVolumeL = 150;
        specNote = '150–180 L (1 peak concurrent outlet)';
      }

    if (strategy === 'stored_mixergy') {
      components.push({
        id: 'mixergy_cylinder',
        description: 'Mixergy top-down stratification cylinder',
        suggestedSpec: `${specNote} — minimum ${minVolumeL} L`,
        rationale: 'Mixergy specified — demand mirroring reduces cycling penalties vs standard combi; confirm stratification probe and smart controller wiring',
        confidence: 'required',
      });
      installNotes.push(
        'Confirm stratification probe wiring and smart controller commissioning procedure',
        'Mixergy cylinder cycling penalty is reduced compared to standard combi — document this in handover notes',
        'Confirm Wi-Fi or Ethernet connectivity for smart controller at cylinder location',
      );
    } else if (strategy === 'heat_pump_cylinder') {
      components.push({
        id: 'heat_pump_cylinder',
        description: 'Dedicated heat pump hot water cylinder',
        suggestedSpec: `${specNote} — minimum ${minVolumeL} L; cylinder rated for heat pump flow temperatures (≤55 °C)`,
        rationale: 'ASHP system — larger cylinder volume required to compensate for lower charge temperature and recovery rate',
        confidence: 'required',
      });
      installNotes.push(
        'Confirm cylinder rated for heat pump primary temperatures (typically ≤55 °C)',
        'Verify legionella protection cycle capability — periodic high-temperature pasteurisation required',
        'Anti-legionella periodic boost cycle must be programmed at commissioning',
      );
    } else {
      components.push({
        id: 'unvented_cylinder',
        description: 'Unvented (mains-fed) hot water cylinder',
        suggestedSpec: `${specNote} — minimum ${minVolumeL} L`,
        rationale: 'Mains-pressure storage specified — provides mains-fed supply to all outlets simultaneously',
        confidence: 'required',
      });
    }

    // Expansion management — required for all sealed/unvented cylinders
    expansionManagement = [
      'Expansion vessel sized to manufacturer specification for cylinder volume',
      'Pressure reducing valve (PRV) set to ≤3.0 bar inlet — confirm site pressure before specifying PRV setting',
      'Expansion relief valve (ERV) required — confirm discharge temperature rating to BS EN 1490',
      'Temperature and pressure relief valve (T&P valve) required — confirm port size and discharge capacity',
    ];

    // Discharge/tundish requirements
    dischargeRequirements = [
      'Tundish required between T&P valve and discharge pipe — confirm visible and accessible location',
      'Discharge pipe must terminate safely to external drain or suitable trapped gully',
      'Minimum 22 mm discharge pipe from T&P valve to tundish; 28 mm from tundish to discharge point',
      'Discharge pipe gradient: minimum 1:200 continuously falling to termination point',
      'No valves permitted in discharge pipework',
    ];

    installNotes.push(
      'G3-qualified installer required for all unvented cylinder work',
      'Building Control notification required before commencement of unvented cylinder installation',
      'Commissioning checklist must be completed and retained on site',
    );
  } else if (strategy === 'stored_vented') {
    components.push({
      id: 'vented_cylinder',
      description: 'Open-vented (tank-fed) hot water cylinder',
      suggestedSpec: '120–180 L depending on occupancy',
      rationale: 'Open-vented strategy specified — gravity-fed from cold water storage cistern in loft',
      confidence: 'required',
    });
    components.push({
      id: 'cold_water_storage_cistern',
      description: 'Cold water storage cistern (loft)',
      suggestedSpec: 'Minimum 120 L nominal capacity — confirm existing cistern capacity',
      rationale: 'Open-vented system requires adequate loft storage capacity',
      confidence: 'suggested',
    });

    unresolvedRisks.push({
      id: 'loft_cistern_condition',
      description: 'Loft cold water storage cistern condition and capacity not confirmed',
      resolution: 'Inspect cistern on site — confirm capacity, lid, insulation, and overflow condition',
      severity: 'required',
    });
  } else if (strategy === 'on_demand') {
    // Combi — no cylinder
    installNotes.push('On-demand hot water — no cylinder or storage required');
    installNotes.push('Confirm incoming cold water supply temperature and flow rate are sufficient for combi DHW output');
  }

  if (strategy === 'unknown') {
    unresolvedRisks.push({
      id: 'dhw_strategy_unclear',
      description: 'DHW strategy could not be determined from available survey data',
      resolution: 'Confirm DHW strategy with surveyor before proceeding to specification',
      severity: 'required',
    });
  }

  return {
    strategy,
    suggestedComponents: components,
    ...(expansionManagement !== undefined ? { expansionManagement } : {}),
    ...(dischargeRequirements !== undefined ? { dischargeRequirements } : {}),
    installNotes,
    unresolvedRisks,
  };
}

function buildHydraulicComponentsSection(
  input: BuildImplementationPackInput,
): HydraulicComponentsSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const pipeSizeMm = surveyInput.infrastructure.primaryPipeSizeMm;
  const peakHeatLossKw = surveyInput.property.peakHeatLossKw;

  const components: SuggestedComponent[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // Pump
  components.push({
    id: 'circulating_pump',
    description: 'Circulating pump (central heating primary circuit)',
    suggestedSpec: pipeSizeMm >= 22 ? 'A-rated variable-speed pump — size to system resistance' : 'Standard pump — assess if variable speed is viable given 15 mm primary bore',
    rationale: 'All wet-system heating circuits require a suitable pump rated to the system resistance',
    confidence: 'required',
  });

  // Zone valves — system/regular boiler with cylinder
  if (
    scenarioId !== 'combi' &&
    !scenarioId.includes('ashp') &&
    !scenarioId.includes('heat_pump')
  ) {
    components.push({
      id: 'motorised_zone_valves',
      description: 'Motorised zone valves (2-port)',
      suggestedSpec: '22 mm or 28 mm (match primary pipe size) — one valve for CH zone, one for DHW',
      rationale: 'System/regular boiler with cylinder requires zone valves for independent CH and DHW control',
      confidence: 'required',
    });
  }

  // Bypass for TRV systems
  components.push({
    id: 'automatic_bypass_valve',
    description: 'Automatic bypass valve',
    suggestedSpec: '15 mm or 22 mm — to be positioned to protect pump minimum flow',
    rationale: 'Required whenever TRVs are fitted to most or all radiators to prevent pump deadhead',
    confidence: 'required',
  });

  // Filling loop — required for all sealed heating circuits
  components.push({
    id: 'filling_loop',
    description: 'Sealed system filling loop (temporary double check valve type)',
    suggestedSpec: 'Disconnectable type to Water Regulations requirements',
    rationale: 'Sealed central heating circuit requires filling loop for initial fill and pressure top-up',
    confidence: 'required',
  });

  // Buffer / low-loss header for ASHP
  if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    components.push({
      id: 'low_loss_header_or_buffer',
      description: 'Low-loss header or buffer vessel',
      suggestedSpec: 'To heat pump manufacturer specification — confirm hydraulic separation requirement',
      rationale: 'Many ASHP manufacturers require hydraulic separation between primary and secondary circuits',
      confidence: 'if_applicable',
    });
    unresolvedRisks.push({
      id: 'hydraulic_separation_review',
      description: 'Hydraulic separation requirement (low-loss header or buffer vessel) not confirmed for specified heat pump',
      resolution: 'Check manufacturer installation requirements — some models mandate hydraulic separation; others allow direct pipework',
      severity: 'required',
    });
  }

  if (peakHeatLossKw > 0) {
    installNotes.push(
      `Size circulating pump against calculated system resistance — do not rely on boiler-integrated pump if peak heat loss exceeds 12 kW`,
    );
  }

  installNotes.push(
    'Confirm expansion vessel charge pressure matches static fill height of system',
    'Pressure gauge to be fitted in accessible location for post-installation verification',
  );

  return {
    suggestedComponents: components,
    installNotes,
    unresolvedRisks,
  };
}

function buildControlsSection(
  input: BuildImplementationPackInput,
): ControlsSection {
  const { atlasDecision } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;

  const components: SuggestedComponent[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // Room thermostat
  components.push({
    id: 'room_thermostat',
    description: 'Room thermostat (wireless preferred)',
    suggestedSpec: 'Boiler-interlock capable — must prevent boiler firing when no heat demand',
    rationale: 'Building Regulations Part L requires boiler interlock — room thermostat provides this',
    confidence: 'required',
  });

  // Programmer / scheduler
  components.push({
    id: 'programmer',
    description: 'Time programmer or smart controller',
    suggestedSpec: 'Separate CH and DHW time control where stored hot water is fitted',
    rationale: 'Independent time control for heating and DHW circuits is required for efficiency and Part L compliance',
    confidence: 'required',
  });

  // TRVs
  components.push({
    id: 'trvs',
    description: 'Thermostatic radiator valves (TRVs)',
    suggestedSpec: 'Fit to all radiators except the room where the room thermostat is located',
    rationale: 'Part L requirement — TRVs provide zone-level temperature control',
    confidence: 'required',
  });

  // System boiler cylinder thermostat
  if (
    scenarioId !== 'combi' &&
    !scenarioId.includes('ashp') &&
    !scenarioId.includes('heat_pump')
  ) {
    components.push({
      id: 'cylinder_thermostat',
      description: 'Cylinder thermostat',
      suggestedSpec: 'Immersion-type — set to 60–65 °C for legionella protection (unvented) or 60 °C (vented)',
      rationale: 'Required for stored hot water systems — controls cylinder reheat and prevents overheating',
      confidence: 'required',
    });
  }

  installNotes.push(
    'Confirm boiler interlock wiring is complete — boiler must not fire when no zone demand is present',
    'Smart controls are acceptable as a programmer replacement if they provide equivalent time/temperature control',
    'Confirm programmer or smart control is positioned where it will not be influenced by direct solar gain',
  );

  if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    components.push({
      id: 'weather_compensation_controller',
      description: 'Weather compensation controller',
      suggestedSpec: 'Compatible with heat pump manufacturer — enables modulation of flow temperature with outdoor conditions',
      rationale: 'Weather compensation substantially improves ASHP seasonal efficiency (SCOP) and is required for MCS/BUS certification in many cases',
      confidence: 'suggested',
    });
    installNotes.push(
      'Confirm weather compensation controller is compatible with specified heat pump model',
      'MCS certification requirements for heat pump controls — review installer documentation before commissioning',
    );
  }

  return {
    suggestedComponents: components,
    installNotes,
    unresolvedRisks,
  };
}

function buildWaterQualitySection(
  input: BuildImplementationPackInput,
): WaterQualitySection {
  const { atlasDecision } = input;
  const lifecycle = atlasDecision.lifecycle;

  const components: SuggestedComponent[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // System age drives flush recommendation
  const systemAgeYears = lifecycle.currentSystem.ageYears ?? 0;
  const systemCondition = lifecycle.currentSystem.condition;

  let flushStrategy: string | undefined;
  const filterRecommendation = 'Magnetic filter on primary return — fit upstream of boiler/heat pump primary return connection';
  const inhibitorRecommendation = 'Dose with corrosion inhibitor to BS 7593 specification at commissioning — record dosage and product in the system logbook';
  let scaleManagement: string | undefined;

  // Filter — recommended for all wet systems
  components.push({
    id: 'magnetic_filter',
    description: 'Magnetic system filter',
    suggestedSpec: 'Sized for primary pipe diameter — fit on primary return before boiler/heat pump',
    rationale: 'Removes magnetite and particulate from primary circuit — protects heat exchanger and pump',
    confidence: 'required',
  });

  // Flush strategy
  if (systemAgeYears >= 10 || systemCondition === 'worn' || systemCondition === 'at_risk') {
    flushStrategy = `Power flush recommended — system aged ${systemAgeYears > 0 ? systemAgeYears + ' years' : '(age unconfirmed)'}, condition: ${systemCondition ?? 'unknown'}. Chemical clean and flush to BS 7593 before new components are connected.`;
    components.push({
      id: 'power_flush',
      description: 'Power flush (or chemical clean)',
      suggestedSpec: 'Full primary circuit flush to BS 7593 — include all radiators and primary pipe runs',
      rationale: `System condition (${systemCondition ?? 'unknown'}) and age indicate flush is required before new boiler/heat pump connection to prevent contamination of new heat exchanger`,
      confidence: 'required',
    });
  } else {
    flushStrategy = 'Chemical flush of primary circuit to BS 7593 recommended before connecting new boiler — confirm cleanliness of system on site';
    components.push({
      id: 'chemical_flush',
      description: 'Chemical flush of primary circuit',
      suggestedSpec: 'To BS 7593 specification — dose, circulate, drain, refill',
      rationale: 'Good practice before any boiler replacement to remove residual corrosion products and oils',
      confidence: 'suggested',
    });
  }

  // Inhibitor
  components.push({
    id: 'inhibitor',
    description: 'Corrosion inhibitor dosage',
    suggestedSpec: 'To BS 7593 — full dose for total system volume; record in system logbook',
    rationale: 'Required to protect primary circuit components (heat exchanger, pump, valves) from corrosion',
    confidence: 'required',
  });

  // Scale management — derive from lifecycle influencing factors if present
  const waterQuality = lifecycle.influencingFactors?.waterQuality;
  if (waterQuality === 'hard' || waterQuality === 'moderate') {
    scaleManagement = `Water hardness noted as ${waterQuality} — consider scale reducer/softener on cold water inlet to cylinder or boiler to protect heat exchanger and cylinder immersion elements`;
    components.push({
      id: 'scale_reducer',
      description: 'Limescale reducer or inhibitor dosing pot',
      suggestedSpec: 'Polyphosphate or electrolytic type — size to flow rate; fit on cold water inlet',
      rationale: `Hard water area — limescale build-up on heat exchanger reduces efficiency and increases failure risk`,
      confidence: 'suggested',
    });
  } else if (!waterQuality || waterQuality === 'unknown') {
    unresolvedRisks.push({
      id: 'water_hardness_unknown',
      description: 'Water hardness not confirmed for this property',
      resolution: 'Check local water hardness on site or via Water Quality report; assess need for scale reducer',
      severity: 'advisory',
    });
  }

  installNotes.push(
    'Record inhibitor product name, concentration, and dosage in the system logbook at commissioning',
    'Confirm magnetic filter is accessible for annual service inspection',
    'Take water sample prior to flush and after refill — check pH and TDS where scale risk is elevated',
  );

  return {
    filterRecommendation,
    flushStrategy,
    inhibitorRecommendation,
    ...(scaleManagement !== undefined ? { scaleManagement } : {}),
    suggestedComponents: components,
    installNotes,
    unresolvedRisks,
  };
}

function buildSafetyComplianceSection(
  input: BuildImplementationPackInput,
): SafetyComplianceSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const dhwArch = surveyInput.dhw.architecture;

  const qualifications: RequiredQualification[] = [];
  const complianceItems: RequiredComplianceItem[] = [];
  const installNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // Gas Safe — always required for gas boiler work
  const isGasBased =
    !scenarioId.includes('ashp') && !scenarioId.includes('heat_pump');

  if (isGasBased) {
    qualifications.push({
      id: 'gas_safe',
      label: 'Gas Safe Registered Engineer',
      triggeredBy: 'Any gas appliance installation, modification, or commissioning',
      reference: 'Gas Safety (Installation and Use) Regulations 1998',
    });
    complianceItems.push({
      id: 'gas_safe_notification',
      description: 'Gas Safe registration — installer must be current Gas Safe registered for the appliance category',
      regulatoryRef: 'Gas Safety (Installation and Use) Regulations 1998',
      timing: 'before',
    });
  }

  // G3 — unvented cylinder
  const isUnvented =
    dhwArch === 'stored_standard' ||
    dhwArch === 'stored_mixergy' ||
    scenarioId.includes('unvented') ||
    scenarioId.includes('system') ||
    (scenarioId.includes('regular') && !scenarioId.includes('vented'));

  if (isUnvented && scenarioId !== 'combi') {
    qualifications.push({
      id: 'g3_unvented',
      label: 'G3 Unvented Hot Water Installer',
      triggeredBy: 'Unvented (mains-fed) cylinder installation and commissioning',
      reference: 'Building Regulations Part G3 (England & Wales)',
    });
    complianceItems.push({
      id: 'building_control_g3',
      description: 'Building Control notification for unvented cylinder installation — notify before work commences',
      regulatoryRef: 'Building Regulations Part G3 (England & Wales) / Building Standards (Scotland) Part P',
      timing: 'before',
    });
    complianceItems.push({
      id: 'g3_commissioning_certificate',
      description: 'G3 commissioning certificate issued at completion — retain on site',
      regulatoryRef: 'Building Regulations Part G3',
      timing: 'after',
    });

    installNotes.push(
      'Unvented cylinder: confirm G3 installer status before commencement',
      'Building Control notification must be in place before installation starts',
      'G3 commissioning checklist to be completed and certificate issued at handover',
    );
  }

  // Open-vented (loft tank removal)
  if (scenarioId.includes('vented') && !scenarioId.includes('unvented')) {
    complianceItems.push({
      id: 'loft_tank_disposal',
      description: 'Cold water storage cistern removal and disposal — notify relevant trade waste contractor if applicable',
      timing: 'during',
    });
    installNotes.push(
      'Loft cold water storage cistern to be decommissioned and removed',
      'Confirm all open-vented feeds are capped before sealing circuit',
    );
  }

  // ASHP — MCS
  if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    qualifications.push({
      id: 'mcs_installer',
      label: 'MCS-Certified Heat Pump Installer',
      triggeredBy: 'Air source heat pump installation (required for BUS grant eligibility)',
      reference: 'MCS MCS 020 Heat Pump Standard',
    });
    complianceItems.push({
      id: 'mcs_certificate',
      description: 'MCS certificate required for BUS (Boiler Upgrade Scheme) grant — must be issued by MCS-certified installer',
      regulatoryRef: 'MCS MCS 020',
      timing: 'after',
    });
    complianceItems.push({
      id: 'part_l_compliance_ashp',
      description: 'Building Regulations Part L compliance — confirm SAP calculation or simplified approach for heat pump installation',
      regulatoryRef: 'Building Regulations Part L (England & Wales)',
      timing: 'before',
    });
    installNotes.push(
      'Confirm customer eligibility for BUS grant before committing to MCS route',
      'F-gas handling qualification may be required if refrigerant circuit work is needed on outdoor unit',
    );
  }

  // Electrical
  complianceItems.push({
    id: 'electrical_part_p',
    description: 'Electrical work must comply with Building Regulations Part P — notify if new circuits are required',
    regulatoryRef: 'Building Regulations Part P',
    timing: 'before',
  });

  return {
    requiredQualifications: qualifications,
    requiredComplianceItems: complianceItems,
    installNotes,
    unresolvedRisks,
  };
}

function buildPipeworkSection(
  input: BuildImplementationPackInput,
): PipeworkSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const pipeSizeMm = surveyInput.infrastructure.primaryPipeSizeMm;
  const peakHeatLossKw = surveyInput.property.peakHeatLossKw;

  const components: SuggestedComponent[] = [];
  const topologyNotes: string[] = [];
  const pipeSizingNotes: string[] = [];
  const routingNotes: string[] = [];
  const unresolvedRisks: UnresolvedRisk[] = [];

  // Topology
  topologyNotes.push(
    'Confirm two-pipe distribution system throughout — one-pipe systems require individual radiator isolation confirmation',
    'Identify location of existing primary flow/return and zone valve connections before disconnecting boiler',
  );

  if (scenarioId !== 'combi') {
    topologyNotes.push(
      'System boiler primary circuit: confirm adequate spacing between boiler connections and zone valve positions',
    );
  }

  // Pipe sizing
  if (peakHeatLossKw > 0) {
    pipeSizingNotes.push(
      `Primary circuit at ${pipeSizeMm} mm — adequate for loads up to ~${pipeSizeMm === 15 ? '8' : pipeSizeMm === 22 ? '15' : '30'} kW at standard flow velocities`,
    );
    if (pipeSizeMm === 15 && peakHeatLossKw > 8) {
      pipeSizingNotes.push(
        'Peak heat loss may exceed capacity of 15 mm primary — assess upgrading primary to 22 mm on site',
      );
      unresolvedRisks.push({
        id: 'primary_pipe_upsize_assessment',
        description: 'Primary pipe bore may be insufficient for peak heat load',
        resolution: 'Assess primary flow rate on site; determine whether 22 mm primary upsizing is required to achieve target flow',
        severity: 'required',
      });
    }
  }

  // Connections
  components.push({
    id: 'primary_pipe_fittings',
    description: 'Primary circuit pipe and compression/push-fit fittings',
    suggestedSpec: `${pipeSizeMm} mm primary — match existing bore unless upsizing is required`,
    rationale: 'Match existing primary circuit bore for flow compatibility',
    confidence: 'required',
  });

  // Loft work for open-vented to sealed conversion
  const coldWaterSource = surveyInput.services?.coldWaterSource;
  const isStoredOrRegularScenario =
    scenarioId.includes('system')
    || scenarioId.includes('unvented')
    || scenarioId.includes('regular');
  const hasOpenVentedConversionBoiler =
    surveyInput.currentSystem?.boiler?.type === 'regular'
    || surveyInput.currentSystem?.boiler?.type === 'system';
  if (coldWaterSource === 'loft_tank' && (isStoredOrRegularScenario || hasOpenVentedConversionBoiler)) {
    topologyNotes.push(
      'Open-vented to sealed circuit conversion — loft tank feeds must be capped and removed',
      'Confirm all vent pipes and cold-feed connections are identified before sealing system',
    );
    components.push({
      id: 'loft_pipework_capping',
      description: 'Capping of loft vent and cold-feed pipework',
      suggestedSpec: 'All existing open-vent and cold-feed connections capped and tested before first fill',
      rationale: 'Sealed circuit conversion requires removal of all open-circuit connections',
      confidence: 'required',
    });
    unresolvedRisks.push({
      id: 'loft_pipe_routes_unconfirmed',
      description: 'Loft vent and cold-feed pipe routes not confirmed from survey data',
      resolution: 'Inspect loft to identify and confirm all vent/cold-feed connections before commencing sealed conversion',
      severity: 'required',
    });
  }

  routingNotes.push(
    'Confirm boiler/heat pump flue route and clearances before specifying appliance position',
    'Allow adequate service clearances for new appliance to manufacturer minimum specification',
  );

  return {
    topologyNotes,
    pipeSizingNotes,
    routingNotes,
    suggestedComponents: components,
    unresolvedRisks,
  };
}

function buildCommissioningSection(
  input: BuildImplementationPackInput,
): CommissioningSection {
  const { atlasDecision, surveyInput } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const dhwArch = surveyInput.dhw.architecture;

  const unresolvedRisks: UnresolvedRisk[] = [];

  const steps: string[] = [
    'Carry out pressure test on new pipework before back-filling or concealing',
    'Fill sealed system to 1.0–1.5 bar cold fill pressure — confirm against system static head',
    'Purge air from all radiators and primary circuit before firing boiler/heat pump',
    'Verify magnetic filter is fitted and accessible on primary return',
    'Confirm inhibitor has been dosed to BS 7593 specification and recorded in system logbook',
    'Balance radiators — set TRV heads to maximum; adjust lockshields to achieve design ΔT across circuit',
    'Set boiler/heat pump flow temperature to design set point',
    'Verify room thermostat interlock — confirm boiler does not fire when no zone demand',
    'Test all zone valve operations (CH and DHW separately where applicable)',
    'Complete Benchmark commissioning checklist or equivalent manufacturer documentation',
  ];

  // Unvented cylinder commissioning steps
  const isUnvented =
    dhwArch === 'stored_standard' ||
    dhwArch === 'stored_mixergy' ||
    scenarioId.includes('unvented') ||
    (scenarioId.includes('system') && scenarioId !== 'combi');

  if (isUnvented) {
    steps.push(
      'Commission unvented cylinder — verify expansion vessel charge pressure, PRV setting, and T&P valve operation',
      'Check tundish is clear and discharge pipe runs continuously to safe termination',
      'Complete G3 commissioning certificate and issue to customer',
      'Notify Building Control of completed unvented installation (where required)',
    );
  }

  // ASHP commissioning
  if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    steps.push(
      'Carry out manufacturer-specified heat pump commissioning procedure — log all temperatures and pressures',
      'Verify weather compensation curve is set correctly for emitter type and property heat demand',
      'Complete MCS commissioning documentation and issue certificate',
      'Register installation with heat pump manufacturer for warranty',
    );
    unresolvedRisks.push({
      id: 'mcs_commissioning_documentation',
      description: 'MCS commissioning documentation requirements not yet confirmed',
      resolution: 'Confirm current MCS 020 commissioning checklist version and ensure installer has current documentation before installation date',
      severity: 'required',
    });
  }

  steps.push('Complete handover to customer — explain controls, set points, and annual service requirements');

  const requiredDocumentation: string[] = [
    'Benchmark commissioning checklist (or manufacturer equivalent)',
    'Building Regulations Part P electrical certificate (if new circuits installed)',
  ];

  if (isUnvented) {
    requiredDocumentation.push(
      'G3 commissioning certificate',
      'Building Control completion certificate (unvented)',
    );
  }

  if (scenarioId.includes('ashp') || scenarioId.includes('heat_pump')) {
    requiredDocumentation.push(
      'MCS commissioning certificate',
      'Heat pump manufacturer warranty registration confirmation',
    );
  }

  return {
    steps,
    requiredDocumentation,
    unresolvedRisks,
  };
}

function buildFutureReadySection(
  input: BuildImplementationPackInput,
): FutureReadySection {
  const { atlasDecision } = input;
  const scenarioId = atlasDecision.recommendedScenarioId;
  const futureUpgradePaths = atlasDecision.futureUpgradePaths ?? [];

  const items: Array<{
    id: string;
    label: string;
    preparationNote: string;
    horizon: 'near_term' | 'long_term';
  }> = [];

  // ASHP pathway — for all non-ASHP systems
  if (!scenarioId.includes('ashp') && !scenarioId.includes('heat_pump')) {
    items.push({
      id: 'ashp_pathway',
      label: 'Air source heat pump pathway',
      preparationNote:
        'Emitter review at time of boiler installation — confirm or document radiator sizes and flow temperatures. ' +
        'If all radiators can serve at ≤55 °C flow, note this as future ASHP-ready in the handover documentation.',
      horizon: 'long_term',
    });
  }

  // Smart controls readiness
  items.push({
    id: 'smart_controls_readiness',
    label: 'Smart heating controls upgrade',
    preparationNote:
      'Confirm Wi-Fi availability at boiler/controller location. ' +
      'Smart thermostat-compatible wiring (volt-free contact or OpenTherm) to be considered at installation.',
    horizon: 'near_term',
  });

  // PV export / solar boost
  items.push({
    id: 'solar_boost_readiness',
    label: 'Solar diverter / PV surplus hot water',
    preparationNote:
      'Where stored hot water cylinder is fitted, confirm immersion heater is installed (or can be retro-fitted). ' +
      'Solar diverter can direct surplus PV generation to cylinder immersion — document cylinder position and immersion access in handover notes.',
    horizon: 'near_term',
  });

  // EV charger
  items.push({
    id: 'ev_charger_readiness',
    label: 'EV charger installation readiness',
    preparationNote:
      'Note consumer unit capacity and earthing type in the site handover record — relevant if customer plans EV charger.',
    horizon: 'long_term',
  });

  // Inject any additional future paths from the decision
  for (const path of futureUpgradePaths) {
    const id = `future_path_${path.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    if (!items.some((i) => i.id === id)) {
      items.push({
        id,
        label: path,
        preparationNote: `Atlas recommendation noted: ${path} — confirm site suitability and required enabling works at installation visit`,
        horizon: 'long_term',
      });
    }
  }

  return { items };
}

// ─── Cross-section summaries ──────────────────────────────────────────────────

function collectAllValidations(sections: {
  heatSource: HeatSourceSection;
  hydraulicComponents: HydraulicComponentsSection;
  controls: ControlsSection;
  waterQuality: WaterQualitySection;
  pipework: PipeworkSection;
}): readonly RequiredValidation[] {
  // Derive validations from unresolved risks with severity 'required'
  const validations: RequiredValidation[] = [];

  const allRisks = [
    ...sections.heatSource.unresolvedRisks,
    ...sections.hydraulicComponents.unresolvedRisks,
    ...sections.controls.unresolvedRisks,
    ...sections.waterQuality.unresolvedRisks,
    ...sections.pipework.unresolvedRisks,
  ].filter((r) => r.severity === 'required');

  for (const risk of allRisks) {
    validations.push({
      id: `validation_${risk.id}`,
      check: risk.description,
      reason: risk.resolution,
      severity: risk.severity,
    });
  }

  return deduplicateById(validations);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildSuggestedImplementationPack
 *
 * Deterministically generates a SuggestedImplementationPackV1 from canonical
 * survey and engine truth.
 *
 * NOT customer-facing. NOT quote pricing. NOT compliance pass/fail.
 * NOT final engineering design.
 *
 * @param input  All required inputs — atlasDecision, customerSummary, engineOutput,
 *               surveyInput, and optional scanData.
 * @param now    Optional ISO 8601 timestamp override (used in tests for determinism).
 */
export function buildSuggestedImplementationPack(
  input: BuildImplementationPackInput,
  now?: string,
): SuggestedImplementationPackV1 {
  const heatSource          = buildHeatSourceSection(input);
  const hotWater            = buildHotWaterSection(input);
  const hydraulicComponents = buildHydraulicComponentsSection(input);
  const controls            = buildControlsSection(input);
  const waterQuality        = buildWaterQualitySection(input);
  const safetyCompliance    = buildSafetyComplianceSection(input);
  const pipework            = buildPipeworkSection(input);
  const commissioning       = buildCommissioningSection(input);
  const futureReady         = buildFutureReadySection(input);

  // Roll-up cross-section summaries
  const allUnresolvedRisks = collectRisks([
    heatSource,
    hotWater,
    hydraulicComponents,
    controls,
    waterQuality,
    safetyCompliance,
    pipework,
    commissioning,
  ]);

  const allRequiredQualifications = deduplicateById(
    safetyCompliance.requiredQualifications as RequiredQualification[],
  );

  const allRequiredComplianceItems = deduplicateById(
    safetyCompliance.requiredComplianceItems as RequiredComplianceItem[],
  );

  const allRequiredValidations = collectAllValidations({
    heatSource,
    hydraulicComponents,
    controls,
    waterQuality,
    pipework,
  });

  return {
    packVersion:              'v1',
    recommendedScenarioId:    input.atlasDecision.recommendedScenarioId,
    generatedAt:              now ?? new Date().toISOString(),
    heatSource,
    hotWater,
    hydraulicComponents,
    controls,
    waterQuality,
    safetyCompliance,
    pipework,
    commissioning,
    futureReady,
    allUnresolvedRisks,
    allRequiredQualifications,
    allRequiredComplianceItems,
    allRequiredValidations,
  };
}
