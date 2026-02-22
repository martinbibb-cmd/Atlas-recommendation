import type { AntiLegionellaInput, AntiLegionellaResult } from '../schema/EngineInputV2_3';

// UK HSE / L8 guidance: weekly thermal disinfection cycle at ≥60°C
const STANDARD_WEEKLY_CYCLES_PER_YEAR = 52;

// Conventional cylinder: must heat entire volume to disinfection temp
// Mixergy: top-down stratification means only upper portion needs to reach temp
const MIXERGY_STRATIFICATION_FRACTION = 0.35; // only top 35% of tank heated for sterilisation
const MIXERGY_STERILISATION_TEMP_C = 50;       // °C – safe with 2-hour dwell via stratification
const MIXERGY_STRATIFICATION_TEMP_C = 60;      // °C – actual top-of-tank temperature

// Water thermal properties
const SPECIFIC_HEAT_WATER_KJ_PER_KG_K = 4.19;
const WATER_DENSITY_KG_PER_L = 1.0;

/**
 * Calculate energy required to heat a cylinder volume from cold-fill temperature
 * to the disinfection setpoint temperature.
 *
 * E (kWh) = m × Cp × ΔT / 3600
 */
function calcHeatingEnergyKwh(
  volumeLitres: number,
  fromTempC: number,
  toTempC: number
): number {
  const massKg = volumeLitres * WATER_DENSITY_KG_PER_L;
  const deltaT = toTempC - fromTempC;
  return (massKg * SPECIFIC_HEAT_WATER_KJ_PER_KG_K * deltaT) / 3600;
}

export function runAntiLegionellaModule(input: AntiLegionellaInput): AntiLegionellaResult {
  const notes: string[] = [];
  const annualLegionellaCycles = input.weeklyHighTempCycleEnabled
    ? STANDARD_WEEKLY_CYCLES_PER_YEAR
    : 0;

  // Baseline cold-water temperature (UK annual average mains supply ~10°C)
  const coldWaterTempC = 10;

  let energyPerCycleKwh: number;

  if (input.systemType === 'mixergy' && input.mixergyStratificationEnabled) {
    // Mixergy heats only the top stratified layer to sterilisation temperature
    const effectiveVolumeLitres = input.dhwStorageLitres * MIXERGY_STRATIFICATION_FRACTION;
    energyPerCycleKwh = calcHeatingEnergyKwh(
      effectiveVolumeLitres,
      coldWaterTempC,
      MIXERGY_STERILISATION_TEMP_C
    );
  } else {
    // Conventional: entire cylinder volume must reach high-temp setpoint
    energyPerCycleKwh = calcHeatingEnergyKwh(
      input.dhwStorageLitres,
      coldWaterTempC,
      input.highTempCycleTempC
    );
  }

  const annualPenaltyKwh = annualLegionellaCycles * energyPerCycleKwh;

  // SCOP penalty: express the Legionella heating energy as an equivalent COP reduction
  // Assuming ~2000 kWh/year nominal DHW demand at nominal SCOP
  const nominalAnnualKwh = 2000;
  const effectiveInputKwh = nominalAnnualKwh / input.nominalSCOP + annualPenaltyKwh;
  const effectiveSCOP = nominalAnnualKwh / effectiveInputKwh;
  const scopPenaltyPct = parseFloat(
    (((input.nominalSCOP - effectiveSCOP) / input.nominalSCOP) * 100).toFixed(2)
  );

  notes.push(
    `🦠 Legionella Control: ${annualLegionellaCycles} thermal disinfection cycles/year. ` +
    `Energy per cycle: ${energyPerCycleKwh.toFixed(2)} kWh. ` +
    `Annual penalty: ${annualPenaltyKwh.toFixed(1)} kWh.`
  );

  notes.push(
    `📉 SCOP Impact: Nominal SCOP ${input.nominalSCOP.toFixed(2)} reduced to ` +
    `${effectiveSCOP.toFixed(2)} (${scopPenaltyPct}% penalty) ` +
    `due to weekly high-temperature Legionella cycles.`
  );

  // Mixergy-specific benefit
  let mixergyBenefit: AntiLegionellaResult['mixergyBenefit'];
  if (input.systemType === 'mixergy') {
    // Conventional equivalent energy (full volume to 60°C)
    const conventionalEnergyPerCycle = calcHeatingEnergyKwh(
      input.dhwStorageLitres,
      coldWaterTempC,
      input.highTempCycleTempC
    );
    const mixergyEnergyPerCycle = input.mixergyStratificationEnabled
      ? calcHeatingEnergyKwh(
          input.dhwStorageLitres * MIXERGY_STRATIFICATION_FRACTION,
          coldWaterTempC,
          MIXERGY_STERILISATION_TEMP_C
        )
      : conventionalEnergyPerCycle;

    const energySavingVsConventionalKwh =
      (conventionalEnergyPerCycle - mixergyEnergyPerCycle) * annualLegionellaCycles;

    mixergyBenefit = {
      stratificationTempC: MIXERGY_STRATIFICATION_TEMP_C,
      sterilizationTempC: MIXERGY_STERILISATION_TEMP_C,
      energySavingVsConventionalKwh: parseFloat(energySavingVsConventionalKwh.toFixed(1)),
      safeSterilizationPossible: true,
    };

    notes.push(
      `✅ Mixergy Stratification Advantage: Top-down stratification enables safe ` +
      `Legionella sterilisation at ${MIXERGY_STERILISATION_TEMP_C}°C (2-hour dwell) ` +
      `by heating only the top ${Math.round(MIXERGY_STRATIFICATION_FRACTION * 100)}% of the ` +
      `tank, saving ${energySavingVsConventionalKwh.toFixed(1)} kWh/year versus ` +
      `whole-cylinder heating to ${input.highTempCycleTempC}°C.`
    );
  }

  return {
    annualLegionellaCycles,
    energyPerCycleKwh: parseFloat(energyPerCycleKwh.toFixed(3)),
    annualPenaltyKwh: parseFloat(annualPenaltyKwh.toFixed(2)),
    effectiveSCOP: parseFloat(effectiveSCOP.toFixed(3)),
    scopPenaltyPct,
    mixergyBenefit,
    notes,
  };
}
