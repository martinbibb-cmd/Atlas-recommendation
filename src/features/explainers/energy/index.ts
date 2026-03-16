/**
 * src/features/explainers/energy/index.ts
 *
 * Barrel export for the Energy Literacy module.
 *
 * Import order:
 *   1. Types
 *   2. Data
 *   3. Lib helpers
 *   4. Components (leaf → panel)
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  EnergySourceId,
  EnergySourceFact,
  HeatPumpOperatingPoint,
  EmitterAdequacy,
  PrimaryEnergyLane,
  PrimaryEnergyStep,
  EnergyScenarioSliders,
  EnergyScenarioOutputs,
} from './types/energyTypes';

// ─── Data ─────────────────────────────────────────────────────────────────────
export { ENERGY_SOURCE_FACTS, ENERGY_SOURCE_BY_ID } from './data/energySourceFacts';
export { ENERGY_COPY } from './data/energyExplainerCopy';
export { DEFAULT_SCENARIO_SLIDERS, SCENARIO_BASELINE } from './data/energyScenarioDefaults';

// ─── Lib ──────────────────────────────────────────────────────────────────────
export {
  estimateUsefulHeatFromBoiler,
  estimateUsefulHeatFromResistanceElectric,
  estimateUsefulHeatFromHeatPump,
  estimateBreakEvenCopAgainstBoiler,
  explainEmitterEffect,
  estimateCop,
  estimateGridCarbonIntensity,
} from './lib/energyMath';

export {
  formatCo2Intensity,
  formatDeathsPerTwh,
  formatLcoeRange,
  formatCop,
  formatEfficiencyPct,
  formatTempC,
} from './lib/energyFormatting';

export { runEnergyScenarioModel } from './lib/energyScenarioModel';

// ─── Components ───────────────────────────────────────────────────────────────
export { default as EnergyExplainerCard } from './components/EnergyExplainerCard';
export { default as PrimaryEnergyLadder } from './components/PrimaryEnergyLadder';
export { default as SpongeHeatPumpExplainer } from './components/SpongeHeatPumpExplainer';
export { default as BigEmitterExplainer } from './components/BigEmitterExplainer';
export { default as TortoiseVsBeeExplainer } from './components/TortoiseVsBeeExplainer';
export { default as SourceSafetyTable } from './components/SourceSafetyTable';
export { default as SourceEmissionsTable } from './components/SourceEmissionsTable';
export { default as SourceCostTable } from './components/SourceCostTable';
export { default as GridMixStack } from './components/GridMixStack';
export { default as CopBreakEvenChart } from './components/CopBreakEvenChart';
export { default as EnergyScenarioSimulator } from './components/EnergyScenarioSimulator';

// ─── Top-level panel (assembles all components) ───────────────────────────────
export { default as EnergyLiteracyPanel } from './components/EnergyLiteracyPanel';
