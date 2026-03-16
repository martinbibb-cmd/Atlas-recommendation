/**
 * energyScenarioDefaults.ts — default slider values and baseline constants
 * for the Energy Scenario Simulator.
 *
 * These represent approximate current UK grid mix (2023 data).
 */

import type { EnergyScenarioSliders } from '../types/energyTypes';

/**
 * Approximate UK 2023 grid generation mix percentages.
 * Source: National Grid ESO / DESNZ 2023 provisional statistics.
 */
export const DEFAULT_SCENARIO_SLIDERS: EnergyScenarioSliders = {
  windPct: 28,
  solarPct: 5,
  nuclearPct: 15,
  hydroTidalPct: 3,
  storagePct: 4,
  gasPct: 32,
};

/**
 * UK grid baseline values used by the scenario model.
 */
export const SCENARIO_BASELINE = {
  /** 2023 average UK grid carbon intensity (g CO₂/kWh). Source: National Grid ESO. */
  baselineCarbonIntensityGPerKwh: 233,

  /** Assumed power-station gas-to-electricity conversion efficiency. */
  gasToElectricEfficiencyPct: 47,

  /** Nominal boiler efficiency for break-even COP calculation. */
  boilerEfficiencyPct: 92,

  /** Approximate UK 2024 electricity retail price (p/kWh, inc. standing charge). */
  typicalElectricityPricePencePerKwh: 28,

  /** Approximate UK 2024 gas retail price (p/kWh). */
  typicalGasPricePencePerKwh: 6.5,
} as const;
