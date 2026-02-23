import type {
  ConnectedEngineInputV2_4,
  ConnectedInsightResult,
  ThermalDecayResult,
  BaseloadIsolationResult,
  DsrSavingsResult,
  MagicLinkResult,
  ComparisonTrace,
  HalfHourSlot,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Half-hourly kW threshold for combi boiler ignition spikes (DHW draws) */
const COMBI_SPIKE_KW_THRESHOLD = 19.0;

/** Fraction of grid import reduction due to Mixergy Solar X battery effect (standard) */
const MIXERGY_SOLAR_X_SAVING_FRACTION = 0.35;
/** Enhanced fraction for 300L+ tank – active stratification captures more solar surplus */
const MIXERGY_SOLAR_X_SAVING_FRACTION_300L = 0.40;
/** Minimum tank volume (litres) for enhanced Solar X saving */
const MIXERGY_SOLAR_X_ENHANCED_TANK_L = 300;

/** Assumed average UK electricity price for baseline savings calc (p/kWh) */
const BASELINE_ELECTRICITY_PENCE_PER_KWH = 24.5;

// ─── Thermal Decay Ingestion (Hive) ──────────────────────────────────────────

/**
 * Derives the building's Thermal Time Constant (τ) from Hive thermostat history.
 *
 * Method: identifies "cooling windows" (consecutive readings where temperature
 * is falling with no heating active), computes the average °C/hr drop, and
 * derives τ = ΔT / cooling_rate where ΔT is the indoor-to-outdoor delta.
 *
 * @param telemetry  Timestamped thermostat readings from Hive.
 * @param referenceExternalTempC  Typical outdoor temperature during the logged period (°C).
 */
export function deriveThermalTimeConstant(
  telemetry: { t: string; v: number }[],
  referenceExternalTempC: number = 5,
): ThermalDecayResult {
  const notes: string[] = [];

  if (telemetry.length < 2) {
    notes.push('⚠️ Insufficient Hive telemetry: at least 2 readings required.');
    return { thermalTimeConstantHours: 0, coolingRateCPerHour: 0, referenceExternalTempC, notes };
  }

  // Sort chronologically
  const sorted = [...telemetry].sort((a, b) => a.t.localeCompare(b.t));

  // Identify cooling intervals (temperature drop between consecutive readings)
  const coolingRates: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const tempDrop = prev.v - curr.v;
    if (tempDrop <= 0) continue; // heating or steady – skip

    const dtMs = new Date(curr.t).getTime() - new Date(prev.t).getTime();
    if (dtMs <= 0) continue;
    const dtHours = dtMs / 3_600_000;
    coolingRates.push(tempDrop / dtHours);
  }

  if (coolingRates.length === 0) {
    notes.push('⚠️ No cooling windows detected in Hive telemetry. τ cannot be derived.');
    return { thermalTimeConstantHours: 0, coolingRateCPerHour: 0, referenceExternalTempC, notes };
  }

  const avgCoolingRate = coolingRates.reduce((a, b) => a + b, 0) / coolingRates.length;

  // Estimate indoor temperature (median of all readings)
  const temps = sorted.map(r => r.v).sort((a, b) => a - b);
  const medianIndoorTempC = temps[Math.floor(temps.length / 2)];

  const deltaT = Math.max(medianIndoorTempC - referenceExternalTempC, 1); // prevent /0
  const tau = deltaT / avgCoolingRate;

  notes.push(
    `🌡️ Thermal Time Constant τ = ${tau.toFixed(1)} h derived from ${coolingRates.length} cooling window(s). ` +
    `Average cooling rate: ${avgCoolingRate.toFixed(2)} °C/hr.`,
  );

  return {
    thermalTimeConstantHours: parseFloat(tau.toFixed(2)),
    coolingRateCPerHour: parseFloat(avgCoolingRate.toFixed(3)),
    referenceExternalTempC,
    notes,
  };
}

// ─── Baseload Isolation (Octopus Half-Hourly) ─────────────────────────────────

