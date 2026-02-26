import type { EngineInputV2_3, HydraulicModuleV1Result } from '../schema/EngineInputV2_3';

const BOILER_DELTA_T = 20; // °C – conventional system design ΔT
const ASHP_DELTA_T = 5;    // °C – heat pump low-temperature ΔT (≈4× flow vs boiler)
const SPECIFIC_HEAT = 4.19; // kJ/(kg·°C)

// Recommended velocity band for copper primary pipework (m/s)
const VELOCITY_LOWER_M_S = 0.8;
const VELOCITY_UPPER_M_S = 1.5;

/**
 * Pipe inner cross-sectional area (m²) keyed by nominal outer diameter (mm).
 * Based on EN 1057 copper tube bore dimensions.
 */
const PIPE_BORE_AREA_M2: Record<number, number> = {
  15: Math.PI * (0.006) ** 2,   // ~12 mm bore → r = 6 mm
  22: Math.PI * (0.010) ** 2,   // ~20 mm bore → r = 10 mm
  28: Math.PI * (0.013) ** 2,   // ~26 mm bore → r = 13 mm
  35: Math.PI * (0.016) ** 2,   // ~32 mm bore → r = 16 mm
};

/**
 * Base ASHP COP used when computing the velocity-penalised effective COP.
 * Represents a typical seasonal performance factor at standard conditions.
 */
const BASE_ASHP_COP = 3.2;

/**
 * Clamp a value to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute required mass flow in L/min.
 * flowLpm = powerKw × 60 / (deltaT × Cp)
 */
export function calcFlowLpm(powerKw: number, deltaT: number): number {
  return (powerKw * 60) / (deltaT * SPECIFIC_HEAT);
}

/**
 * Convert a flow in L/min to a velocity in m/s for a given pipe diameter.
 * velocity = (flowLpm / 1000 / 60) / pipeArea_m2
 */
export function calcVelocityFromLpm(flowLpm: number, pipeDiameterMm: number): number {
  const areas = [35, 28, 22, 15] as const;
  const key = areas.find(k => pipeDiameterMm >= k) ?? 15;
  const area = PIPE_BORE_AREA_M2[key];
  return (flowLpm / 1000 / 60) / area;
}

/**
 * Per-pipe-diameter thresholds (kW) for boiler and ASHP circuits.
 * Conservative values calibrated to copper pipe velocity / erosion limits.
 */
export const PIPE_THRESHOLDS = {
  15: { boilerWarnKw: 4,  boilerFailKw: 6,  ashpWarnKw: 2,  ashpFailKw: 4  },
  22: { boilerWarnKw: 19, boilerFailKw: 26, ashpWarnKw: 8,  ashpFailKw: 14 },
  28: { boilerWarnKw: 30, boilerFailKw: 40, ashpWarnKw: 15, ashpFailKw: 22 },
  35: { boilerWarnKw: 40, boilerFailKw: 55, ashpWarnKw: 20, ashpFailKw: 30 },
} as const;

type PipeKey = keyof typeof PIPE_THRESHOLDS;

function resolveThresholds(diameter: number) {
  const key = ([35, 28, 22, 15] as PipeKey[]).find(k => diameter >= k) ?? 15;
  return PIPE_THRESHOLDS[key];
}

function classifyRisk(
  powerKw: number,
  warnKw: number,
  failKw: number,
): 'pass' | 'warn' | 'fail' {
  if (powerKw >= failKw) return 'fail';
  if (powerKw >= warnKw) return 'warn';
  return 'pass';
}

