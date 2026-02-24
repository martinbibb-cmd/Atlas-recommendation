/**
 * CwsSupplyModule
 *
 * Models the cold-water supply (CWS) as a deterministic (L/min @ bar) dynamic point.
 * A single dynamic-pressure reading is NOT sufficient to characterise supply quality —
 * you need both pressure (bar) AND flow (L/min) to form a meaningful operating point.
 *
 * Pressure-drop quality (when static is also present):
 *   drop < 0.5 bar  → 'strong'
 *   0.5 ≤ drop < 1.0 → 'moderate'
 *   drop ≥ 1.0 bar  → 'weak'
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

export type CwsLimitation = 'none' | 'flow' | 'pressure' | 'unknown';

export interface CwsSupplyV1Result {
  source: 'unknown' | 'mains_true' | 'mains_shared' | 'loft_tank';
  hasMeasurements: boolean;
  dynamic?: { pressureBar?: number; flowLpm?: number };
  static?: { pressureBar?: number };
  dropBar?: number | null;
  limitation: CwsLimitation;
  quality: 'strong' | 'moderate' | 'weak' | 'unknown';
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

  // Case 1: both dynamic pressure AND flow present → meaningful dynamic point
  if (dynamicFlowLpm !== undefined) {
    const dynamic = { pressureBar: dynamicPressureBar, flowLpm: dynamicFlowLpm };
    const staticResult = staticPressureBar !== undefined ? { pressureBar: staticPressureBar } : undefined;

    let dropBar: number | null = null;
    let quality: CwsSupplyV1Result['quality'] = 'unknown';

    if (staticPressureBar !== undefined) {
      dropBar = staticPressureBar - dynamicPressureBar;
      if (dropBar < 0) {
        // Negative drop (dynamic > static) is physically unexpected; treat as unknown.
        dropBar = 0;
        quality = 'unknown';
      } else if (dropBar < 0.5) {
        quality = 'strong';
      } else if (dropBar < 1.0) {
        quality = 'moderate';
      } else {
        quality = 'weak';
      }
    }

    notes.push(
      `Mains supply (dynamic): ${dynamicFlowLpm.toFixed(1)} L/min @ ${dynamicPressureBar.toFixed(1)} bar.`
    );

    if (staticPressureBar !== undefined && dropBar !== null) {
      notes.push(
        `Pressure: ${staticPressureBar.toFixed(1)} → ${dynamicPressureBar.toFixed(1)} bar ` +
          `(drop ${dropBar.toFixed(1)} bar: ${quality}).`
      );
    } else {
      notes.push('Static pressure not measured — pressure-drop quality unknown.');
    }

    return {
      source,
      hasMeasurements: true,
      dynamic,
      static: staticResult,
      dropBar: staticPressureBar !== undefined ? dropBar : null,
      limitation: 'none',
      quality,
      notes,
    };
  }

  // Case 2: dynamic pressure only (no flow)
  notes.push(
    `Mains supply: ${dynamicPressureBar.toFixed(1)} bar (dynamic only) — add L/min @ bar to judge stability.`
  );

  return {
    source,
    hasMeasurements: false,
    dynamic: { pressureBar: dynamicPressureBar },
    static: staticPressureBar !== undefined ? { pressureBar: staticPressureBar } : undefined,
    dropBar: null,
    limitation: 'unknown',
    quality: 'unknown',
    notes,
  };
}
