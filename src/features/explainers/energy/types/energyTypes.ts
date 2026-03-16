/**
 * energyTypes.ts — shared type definitions for the Energy Literacy module.
 *
 * All explainer components and data files in this module import from here.
 * Never duplicate these definitions elsewhere.
 */

// ─── Energy source identifiers ────────────────────────────────────────────────

export type EnergySourceId =
  | 'gas'
  | 'coal'
  | 'oil'
  | 'nuclear'
  | 'wind'
  | 'solar'
  | 'hydro'
  | 'tidal'
  | 'storage';

// ─── Energy source facts ──────────────────────────────────────────────────────

export interface EnergySourceFact {
  id: EnergySourceId;
  label: string;
  category: 'combustion' | 'constant' | 'weather' | 'predictable' | 'storage';
  /** Lifecycle CO₂ in grams per kWh of electricity generated. */
  typicalLifecycleCo2gPerKwh?: number;
  /** Deaths per TWh of electricity generated (occupational + accident + air quality). */
  typicalDeathsPerTwh?: number;
  /** Levelised cost of electricity in USD per MWh (low / high range). */
  typicalLcoeUsdPerMwh?: { low: number; high: number };
  dispatchStyle: 'instant' | 'flexible' | 'flat' | 'intermittent' | 'stored';
  /** One-sentence plain-language description. */
  explainer: string;
}

// ─── Heat pump operating point ────────────────────────────────────────────────

export type EmitterAdequacy = 'undersized' | 'adequate' | 'oversized';

export interface HeatPumpOperatingPoint {
  outdoorTempC: number;
  flowTempC: number;
  emitterAdequacy: EmitterAdequacy;
  estimatedCop: number;
}

// ─── Primary energy ladder lane ───────────────────────────────────────────────

export interface PrimaryEnergyLane {
  id: 'boiler' | 'resistance' | 'heatpump';
  label: string;
  steps: PrimaryEnergyStep[];
  usefulHeat: number;
}

export interface PrimaryEnergyStep {
  label: string;
  efficiency: number;
}

// ─── Scenario simulator state ─────────────────────────────────────────────────

export interface EnergyScenarioSliders {
  windPct: number;
  solarPct: number;
  nuclearPct: number;
  hydroTidalPct: number;
  storagePct: number;
  gasPct: number;
}

export interface EnergyScenarioOutputs {
  gasDependencePct: number;
  balancingStressScore: number;
  carbonIntensityGPerKwh: number;
  retailElectricityPressureScore: number;
  heatPumpAttractivenessScore: number;
}