export function runHydraulicModuleV1(input: EngineInputV2_3): HydraulicModuleV1Result {
  const heatLossKw = input.heatLossWatts / 1000;
  const boilerFlowLpm = calcFlowLpm(heatLossKw, BOILER_DELTA_T);
  const ashpFlowLpm   = calcFlowLpm(heatLossKw, ASHP_DELTA_T);

  // ── Velocity calculation for ASHP circuit ─────────────────────────────────
  const ashpVelocityMs = calcVelocityFromLpm(ashpFlowLpm, input.primaryPipeDiameter);

  // ── Continuous velocity penalty: clamp((v − 1.5) / 1.0, 0, 1) ───────────
  const velocityPenalty = clamp((ashpVelocityMs - VELOCITY_UPPER_M_S) / 1.0, 0, 1);

  // ── Effective COP degraded by velocity penalty ────────────────────────────
  const effectiveCOP = parseFloat(
    (BASE_ASHP_COP * (1 - 0.25 * velocityPenalty)).toFixed(2),
  );

  const thresholds = resolveThresholds(input.primaryPipeDiameter);
  const boilerRisk  = classifyRisk(heatLossKw, thresholds.boilerWarnKw, thresholds.boilerFailKw);
  const ashpRisk    = classifyRisk(heatLossKw, thresholds.ashpWarnKw,   thresholds.ashpFailKw);

  const notes: string[] = [];

  if (boilerRisk === 'fail') {
    notes.push(
      `⚠️ Hydraulic Warning: ${heatLossKw.toFixed(1)}kW heat loss exceeds the safe boiler flow ` +
      `capacity of ${input.primaryPipeDiameter}mm primary pipework. ` +
      `Required flow: ${boilerFlowLpm.toFixed(1)} L/min at ΔT ${BOILER_DELTA_T}°C. ` +
      `Pipe upgrade recommended.`
    );
  } else if (boilerRisk === 'warn') {
    notes.push(
      `⚠️ Hydraulic Warning: ${heatLossKw.toFixed(1)}kW approaches the safe capacity for ` +
      `${input.primaryPipeDiameter}mm primaries at ΔT ${BOILER_DELTA_T}°C ` +
      `(${boilerFlowLpm.toFixed(1)} L/min). Monitor for noise and erosion.`
    );
  }

  // Safe capacity for current pipe at ASHP ΔT = flow at the warn threshold
  const ashpSafeFlowLpm = calcFlowLpm(thresholds.ashpWarnKw, ASHP_DELTA_T);

  if (ashpRisk === 'fail') {
    notes.push(
      `❌ ASHP at ΔT ${ASHP_DELTA_T}°C requires ${ashpFlowLpm.toFixed(1)} L/min\n` +
      `▸ ${input.primaryPipeDiameter}mm pipe max safe flow: ~${ashpSafeFlowLpm.toFixed(0)} L/min\n` +
      `▸ Velocity = ${(ashpFlowLpm / ashpSafeFlowLpm).toFixed(1)}× safe limit\n` +
      `▸ Upgrade to 28mm would enable this option.`
    );
  } else if (ashpRisk === 'warn') {
    notes.push(
      `⚠️ ASHP at ΔT ${ASHP_DELTA_T}°C demands ${ashpFlowLpm.toFixed(1)} L/min ` +
      `(~${(ashpFlowLpm / boilerFlowLpm).toFixed(1)}× boiler flow). ` +
      `${input.primaryPipeDiameter}mm primary pipework is marginal — performance may be clipped ` +
      `and pipe erosion is possible. Consider upgrading to 28mm.`
    );
  }

  // ── Velocity penalty note ─────────────────────────────────────────────────
  if (velocityPenalty > 0) {
    const velocityBand =
      ashpVelocityMs >= VELOCITY_UPPER_M_S + 1.0
        ? 'severe'
        : ashpVelocityMs >= VELOCITY_UPPER_M_S
          ? 'elevated'
          : 'acceptable';
    if (velocityBand !== 'acceptable') {
      notes.push(
        `📉 Velocity Penalty: ASHP circuit velocity ${ashpVelocityMs.toFixed(2)} m/s ` +
        `exceeds the ${VELOCITY_LOWER_M_S}–${VELOCITY_UPPER_M_S} m/s recommended band. ` +
        `velocityPenalty = ${velocityPenalty.toFixed(2)} → effective COP reduced to ${effectiveCOP} ` +
        `(from base ${BASE_ASHP_COP}). Upgrading primary pipework reduces this penalty continuously.`
      );
    }
  }

  return {
    boiler:  { deltaT: BOILER_DELTA_T, flowLpm: boilerFlowLpm },
    ashp:    { deltaT: ASHP_DELTA_T,   flowLpm: ashpFlowLpm, velocityMs: ashpVelocityMs },
    verdict: { boilerRisk, ashpRisk },
    velocityPenalty,
    effectiveCOP,
    notes,
  };
}
