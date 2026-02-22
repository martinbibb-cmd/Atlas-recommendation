import { describe, it, expect } from 'vitest';
import { generateSurveySummary } from '../modules/SurveySummaryGenerator';
import type { SurveySummaryInput, SpecEdgeResult, SludgeVsScaleResult } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const baseSpecEdge: SpecEdgeResult = {
  designFlowTempC: 37,
  spfRange: [3.8, 4.4],
  spfMidpoint: 4.1,
  recommendedMetallurgy: 'al_si',
  longevityBonusActive: true,
  wbSoftenerEdgeActive: false,
  magnetiteSludgeTaxPct: 7,
  radiatorHeatOutputReductionPct: 0,
  dhwScalingTaxPct: 0,
  annualCostOfInactionGbp: 84,
  flushPaybackYears: 5.9,
  notes: [],
};

const baseSludgeVsScale: SludgeVsScaleResult = {
  primarySludgeTaxPct: 0,
  dhwScalePenaltyPct: 0,
  estimatedScaleThicknessMm: 0,
  dhwRecoveryLatencyIncreaseSec: 0,
  primarySludgeCostGbp: 42,
  dhwScaleCostGbp: 42,
  notes: [],
};

const baseInput: SurveySummaryInput = {
  postcode: 'BH8 8NX',
  heatLossWatts: 8000,
  outsideDesignTemp: -3,
  hasSoftener: false,
  requiresBufferVessel: false,
  rooms: [
    {
      name: 'Living Room',
      targetTemp: 21,
      surfaces: [
        { area: 12, uValue: 0.35 },
        { area: 8,  uValue: 2.0  },
      ],
      airChangesPerHour: 0.5,
      volume: 40,
      emitterOutputWatts: 1200,
    },
    {
      name: 'Bedroom',
      targetTemp: 18,
      surfaces: [
        { area: 10, uValue: 0.35 },
      ],
      airChangesPerHour: 0.5,
      volume: 30,
      emitterOutputWatts: 400,
    },
  ],
  specEdge: baseSpecEdge,
  sludgeVsScale: baseSludgeVsScale,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SurveySummaryGenerator', () => {
  // ── Basic structure ───────────────────────────────────────────────────────

  it('returns customerRef equal to the input postcode', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.customerRef).toBe('BH8 8NX');
  });

  it('returns totalHeatLoadKw as a 1 d.p. string derived from heatLossWatts', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.totalHeatLoadKw).toBe('8.0');
  });

  // ── Heat Loss Schedule ────────────────────────────────────────────────────

  it('produces a heat loss schedule entry for each room', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.heatLossSchedule).toHaveLength(2);
  });

  it('calculates fabric + ventilation heat loss correctly for the living room', () => {
    const result = generateSurveySummary(baseInput);
    const livingRoom = result.heatLossSchedule[0];
    // ΔT = 21 – (−3) = 24°C
    // Fabric: (12 × 0.35 × 24) + (8 × 2.0 × 24) = 100.8 + 384 = 484.8 W
    // Ventilation: 0.33 × 0.5 × 40 × 24 = 158.4 W
    // Total = 643.2 → rounds to 643 W
    expect(livingRoom.roomName).toBe('Living Room');
    expect(livingRoom.designTemp).toBe(21);
    expect(livingRoom.totalWatts).toBe(643);
  });

  it('marks room as compliant when totalWatts ≤ emitterOutputWatts', () => {
    const result = generateSurveySummary(baseInput);
    const livingRoom = result.heatLossSchedule[0];
    expect(livingRoom.isCompliant).toBe(true); // 643 ≤ 1200
  });

  it('marks room as non-compliant when totalWatts > emitterOutputWatts', () => {
    const result = generateSurveySummary(baseInput);
    const bedroom = result.heatLossSchedule[1];
    // ΔT = 18 – (−3) = 21°C
    // Fabric: 10 × 0.35 × 21 = 73.5 W; Ventilation: 0.33 × 0.5 × 30 × 21 ≈ 104 W
    // Total ≈ 178 W which is < emitterOutputWatts(400), so the base bedroom is compliant.
    // Use an emitter output lower than the calculated heat loss to force non-compliance.
    expect(bedroom.isCompliant).toBe(true); // baseline: confirm bedroom is compliant
    const inputLowEmitter: SurveySummaryInput = {
      ...baseInput,
      rooms: [
        {
          ...baseInput.rooms[1],
          emitterOutputWatts: 50, // lower than calculated loss
        },
      ],
    };
    const r = generateSurveySummary(inputLowEmitter);
    expect(r.heatLossSchedule[0].isCompliant).toBe(false);
  });

  it('handles an empty rooms array gracefully', () => {
    const result = generateSurveySummary({ ...baseInput, rooms: [] });
    expect(result.heatLossSchedule).toHaveLength(0);
  });

  // ── Commercial Insights ───────────────────────────────────────────────────

  it('produces exactly three commercial insights', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.commercialInsights).toHaveLength(3);
  });

  it('raises a warn silicate-tax insight for a BH postcode', () => {
    const result = generateSurveySummary(baseInput); // BH8 8NX
    const silicateInsight = result.commercialInsights[0];
    expect(silicateInsight.status).toBe('warn');
    expect(silicateInsight.detail).toContain('Powerflush recommended');
  });

  it('raises a warn silicate-tax insight for a DT postcode', () => {
    const result = generateSurveySummary({ ...baseInput, postcode: 'DT9 3AQ' });
    const silicateInsight = result.commercialInsights[0];
    expect(silicateInsight.status).toBe('warn');
    expect(silicateInsight.detail).toContain('Silica-scaffolded scale is present');
  });

  it('returns a pass silicate insight for a non-silicate postcode', () => {
    const result = generateSurveySummary({ ...baseInput, postcode: 'PR1 1AA' });
    const silicateInsight = result.commercialInsights[0];
    expect(silicateInsight.status).toBe('pass');
  });

  it('SPF delta insight references both flow temperatures', () => {
    const result = generateSurveySummary(baseInput);
    const spfInsight = result.commercialInsights[1];
    expect(spfInsight.detail).toContain('35°C');
    expect(spfInsight.detail).toContain('50°C');
    expect(spfInsight.detail).toContain('SPF ≈ 4.2');
    expect(spfInsight.detail).toContain('SPF ≈ 2.9');
    expect(spfInsight.status).toBe('info');
  });

  it('SPF delta insight mentions £180/year saving', () => {
    const result = generateSurveySummary(baseInput);
    const spfInsight = result.commercialInsights[1];
    expect(spfInsight.detail).toContain('£180/year');
  });

  it('WB softener insight shows pass status when softener is fitted', () => {
    const result = generateSurveySummary({ ...baseInput, hasSoftener: true });
    const softenerInsight = result.commercialInsights[2];
    expect(softenerInsight.status).toBe('pass');
    expect(softenerInsight.detail).toContain('Worcester Bosch heat exchangers are uniquely compatible');
  });

  it('WB softener insight warns about Vaillant incompatibility when softener is fitted', () => {
    const result = generateSurveySummary({ ...baseInput, hasSoftener: true });
    const softenerInsight = result.commercialInsights[2];
    expect(softenerInsight.detail).toContain('Vaillant');
  });

  it('WB softener insight shows info status when no softener is fitted', () => {
    const result = generateSurveySummary(baseInput); // hasSoftener: false
    const softenerInsight = result.commercialInsights[2];
    expect(softenerInsight.status).toBe('info');
  });

  // ── Bill of Materials ─────────────────────────────────────────────────────

  it('BOM always includes an Air Source Heat Pump entry', () => {
    const result = generateSurveySummary(baseInput);
    const ashp = result.bom.find(b => b.component === 'Air Source Heat Pump');
    expect(ashp).toBeDefined();
    expect(ashp?.detail).toContain('8.0kW');
  });

  it('BOM always includes an Expansion Vessel entry sized at 15% of primary volume', () => {
    const result = generateSurveySummary(baseInput);
    const ev = result.bom.find(b => b.component === 'Expansion Vessel');
    expect(ev).toBeDefined();
    // Primary volume estimate = 8 kW × 10 L/kW = 80 L; 15% = 12 L
    expect(ev?.detail).toContain('12.0L');
  });

  it('BOM does not include a Buffer Vessel when requiresBufferVessel is false', () => {
    const result = generateSurveySummary(baseInput);
    const buffer = result.bom.find(b => b.component === 'Buffer Vessel');
    expect(buffer).toBeUndefined();
  });

  it('BOM includes a Buffer Vessel sized at 15L/kW when requiresBufferVessel is true', () => {
    const result = generateSurveySummary({ ...baseInput, requiresBufferVessel: true });
    const buffer = result.bom.find(b => b.component === 'Buffer Vessel');
    expect(buffer).toBeDefined();
    // 8 kW × 15 L/kW = 120 L
    expect(buffer?.detail).toContain('120L');
    expect(buffer?.detail).toContain('MCS MIS 3005');
  });

  // ── Maintenance ROI ───────────────────────────────────────────────────────

  it('maintenanceROI paybackYears matches specEdge.flushPaybackYears', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.maintenanceROI.paybackYears).toBe('5.9');
  });

  it('maintenanceROI paybackYears is "N/A" when flushPaybackYears is null', () => {
    const result = generateSurveySummary({
      ...baseInput,
      specEdge: { ...baseSpecEdge, flushPaybackYears: null },
    });
    expect(result.maintenanceROI.paybackYears).toBe('N/A');
  });

  it('maintenanceROI copy references the computed payback years', () => {
    const result = generateSurveySummary(baseInput);
    expect(result.maintenanceROI.copy).toContain('5.9 years');
  });

  it('maintenanceROI copy includes annual cost of inaction', () => {
    const result = generateSurveySummary(baseInput);
    // primarySludgeCostGbp(42) + dhwScaleCostGbp(42) = £84
    expect(result.maintenanceROI.copy).toContain('£84');
  });
});
