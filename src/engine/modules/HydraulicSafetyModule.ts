import type { EngineInputV2_3, HydraulicResult } from '../schema/EngineInputV2_3';

const SPECIFIC_HEAT_WATER = 4.19; // kJ/(kg·°C)
const STANDARD_DELTA_T = 20;      // °C for conventional systems
const ASHP_DELTA_T_MIN = 5;       // °C
const MAX_VELOCITY_22MM = 1.5;    // m/s
const PIPE_15MM_AREA = Math.PI * (0.006) ** 2; // m² (inner radius ~6mm for 15mm copper)
const PIPE_22MM_AREA = Math.PI * (0.009) ** 2; // m² (inner radius ~9mm for standard 22mm copper)
const PIPE_28MM_AREA = Math.PI * (0.014) ** 2; // m² (inner radius ~14mm)
const BOTTLENECK_THRESHOLD_KW = 19.0;
const MIN_MAINS_PRESSURE_BAR = 1.0;

/**
 * Calculate volumetric flow rate (L/s) from thermal load.
 * Q = P / (ΔT × Cp × ρ) where ρ=1 kg/L for water
 */
export function calcFlowRate(powerKw: number, deltaTc: number): number {
  return powerKw / (deltaTc * SPECIFIC_HEAT_WATER);
}

/**
 * Calculate water velocity (m/s) in a pipe given flow rate and pipe area.
 */
export function calcVelocity(flowRateLs: number, pipeAreaM2: number): number {
  // Convert L/s to m³/s
  return (flowRateLs / 1000) / pipeAreaM2;
}

export function runHydraulicSafetyModule(input: EngineInputV2_3): HydraulicResult {
  const notes: string[] = [];
  const heatLossKw = input.heatLossWatts / 1000;

  // Select pipe cross-section area based on primary pipe diameter
  let pipeArea: number;
  if (input.primaryPipeDiameter >= 28) {
    pipeArea = PIPE_28MM_AREA;
  } else if (input.primaryPipeDiameter >= 22) {
    pipeArea = PIPE_22MM_AREA;
  } else {
    pipeArea = PIPE_15MM_AREA; // 15mm (microbore primaries)
  }

  // Standard system flow
  const flowRateLs = calcFlowRate(heatLossKw, STANDARD_DELTA_T);
  const velocityMs = calcVelocity(flowRateLs, pipeArea);

  // Hydraulic bottleneck check: >19kW on 22mm at 20°C ΔT
  const isBottleneck =
    input.primaryPipeDiameter < 28 && heatLossKw > BOTTLENECK_THRESHOLD_KW;

  if (isBottleneck) {
    notes.push(
      `⚠️ Hydraulic Bottleneck: ${heatLossKw.toFixed(1)}kW load on 22mm pipework ` +
      `exceeds 19.0kW threshold. Velocity ${velocityMs.toFixed(2)}m/s > 1.5m/s limit. ` +
      `Upgrade to 28mm primary pipework required.`
    );
  }

  // Safety lockout: low mains pressure on combi
  const isSafetyCutoffRisk = input.dynamicMainsPressure < MIN_MAINS_PRESSURE_BAR;
  if (isSafetyCutoffRisk) {
    notes.push(
      `🚨 Safety Cut-off Risk: Dynamic mains pressure ${input.dynamicMainsPressure.toFixed(1)}bar ` +
      `< 1.0bar minimum. Combination boiler will lock out to prevent heat exchanger damage ` +
      `during simultaneous hot water draws.`
    );
  }

  // ASHP: requires lower ΔT and therefore higher flow rates → needs 28mm
  const ashpFlowRate = calcFlowRate(heatLossKw, ASHP_DELTA_T_MIN);
  const ashpVelocity22mm = calcVelocity(ashpFlowRate, PIPE_22MM_AREA);
  const ashpRequires28mm = ashpVelocity22mm > MAX_VELOCITY_22MM;

  if (ashpRequires28mm) {
    notes.push(
      `ℹ️ ASHP ΔT Reality: Heat pumps operate at 5–7°C ΔT (vs 20°C for boilers). ` +
      `This demands ${(ashpFlowRate * 1000).toFixed(2)} L/min flow, exceeding 22mm capacity. ` +
      `28mm primary pipework required even for modest 8kW loads.`
    );
  }

  return { flowRateLs, velocityMs, isBottleneck, isSafetyCutoffRisk, ashpRequires28mm, notes };
}
