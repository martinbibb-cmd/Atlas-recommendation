/**
 * energyMath.ts — pure helper functions for the Energy Literacy module.
 *
 * All functions are pure (no side effects) and accept SI units unless
 * otherwise noted.  Components should import from here rather than
 * computing physics inline.
 */

// ─── Primary energy chain ─────────────────────────────────────────────────────

/**
 * Useful heat from a gas boiler per unit of gas consumed.
 *
 * @param boilerEfficiency  e.g. 0.92 for a 92 % efficient condensing boiler
 */
export function estimateUsefulHeatFromBoiler(boilerEfficiency: number): number {
  return boilerEfficiency;
}

/**
 * Useful heat from electric resistance per unit of gas consumed at the power
 * station.
 *
 * @param powerStationEfficiency  e.g. 0.47 for a CCGT gas power station
 */
export function estimateUsefulHeatFromResistanceElectric(
  powerStationEfficiency: number,
): number {
  return powerStationEfficiency; // 1 kWh electricity → 1 kWh heat; loss is upstream
}

/**
 * Useful heat from a heat pump per unit of gas consumed at the power station.
 *
 * @param powerStationEfficiency  e.g. 0.47
 * @param cop                     heat pump coefficient of performance, e.g. 3.2
 */
export function estimateUsefulHeatFromHeatPump(
  powerStationEfficiency: number,
  cop: number,
): number {
  return powerStationEfficiency * cop;
}

/**
 * Minimum COP a heat pump must achieve to deliver cheaper heat per kWh than a
 * gas boiler, assuming both are supplied from the same gas chain.
 *
 * Break-even COP = boilerEfficiency / powerStationEfficiency
 *
 * @param boilerEfficiency        e.g. 0.92
 * @param powerStationEfficiency  e.g. 0.47
 */
export function estimateBreakEvenCopAgainstBoiler(
  boilerEfficiency: number,
  powerStationEfficiency: number,
): number {
  if (powerStationEfficiency <= 0) return Infinity;
  return boilerEfficiency / powerStationEfficiency;
}

// ─── Emitter physics ──────────────────────────────────────────────────────────

/**
 * Plain-language description of what a given flow temperature implies for
 * emitter sizing.
 */
export function explainEmitterEffect(flowTempC: number): string {
  if (flowTempC <= 40)
    return 'Large enough emitter area allows low-temperature heat delivery.';
  if (flowTempC <= 50)
    return 'Emitter area is workable, but efficiency is no longer optimal.';
  return 'Emitter area is too limited, forcing high flow temperature and reducing heat-pump efficiency.';
}

// ─── COP estimation ───────────────────────────────────────────────────────────

/**
 * Simplified heat pump COP estimate based on outdoor temperature and flow
 * temperature.  Uses the Carnot limit scaled by a real-world efficiency factor.
 *
 * Formula:  COP ≈ 0.5 × (flowTempK / (flowTempK − outdoorTempK))
 * (0.5 = typical real-world fraction of Carnot for air-source heat pumps)
 *
 * @param outdoorTempC  Outdoor air temperature in °C
 * @param flowTempC     Required hot-water flow temperature in °C
 */
export function estimateCop(outdoorTempC: number, flowTempC: number): number {
  const outdoorTempK = outdoorTempC + 273.15;
  const flowTempK = flowTempC + 273.15;
  const delta = flowTempK - outdoorTempK;
  if (delta <= 0) return 10; // degenerate case: flow colder than outdoor
  const carnot = flowTempK / delta;
  return Math.max(1.0, Math.min(10, 0.5 * carnot));
}

// ─── Grid scenario model ──────────────────────────────────────────────────────

/**
 * Estimate grid carbon intensity from a rough generation mix.
 *
 * Uses simplified lifecycle g CO₂/kWh intensity factors per source.
 * This is an educational estimate only.
 *
 * @param mixPct  Object mapping source name → percentage of generation
 */
export function estimateGridCarbonIntensity(mixPct: {
  windPct: number;
  solarPct: number;
  nuclearPct: number;
  hydroTidalPct: number;
  // storagePct is accepted for API symmetry with EnergyScenarioSliders but
  // carries zero operational emissions — it is not used in the weighted sum.
  storagePct: number;
  gasPct: number;
}): number {
  const { windPct, solarPct, nuclearPct, hydroTidalPct, gasPct } = mixPct;
  // Operational (not lifecycle) intensity factors (g CO₂/kWh).
  // Wind, solar, nuclear, and hydro/tidal have near-zero operational emissions.
  // Gas is the dominant source at ~450 g CO₂/kWh operational intensity.
  const weighted =
    windPct * 0 +
    solarPct * 0 +
    nuclearPct * 0 +
    hydroTidalPct * 0 +
    gasPct * 450;
  const totalPct = windPct + solarPct + nuclearPct + hydroTidalPct + gasPct;
  if (totalPct <= 0) return 0;
  return weighted / totalPct;
}
