/**
 * buildLimiterLedger.ts — PR8: Derives a LimiterLedger from engine run evidence.
 *
 * Takes a FamilyRunnerResult and a DerivedSystemEventSummary and returns a
 * LimiterLedger that explains, in structured form, why a run struggled.
 *
 * Design rules:
 *   1. Every limiter entry must have real evidence from its stated source.
 *   2. No entry is emitted from UI summaries or without trigger evidence.
 *   3. Family-specific limiters respect topology ownership.
 *   4. Output ordering is deterministic: severity → domain → id.
 *   5. Ledger is explanatory only — no recommendation ranking.
 *
 * Initial limiter catalogue:
 *   DHW / service
 *     combi_service_switching          combi-only; heating interrupted for DHW
 *     stored_volume_shortfall          store-only; cylinder too small for demand
 *     reduced_dhw_service              store-only; partial-store draw reduced service
 *     hp_reheat_latency                heat-pump-only; slow cylinder recovery
 *     simultaneous_demand_constraint   shared; system cannot serve CH + DHW at once
 *
 *   Hydraulic
 *     mains_flow_constraint            shared; mains flow below delivery threshold
 *     pressure_constraint              shared; mains dynamic pressure too low
 *     primary_pipe_constraint          heat-pump-only; pipe bore limits HP flow (advice only, no hard stop)
 *     open_vented_head_limit           open_vented-only; gravity head limits pressure
 *
 *   Heating / temperature
 *     emitter_temperature_constraint   shared; emitters require high flow temp
 *     cycling_risk                     shared; sludge-restricted circuit causes cycling
 *     high_return_temp_non_condensing  shared; return temp above condensing threshold
 *     hp_high_flow_temp_penalty        heat-pump-only; high flow temp degrades HP SPF
 *
 *   Installability / topology
 *     dhw_storage_required             combi or HP; storage needed by topology or demand
 *     space_for_cylinder_unavailable   store-only; tight space limits cylinder choice
 */

import type { FamilyRunnerResult } from '../runners/types';
import type { DerivedSystemEventSummary } from '../timeline/DerivedSystemEvent';
import type { LimiterLedger, LimiterLedgerEntry, LimiterSeverity } from './LimiterLedger';
import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Demographic context ──────────────────────────────────────────────────────

/**
 * Household demographic inputs used for occupancy-driven limiter rules.
 *
 * All fields are optional — absent values cause the corresponding rules to be
 * skipped (no entry emitted).  This type is always passed as an optional third
 * argument so existing call sites without demographic data are unaffected.
 */
export interface LimiterDemographicContext {
  /** Number of people regularly resident. */
  occupancyCount?: number;
  /** Number of bathrooms. */
  bathroomCount?: number;
  /** Peak simultaneous DHW outlets (e.g. 1 = single shower, 2 = shower + basin). */
  peakConcurrentOutlets?: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** HP post-draw recovery > this (minutes) is classified as slow reheat. */
const HP_REHEAT_LATENCY_THRESHOLD_MINUTES = 45;

/** Mains flow below this (L/min) triggers mains_flow_constraint. */
const MIN_ADEQUATE_FLOW_LPM = 13;

/**
 * Mains flow at or below this (L/min) elevates mains_flow_constraint from
 * 'warning' (workable but limited) to 'limit' (serious impairment).
 */
const CRITICAL_FLOW_LPM = 10;

/** Dynamic mains pressure below this (bar) triggers pressure_constraint. */
const MIN_ADEQUATE_PRESSURE_BAR = 1.0;

/** Cycling loss above this fraction triggers cycling_risk. */
const CYCLING_RISK_THRESHOLD = 0.05;

/** Cycling loss at or above this fraction elevates severity from 'warning' to 'limit'. */
const CRITICAL_CYCLING_LOSS = 0.15;

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<LimiterSeverity, number> = {
  hard_stop: 0,
  limit: 1,
  warning: 2,
  info: 3,
};

// ─── Domain ordering ─────────────────────────────────────────────────────────

const DOMAIN_ORDER: Record<string, number> = {
  dhw: 0,
  space_heating: 1,
  hydraulic: 2,
  efficiency: 3,
  installability: 4,
  controls: 5,
  lifecycle: 6,
};

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortEntries(entries: LimiterLedgerEntry[]): LimiterLedgerEntry[] {
  return [...entries].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const domA = DOMAIN_ORDER[a.domain] ?? 99;
    const domB = DOMAIN_ORDER[b.domain] ?? 99;
    const domDiff = domA - domB;
    if (domDiff !== 0) return domDiff;
    return a.id.localeCompare(b.id);
  });
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `LimiterLedger` from a `FamilyRunnerResult` and a
 * `DerivedSystemEventSummary`.
 *
 * This function is the single entry point for PR8 limiter derivation.
 * It accepts any valid family runner result (combi or hydronic) and returns
 * an ordered ledger of constraints derived from timeline, event, and physics
 * evidence.
 *
 * The function is evidence-gated: no entry is emitted unless the corresponding
 * trigger source contains the required signal.  An empty run (no events, no
 * physics flags above thresholds) produces an empty or near-empty ledger.
 *
 * @param runnerResult   Full result from one of the four family runners.
 * @param eventSummary   Derived events and counters from PR7 projection.
 * @returns              `LimiterLedger` with deterministically ordered entries.
 */
