/**
 * computeFitPosition
 *
 * Maps simplified household survey inputs onto a 2-D fit landscape so the
 * System Fit Map can position the user's home and highlight the nearest
 * heating system option.
 *
 * Axes:
 *   X (0–1) — simultaneous demand intensity
 *   Y (0–1) — low-temperature / stored-system suitability
 *
 * Keep the logic intentionally simple: this is a visual truth tool, not a
 * physics calculator.  Accuracy can improve later; clarity comes first.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FitInputs {
  peakConcurrentOutlets: number;
  mainsDynamicPressureBar: number;
  primaryPipeSizeMm: 15 | 22 | 28 | 35;
  thermalInertia: 'low' | 'medium' | 'high';
  occupancy: 'professional' | 'steady' | 'shift';
}

export interface FitPosition {
  /** 0–1 demand axis (higher = more simultaneous demand) */
  x: number;
  /** 0–1 system behaviour axis (higher = better low-temp / stored-system fit) */
  y: number;
  nearestSystem: 'combi' | 'system' | 'heat_pump';
}

// ─── Scoring weights ──────────────────────────────────────────────────────────

/** Demand (X) axis — contribution per factor. */
const CONCURRENT_OUTLETS_WEIGHT  = 0.4;
const STEADY_OCCUPANCY_X_WEIGHT  = 0.3;
const LOW_PRESSURE_WEIGHT        = 0.2;

/** Low-temp suitability (Y) axis — contribution per factor. */
const HIGH_THERMAL_INERTIA_WEIGHT = 0.4;
const LARGE_PIPE_WEIGHT           = 0.4;
const STEADY_OCCUPANCY_Y_WEIGHT   = 0.2;

/** Zone boundary thresholds for nearest-system classification. */
const HEAT_PUMP_Y_THRESHOLD = 0.6;
const SYSTEM_X_THRESHOLD    = 0.5;

// ─── Core logic ───────────────────────────────────────────────────────────────

export function computeFitPosition(input: FitInputs): FitPosition {
  // X axis = demand intensity
  let demand = 0;

  if (input.peakConcurrentOutlets >= 2) demand += CONCURRENT_OUTLETS_WEIGHT;
  if (input.occupancy === 'steady') demand += STEADY_OCCUPANCY_X_WEIGHT;
  if (input.mainsDynamicPressureBar < 1.2) demand += LOW_PRESSURE_WEIGHT;

  // Y axis = low-temp suitability
  let lowTemp = 0;

  if (input.thermalInertia === 'high') lowTemp += HIGH_THERMAL_INERTIA_WEIGHT;
  if (input.primaryPipeSizeMm >= 28) lowTemp += LARGE_PIPE_WEIGHT;
  if (input.occupancy === 'steady') lowTemp += STEADY_OCCUPANCY_Y_WEIGHT;

  const x = Math.min(1, demand);
  const y = Math.min(1, lowTemp);

  // Determine closest system (simple zone thresholds)
  let nearestSystem: FitPosition['nearestSystem'] = 'combi';

  if (y > HEAT_PUMP_Y_THRESHOLD) nearestSystem = 'heat_pump';
  else if (x > SYSTEM_X_THRESHOLD) nearestSystem = 'system';

  return { x, y, nearestSystem };
}
