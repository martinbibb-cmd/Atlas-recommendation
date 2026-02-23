import { describe, it, expect } from 'vitest';
import {
  deriveThermalTimeConstant,
  isolateBaseload,
  calculateDsrSavings,
  generateMagicLink,
  runConnectedInsightModule,
} from '../modules/ConnectedInsightModule';
import type { ConnectedEngineInputV2_4, HalfHourSlot } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Hive telemetry: 4 readings showing the house cooling from 21°C to 18°C over 3 hours */
const hiveTelemetry: { t: string; v: number }[] = [
  { t: '2024-01-15T18:00:00Z', v: 21.0 },
  { t: '2024-01-15T19:00:00Z', v: 20.0 },
  { t: '2024-01-15T20:00:00Z', v: 19.0 },
  { t: '2024-01-15T21:00:00Z', v: 18.0 },
];

/** 48 half-hour slots with mostly low consumption and two high-intensity spikes */
const halfHourlyReadings: number[] = Array.from({ length: 48 }, (_, i) => {
  // Slots 10 and 20 are high-intensity DHW draws (>9.5 kWh = >19 kW peak)
  if (i === 10 || i === 20) return 10.0;
  return 1.0; // steady space-heating baseload
});

/** A simple set of Agile price slots – one cheap overnight slot */
const agileSlots: HalfHourSlot[] = Array.from({ length: 48 }, (_, i) => ({
  slotIndex: i,
  pricePerKwhPence: i === 4 ? 5.0 : 24.5, // slot 4 (02:00-02:30) is very cheap
}));

const octopusInput: ConnectedEngineInputV2_4 = {
  insightProvider: { source: 'octopus', authType: 'api_key', lastSynced: '2024-01-15T23:59:00Z' },
  historicalData: { gasConsumptionHalfHourly: halfHourlyReadings },
  gridConstraints: { smartTariff: 'octopus_agile', hasSolarPV: false, mixergySolarX: false },
};

const hiveInput: ConnectedEngineInputV2_4 = {
  insightProvider: { source: 'hive', authType: 'oauth_credential', lastSynced: '2024-01-15T21:00:00Z' },
  historicalData: { internalTemperatureTelemetry: hiveTelemetry },
  gridConstraints: { smartTariff: 'standard_fixed', hasSolarPV: false, mixergySolarX: false },
};

const manualInput: ConnectedEngineInputV2_4 = {
  insightProvider: { source: 'manual', authType: 'api_key', lastSynced: '2024-01-01T00:00:00Z' },
  historicalData: { annualGasKwh: 12000 },
  gridConstraints: { smartTariff: 'standard_fixed', hasSolarPV: false, mixergySolarX: false },
};

// ─── deriveThermalTimeConstant ────────────────────────────────────────────────

describe('deriveThermalTimeConstant', () => {
  it('returns a positive τ for a cooling house', () => {
    const result = deriveThermalTimeConstant(hiveTelemetry, 5);
    expect(result.thermalTimeConstantHours).toBeGreaterThan(0);
  });

  it('derives a cooling rate of 1 °C/hr from steady 1 °C/hr drop data', () => {
    const result = deriveThermalTimeConstant(hiveTelemetry, 5);
    expect(result.coolingRateCPerHour).toBeCloseTo(1.0, 1);
  });

  it('returns zero τ for empty telemetry', () => {
    const result = deriveThermalTimeConstant([], 5);
    expect(result.thermalTimeConstantHours).toBe(0);
    expect(result.notes[0]).toContain('Insufficient');
  });

  it('returns zero τ when only one reading is provided', () => {
    const result = deriveThermalTimeConstant([{ t: '2024-01-15T18:00:00Z', v: 21 }], 5);
    expect(result.thermalTimeConstantHours).toBe(0);
  });

  it('ignores heating or steady windows (temperature rises)', () => {
    const heatingData: { t: string; v: number }[] = [
      { t: '2024-01-15T06:00:00Z', v: 16 },
      { t: '2024-01-15T07:00:00Z', v: 18 },
      { t: '2024-01-15T08:00:00Z', v: 20 },
    ];
    const result = deriveThermalTimeConstant(heatingData, 5);
    expect(result.thermalTimeConstantHours).toBe(0);
    expect(result.notes[0]).toContain('No cooling windows');
  });

  it('preserves the referenceExternalTempC in the output', () => {
    const result = deriveThermalTimeConstant(hiveTelemetry, -3);
    expect(result.referenceExternalTempC).toBe(-3);
  });

  it('produces notes containing τ value', () => {
    const result = deriveThermalTimeConstant(hiveTelemetry, 5);
    expect(result.notes.some(n => n.includes('τ'))).toBe(true);
  });
});

