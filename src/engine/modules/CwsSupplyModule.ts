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
  const deliveryMode = input.dhwDeliveryMode ?? 'unknown';

  const dynamicPressureBar =
    input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  const dynamicFlowLpm = input.mainsDynamicFlowLpm;
  const staticPressureBar = input.staticMainsPressureBar;

  const notes: string[] = [];

  // Non-mains delivery modes — don't pretend mains governs everything
  if (deliveryMode === 'gravity' || deliveryMode === 'pumped') {
    notes.push(
      `DHW delivery is ${deliveryMode} — mains pressure does not directly govern hot-water performance.`
    );
  } else if (deliveryMode === 'electric_cold_only') {
    notes.push(
      'Electric system (cold only, independent of cylinder) — mains pressure only relevant for cold outlets.'
    );
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
    `Mains supply: ${dynamicPressureBar.toFixed(1)} bar (dynamic only). ` +
      'Flow at pressure not measured — stability unknown.'
  );
  notes.push(
    "Dynamic pressure alone isn't enough — need flow at pressure (L/min @ bar)."
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