/**
 * Splits half-hourly gas consumption readings into DHW spikes and steady
 * space-heating baseload.
 *
 * DHW spikes are identified as half-hour slots where the peak power
 * exceeds COMBI_SPIKE_KW_THRESHOLD (19 kW), typical of a combi boiler firing
 * for a short draw.
 *
 * @param halfHourlyKwh  Array of energy values for each half-hour slot (kWh).
 */
export function isolateBaseload(halfHourlyKwh: number[]): BaseloadIsolationResult {
  const notes: string[] = [];

  if (halfHourlyKwh.length === 0) {
    notes.push('⚠️ No half-hourly data supplied.');
    return { estimatedDhwKwh: 0, estimatedSpaceHeatingKwh: 0, highIntensitySpikeCount: 0, notes };
  }

  let dhwKwh = 0;
  let spaceHeatingKwh = 0;
  let spikeCount = 0;

  for (const kwhSlot of halfHourlyKwh) {
    // Convert kWh in a 30-min slot to peak kW (× 2)
    const peakKw = kwhSlot * 2;
    if (peakKw > COMBI_SPIKE_KW_THRESHOLD) {
      dhwKwh += kwhSlot;
      spikeCount++;
    } else {
      spaceHeatingKwh += kwhSlot;
    }
  }

  notes.push(
    `🔥 Baseload isolation complete. DHW: ${dhwKwh.toFixed(1)} kWh from ${spikeCount} spike(s). ` +
    `Space heating: ${spaceHeatingKwh.toFixed(1)} kWh across ${halfHourlyKwh.length} slots.`,
  );

  return {
    estimatedDhwKwh: parseFloat(dhwKwh.toFixed(2)),
    estimatedSpaceHeatingKwh: parseFloat(spaceHeatingKwh.toFixed(2)),
    highIntensitySpikeCount: spikeCount,
    notes,
  };
}

// ─── DSR Savings Calculator ───────────────────────────────────────────────────

/**
 * Simulates shifting the DHW load to the cheapest daily half-hour slot on
 * the Octopus Agile tariff and optionally applies the Mixergy Solar X
 * "Hot Water Battery" 35% grid-import reduction (40% for 300L+ tank).
 *
 * @param dhwAnnualKwh      Annual DHW demand to shift (kWh).
 * @param agileSlots        48 half-hour price slots for a representative day (p/kWh).
 * @param mixergySolarX     Whether the Mixergy Solar X integration is enabled.
 * @param tankVolumeLitres  Tank volume (litres) – 300L+ triggers enhanced 40% saving.
 */
