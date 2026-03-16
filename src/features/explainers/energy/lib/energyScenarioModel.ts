/**
 * energyScenarioModel.ts — educational grid scenario model.
 *
 * Takes slider inputs and produces indicative output metrics.
 * This is NOT a market forecasting tool; it illustrates directional
 * system-level logic only.
 */

import type { EnergyScenarioSliders, EnergyScenarioOutputs } from '../types/energyTypes';
import { SCENARIO_BASELINE } from '../data/energyScenarioDefaults';
import { estimateGridCarbonIntensity } from './energyMath';

/**
 * Run the educational scenario model.
 *
 * All output scores are [0, 100] where higher means better for heat pumps
 * (except gasDependencePct and balancingStressScore where lower is better).
 */
export function runEnergyScenarioModel(
  sliders: EnergyScenarioSliders,
): EnergyScenarioOutputs {
  const { windPct, solarPct, nuclearPct, hydroTidalPct, storagePct, gasPct } = sliders;

  // ── Carbon intensity ────────────────────────────────────────────────────────
  const carbonIntensityGPerKwh = estimateGridCarbonIntensity({
    windPct,
    solarPct,
    nuclearPct,
    hydroTidalPct,
    storagePct,
    gasPct,
  });

  // ── Gas dependence ──────────────────────────────────────────────────────────
  const totalDispatchable = nuclearPct + gasPct + hydroTidalPct;
  const gasDependencePct =
    totalDispatchable > 0 ? (gasPct / totalDispatchable) * 100 : 0;

  // ── Balancing stress ────────────────────────────────────────────────────────
  // Higher intermittent share without firm backup increases stress.
  // Storage is weighted at 2× because 1 MWh of storage can balance 2 MWh of
  // intermittent output over a typical diurnal cycle.
  // Nuclear is weighted at 0.5× because it is firm but inflexible — it reduces
  // stress less than dispatchable hydro or storage would.
  const intermittentPct = windPct + solarPct;
  const rawStress = Math.max(0, intermittentPct - storagePct * 2 - nuclearPct * 0.5);
  const balancingStressScore = Math.min(100, rawStress);

  // ── Retail electricity pressure ─────────────────────────────────────────────
  // Gas dependence drives 60% of retail price pressure (gas sets the marginal
  // price in most European markets). Balancing stress drives the remaining 40%
  // (higher stress → more expensive ancillary services and reserve capacity).
  // The result is scaled to 70% of maximum to reflect that retail tariffs
  // absorb some of the cost through long-term contract smoothing.
  const retailPressureScore = Math.round(
    (gasDependencePct * 0.6 + balancingStressScore * 0.4) * 0.7,
  );

  // ── Heat pump attractiveness ────────────────────────────────────────────────
  // Attractiveness is split equally (50/50) between:
  //   - Carbon intensity improvement vs baseline: lower carbon → greener electricity
  //   - Gas dependence reduction: less gas dependence → more price stability
  const baselineCi = SCENARIO_BASELINE.baselineCarbonIntensityGPerKwh;
  const ciImprovement = Math.max(0, (baselineCi - carbonIntensityGPerKwh) / baselineCi);
  const gasReduction = Math.max(0, (100 - gasDependencePct) / 100);
  const attractiveness = Math.round((ciImprovement * 0.5 + gasReduction * 0.5) * 100);

  return {
    gasDependencePct: Math.round(gasDependencePct),
    balancingStressScore: Math.round(balancingStressScore),
    carbonIntensityGPerKwh: Math.round(carbonIntensityGPerKwh),
    retailElectricityPressureScore: retailPressureScore,
    heatPumpAttractivenessScore: Math.min(100, attractiveness),
  };
}
