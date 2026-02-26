import type { EngineInputV2_3, HydraulicModuleV1Result } from '../schema/EngineInputV2_3';

const BOILER_DELTA_T = 20; // °C – conventional system design ΔT
const ASHP_DELTA_T = 5;    // °C – heat pump low-temperature ΔT (≈4× flow vs boiler)
const SPECIFIC_HEAT = 4.19; // kJ/(kg·°C)

/**
 * Compute required mass flow in L/min.
 * flowLpm = powerKw × 60 / (deltaT × Cp)
 */
export function calcFlowLpm(powerKw: number, deltaT: number): number {
  return (powerKw * 60) / (deltaT * SPECIFIC_HEAT);
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

  return {
    boiler:  { deltaT: BOILER_DELTA_T, flowLpm: boilerFlowLpm },
    ashp:    { deltaT: ASHP_DELTA_T,   flowLpm: ashpFlowLpm   },
    verdict: { boilerRisk, ashpRisk },
    notes,
  };
}