export function calculateDsrSavings(
  dhwAnnualKwh: number,
  agileSlots: HalfHourSlot[],
  mixergySolarX: boolean,
  tankVolumeLitres?: number,
): DsrSavingsResult {
  const notes: string[] = [];

  if (agileSlots.length === 0 || dhwAnnualKwh <= 0) {
    notes.push('⚠️ Insufficient data for DSR calculation.');
    return {
      annualLoadShiftSavingKwh: 0,
      annualLoadShiftSavingGbp: 0,
      mixergySolarXSavingKwh: 0,
      optimalSlotIndex: 0,
      notes,
    };
  }

  // Find the cheapest slot
  const cheapest = agileSlots.reduce(
    (min, s) => (s.pricePerKwhPence < min.pricePerKwhPence ? s : min),
    agileSlots[0],
  );

  // Average price across all slots
  const avgPricePence =
    agileSlots.reduce((acc, s) => acc + s.pricePerKwhPence, 0) / agileSlots.length;

  // Saving = shifting from average to cheapest price
  const savingPerKwhPence = Math.max(avgPricePence - cheapest.pricePerKwhPence, 0);
  const annualLoadShiftSavingGbp = (dhwAnnualKwh * savingPerKwhPence) / 100;

  // In kWh terms: express the financial saving as a notional energy equivalent
  // by normalising against the baseline tariff rate. This allows the saving to be
  // compared on an energy basis (e.g. for SAP/EPC calculations) even though the
  // real benefit is financial – a price ratio of 1.0 means no kWh saving.
  const annualLoadShiftSavingKwh =
    BASELINE_ELECTRICITY_PENCE_PER_KWH > 0
      ? dhwAnnualKwh * (savingPerKwhPence / BASELINE_ELECTRICITY_PENCE_PER_KWH)
      : 0;

  // Mixergy Solar X: 35% reduction in grid import on top of load shift (40% for 300L+ tank)
  const solarXFraction = (mixergySolarX && (tankVolumeLitres ?? 0) >= MIXERGY_SOLAR_X_ENHANCED_TANK_L)
    ? MIXERGY_SOLAR_X_SAVING_FRACTION_300L
    : MIXERGY_SOLAR_X_SAVING_FRACTION;
  const mixergySolarXSavingKwh = mixergySolarX
    ? parseFloat((dhwAnnualKwh * solarXFraction).toFixed(2))
    : 0;

  notes.push(
    `⚡ Optimal slot: index ${cheapest.slotIndex} at ${cheapest.pricePerKwhPence.toFixed(1)} p/kWh ` +
    `vs. daily average ${avgPricePence.toFixed(1)} p/kWh. ` +
    `Annual load-shift saving: £${annualLoadShiftSavingGbp.toFixed(2)}.`,
  );
  if (mixergySolarX) {
    notes.push(
      `🔋 Mixergy Solar X enabled: additional ${mixergySolarXSavingKwh.toFixed(1)} kWh/yr ` +
      `grid-import reduction (${Math.round(solarXFraction * 100)}% of DHW load` +
      `${(tankVolumeLitres ?? 0) >= MIXERGY_SOLAR_X_ENHANCED_TANK_L ? ' – 300L enhanced rate' : ''}).`,
    );
  }

  return {
    annualLoadShiftSavingKwh: parseFloat(annualLoadShiftSavingKwh.toFixed(2)),
    annualLoadShiftSavingGbp: parseFloat(annualLoadShiftSavingGbp.toFixed(2)),
    mixergySolarXSavingKwh,
    optimalSlotIndex: cheapest.slotIndex,
    notes,
  };
}

// ─── Magic Link Handler ───────────────────────────────────────────────────────

/**
 * Generates a secure, one-time read-only sharing URL with a 24-hour expiration.
 *
 * The token is derived from a combination of the property reference, current
 * timestamp, and a random suffix to ensure uniqueness without requiring
 * persistent storage at generation time.
 *
 * @param baseUrl          Base URL of the data-sharing portal.
 * @param propertyRef      Unique property identifier (e.g. UPRN or postcode).
 * @param nowIso           ISO 8601 string for "now" (injectable for testing).
 */
export function generateMagicLink(
  baseUrl: string,
  _propertyRef: string,
  nowIso?: string,
): MagicLinkResult {
  const now = nowIso ? new Date(nowIso) : new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Generate a cryptographically secure random token using the Web Crypto API.
  // No plaintext property data is embedded to prevent enumeration attacks.
  const token = globalThis.crypto.randomUUID().replace(/-/g, '');

  const url = `${baseUrl.replace(/\/$/, '')}/share/${token}?expires=${encodeURIComponent(expiresAt)}`;

  return { url, expiresAt, token };
}

// ─── Data Confidence Score ────────────────────────────────────────────────────

function resolveDataConfidence(input: ConnectedEngineInputV2_4): number {
  const source = input.insightProvider.source;
  if (source === 'manual') return 0.4;
  if (source === 'dcc_link') return 0.7;
  // Half-hourly providers (octopus, ovo) or in-home telemetry (hive)
  return 1.0;
}

// ─── Comparison Trace ────────────────────────────────────────────────────────

