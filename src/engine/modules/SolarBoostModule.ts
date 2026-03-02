import type { EngineInputV2_3, SolarBoostResult, SolarBoostHour } from '../schema/EngineInputV2_3';

// ── Solar availability presets ─────────────────────────────────────────────────

/**
 * Solar window bands per preset.
 * Each entry defines [startHour, endHour] (inclusive) for meaningful solar irradiance.
 */
const SOLAR_WINDOW: Record<'summer' | 'shoulder' | 'winter', [number, number]> = {
  summer:   [8, 18],  // ~10 h window, midday peak
  shoulder: [9, 16],  // ~7 h window
  winter:   [10, 14], // ~4 h window, low irradiance
};

/**
 * Peak solar availability fraction per hour within the window.
 * Approximated as a half-sine arch: fraction = sin(π × position_in_window).
 */

/**
 * Default peak power (kW) delivered to the cylinder when the source is absent.
 * PV diverter: ~2.5 kW (single-phase 10 A immersion path).
 * Solar thermal: ~1.5 kW (coil exchange rate, UK average irradiance).
 */
const DEFAULT_POWER_KW: Record<'PV_diverter' | 'solar_thermal', number> = {
  PV_diverter: 2.5,
  solar_thermal: 1.5,
};

/**
 * Average availability fraction within the solar window, accounting for UK cloud cover:
 * summer ~55%, shoulder ~40%, winter ~25%.
 */
const AVAILABILITY_FRACTION: Record<'summer' | 'shoulder' | 'winter', number> = {
  summer:   0.55,
  shoulder: 0.40,
  winter:   0.25,
};

// ── Main module ───────────────────────────────────────────────────────────────

/**
 * SolarBoostModule
 *
 * Models the effect of a PV diverter or solar thermal coil feeding
 * free heat into the Mixergy (or conventional stored) cylinder during
 * periods of solar availability.
 *
 * Approach:
 *   - For each hour within the solar window, compute available solar heat
 *     as: solarHeatKw = powerKw × availabilityFraction × sin-arch shape factor.
 *   - Sum to total daily solar input (kWh).
 *   - Estimate boiler/HP demand reduction: assumes solar input directly
 *     displaces boiler firing (1:1 kWh displacement for a well-insulated cylinder).
 *
 * Notes:
 *   - This is a first-order estimate; real displacement depends on demand
 *     timing relative to the solar window.
 *   - The hourly profile is intended for the UI "green charge" overlay.
 */
export function runSolarBoostModule(input: EngineInputV2_3): SolarBoostResult {
  const cfg = input.solarBoost;

  if (!cfg?.enabled) {
    return {
      enabled: false,
      source: 'none',
      totalSolarInputKwh: 0,
      boilerDemandReductionKwh: 0,
      hourlyProfile: Array.from({ length: 24 }, (_, h) => ({ hour: h, solarHeatKw: 0 })),
      notes: ['Solar boost not enabled for this scenario.'],
    };
  }

  const source = cfg.source;
  const powerKw = cfg.powerKw ?? DEFAULT_POWER_KW[source];
  const preset = cfg.profilePreset ?? 'shoulder';
  const [winStart, winEnd] = SOLAR_WINDOW[preset];
  const availFraction = AVAILABILITY_FRACTION[preset];
  const windowHours = winEnd - winStart + 1;

  const hourlyProfile: SolarBoostHour[] = [];
  let totalSolarInputKwh = 0;

  for (let h = 0; h < 24; h++) {
    if (h < winStart || h > winEnd) {
      hourlyProfile.push({ hour: h, solarHeatKw: 0 });
      continue;
    }

    // Half-sine arch shape: peaks at midday of the window
    const position = (h - winStart) / Math.max(windowHours - 1, 1); // 0 → 1
    const shapeFactor = Math.sin(Math.PI * position);

    const solarHeatKw = parseFloat((powerKw * availFraction * shapeFactor).toFixed(3));
    hourlyProfile.push({ hour: h, solarHeatKw });
    totalSolarInputKwh += solarHeatKw; // each slot is 1 h → kWh = kW × 1 h
  }

  totalSolarInputKwh = parseFloat(totalSolarInputKwh.toFixed(2));

  // Boiler demand reduction: assume solar input fully displaces boiler reheat
  // (stored cylinder acts as a thermal buffer — solar heat in = boiler firing out).
  const boilerDemandReductionKwh = totalSolarInputKwh;

  const presetNote = `☀️ Solar ${preset} preset: window ${winStart}:00–${winEnd}:00, ` +
    `peak ${powerKw} kW (${source}), availability ${Math.round(availFraction * 100)}%.`;

  const savingNote = `⚡ Estimated daily solar input: ${totalSolarInputKwh} kWh. ` +
    `Boiler/HP demand displaced: ~${boilerDemandReductionKwh} kWh/day.`;

  return {
    enabled: true,
    source,
    totalSolarInputKwh,
    boilerDemandReductionKwh,
    hourlyProfile,
    notes: [presetNote, savingNote],
  };
}
