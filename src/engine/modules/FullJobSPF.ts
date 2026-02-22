import type { FullJobSPFInput, FullJobSPFResult } from '../schema/EngineInputV2_3';

// ─── SPF Curve Constants ──────────────────────────────────────────────────────

// British Gas "Full Job": new oversized Type 22 radiators sized for the full
// heat load at 35–40°C flow temperature.  Heat pump operates in its efficiency
// sweet spot throughout the heating season.
const FULL_JOB_FLOW_TEMP_C = 35;
const FULL_JOB_SPF_MIN = 3.8;
const FULL_JOB_SPF_MAX = 4.4;

// Octopus "Cosy" / Fast Fit: existing radiators retained → higher flow
// temperature needed to meet heat demand → SPF collapses.
const FAST_FIT_FLOW_TEMP_C = 50;
const FAST_FIT_SPF_MIN = 2.9;
const FAST_FIT_SPF_MAX = 3.1;

// Annual electricity consumed (%) relative to annual gas spend – used to
// convert gas spend into an ASHP electricity proxy for running-cost comparison.
// A ASHP-heated home typically replaces gas spend with electricity spend scaled
// by SPF: electricity cost ≈ gas energy / SPF × electricity unit rate.
// Assumes typical UK prices: ~24p/kWh electricity vs ~7p/kWh gas → ratio ≈ 3.5×.
const ELECTRICITY_TO_GAS_PRICE_RATIO = 3.5; // electricity is ~3.5× more expensive per kWh (24p vs 7p)

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * FullJobSPF
 *
 * Compares the Seasonal Performance Factor (SPF) and running cost of two ASHP
 * installation approaches:
 *
 *  - Full Job (British Gas): New, oversized Type 22 radiators sized for full heat
 *    load at 35°C flow → SPF 3.8–4.4.  Heat pump operates in its efficiency sweet
 *    spot; the "Horizon" Comfort Clock line is flat and stable.
 *
 *  - Fast Fit (Octopus "Cosy"): Existing undersized radiators retained → 50°C
 *    flow temperature forced → SPF collapses to 2.9–3.1.
 *
 * The SPF delta (Full Job advantage ≈ 0.9–1.5 points) is translated into an
 * annualised running-cost saving when `annualGasSpendGbp` is provided.
 *
 * Commercial goal: Proves that British Gas technically outperforms Octopus on
 * ASHP installations through proper heat emitter design.
 */
export function runFullJobSPF(input: FullJobSPFInput): FullJobSPFResult {
  const notes: string[] = [];

  const isFullJob = input.installationVariant === 'full_job';

  const designFlowTempC = isFullJob ? FULL_JOB_FLOW_TEMP_C : FAST_FIT_FLOW_TEMP_C;
  const spfRange: [number, number] = isFullJob
    ? [FULL_JOB_SPF_MIN, FULL_JOB_SPF_MAX]
    : [FAST_FIT_SPF_MIN, FAST_FIT_SPF_MAX];
  const spfMidpoint = parseFloat(((spfRange[0] + spfRange[1]) / 2).toFixed(2));

  // SPF delta vs the alternative (only meaningful if fast_fit is chosen)
  const fullJobMidpoint = (FULL_JOB_SPF_MIN + FULL_JOB_SPF_MAX) / 2;
  const fastFitMidpoint = (FAST_FIT_SPF_MIN + FAST_FIT_SPF_MAX) / 2;
  const spfDeltaVsAlternative = isFullJob
    ? 0
    : parseFloat((fullJobMidpoint - fastFitMidpoint).toFixed(2));

  // ── Annual saving estimate ────────────────────────────────────────────────
  // Model: annual running cost ∝ heat demand / SPF × electricity price.
  // Since heat demand is fixed, cost ratio = SPF_fast / SPF_full (for electricity).
  // We convert the "gas spend" input to a comparable electricity spend and compute
  // the saving from a higher SPF.
  let annualSavingGbp: number | null = null;

  if (!isFullJob && input.annualGasSpendGbp) {
    // Estimated annual electricity spend at fast-fit SPF
    const electricityCostFastFit =
      (input.annualGasSpendGbp / fastFitMidpoint) * ELECTRICITY_TO_GAS_PRICE_RATIO;
    // Estimated annual electricity spend at full-job SPF
    const electricityCostFullJob =
      (input.annualGasSpendGbp / fullJobMidpoint) * ELECTRICITY_TO_GAS_PRICE_RATIO;
    annualSavingGbp = parseFloat(
      (electricityCostFastFit - electricityCostFullJob).toFixed(0)
    );
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (isFullJob) {
    notes.push(
      `✅ British Gas "Full Job" (${designFlowTempC}°C flow): New oversized Type 22 ` +
      `radiators sized for full heat load. SPF modelled at ${spfRange[0]}–${spfRange[1]} ` +
      `(midpoint ${spfMidpoint}). Heat pump operates in its efficiency sweet spot, ` +
      `delivering a flat "Horizon" line on the Comfort Clock.`
    );
    notes.push(
      `📊 SPF Advantage: Running at ${designFlowTempC}°C flow vs the Octopus "Cosy" ` +
      `${FAST_FIT_FLOW_TEMP_C}°C approach delivers approximately ` +
      `${(fullJobMidpoint - fastFitMidpoint).toFixed(1)} extra SPF points – ` +
      `translating directly to lower annual running costs.`
    );
  } else {
    notes.push(
      `⚠️ Octopus "Cosy" Fast Fit (${designFlowTempC}°C flow): Existing undersized ` +
      `radiators retained. Flow temperature forced to ${designFlowTempC}°C. ` +
      `SPF collapses to ${spfRange[0]}–${spfRange[1]} (midpoint ${spfMidpoint}).`
    );
    notes.push(
      `📉 SPF Penalty: ${designFlowTempC}°C flow vs Full Job ${FULL_JOB_FLOW_TEMP_C}°C ` +
      `reduces SPF by ~${spfDeltaVsAlternative.toFixed(1)} points. ` +
      `Upgrading to a Full Job specification (Type 22 radiators, ` +
      `${FULL_JOB_FLOW_TEMP_C}°C design flow) would raise SPF to ` +
      `${FULL_JOB_SPF_MIN}–${FULL_JOB_SPF_MAX} and materially lower running costs.`
    );

    if (annualSavingGbp !== null) {
      notes.push(
        `💰 Estimated Annual Saving from Full Job Upgrade: £${annualSavingGbp}/yr ` +
        `(based on £${input.annualGasSpendGbp} annual gas spend, SPF midpoints ` +
        `${spfMidpoint} vs ${fullJobMidpoint.toFixed(2)}, electricity/gas price ratio ${ELECTRICITY_TO_GAS_PRICE_RATIO}×).`
      );
    }
  }

  return {
    installationVariant: input.installationVariant,
    designFlowTempC,
    spfRange,
    spfMidpoint,
    spfDeltaVsAlternative,
    annualSavingGbp,
    notes,
  };
}
