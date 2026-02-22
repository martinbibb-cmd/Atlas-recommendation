/**
 * EngineInputV3 – Canonical Schema (V3)
 *
 * This is the absolute contract between data ingestion and the physics core.
 * All strictly-typed physical inputs required by the Domestic Thermal Physics
 * Simulator are defined here.
 *
 * Replaces EngineInputV2_3 as the primary input schema for new integrations.
 */

import type { EngineInputV2_3 } from './EngineInputV2_3';

// ─── Hydraulics ───────────────────────────────────────────────────────────────

/** Permitted primary pipe bore diameters (mm). */
export type PrimaryPipeDiameter = 15 | 22 | 28;

// ─── Metallurgy ───────────────────────────────────────────────────────────────

/**
 * Heat exchanger material classification.
 *  - 'Al-Si':          Aluminium-Silicon alloy (e.g. Worcester Bosch 8000+).
 *                      Lightweight, high thermal conductivity, uniquely compatible
 *                      with salt-water softeners on the domestic circuit.
 *  - 'stainless_steel': High corrosion resistance, wide pH tolerance, but NOT
 *                      recommended alongside salt-water softeners on the primary
 *                      circuit (dezincification / pitting risk).
 */
export type HeatExchangerMaterial = 'Al-Si' | 'stainless_steel';

// ─── Behaviour ────────────────────────────────────────────────────────────────

/**
 * V3 occupancy signatures (simplified from V2 nomenclature).
 *  - 'professional': Double-peak demand profile (07:00 & 18:00). Favours boiler.
 *  - 'steady':       Continuous low-level demand (retired / WFH). Favours ASHP.
 *  - 'shift':        Irregular / offset demand. Favours stored water.
 */
export type OccupancySignatureV3 = 'professional' | 'steady' | 'shift';

/**
 * Hot-water draw frequency classification.
 *  - 'low':  Infrequent draws (≤ 4 per day). Combi purge losses are proportionally
 *            less severe; stored solutions show less advantage.
 *  - 'high': Frequent draws (> 4 per day). Combi efficiency collapses rapidly;
 *            Mixergy / stored solutions outperform by a large margin.
 */
export type DrawFrequency = 'low' | 'high';

// ─── Canonical V3 Input ───────────────────────────────────────────────────────

/**
 * EngineInputV3 is the canonical input contract for the V3 physics engine.
 *
 * Key differences from EngineInputV2_3:
 *  - `primaryPipeDiameter` is narrowed to the literal union 15 | 22 | 28 mm.
 *  - `heatExchangerMaterial` uses the new V3 naming ('Al-Si' | 'stainless_steel').
 *  - `occupancySignature` uses the simplified V3 union.
 *  - `drawFrequency` is a required field (was absent in V2_3).
 */
export interface EngineInputV3
  extends Omit<
    EngineInputV2_3,
    'primaryPipeDiameter' | 'occupancySignature' | 'preferredMetallurgy'
  > {
  // ── Hydraulics ──────────────────────────────────────────────────────────────
  /** Primary pipe bore (mm). Only 15, 22, or 28 mm are valid in V3. */
  primaryPipeDiameter: PrimaryPipeDiameter;

  /** Piping circuit topology (required in V3; was optional in V2_3). */
  pipingTopology: 'two_pipe' | 'one_pipe' | 'microbore';

  // ── Metallurgy ──────────────────────────────────────────────────────────────
  /** V3 material designation for the heat exchanger. Replaces preferredMetallurgy. */
  heatExchangerMaterial: HeatExchangerMaterial;

  // ── Behaviour ───────────────────────────────────────────────────────────────
  /** Simplified V3 occupancy pattern. */
  occupancySignature: OccupancySignatureV3;

  /** Hot-water draw frequency – drives combi efficiency vs stored-water curves. */
  drawFrequency: DrawFrequency;
}
