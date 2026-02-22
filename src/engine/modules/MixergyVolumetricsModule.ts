import type { MixergyResult } from '../schema/EngineInputV2_3';

const MIXERGY_LITRES = 150;
const CONVENTIONAL_EQUIVALENT_LITRES = 210;
const FOOTPRINT_SAVING_PCT = Math.round(
  ((CONVENTIONAL_EQUIVALENT_LITRES - MIXERGY_LITRES) / CONVENTIONAL_EQUIVALENT_LITRES) * 100
); // ~29% ≈ 30%
const HEAT_PUMP_COP_IMPROVEMENT_MIN = 5;
const HEAT_PUMP_COP_IMPROVEMENT_MAX = 10;

/**
 * Mixergy Volumetrics Module
 *
 * Mixergy uses active top-down stratification, keeping the hottest water
 * at the top of the cylinder. This prevents cold-water dilution at the outlet,
 * meaning a 150L Mixergy delivers the same usable hot water as a 210L conventional tank.
 *
 * When paired with an ASHP via an external plate heat exchanger:
 * - Cold water is drawn from the very bottom of the tank (coldest possible source)
 * - This maximises the temperature differential for the heat pump
 * - Prevents "coil lock-out" where a conventional coil sits in already-warm water
 * - Results in 5-10% COP improvement
 */
export function runMixergyVolumetricsModule(): MixergyResult {
  const notes: string[] = [
    `📦 Volumetric Advantage: A 150L Mixergy replaces a 210L conventional cylinder ` +
    `(${FOOTPRINT_SAVING_PCT}% footprint saving) through active top-down stratification ` +
    `that eliminates cold-water dilution at the hot outlet.`,

    `🔄 Stratification: Unlike mixed-mass cylinders, Mixergy heats from the top down, ` +
    `ensuring a full layer of ready-to-use hot water is always available at the outlet ` +
    `without mixing with cold supply water.`,

    `🌡️ Heat Pump COP Multiplier: When paired with an ASHP via external plate heat exchanger, ` +
    `Mixergy draws the coldest water from the very base of the tank, maximising ΔT for the ` +
    `heat pump and preventing coil lock-out, delivering a ${HEAT_PUMP_COP_IMPROVEMENT_MIN}–` +
    `${HEAT_PUMP_COP_IMPROVEMENT_MAX}% COP improvement.`,
  ];

  return {
    equivalentConventionalLitres: CONVENTIONAL_EQUIVALENT_LITRES,
    mixergyLitres: MIXERGY_LITRES,
    footprintSavingPct: FOOTPRINT_SAVING_PCT,
    heatPumpCopMultiplierPct: HEAT_PUMP_COP_IMPROVEMENT_MIN,
    notes,
  };
}
