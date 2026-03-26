/**
 * buildThermalStoreContextFromSurvey.ts
 *
 * Dedicated context builder for thermal store DHW architecture.
 *
 * A thermal store is NOT a potable stored hot water cylinder.  It stores heat
 * (not domestic hot water) in a primary-circuit buffer.  DHW is delivered via
 * an internal heat exchanger — the store never contains potable water.
 *
 * This builder is the ONLY correct path for survey data where
 * dhwStorageType === 'thermal_store'.  It must never be confused with
 * buildStoredHotWaterContextFromSurvey, which is for potable cylinder
 * architectures (vented, unvented, Mixergy, heat-pump cylinder).
 *
 * Design rules:
 *   - Models stored heat, not stored domestic hot water.
 *   - Does not carry cylinder pressure/flow fields (not applicable).
 *   - primaryStoreTempC reflects the primary-circuit store temperature — this
 *     is a high-temperature primary value (75–85 °C), not a domestic water
 *     setpoint.
 *   - storeVolumeLitres is the thermal buffer volume, not a potable water volume.
 */

import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ─── Output type ──────────────────────────────────────────────────────────────

/**
 * Normalised thermal store context derived from a FullSurveyModelV1.
 *
 * Represents the DHW architecture where heat is stored in a primary-circuit
 * buffer and domestic hot water is produced via an internal heat exchanger.
 * This type must never be used in place of StoredHotWaterContext.
 */
export type ThermalStoreContext = {
  /** Discriminator — always 'thermal_store'. */
  architecture: 'thermal_store';
  /**
   * Primary-circuit store temperature (°C), or null if not captured.
   * This is the stored-heat temperature in the primary buffer — not a
   * domestic hot water setpoint.  Thermal stores typically operate at
   * 75–85 °C primary.
   */
  primaryStoreTempC: number | null;
  /**
   * Thermal buffer store volume (litres), or null if not captured.
   * This is the heat buffer volume — not a potable water cylinder volume.
   */
  storeVolumeLitres: number | null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the canonical thermal store context from a FullSurveyModelV1.
 *
 * This is the correct path for surveys where dhwStorageType === 'thermal_store'.
 * Do NOT call buildStoredHotWaterContextFromSurvey for thermal store surveys —
 * that function is reserved for potable stored hot water cylinder architectures.
 *
 * @param survey  Completed (or partial) FullSurveyModelV1 with thermal store data.
 * @returns       Normalised ThermalStoreContext ready for simulator or engine use.
 */
export function buildThermalStoreContextFromSurvey(
  survey: FullSurveyModelV1,
): ThermalStoreContext {
  return {
    architecture: 'thermal_store',
    primaryStoreTempC: survey.storeTempC ?? null,
    storeVolumeLitres: survey.cylinderVolumeLitres ?? null,
  };
}
