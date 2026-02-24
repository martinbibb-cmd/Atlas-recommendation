/**
 * CwsSupplyModule
 *
 * Models the cold-water supply (CWS) evidence from available measurements.
 * Flow-only is valid evidence — pressure is not required for hasMeasurements.
 * Dynamic pressure of 0 bar is accepted (flow-cup test at gauge zero).
 *
 * Hard rule: dynamic must not exceed static + 0.2 bar (INCONSISTENCY_TOLERANCE).
 *
 * Unvented eligibility gate: flowLpm ≥ 10 @ dynamicBar ≥ 1.0  OR  flowLpm ≥ 12 @ dynamicBar ≈ 0.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

/** Tolerance (bar) for dynamic > static inconsistency check. */
const INCONSISTENCY_TOLERANCE = 0.2;

/** Unvented requirement: 10 L/min @ ≥ 1.0 bar, or 12 L/min @ ≈ 0 bar (flow-cup). */
const UNVENTED_FLOW_AT_PRESSURE_LPM = 10;
const UNVENTED_FLOW_AT_PRESSURE_BAR = 1.0;
const UNVENTED_FLOW_CUP_LPM = 12;
const UNVENTED_FLOW_CUP_MAX_BAR = 0.2; // "0 bar" tolerance

export type CwsLimitation = 'none' | 'flow' | 'pressure' | 'unknown';

export interface CwsSupplyV1Result {
  source: 'unknown' | 'mains_true' | 'mains_shared' | 'loft_tank';
  /** True when flow measurement is present (regardless of pressure). */
  hasMeasurements: boolean;
  /** True when flow is present AND dynamicBar is defined (including 0). */
  hasDynOpPoint: boolean;
  dynamic?: { pressureBar?: number; flowLpm?: number };
  static?: { pressureBar?: number };
  dropBar?: number | null;
  /** True when dynamicBar > staticBar + tolerance — readings are physically inconsistent. */
  inconsistent: boolean;
  /** True when the unvented eligibility gate is met (10 L/min @ 1 bar OR 12 L/min @ 0 bar). */
  meetsUnventedRequirement: boolean;
  limitation: CwsLimitation;
  notes: string[];
  evidenceIds?: string[];
}

/**
 * Run the CWS supply module deterministically from engine input.
 */
export function runCwsSupplyModuleV1(input: EngineInputV2_3): CwsSupplyV1Result {
  const source = input.coldWaterSource ?? 'unknown';

  // Normalise legacy aliases → single canonical mode internally.
  // tank_pumped | pumped → pumped_from_tank
  const rawMode = input.dhwDeliveryMode ?? 'unknown';
  const deliveryMode =
    rawMode === 'tank_pumped' || rawMode === 'pumped' ? 'pumped_from_tank' : rawMode;

  const dynamicPressureBar =
    input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  const dynamicFlowLpm = input.mainsDynamicFlowLpm;
  const staticPressureBar = input.staticMainsPressureBar;

  const notes: string[] = [];

  // Delivery mode — add mode-specific note
  if (deliveryMode === 'gravity') {
    notes.push('Gravity-fed: flow depends on head height + pipework, not mains.');
  } else if (deliveryMode === 'pumped_from_tank') {
    notes.push('Power shower (pump from tank): performance depends on pump + stored supply, not mains.');
  } else if (deliveryMode === 'mains_mixer') {
    notes.push('Mixer (mains-fed): performance depends on mains flow/pressure under load.');
  } else if (deliveryMode === 'accumulator_supported') {
    notes.push('Cannot increase mains supply. Accumulator (buffers peaks): smooths short demand peaks — once depleted, performance reverts to mains.');
  } else if (deliveryMode === 'break_tank_booster') {
    notes.push('Cannot increase mains supply. Break tank + booster set (pumped from storage): pump draws from stored water; mains only refills the tank over time.');
  } else if (deliveryMode === 'electric_cold_only') {
    notes.push('Electric shower: cold mains only; independent of cylinder temperature.');
  }

  // Inconsistency check: dynamic must not exceed static + tolerance
  const inconsistent =
    staticPressureBar !== undefined &&
    dynamicPressureBar > staticPressureBar + INCONSISTENCY_TOLERANCE;

  if (inconsistent) {
    notes.unshift('Readings inconsistent (dynamic > static) — likely swapped or measured at different points.');
  }

  // hasMeasurements: true when flow is present (flow-only is valid evidence)
  const hasFlow = dynamicFlowLpm !== undefined && dynamicFlowLpm > 0;

  // hasDynOpPoint: true when flow is present (pressure is always defined as a number)
  const hasDynOpPoint = hasFlow;

  // Case 1: flow present → meaningful measurement
  if (hasFlow) {
    const flow = dynamicFlowLpm as number; // narrowed by hasFlow guard
    const dynamic = { pressureBar: dynamicPressureBar, flowLpm: flow };
    const staticResult = staticPressureBar !== undefined ? { pressureBar: staticPressureBar } : undefined;

    let dropBar: number | null = null;

    if (staticPressureBar !== undefined && !inconsistent) {
      dropBar = staticPressureBar - dynamicPressureBar;
    }

    notes.push(
      `Mains supply (dynamic): ${flow.toFixed(1)} L/min @ ${dynamicPressureBar.toFixed(1)} bar.`
    );

    if (staticPressureBar !== undefined && !inconsistent && dropBar !== null) {
      notes.push(
        `Pressure: ${staticPressureBar.toFixed(1)} → ${dynamicPressureBar.toFixed(1)} bar ` +
          `(drop ${dropBar.toFixed(1)} bar).`
      );
    } else if (staticPressureBar === undefined) {
      notes.push('Static pressure not measured — pressure-drop unknown.');
    }

    // Unvented eligibility gate
    const meetsUnventedRequirement =
      !inconsistent && (
        (flow >= UNVENTED_FLOW_AT_PRESSURE_LPM && dynamicPressureBar >= UNVENTED_FLOW_AT_PRESSURE_BAR) ||
        (flow >= UNVENTED_FLOW_CUP_LPM && dynamicPressureBar <= UNVENTED_FLOW_CUP_MAX_BAR)
      );

    return {
      source,
      hasMeasurements: true,
      hasDynOpPoint,
      dynamic,
      static: staticResult,
      dropBar: staticPressureBar !== undefined ? dropBar : null,
      inconsistent,
      meetsUnventedRequirement,
      limitation: 'none',
      notes,
    };
  }

  // Case 2: pressure only (no flow)
  notes.push(
    `Mains supply: ${dynamicPressureBar.toFixed(1)} bar (dynamic only) — add L/min @ bar to judge stability.`
  );

  return {
    source,
    hasMeasurements: false,
    hasDynOpPoint: false,
    dynamic: { pressureBar: dynamicPressureBar },
    static: staticPressureBar !== undefined ? { pressureBar: staticPressureBar } : undefined,
    dropBar: null,
    inconsistent,
    meetsUnventedRequirement: false,
    limitation: 'unknown',
    notes,
  };
}