export function buildLimiterLedger(
  runnerResult: FamilyRunnerResult,
  eventSummary: DerivedSystemEventSummary,
  demographic?: LimiterDemographicContext,
): LimiterLedger {
  const entries: LimiterLedgerEntry[] = [];

  const family: ApplianceFamily = runnerResult.topology.appliance.family;
  const { counters, events } = eventSummary;

  // ── DHW / service limiters ──────────────────────────────────────────────────

  // 1. combi_service_switching — combi-only
  //    Evidence: heating_interrupted_by_dhw events on a combi timeline.
  if (family === 'combi' && counters.heatingInterruptions > 0) {
    entries.push({
      id: 'combi_service_switching',
      family,
      domain: 'dhw',
      severity: 'warning',
      title: 'Combi service switching',
      description:
        `Space heating was interrupted ${counters.heatingInterruptions} time(s) to serve a DHW demand. ` +
        `A combi boiler cannot deliver CH and DHW simultaneously — the diverter valve switches to the ` +
        `DHW circuit, suspending space heating for the duration of the draw.`,
      source: 'timeline',
      triggerKeys: ['heating_interrupted_by_dhw'],
      removableByUpgrade: true,
      candidateInterventions: ['switch_to_stored_system', 'install_stored_hot_water_cylinder'],
      confidence: 'derived',
    });
  }

  // 1a. combi_dhw_demand_risk — combi-only; occupancy/bathroom demand gate.
  //     Rules (from household physics):
  //       bathroomCount >= 2 || peakConcurrentOutlets >= 2 → 'limit'    (simultaneous-demand advisory)
  //       occupancyCount === 3                              → 'warning'  (borderline demand)
  //       occupancyCount <= 2                              → pass (no entry emitted)
  //     Hard stops are not permitted — the maximum severity is 'limit' (advice only).
  if (family === 'combi' && demographic != null) {
    const { occupancyCount, bathroomCount, peakConcurrentOutlets } = demographic;
    const isHardGate =
      (bathroomCount != null && bathroomCount >= 2) ||
      (peakConcurrentOutlets != null && peakConcurrentOutlets >= 2);
    const isBorderline =
      !isHardGate && occupancyCount != null && occupancyCount === 3;

    if (isHardGate) {
      // Determine which field triggered the gate and its value for the description.
      const triggerField = (bathroomCount != null && bathroomCount >= 2)
        ? `${bathroomCount} bathrooms`
        : `${peakConcurrentOutlets!} simultaneous outlets`;
      entries.push({
        id: 'combi_dhw_demand_risk',
        family,
        domain: 'dhw',
        severity: 'limit',
        title: 'Simultaneous demand risk — combi not advisable',
        description:
          `This home has ${triggerField}, ` +
          `creating a high risk of concurrent hot-water demand. A combi boiler can only serve one ` +
          `outlet at full flow at a time — simultaneous draws will result in reduced temperature ` +
          `or pressure at one or more outlets. A stored system is strongly advisable.`,
        source: 'demographic',
        triggerKeys: ['bathroomCount', 'peakConcurrentOutlets'],
        removableByUpgrade: true,
        candidateInterventions: ['switch_to_stored_system', 'install_stored_hot_water_cylinder'],
        confidence: 'assumed',
      });
    } else if (isBorderline) {
      entries.push({
        id: 'combi_dhw_demand_risk',
        family,
        domain: 'dhw',
        severity: 'warning',
        title: 'Borderline combi demand — three-person household',
        description:
          `With ${occupancyCount} occupants, peak morning demand may approach the limits of ` +
          `on-demand hot water. Back-to-back showers without a stored system can result in ` +
          `reduced temperature towards the end of consecutive draws.`,
        source: 'demographic',
        triggerKeys: ['occupancyCount'],
        removableByUpgrade: true,
        candidateInterventions: ['switch_to_stored_system', 'install_stored_hot_water_cylinder'],
        confidence: 'assumed',
      });
    }
    // occupancyCount <= 2 with bathroomCount < 2: pass — no entry emitted.
  }

  // 2. simultaneous_demand_constraint — shared
  //    Evidence: simultaneous_demand_constraint events from the timeline.
  if (counters.simultaneousDemandConstraints > 0) {
    entries.push({
      id: 'simultaneous_demand_constraint',
      family,
      domain: 'dhw',
      severity: 'limit',
      title: 'Simultaneous demand constraint',
      description:
        `The system hit a simultaneous demand constraint ${counters.simultaneousDemandConstraints} time(s) — ` +
        `it cannot serve both space heating and DHW at full capacity at the same time.`,
      source: 'timeline',
      triggerKeys: ['simultaneous_demand_constraint'],
      removableByUpgrade: true,
      candidateInterventions: ['switch_to_stored_system', 'upgrade_to_heat_pump'],
      confidence: 'derived',
    });
  }

  // 3/4. stored_volume_shortfall / reduced_dhw_service — store-only
  //      Evidence: reduced_dhw_service events from the timeline.
  //      stored_volume_shortfall requires additional store-depletion state evidence.
  //      reduced_dhw_service is emitted when depletion evidence is absent.
  if (family !== 'combi' && counters.reducedDhwEvents > 0) {
    const hasDepletionEvidence = runnerResult.stateTimeline.some(
      tick => tick.storeStateSummary === 'depleted' || tick.storeStateSummary === 'partial',
    );
    const hasStoreDepletedEvent = events.some(e => e.eventType === 'store_depleted');

    if (hasDepletionEvidence || hasStoreDepletedEvent) {
      // Strongest signal: both reduced-service events and depletion state evidence
      entries.push({
        id: 'stored_volume_shortfall',
        family,
        domain: 'dhw',
        severity: 'limit',
        title: 'Stored volume shortfall',
        description:
          `The cylinder did not contain sufficient usable hot water to meet demand. Draw volume ` +
          `exceeded usable stored capacity, resulting in reduced DHW service ` +
          `(${counters.reducedDhwEvents} reduced-service event(s)).`,
        source: 'stored_dhw_phase',
        triggerKeys: ['reduced_dhw_service', 'store_depleted'],
        removableByUpgrade: true,
        candidateInterventions: ['upsize_cylinder', 'upgrade_to_mixergy', 'add_solar_thermal'],
        confidence: 'derived',
      });
    } else {
      // Weaker signal: reduced-service events without confirmed store depletion
      entries.push({
        id: 'reduced_dhw_service',
        family,
        domain: 'dhw',
        severity: 'warning',
        title: 'Reduced DHW service',
        description:
          `DHW service was reduced on ${counters.reducedDhwEvents} occasion(s) — the stored hot ` +
          `water was partially depleted, limiting delivery temperature or volume.`,
        source: 'timeline',
        triggerKeys: ['reduced_dhw_service'],
        removableByUpgrade: true,
        candidateInterventions: ['upsize_cylinder', 'improve_cylinder_insulation'],
        confidence: 'derived',
      });
    }
  }

  // 5. hp_reheat_latency — heat-pump-only
  //    Evidence: heat_pump_stored recovery characteristic + slow estimated recovery
  //    + at least one recharge cycle in the event summary.
  if (family === 'heat_pump') {
    const storedPhase = runnerResult.dhw.storedDhwPhase;
    if (
      storedPhase !== undefined &&
      storedPhase.recoveryCharacteristic === 'heat_pump_stored' &&
      storedPhase.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes >
        HP_REHEAT_LATENCY_THRESHOLD_MINUTES &&
      counters.rechargeCycles > 0
    ) {
      const recoveryMins =
        storedPhase.drawOffResult.postDrawStoreState.estimatedRecoveryMinutes;
      entries.push({
        id: 'hp_reheat_latency',
        family,
        domain: 'dhw',
        severity: 'warning',
        title: 'Heat pump reheat latency',
        description:
          `The heat pump cylinder requires approximately ${recoveryMins} minutes to recover after ` +
          `a significant draw-off. Heat pumps reheat stored water more slowly than boilers ` +
          `(~100 L/h vs ~200 L/h), so consecutive draws may cause shortfalls.`,
        source: 'stored_dhw_phase',
        triggerKeys: ['recharge_started', 'recharge_completed'],
        removableByUpgrade: false,
        candidateInterventions: ['upsize_cylinder', 'add_solar_thermal', 'install_mixergy'],
        confidence: 'derived',
      });
    }
  }

  // ── Hydraulic limiters ──────────────────────────────────────────────────────

  // 6. mains_flow_constraint — shared
  //    Evidence: cwsSupplyV1.dynamic.flowLpm below delivery threshold.
  const cwsFlow = runnerResult.hydraulic.cwsSupplyV1.dynamic?.flowLpm;
  if (cwsFlow !== undefined && cwsFlow < MIN_ADEQUATE_FLOW_LPM) {
    // 'limit': at or below 10 L/min — hard physics constraint; combi DHW seriously impaired.
    // 'warning': 10–12 L/min — workable but degraded; stored system better for this demand.
    const flowSeverity: LimiterSeverity = cwsFlow < CRITICAL_FLOW_LPM ? 'limit' : 'warning';
    entries.push({
      id: 'mains_flow_constraint',
      family,
      domain: 'hydraulic',
      severity: flowSeverity,
      title: 'Mains flow constraint',
      description:
        `Mains flow of ${cwsFlow.toFixed(1)} L/min is below the ${MIN_ADEQUATE_FLOW_LPM} L/min ` +
        `minimum required for reliable DHW delivery. Low mains flow causes temperature instability ` +
        `during showers and prevents simultaneous DHW draws.`,
      source: 'hydraulic',
      triggerKeys: ['cwsSupplyV1.dynamic.flowLpm'],
      removableByUpgrade: false,
      candidateInterventions: ['install_pressure_booster', 'switch_to_stored_system'],
      confidence: runnerResult.hydraulic.cwsSupplyV1.hasMeasurements ? 'measured' : 'assumed',
    });
  }

  // 7. pressure_constraint — shared
  //    Evidence: pressureAnalysis.dynamicBar below minimum unvented threshold.
  const dynamicBar = runnerResult.hydraulic.pressureAnalysis.dynamicBar;
  if (dynamicBar < MIN_ADEQUATE_PRESSURE_BAR) {
    entries.push({
      id: 'pressure_constraint',
      family,
      domain: 'hydraulic',
      severity: 'warning',
      title: 'Mains pressure constraint',
      description:
        `Dynamic mains pressure of ${dynamicBar.toFixed(1)} bar is below the ` +
        `${MIN_ADEQUATE_PRESSURE_BAR.toFixed(1)} bar minimum required for reliable unvented DHW or ` +
        `combi operation. Low pressure limits outlet flow rate and delivery consistency.`,
      source: 'hydraulic',
      triggerKeys: ['pressureAnalysis.dynamicBar'],
      removableByUpgrade: false,
      candidateInterventions: ['install_pressure_booster', 'switch_to_vented_system'],
      confidence: 'measured',
    });
  }

  // 8. primary_pipe_constraint — heat-pump family only
  //    Evidence: hydraulicV1.verdict.ashpRisk is not 'pass'.
  //    This constraint is about heat-pump flow requirements and is not relevant
  //    to boiler families (regular, system, combi, open_vented).  Hard stops are
  //    never permitted — the maximum severity is 'warning' (advice only).
  if (family === 'heat_pump' && runnerResult.hydraulic.v1.verdict.ashpRisk !== 'pass') {
    const pipeSeverity: LimiterSeverity = 'warning';
    entries.push({
      id: 'primary_pipe_constraint',
      family,
      domain: 'hydraulic',
      severity: pipeSeverity,
      title: 'Primary pipe constraint',
      description:
        `Primary pipework may not carry the flow required for optimal heat pump operation. ` +
        `Pipe velocity could exceed recommended limits, affecting efficiency and noise levels. ` +
        `A hydraulic calculation is needed to confirm whether pipework upgrades are required.`,
      source: 'hydraulic',
      triggerKeys: ['hydraulicV1.verdict.ashpRisk'],
      removableByUpgrade: true,
      candidateInterventions: ['upgrade_primary_to_28mm', 'upgrade_primary_to_35mm'],
      confidence: 'derived',
    });
  }

  // 9. open_vented_head_limit — open_vented-only
  //    Evidence: topology family is 'open_vented' (structural topology fact).
  if (family === 'open_vented') {
    entries.push({
      id: 'open_vented_head_limit',
      family,
      domain: 'hydraulic',
      severity: 'info',
      title: 'Tank-fed supply head limit',
      description:
        `This system uses tank-fed hot water supply, which limits delivery pressure to the ` +
        `available gravity head from the cold water storage tank. Flow rate and pressure depend ` +
        `on tank height above the outlets.`,
      source: 'topology',
      triggerKeys: ['topology.family'],
      removableByUpgrade: true,
      candidateInterventions: ['upgrade_to_unvented_cylinder', 'upgrade_to_mains_fed_supply'],
      confidence: 'derived',
    });
  }

  // ── Heating / temperature limiters ─────────────────────────────────────────

  // 10. emitter_temperature_constraint — shared
  //     Evidence: heatPumpRegime.designFlowTempBand is at the highest band (50 °C),
  //     indicating emitters cannot support the lower flow temps needed for
  //     efficient heat pump operation.
  if (runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50) {
    entries.push({
      id: 'emitter_temperature_constraint',
      family,
      domain: 'space_heating',
      severity: 'warning',
      title: 'Emitter temperature constraint',
      description:
        `Current emitters require a design flow temperature in the ` +
        `${runnerResult.heating.heatPumpRegime.designFlowTempBand} °C band, which is above the ` +
        `optimal range for heat pump operation (35–45 °C). Higher flow temperatures reduce ` +
        `heat pump efficiency significantly.`,
      source: 'heat_pump_regime',
      triggerKeys: ['heatPumpRegime.designFlowTempBand'],
      removableByUpgrade: true,
      candidateInterventions: [
        'upgrade_radiators',
        'add_underfloor_heating',
        'increase_emitter_count',
      ],
      confidence: 'derived',
    });
  }

  // 11. cycling_risk — shared
  //     Evidence: sludgeVsScale.cyclingLossPct above threshold.
  const cyclingLossPct = runnerResult.hydraulic.sludgeVsScale.cyclingLossPct ?? 0;
  if (cyclingLossPct >= CYCLING_RISK_THRESHOLD) {
    const cyclingSeverity: LimiterSeverity =
      cyclingLossPct >= CRITICAL_CYCLING_LOSS ? 'limit' : 'warning';
    entries.push({
      id: 'cycling_risk',
      family,
      domain: 'efficiency',
      severity: cyclingSeverity,
      title: 'Boiler cycling risk',
      description:
        `Sludge restriction causes ${(cyclingLossPct * 100).toFixed(1)}% additional fuel consumption ` +
        `from short-cycling. A dirty primary circuit restricts flow and causes the heat source to ` +
        `overshoot setpoint quickly, firing on/off more frequently at low loads.`,
      source: 'hydraulic',
      triggerKeys: ['sludgeVsScale.cyclingLossPct'],
      removableByUpgrade: false,
      candidateInterventions: ['powerflush_circuit', 'fit_magnetic_filter'],
      confidence: 'derived',
    });
  }

  // 12. high_return_temp_non_condensing — shared
  //     Evidence: condensingState.zone is 'red' (non-condensing operation).
  if (runnerResult.efficiency.condensingState.zone === 'non_condensing') {
    entries.push({
      id: 'high_return_temp_non_condensing',
      family,
      domain: 'efficiency',
      severity: 'warning',
      title: 'High return temperature — non-condensing operation',
      description:
        `Return temperature of ${runnerResult.efficiency.condensingState.fullLoadReturnC.toFixed(0)} °C ` +
        `is above the condensing threshold (${runnerResult.efficiency.condensingState.condensingThresholdC} °C). ` +
        `The heat source is operating in non-condensing mode and cannot recover latent heat from ` +
        `flue gases, reducing seasonal efficiency.`,
      source: 'condensing_state',
      triggerKeys: ['condensingState.zone'],
      removableByUpgrade: true,
      candidateInterventions: [
        'lower_flow_temperature',
        'install_weather_compensation',
        'upgrade_emitters',
      ],
      confidence: 'derived',
    });
  }

  // 13. hp_high_flow_temp_penalty — heat-pump-only
  //     Evidence: heat pump family + heatPumpRegime.spfBand is 'poor'
  //     + designFlowTempBand at highest band.
  if (
    family === 'heat_pump' &&
    runnerResult.heating.heatPumpRegime.spfBand === 'poor' &&
    runnerResult.heating.heatPumpRegime.designFlowTempBand >= 50
  ) {
    entries.push({
      id: 'hp_high_flow_temp_penalty',
      family,
      domain: 'efficiency',
      severity: 'warning',
      title: 'Heat pump high flow temperature penalty',
      description:
        `The heat pump is operating at a high design flow temperature ` +
        `(${runnerResult.heating.heatPumpRegime.designFlowTempBand} °C band) with a poor SPF band. ` +
        `Every 5 °C rise in flow temperature reduces COP by approximately 10%.`,
      source: 'heat_pump_regime',
      triggerKeys: ['heatPumpRegime.spfBand', 'heatPumpRegime.designFlowTempBand'],
      removableByUpgrade: true,
      candidateInterventions: [
        'upgrade_emitters',
        'add_underfloor_heating',
        'install_weather_compensation',
      ],
      confidence: 'derived',
    });
  }

  // ── Installability / topology limiters ─────────────────────────────────────

  // 14. dhw_storage_required — combi (demand-driven) or heat_pump (topology-driven)
  //     Evidence:
  //       heat_pump — topology always requires a cylinder (structural fact)
  //       combi     — simultaneous demand or service switching events present
  const needsStorageHP = family === 'heat_pump';
  const needsStorageCombi =
    family === 'combi' &&
    (counters.simultaneousDemandConstraints > 0 || counters.heatingInterruptions > 0);

  if (needsStorageHP || needsStorageCombi) {
    entries.push({
      id: 'dhw_storage_required',
      family,
      domain: 'installability',
      severity: 'info',
      title: 'DHW storage required',
      description: needsStorageHP
        ? `Heat pump systems always require a hot water cylinder — the appliance cannot serve ` +
          `DHW directly on demand. Cylinder sizing and space must be confirmed before installation.`
        : `DHW service switching and simultaneous demand constraints indicate that this property ` +
          `would benefit from stored hot water. A cylinder would decouple DHW delivery from ` +
          `space heating.`,
      source: needsStorageHP ? 'topology' : 'timeline',
      triggerKeys: needsStorageHP
        ? ['topology.family']
        : ['simultaneous_demand_constraint', 'heating_interrupted_by_dhw'],
      removableByUpgrade: false,
      candidateInterventions: ['install_unvented_cylinder', 'install_system_boiler_with_cylinder'],
      confidence: 'derived',
    });
  }

  // 15. space_for_cylinder_unavailable — store-only
  //     Evidence: storedDhwV1.flags contains 'stored-space-tight'.
  if (family !== 'combi') {
    const storedDhwV1 = runnerResult.dhw.storedDhwV1;
    const hasSpaceTightFlag = storedDhwV1?.flags.some(f => f.id === 'stored-space-tight');
    if (hasSpaceTightFlag) {
      entries.push({
        id: 'space_for_cylinder_unavailable',
        family,
        domain: 'installability',
        severity: 'warning',
        title: 'Limited space for cylinder',
        description:
          `Available space for a hot water cylinder is tight. A compact or slimline cylinder ` +
          `will be required, which may limit the usable stored volume and constrain system options.`,
        source: 'stored_dhw_v1',
        triggerKeys: ['storedDhwV1.flags.stored-space-tight'],
        removableByUpgrade: false,
        candidateInterventions: ['install_compact_cylinder', 'install_mixergy_unit'],
        confidence: 'derived',
      });
    }
  }

  return { entries: sortEntries(entries) };
}
