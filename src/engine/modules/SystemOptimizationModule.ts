import type {
  SystemOptimizationInput,
  SystemOptimizationResult,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// Full-job (British Gas model): oversized Type 22 radiators sized to deliver
// full heat load at low flow temperatures → heat pump sweet spot.
const FULL_JOB_FLOW_TEMP_C = 37;  // mid-point of 35–40°C band
const FULL_JOB_SPF_MIN = 3.8;
const FULL_JOB_SPF_MAX = 4.4;
const FULL_JOB_RAD_TYPE = 'Type 22 double-panel convector (oversized)';

// High-temp retrofit (Octopus "Cosy" model): existing radiators retained →
// higher flow temperature needed to meet heat demand → lower SPF.
const HIGH_TEMP_FLOW_TEMP_C = 50;
const HIGH_TEMP_SPF_MIN = 2.9;
const HIGH_TEMP_SPF_MAX = 3.1;
const HIGH_TEMP_RAD_TYPE = 'Existing radiators (retained, not resized)';

// Condensing mode requires return temperature < 55°C.
// For a 20°C ΔT system: return = flow − 20.  So flow must be ≤ 75°C, but
// practically condensing requires return < 55°C → flow < 75°C.
// Both policies are condensing-compatible; however we note that 50°C flow
// results in ~30°C return which is still condensing – the SPF penalty at
// 50°C is from the heat-pump compressor work, not condensing loss.
const CONDENSING_RETURN_THRESHOLD_C = 55;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function returnTemp(flowTempC: number, deltaTc = 20): number {
  return flowTempC - deltaTc;
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * SystemOptimizationModule
 *
 * Models the competitive difference between:
 *  - British Gas "Full Job": oversized Type 22 radiators → 35–40°C flow →
 *    SPF 3.8–4.4 (ASHP efficiency sweet spot).
 *  - Octopus "Cosy" / fast-fit: existing radiators retained → 50°C flow →
 *    SPF 2.9–3.1 (Seasonal Performance Factor significantly degraded).
 *
 * The Comfort Clock visually proves the full-job advantage on cold days.
 */
export function runSystemOptimizationModule(
  input: SystemOptimizationInput
): SystemOptimizationResult {
  const notes: string[] = [];

  const isFullJob = input.installationPolicy === 'full_job';

  const designFlowTempC = isFullJob ? FULL_JOB_FLOW_TEMP_C : HIGH_TEMP_FLOW_TEMP_C;
  const spfRange: [number, number] = isFullJob
    ? [FULL_JOB_SPF_MIN, FULL_JOB_SPF_MAX]
    : [HIGH_TEMP_SPF_MIN, HIGH_TEMP_SPF_MAX];
  const spfMidpoint = parseFloat(((spfRange[0] + spfRange[1]) / 2).toFixed(2));
  const radiatorType = isFullJob ? FULL_JOB_RAD_TYPE : HIGH_TEMP_RAD_TYPE;
  const condensingModeAvailable =
    returnTemp(designFlowTempC) < CONDENSING_RETURN_THRESHOLD_C;

  if (isFullJob) {
    notes.push(
      `✅ Full System Optimisation (British Gas model): New, oversized Type 22 ` +
      `radiators sized for full heat load at ${designFlowTempC}°C flow temperature. ` +
      `SPF modelled at ${spfRange[0]}–${spfRange[1]} — heat pump operates in its ` +
      `efficiency sweet spot throughout the heating season.`
    );
    notes.push(
      `🌡️ Low Flow Temperature Advantage: ${designFlowTempC}°C design flow means the ` +
      `heat pump COP remains high even on the coldest design-day (−3°C external). ` +
      `Comfort Clock "Horizon" line will reflect a flat, stable heating profile.`
    );
  } else {
    notes.push(
      `⚠️ High-Temp Retrofit (fast-fit model): Existing radiators retained. ` +
      `Flow temperature raised to ${designFlowTempC}°C to compensate for undersized ` +
      `emitters. SPF modelled at ${spfRange[0]}–${spfRange[1]} — significantly below ` +
      `full-job performance, especially on cold days.`
    );
    notes.push(
      `📉 SPF Penalty: Operating at ${designFlowTempC}°C flow instead of 35–40°C ` +
      `reduces the heat pump SPF by ~${(FULL_JOB_SPF_MIN - HIGH_TEMP_SPF_MAX).toFixed(1)} ` +
      `points. Over a heating season this translates to materially higher running costs.`
    );
  }

  // Heat loss check: warn if heat loss is high relative to radiator count
  const wattsPerRad = input.heatLossWatts / Math.max(1, input.radiatorCount);
  if (!isFullJob && wattsPerRad > 800) {
    notes.push(
      `🔴 Undersized Emitters Risk: ${wattsPerRad.toFixed(0)} W/radiator at ${input.heatLossWatts} W ` +
      `total heat loss across ${input.radiatorCount} radiators. At ${designFlowTempC}°C flow ` +
      `this property will struggle to maintain design room temperature on peak-demand days. ` +
      `Radiator upgrade strongly recommended.`
    );
  }

  return {
    installationPolicy: input.installationPolicy,
    designFlowTempC,
    spfRange,
    spfMidpoint,
    radiatorType,
    condensingModeAvailable,
    notes,
  };
}
