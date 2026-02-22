import type { GridFlexInput, GridFlexResult, HalfHourSlot } from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mixergy Solar X standard grid-import reduction fraction (35%) */
const SOLAR_X_SAVING_FRACTION = 0.35;
/** Enhanced Solar X fraction for 300L+ tanks (active stratification) */
const SOLAR_X_SAVING_FRACTION_300L = 0.40;
/** Minimum tank volume (litres) for enhanced Solar X saving */
const SOLAR_X_ENHANCED_TANK_L = 300;

/** Baseline electricity price used to convert kWh savings to GBP (p/kWh) */
const BASELINE_ELECTRICITY_PENCE_PER_KWH = 24.5;

/** British Gas "Mixergy Extra" annual rebate for eligible customers (GBP) */
const BG_MIXERGY_REBATE_GBP = 40;

// ─── BH/DT Simulated Agile Day (High Renewables) ─────────────────────────────
//
// 48 half-hour slots for a representative "High Renewables" day in the South
// West (BH / DT region).  Prices are calibrated against Octopus Agile BH/DT
// actuals for a day with high wind-plus-solar penetration.
//
// Structure:
//  • 00:00–02:00 (slots  0– 3): night shoulder, ~7–9 p/kWh.
//  • 02:00–05:30 (slots  4–10): cheapest overnight window, ~2–5 p/kWh.
//    This is the optimal 3.5-hour block for the Mixergy "Hot Water Battery."
//  • 05:30–07:00 (slots 11–13): early morning ramp-up, ~9–15 p/kWh.
//  • 07:00–16:00 (slots 14–31): daytime shoulder (solar support), ~14–22 p/kWh.
//  • 16:00–20:00 (slots 32–39): evening peak, ~28–38 p/kWh.
//  • 20:00–24:00 (slots 40–47): late evening taper, ~18–12 p/kWh.

export const BH_DT_HIGH_RENEWABLES_DAY: HalfHourSlot[] = [
  { slotIndex:  0, pricePerKwhPence:  8.5 },  // 00:00
  { slotIndex:  1, pricePerKwhPence:  7.8 },  // 00:30
  { slotIndex:  2, pricePerKwhPence:  7.2 },  // 01:00
  { slotIndex:  3, pricePerKwhPence:  6.5 },  // 01:30
  { slotIndex:  4, pricePerKwhPence:  4.2 },  // 02:00  ← cheapest window start
  { slotIndex:  5, pricePerKwhPence:  3.8 },  // 02:30
  { slotIndex:  6, pricePerKwhPence:  2.9 },  // 03:00  ← absolute cheapest slot
  { slotIndex:  7, pricePerKwhPence:  3.1 },  // 03:30
  { slotIndex:  8, pricePerKwhPence:  3.5 },  // 04:00
  { slotIndex:  9, pricePerKwhPence:  4.0 },  // 04:30
  { slotIndex: 10, pricePerKwhPence:  4.8 },  // 05:00
  { slotIndex: 11, pricePerKwhPence:  9.2 },  // 05:30  ← cheapest window end
  { slotIndex: 12, pricePerKwhPence: 12.4 },  // 06:00
  { slotIndex: 13, pricePerKwhPence: 15.1 },  // 06:30
  { slotIndex: 14, pricePerKwhPence: 17.8 },  // 07:00
  { slotIndex: 15, pricePerKwhPence: 19.2 },  // 07:30
  { slotIndex: 16, pricePerKwhPence: 20.5 },  // 08:00
  { slotIndex: 17, pricePerKwhPence: 21.0 },  // 08:30
  { slotIndex: 18, pricePerKwhPence: 20.8 },  // 09:00
  { slotIndex: 19, pricePerKwhPence: 19.5 },  // 09:30
  { slotIndex: 20, pricePerKwhPence: 18.2 },  // 10:00
  { slotIndex: 21, pricePerKwhPence: 17.0 },  // 10:30
  { slotIndex: 22, pricePerKwhPence: 16.5 },  // 11:00
  { slotIndex: 23, pricePerKwhPence: 15.8 },  // 11:30
  { slotIndex: 24, pricePerKwhPence: 14.5 },  // 12:00
  { slotIndex: 25, pricePerKwhPence: 14.2 },  // 12:30
  { slotIndex: 26, pricePerKwhPence: 14.8 },  // 13:00
  { slotIndex: 27, pricePerKwhPence: 15.5 },  // 13:30
  { slotIndex: 28, pricePerKwhPence: 16.8 },  // 14:00
  { slotIndex: 29, pricePerKwhPence: 18.0 },  // 14:30
  { slotIndex: 30, pricePerKwhPence: 19.8 },  // 15:00
  { slotIndex: 31, pricePerKwhPence: 22.5 },  // 15:30
  { slotIndex: 32, pricePerKwhPence: 28.4 },  // 16:00  ← peak start
  { slotIndex: 33, pricePerKwhPence: 32.1 },  // 16:30
  { slotIndex: 34, pricePerKwhPence: 35.8 },  // 17:00
  { slotIndex: 35, pricePerKwhPence: 38.2 },  // 17:30  ← peak apex
  { slotIndex: 36, pricePerKwhPence: 36.5 },  // 18:00
  { slotIndex: 37, pricePerKwhPence: 33.0 },  // 18:30
  { slotIndex: 38, pricePerKwhPence: 29.8 },  // 19:00
  { slotIndex: 39, pricePerKwhPence: 26.2 },  // 19:30
  { slotIndex: 40, pricePerKwhPence: 22.0 },  // 20:00
  { slotIndex: 41, pricePerKwhPence: 19.5 },  // 20:30
  { slotIndex: 42, pricePerKwhPence: 17.8 },  // 21:00
  { slotIndex: 43, pricePerKwhPence: 16.2 },  // 21:30
  { slotIndex: 44, pricePerKwhPence: 15.0 },  // 22:00
  { slotIndex: 45, pricePerKwhPence: 13.8 },  // 22:30
  { slotIndex: 46, pricePerKwhPence: 12.5 },  // 23:00
  { slotIndex: 47, pricePerKwhPence: 11.2 },  // 23:30
];

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
 * Shifting potential:
 *  - Combi boilers:   0% – must fire on demand; no arbitrage possible.
 *  - Mixergy tanks: 100% – entire 4 kWh daily reheat can be pre-loaded
 *    overnight (typically 02:00–05:30) at the cheapest Agile price.
 *
 * British Gas rebate:
 *  - £40/year "Mixergy Extra" rebate applied when tankType is 'mixergy'
 *    AND provider is 'british_gas'.
 *
 * @param input  Grid flexibility input block (DHW demand, Agile slots, Solar X).
 */