// ─── isolateBaseload ──────────────────────────────────────────────────────────

describe('isolateBaseload', () => {
  it('returns zero totals for empty input', () => {
    const result = isolateBaseload([]);
    expect(result.estimatedDhwKwh).toBe(0);
    expect(result.estimatedSpaceHeatingKwh).toBe(0);
    expect(result.highIntensitySpikeCount).toBe(0);
  });

  it('detects exactly 2 high-intensity spikes in the fixture data', () => {
    const result = isolateBaseload(halfHourlyReadings);
    expect(result.highIntensitySpikeCount).toBe(2);
  });

  it('allocates the spike kWh to DHW and the rest to space heating', () => {
    const result = isolateBaseload(halfHourlyReadings);
    // 2 spike slots × 10 kWh = 20 kWh DHW
    expect(result.estimatedDhwKwh).toBeCloseTo(20.0, 1);
    // 46 normal slots × 1 kWh = 46 kWh space heating
    expect(result.estimatedSpaceHeatingKwh).toBeCloseTo(46.0, 1);
  });

  it('classifies a 19 kW peak slot as DHW (boundary case)', () => {
    // 9.5 kWh × 2 = 19 kW peak — exactly at threshold, not above
    const borderSlot = [9.5];
    const result = isolateBaseload(borderSlot);
    expect(result.highIntensitySpikeCount).toBe(0);
    expect(result.estimatedSpaceHeatingKwh).toBeCloseTo(9.5, 1);
  });

  it('classifies a slot just above 19 kW as a DHW spike', () => {
    const aboveThreshold = [9.51]; // 9.51 × 2 = 19.02 kW
    const result = isolateBaseload(aboveThreshold);
    expect(result.highIntensitySpikeCount).toBe(1);
    expect(result.estimatedDhwKwh).toBeCloseTo(9.51, 2);
  });

  it('produces notes', () => {
    const result = isolateBaseload(halfHourlyReadings);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

// ─── calculateDsrSavings ──────────────────────────────────────────────────────

describe('calculateDsrSavings', () => {
  it('returns zero savings for empty slot array', () => {
    const result = calculateDsrSavings(500, [], false);
    expect(result.annualLoadShiftSavingGbp).toBe(0);
    expect(result.annualLoadShiftSavingKwh).toBe(0);
  });

  it('returns zero savings for zero DHW demand', () => {
    const result = calculateDsrSavings(0, agileSlots, false);
    expect(result.annualLoadShiftSavingGbp).toBe(0);
  });

  it('selects slot 4 as the optimal slot (cheapest in fixture data)', () => {
    const result = calculateDsrSavings(1000, agileSlots, false);
    expect(result.optimalSlotIndex).toBe(4);
  });

  it('returns a positive annual saving in GBP', () => {
    const result = calculateDsrSavings(1000, agileSlots, false);
    expect(result.annualLoadShiftSavingGbp).toBeGreaterThan(0);
  });

  it('adds Mixergy Solar X saving when enabled', () => {
    const withMixergy = calculateDsrSavings(1000, agileSlots, true);
    const withoutMixergy = calculateDsrSavings(1000, agileSlots, false);
    expect(withMixergy.mixergySolarXSavingKwh).toBeGreaterThan(0);
    expect(withoutMixergy.mixergySolarXSavingKwh).toBe(0);
  });

  it('Mixergy Solar X saving is 35% of DHW demand for standard tank', () => {
    const result = calculateDsrSavings(1000, agileSlots, true);
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(350, 0);
  });

  it('Mixergy Solar X saving is 40% of DHW demand for 300L tank', () => {
    const result = calculateDsrSavings(1000, agileSlots, true, 300);
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(400, 0);
  });

  it('Mixergy Solar X saving is 35% for tank under 300L', () => {
    const result = calculateDsrSavings(1000, agileSlots, true, 250);
    expect(result.mixergySolarXSavingKwh).toBeCloseTo(350, 0);
  });

  it('produces notes with optimal slot and saving', () => {
    const result = calculateDsrSavings(1000, agileSlots, false);
    expect(result.notes.some(n => n.includes('Optimal slot'))).toBe(true);
  });
});

// ─── generateMagicLink ────────────────────────────────────────────────────────

describe('generateMagicLink', () => {
  const BASE_URL = 'https://atlas.example.com';
  const NOW_ISO = '2024-01-15T12:00:00.000Z';
  const EXPECTED_EXPIRY = '2024-01-16T12:00:00.000Z';

  it('generates a URL with the expected base URL and path structure', () => {
    const result = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    const parsed = new URL(result.url);
    expect(parsed.origin).toBe(BASE_URL);
    expect(parsed.pathname.startsWith('/share/')).toBe(true);
  });

  it('sets expiry 24 hours after the provided nowIso', () => {
    const result = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    expect(result.expiresAt).toBe(EXPECTED_EXPIRY);
  });

  it('embeds the token in the URL', () => {
    const result = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    expect(result.url).toContain(result.token);
  });

  it('produces a non-empty token', () => {
    const result = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('generates different tokens for different property refs', () => {
    const r1 = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    const r2 = generateMagicLink(BASE_URL, 'SW1A2AA', NOW_ISO);
    expect(r1.token).not.toBe(r2.token);
  });

  it('strips trailing slash from base URL', () => {
    const result = generateMagicLink(`${BASE_URL}/`, 'EC1A1BB', NOW_ISO);
    const parsed = new URL(result.url);
    expect(parsed.origin).toBe(BASE_URL);
    expect(parsed.pathname.startsWith('/share/')).toBe(true);
  });

  it('includes expiry timestamp as a query param in the URL', () => {
    const result = generateMagicLink(BASE_URL, 'EC1A1BB', NOW_ISO);
    expect(result.url).toContain('expires=');
  });
});

// ─── runConnectedInsightModule ────────────────────────────────────────────────

describe('runConnectedInsightModule', () => {
  it('returns dataConfidence of 1.0 for octopus (half-hourly) source', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.dataConfidence).toBe(1.0);
  });

  it('returns dataConfidence of 0.4 for manual source', () => {
    const result = runConnectedInsightModule(manualInput);
    expect(result.dataConfidence).toBe(0.4);
  });

  it('populates thermalDecay for hive source', () => {
    const result = runConnectedInsightModule(hiveInput);
    expect(result.thermalDecay).toBeDefined();
    expect(result.thermalDecay!.thermalTimeConstantHours).toBeGreaterThan(0);
  });

  it('populates baseloadIsolation for octopus source', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.baseloadIsolation).toBeDefined();
    expect(result.baseloadIsolation!.highIntensitySpikeCount).toBeGreaterThan(0);
  });

  it('populates dsrSavings when tariff is octopus_agile and agile slots are supplied', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.dsrSavings).toBeDefined();
    expect(result.dsrSavings!.annualLoadShiftSavingGbp).toBeGreaterThan(0);
  });

  it('does not populate dsrSavings when tariff is standard_fixed', () => {
    const standardInput: ConnectedEngineInputV2_4 = {
      ...octopusInput,
      gridConstraints: { ...octopusInput.gridConstraints, smartTariff: 'standard_fixed' },
    };
    const result = runConnectedInsightModule(standardInput, 5000, agileSlots);
    expect(result.dsrSavings).toBeUndefined();
  });

  it('builds a comparisonTrace with all required fields', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.comparisonTrace.theoreticalHeatLossKwh).toBeGreaterThan(0);
    expect(result.comparisonTrace.measuredConsumptionKwh).toBeGreaterThan(0);
    expect(typeof result.comparisonTrace.gapKwh).toBe('number');
    expect(typeof result.comparisonTrace.ratio).toBe('number');
  });

  it('uses annualGasKwh as measuredConsumptionKwh for manual source', () => {
    const result = runConnectedInsightModule(manualInput, 5000);
    expect(result.comparisonTrace.measuredConsumptionKwh).toBeCloseTo(12000, 0);
  });

  it('produces a non-empty notes array', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('notes include the data confidence percentage', () => {
    const result = runConnectedInsightModule(octopusInput, 5000, agileSlots);
    expect(result.notes.some(n => n.includes('100%'))).toBe(true);
  });

  it('returns zero comparison trace values when no consumption data is present', () => {
    const emptyInput: ConnectedEngineInputV2_4 = {
      insightProvider: { source: 'dcc_link', authType: 'magic_link', lastSynced: '2024-01-01T00:00:00Z' },
      historicalData: {},
      gridConstraints: { smartTariff: 'standard_fixed', hasSolarPV: false, mixergySolarX: false },
    };
    const result = runConnectedInsightModule(emptyInput);
    expect(result.comparisonTrace.measuredConsumptionKwh).toBe(0);
  });
});
