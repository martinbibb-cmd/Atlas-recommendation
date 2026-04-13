/**
 * units.ts
 *
 * Nominal (branded) unit types for heat and power values in the Atlas engine.
 *
 * These branded types make it a TypeScript compile-time error to pass a raw
 * `number` where a specific unit is expected, eliminating the classic W ↔ kW
 * "off-by-1000" bug that can silently corrupt physics calculations.
 *
 * Usage
 * ─────
 *   import { toWatts, toKilowatts, wattsToKilowatts, kilowattsToWatts } from './units';
 *
 *   const loss = toWatts(3500);       // Watts
 *   const lossKw = wattsToKilowatts(loss);  // Kilowatts
 *
 * Rules
 * ─────
 *   - All heat-loss values stored in AtlasSpatialModelV1 / HeatLossModelV1 are
 *     in Watts — use the `Watts` type.
 *   - All power/output values presented in the engine output or UI are in kW —
 *     use the `Kilowatts` type.
 *   - Never multiply or divide a branded value by 1000 inline; always call the
 *     conversion helpers so conversions are auditable.
 */

// ─── Branded types ────────────────────────────────────────────────────────────

declare const __watts__: unique symbol;
declare const __kilowatts__: unique symbol;

/** A numeric value whose unit is Watts (W). */
export type Watts = number & { readonly [__watts__]: true };

/** A numeric value whose unit is Kilowatts (kW). */
export type Kilowatts = number & { readonly [__kilowatts__]: true };

// ─── Construction helpers ─────────────────────────────────────────────────────

/**
 * Tag a raw numeric value as Watts.
 * Use at trust boundaries (survey input, engine input normalisation, spatial
 * model construction) where the raw numeric value is confirmed to be in W.
 */
export function toWatts(value: number): Watts {
  return value as Watts;
}

/**
 * Tag a raw numeric value as Kilowatts.
 * Use at trust boundaries where the raw numeric value is confirmed to be in kW.
 */
export function toKilowatts(value: number): Kilowatts {
  return value as Kilowatts;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Convert Watts → Kilowatts.
 *
 * This is the ONLY authorised W→kW conversion path.  Never write `value / 1000`
 * inline — always call this function so that all conversions remain auditable.
 */
export function wattsToKilowatts(w: Watts): Kilowatts {
  return (w / 1000) as Kilowatts;
}

/**
 * Convert Kilowatts → Watts.
 *
 * This is the ONLY authorised kW→W conversion path.  Never write `value * 1000`
 * inline — always call this function.
 */
export function kilowattsToWatts(kw: Kilowatts): Watts {
  return (kw * 1000) as Watts;
}

/**
 * Strip the brand and return the raw numeric value in Watts.
 * Use only where a plain `number` is required (e.g. legacy call sites).
 */
export function rawWatts(w: Watts): number {
  return w as number;
}

/**
 * Strip the brand and return the raw numeric value in Kilowatts.
 * Use only where a plain `number` is required (e.g. legacy call sites).
 */
export function rawKilowatts(kw: Kilowatts): number {
  return kw as number;
}