export function runGridFlexModule(input: GridFlexInput): GridFlexResult {
  const notes: string[] = [];

  // ── 0. Shifting potential ─────────────────────────────────────────────────
  // Combi boilers fire on demand and cannot shift; Mixergy tanks are 100% shiftable.
  const shiftingPotentialFraction = input.tankType === 'combi' ? 0 : 1;

  if (input.tankType === 'combi') {
    notes.push(
      `🔥 Combi Boiler detected: shifting potential = 0%. ` +
      `Combi boilers must fire when the tap opens – no Agile load-shifting is possible. ` +
      `Upgrade to a Mixergy stored cylinder to unlock 100% shifting potential.`,
    );
  } else if (input.tankType === 'mixergy') {
    notes.push(
      `🔋 Mixergy Tank detected: shifting potential = 100%. ` +
      `Entire 4 kWh daily reheat can be pre-loaded in the cheapest overnight window (02:00–05:30).`,
    );
  }

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
      shiftingPotentialFraction,
      bgRebateGbp: 0,
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
  // Saving per kWh = difference between average price and cheapest slot,
  // scaled by the shifting potential (0 for combi, 1 for Mixergy).
  const savingPerKwhPence = Math.max(dailyAvgPricePence - cheapest.pricePerKwhPence, 0);
  const annualLoadShiftSavingGbp = parseFloat(
    ((input.dhwAnnualKwh * savingPerKwhPence * shiftingPotentialFraction) / 100).toFixed(2),
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

  // ── 5. British Gas "Mixergy Extra" rebate ─────────────────────────────────
  const bgRebateGbp =
    input.tankType === 'mixergy' && input.provider === 'british_gas'
      ? BG_MIXERGY_REBATE_GBP
      : 0;

  if (bgRebateGbp > 0) {
    notes.push(
      `🏷️ British Gas "Mixergy Extra" rebate: £${bgRebateGbp}/yr applied ` +
      `(Mixergy tank + British Gas tariff combination).`,
    );
  }

  // ── 6. Total saving ───────────────────────────────────────────────────────
  const totalAnnualSavingGbp = parseFloat(
    (annualLoadShiftSavingGbp + mixergySolarXSavingGbp + bgRebateGbp).toFixed(2),
  );

  notes.push(
    `💰 Total annual grid-flexibility saving: £${totalAnnualSavingGbp.toFixed(2)} ` +
    `(load shift £${annualLoadShiftSavingGbp.toFixed(2)} + Solar X £${mixergySolarXSavingGbp.toFixed(2)}` +
    `${bgRebateGbp > 0 ? ` + BG rebate £${bgRebateGbp.toFixed(2)}` : ''}).`,
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
    shiftingPotentialFraction,
    bgRebateGbp,
    notes,
  };
}
