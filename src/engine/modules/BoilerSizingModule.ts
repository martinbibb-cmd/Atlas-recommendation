/**
 * BoilerSizingModule — computes oversize ratio from nominal boiler output vs
 * peak heat loss, and classifies the result into a sizing band.
 *
 * Oversize ratio = nominalKw / peakHeatLossKw
 *
 * Sizing bands:
 *   ≤ 1.3  → well_matched
 *   ≤ 1.8  → mild_oversize
 *   ≤ 2.5  → oversized
 *   > 2.5  → aggressive
 */

/** Fallback nominal output (kW) by boiler type when nominalOutputKw is not provided. */
export const NOMINAL_KW_FALLBACK: Record<string, number> = {
  combi:   24,
  system:  18,
  regular: 18,
  back_boiler: 18,
  unknown: 24,
};

/** Default fallback when boiler type is unknown or absent. */
export const DEFAULT_NOMINAL_KW = 24;

export interface BoilerSizingResultV1 {
  nominalKw: number;
  peakHeatLossKw: number | null;
  oversizeRatio: number | null;
  sizingBand: 'well_matched' | 'mild_oversize' | 'oversized' | 'aggressive';
}

/**
 * Derive the boiler oversize ratio and sizing band.
 *
 * @param nominalOutputKw  Nameplate kW — use NOMINAL_KW_FALLBACK when absent.
 * @param boilerType       Boiler architecture (combi/system/regular/…).
 * @param peakHeatLossKw   Property peak heat loss in kW. Pass null when unknown.
 */
export function runBoilerSizingModuleV1(
  nominalOutputKw: number | undefined,
  boilerType: string | undefined,
  peakHeatLossKw: number | null,
): BoilerSizingResultV1 {
  const nominalKw =
    nominalOutputKw ??
    NOMINAL_KW_FALLBACK[boilerType ?? 'unknown'] ??
    DEFAULT_NOMINAL_KW;

  if (peakHeatLossKw == null || peakHeatLossKw <= 0) {
    return {
      nominalKw,
      peakHeatLossKw: peakHeatLossKw ?? null,
      oversizeRatio: null,
      sizingBand: classifySizingBand(null),
    };
  }

  const ratio = nominalKw / peakHeatLossKw;
  return {
    nominalKw,
    peakHeatLossKw,
    oversizeRatio: ratio,
    sizingBand: classifySizingBand(ratio),
  };
}

/** Map a ratio (or null) to a sizing band label. */
export function classifySizingBand(
  ratio: number | null,
): BoilerSizingResultV1['sizingBand'] {
  // When ratio is unknown we default to 'well_matched' — the most conservative
  // choice that applies no extra cycling penalty, avoiding false alarms when
  // peak heat loss has not been measured.
  if (ratio == null) return 'well_matched';
  if (ratio <= 1.3)  return 'well_matched';
  if (ratio <= 1.8)  return 'mild_oversize';
  if (ratio <= 2.5)  return 'oversized';
  return 'aggressive';
}
