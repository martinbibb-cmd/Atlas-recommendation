import type { GridFlexInput, GridFlexResult } from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mixergy Solar X standard grid-import reduction fraction (35%) */
const SOLAR_X_SAVING_FRACTION = 0.35;
/** Enhanced Solar X fraction for 300L+ tanks (active stratification) */
const SOLAR_X_SAVING_FRACTION_300L = 0.40;
/** Minimum tank volume (litres) for enhanced Solar X saving */
const SOLAR_X_ENHANCED_TANK_L = 300;

/** Baseline electricity price used to convert kWh savings to GBP (p/kWh) */
const BASELINE_ELECTRICITY_PENCE_PER_KWH = 24.5;

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * GridFlexModule – Hot Water Battery & Grid Flexibility Calculator
 *
 * Models the Mixergy cylinder as a Demand Side Response (DSR) asset.
 * Calculates the annual savings achievable by:
 *
 * 1. Shifting 100% of the daily DHW reheat to the cheapest half-hour slot on
 *    an Octopus Agile tariff.
 * 2. Applying the Mixergy Solar X "Hot Water Battery" grid-import reduction
 *    (35% standard, 40% for 300L+ tanks).
 *
 * @param input  Grid flexibility input block (DHW demand, Agile slots, Solar X).
 */
export function runGridFlexModule(input: GridFlexInput): GridFlexResult {
  const notes: string[] = [];

  if (input.agileSlots.length === 0 || input.dhwAnnualKwh <= 0) {
    notes.push('⚠️ Insufficient data: agileSlots and dhwAnnualKwh are required for DSR calculation.');
    return {
      optimalSlotIndex: 0,
      optimalSlotPricePence: 0,
      dailyAvgPricePence: 0,
      annualLoadShiftSavingGbp: 0,
      mixergySolarXSavingKwh: 0,
      mixergySolarXSavingGbp: 0,
      totalAnnualSavingGbp: 0,
      solarSelfConsumptionFraction: 0,
      notes,
    };
  }

  // ── 1. Find cheapest Agile slot ───────────────────────────────────────────
  const cheapest = input.agileSlots.reduce(
    (min, s) => (s.pricePerKwhPence < min.pricePerKwhPence ? s : min),
    input.agileSlots[0],
  );

  const dailyAvgPricePence =
    input.agileSlots.reduce((acc, s) => acc + s.pricePerKwhPence, 0) / input.agileSlots.length;

  // ── 2. Annual load-shift saving ───────────────────────────────────────────
  // Saving per kWh = difference between average price and cheapest slot
  const savingPerKwhPence = Math.max(dailyAvgPricePence - cheapest.pricePerKwhPence, 0);
  const annualLoadShiftSavingGbp = parseFloat(
    ((input.dhwAnnualKwh * savingPerKwhPence) / 100).toFixed(2),
  );

  notes.push(
    `⚡ Optimal Agile slot: index ${cheapest.slotIndex} at ${cheapest.pricePerKwhPence.toFixed(1)} p/kWh ` +
    `vs. daily average ${dailyAvgPricePence.toFixed(1)} p/kWh. ` +
    `Annual load-shift saving: £${annualLoadShiftSavingGbp.toFixed(2)}.`,
  );

  // ── 3. Mixergy Solar X grid-import reduction ──────────────────────────────
  let mixergySolarXSavingKwh = 0;
  let mixergySolarXSavingGbp = 0;

  if (input.mixergySolarX) {
    const solarXFraction =
      (input.tankVolumeLitres ?? 0) >= SOLAR_X_ENHANCED_TANK_L
        ? SOLAR_X_SAVING_FRACTION_300L
        : SOLAR_X_SAVING_FRACTION;
    mixergySolarXSavingKwh = parseFloat((input.dhwAnnualKwh * solarXFraction).toFixed(2));
    mixergySolarXSavingGbp = parseFloat(
      ((mixergySolarXSavingKwh * BASELINE_ELECTRICITY_PENCE_PER_KWH) / 100).toFixed(2),
    );
    notes.push(
      `🔋 Mixergy Solar X: ${Math.round(solarXFraction * 100)}% grid-import reduction ` +
      `= ${mixergySolarXSavingKwh.toFixed(1)} kWh/yr saved ` +
      `(£${mixergySolarXSavingGbp.toFixed(2)}/yr at ${BASELINE_ELECTRICITY_PENCE_PER_KWH} p/kWh baseline)` +
      `${(input.tankVolumeLitres ?? 0) >= SOLAR_X_ENHANCED_TANK_L ? ' – 300L enhanced rate active.' : '.'}`,
    );
  }

  // ── 4. Solar self-consumption fraction ───────────────────────────────────
  // The fraction of the cylinder's annual demand that can be satisfied from
  // the available solar surplus (capped at 1.0).
  const cappedDhwAnnualKwh = input.cylinderCapacityKwh > 0
    ? Math.min(input.cylinderCapacityKwh * 365, input.dhwAnnualKwh)
    : input.dhwAnnualKwh;

  const solarSelfConsumptionFraction =
    input.annualSolarSurplusKwh != null && cappedDhwAnnualKwh > 0
      ? parseFloat(Math.min(input.annualSolarSurplusKwh / cappedDhwAnnualKwh, 1).toFixed(3))
      : 0;

  if (input.annualSolarSurplusKwh != null) {
    notes.push(
      `☀️ Solar self-consumption: ${(solarSelfConsumptionFraction * 100).toFixed(0)}% of DHW demand ` +
      `covered by ${input.annualSolarSurplusKwh.toFixed(0)} kWh/yr solar surplus.`,
    );
  }

  // ── 5. Total saving ───────────────────────────────────────────────────────
  const totalAnnualSavingGbp = parseFloat(
    (annualLoadShiftSavingGbp + mixergySolarXSavingGbp).toFixed(2),
  );

  notes.push(
    `💰 Total annual grid-flexibility saving: £${totalAnnualSavingGbp.toFixed(2)} ` +
    `(load shift £${annualLoadShiftSavingGbp.toFixed(2)} + Solar X £${mixergySolarXSavingGbp.toFixed(2)}).`,
  );

  return {
    optimalSlotIndex: cheapest.slotIndex,
    optimalSlotPricePence: parseFloat(cheapest.pricePerKwhPence.toFixed(2)),
    dailyAvgPricePence: parseFloat(dailyAvgPricePence.toFixed(2)),
    annualLoadShiftSavingGbp,
    mixergySolarXSavingKwh,
    mixergySolarXSavingGbp,
    totalAnnualSavingGbp,
    solarSelfConsumptionFraction,
    notes,
  };
}