function buildComparisonTrace(
  _input: ConnectedEngineInputV2_4,
  measuredKwh: number,
  theoreticalHeatLossWatts: number,
): ComparisonTrace {
  // Annualise theoretical heat loss using UK average full-load equivalent hours
  // (≈1800 h/yr, consistent with SAP 10.2 Table 5 for a typical semi-detached).
  const HEATING_HOURS_PER_YEAR = 1800;
  const theoreticalKwh = (theoreticalHeatLossWatts * HEATING_HOURS_PER_YEAR) / 1000;
  const gap = measuredKwh - theoreticalKwh;
  const ratio = theoreticalKwh > 0 ? measuredKwh / theoreticalKwh : 1;

  return {
    theoreticalHeatLossKwh: parseFloat(theoreticalKwh.toFixed(1)),
    measuredConsumptionKwh: parseFloat(measuredKwh.toFixed(1)),
    gapKwh: parseFloat(gap.toFixed(1)),
    ratio: parseFloat(ratio.toFixed(3)),
  };
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Processes multi-provider data into physical constants and insight outputs
 * for the EngineInputV2_4 schema.
 *
 * @param input                   Connected insight input block.
 * @param theoreticalHeatLossW    Theoretical building heat loss from the physics engine (W).
 * @param agileSlots              Representative Octopus Agile half-hour price slots.
 *                                Required when source === 'octopus' and tariff === 'octopus_agile'.
 */
export function runConnectedInsightModule(
  input: ConnectedEngineInputV2_4,
  theoreticalHeatLossW: number = 0,
  agileSlots: HalfHourSlot[] = [],
): ConnectedInsightResult {
  const notes: string[] = [];
  const source = input.insightProvider.source;

  // ── Thermal Decay (Hive) ──────────────────────────────────────────────────
  let thermalDecay: ThermalDecayResult | undefined;
  if (source === 'hive' && input.historicalData.internalTemperatureTelemetry) {
    thermalDecay = deriveThermalTimeConstant(
      input.historicalData.internalTemperatureTelemetry,
    );
    notes.push(...thermalDecay.notes);
  }

  // ── Baseload Isolation (Octopus / OVO) ───────────────────────────────────
  let baseloadIsolation: BaseloadIsolationResult | undefined;
  if (
    (source === 'octopus' || source === 'ovo') &&
    input.historicalData.gasConsumptionHalfHourly
  ) {
    baseloadIsolation = isolateBaseload(input.historicalData.gasConsumptionHalfHourly);
    notes.push(...baseloadIsolation.notes);
  }

  // ── DSR Savings (Agile tariff) ────────────────────────────────────────────
  let dsrSavings: DsrSavingsResult | undefined;
  if (
    input.gridConstraints.smartTariff === 'octopus_agile' &&
    baseloadIsolation &&
    agileSlots.length > 0
  ) {
    dsrSavings = calculateDsrSavings(
      baseloadIsolation.estimatedDhwKwh,
      agileSlots,
      input.gridConstraints.mixergySolarX,
      input.gridConstraints.mixergySolarXTankLitres,
    );
    notes.push(...dsrSavings.notes);
  }

  // ── Measured Consumption ──────────────────────────────────────────────────
  let measuredKwh = 0;
  if (input.historicalData.gasConsumptionHalfHourly) {
    measuredKwh = input.historicalData.gasConsumptionHalfHourly.reduce((a, b) => a + b, 0);
  } else if (input.historicalData.annualGasKwh != null) {
    measuredKwh = input.historicalData.annualGasKwh;
  }

  // ── Build Outputs ─────────────────────────────────────────────────────────
  const dataConfidence = resolveDataConfidence(input);
  const comparisonTrace = buildComparisonTrace(input, measuredKwh, theoreticalHeatLossW);

  notes.push(
    `📋 Data confidence: ${(dataConfidence * 100).toFixed(0)}% ` +
    `(source: ${source}, auth: ${input.insightProvider.authType}).`,
  );

  return {
    dataConfidence,
    thermalDecay,
    baseloadIsolation,
    dsrSavings,
    comparisonTrace,
    notes,
  };
}
