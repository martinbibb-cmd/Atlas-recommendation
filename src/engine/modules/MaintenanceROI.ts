import type { MaintenanceROIInput, MaintenanceROIResult } from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// Magnetite sludge penalty: 7% of annual gas spend when no magnetic filter is fitted.
// Source: Baxi / HHIC research – sludge increases bills by 7% and reduces
// radiator heat output by up to 47%.
const SLUDGE_PENALTY_FACTOR = 0.07;

// DHW scale penalty: 11% of annual gas spend when postcode CaCO₃ > 200 ppm
// and no scale inhibitor or softener is used.
// Source: SEDBUK / CIBSE – 8% efficiency drop per 1 mm scale; 1.6 mm layer = 11% fuel increase.
const SCALING_PENALTY_FACTOR = 0.11;

// CaCO₃ threshold above which the scaling penalty applies (mg/L = ppm)
const SCALING_THRESHOLD_PPM = 200;

// Assumed cost of a professional system power-flush (£)
const FLUSH_COST_GBP = 500;

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * MaintenanceROI
 *
 * Calculates the "Cost of Inaction" to power the HomeCare / Hive Premium
 * subscription sell by quantifying the annual financial penalty from:
 *
 * 1. Magnetite sludge (primary circuit): 7% of total annual gas spend
 *    when no magnetic filter is present.
 * 2. DHW scale (secondary circuit): 11% of total annual gas spend
 *    when the postcode CaCO₃ level exceeds 200 ppm and no softener is fitted.
 *
 * The flush payback period is then: £500 / annualCostOfInaction.
 */
export function runMaintenanceROI(input: MaintenanceROIInput): MaintenanceROIResult {
  const notes: string[] = [];

  // ── 1. Sludge penalty ────────────────────────────────────────────────────
  const sludgePenaltyGbpPerYear = input.hasMagneticFilter
    ? 0
    : parseFloat((SLUDGE_PENALTY_FACTOR * input.annualGasSpendGbp).toFixed(2));

  if (input.hasMagneticFilter) {
    notes.push(
      `🧲 Sludge: Magnetic filter fitted – magnetite sludge tax cleared. ` +
      `No sludge penalty applied.`
    );
  } else {
    notes.push(
      `🔩 Sludge Penalty (${(SLUDGE_PENALTY_FACTOR * 100).toFixed(0)}% bill increase): ` +
      `No magnetic filter detected. Magnetite sludge costs £${sludgePenaltyGbpPerYear.toFixed(0)}/yr. ` +
      `Fit a Fernox TF1 or equivalent to eliminate this penalty.`
    );
  }

  // ── 2. Scaling penalty ───────────────────────────────────────────────────
  const scaleApplies = input.cacO3LevelMgL > SCALING_THRESHOLD_PPM && !input.hasSoftener;
  const scalingPenaltyGbpPerYear = scaleApplies
    ? parseFloat((SCALING_PENALTY_FACTOR * input.annualGasSpendGbp).toFixed(2))
    : 0;

  if (input.hasSoftener) {
    notes.push(
      `✅ Scaling: Water softener fitted – DHW scale penalty cleared. ` +
      `${(SCALING_PENALTY_FACTOR * 100).toFixed(0)}% efficiency gain retained.`
    );
  } else if (scaleApplies) {
    const silicateNote = input.isHighSilica
      ? `Your postcode's high silicates make scale ~10× harder to remove. `
      : '';
    notes.push(
      `🔥 Scaling Penalty (${(SCALING_PENALTY_FACTOR * 100).toFixed(0)}% bill increase): ` +
      `CaCO₃ level ${input.cacO3LevelMgL} ppm exceeds ${SCALING_THRESHOLD_PPM} ppm threshold. ` +
      `${silicateNote}` +
      `Scale costs £${scalingPenaltyGbpPerYear.toFixed(0)}/yr. ` +
      `Scale inhibitor or softener treatment recommended.`
    );
  } else {
    notes.push(
      `✅ Scaling: CaCO₃ ${input.cacO3LevelMgL} ppm is at or below the ` +
      `${SCALING_THRESHOLD_PPM} ppm threshold – no scale penalty applied.`
    );
  }

  // ── 3. Cost of Inaction & flush payback ──────────────────────────────────
  const totalAnnualCostGbp = parseFloat(
    (sludgePenaltyGbpPerYear + scalingPenaltyGbpPerYear).toFixed(2)
  );

  const flushPaybackYears =
    totalAnnualCostGbp > 0
      ? parseFloat((FLUSH_COST_GBP / totalAnnualCostGbp).toFixed(1))
      : null;

  // ── 4. Sell message ───────────────────────────────────────────────────────
  let message: string;
  if (flushPaybackYears !== null) {
    const silicateClause = input.isHighSilica
      ? `Based on your postcode's high silicates, `
      : `Based on your water quality, `;
    message =
      `${silicateClause}a professional flush will pay for itself in ` +
      `${flushPaybackYears} years through restored efficiency. ` +
      `You are currently losing £${totalAnnualCostGbp.toFixed(0)}/yr.`;
  } else {
    message = `No maintenance cost penalties detected. System is running efficiently.`;
  }

  if (totalAnnualCostGbp > 0) {
    notes.push(
      `💰 Cost of Inaction: Sludge £${sludgePenaltyGbpPerYear.toFixed(0)}/yr + ` +
      `Scale £${scalingPenaltyGbpPerYear.toFixed(0)}/yr = ` +
      `£${totalAnnualCostGbp.toFixed(0)}/yr. ${message}`
    );
  }

  return {
    sludgePenaltyGbpPerYear,
    scalingPenaltyGbpPerYear,
    totalAnnualCostGbp,
    flushPaybackYears,
    message,
    notes,
  };
}
