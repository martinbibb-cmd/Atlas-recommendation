/**
 * energyFormatting.ts — display-layer formatting helpers for the Energy
 * Literacy module.
 *
 * All functions return ready-to-render strings.  Keep number-formatting
 * logic here so components stay declarative.
 */

/**
 * Format a CO₂ intensity value (g/kWh) with unit.
 * e.g. 233 → "233 g CO₂/kWh"
 */
export function formatCo2Intensity(gPerKwh: number): string {
  return `${Math.round(gPerKwh)} g CO₂/kWh`;
}

/**
 * Format a deaths-per-TWh safety figure.
 * e.g. 0.03 → "0.03 deaths/TWh"
 */
export function formatDeathsPerTwh(value: number): string {
  if (value < 0.01) return `<0.01 deaths/TWh`;
  return `${value.toFixed(2)} deaths/TWh`;
}

/**
 * Format a LCOE range.
 * e.g. { low: 24, high: 75 } → "$24–75/MWh"
 */
export function formatLcoeRange(range: { low: number; high: number }): string {
  return `$${range.low}–${range.high}/MWh`;
}

/**
 * Format a COP value to 1 decimal place.
 * e.g. 3.2 → "COP 3.2"
 */
export function formatCop(cop: number): string {
  return `COP ${cop.toFixed(1)}`;
}

/**
 * Format a useful-heat fraction as a percentage.
 * e.g. 0.92 → "92%"
 */
export function formatEfficiencyPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Format a temperature.
 * e.g. 45 → "45 °C"
 */
export function formatTempC(tempC: number): string {
  return `${tempC} °C`;
}
