import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildTimeline24hV1 } from '../TimelineBuilder';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('TimelineBuilder', () => {
  it('timeline visual is included in engineOutput when input is provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline).toBeDefined();
    expect(timeline!.id).toBe('timeline_24h');
  });

  it('timeline visual is present in engineOutput from runEngine (input always provided)', () => {
    const result = runEngine(baseInput);
    const timelineVisuals = result.engineOutput.visuals?.filter(v => v.type === 'timeline_24h');
    expect((timelineVisuals ?? []).length).toBeGreaterThan(0);
  });

  it('timeline payload has exactly 96 time points', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const payload = timeline!.data;
    expect(payload.timeMinutes).toHaveLength(96);
    expect(payload.demandHeatKw).toHaveLength(96);
  });

  it('timeMinutes starts at 0 and ends at 1425 (15-min intervals)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { timeMinutes } = timeline!.data;
    expect(timeMinutes[0]).toBe(0);
    expect(timeMinutes[95]).toBe(1425);
    expect(timeMinutes[1] - timeMinutes[0]).toBe(15);
  });

  it('timeline includes exactly two series', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline!.data.series).toHaveLength(2);
  });

  it('both series have aligned lengths matching timeMinutes (96 points)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { series, timeMinutes } = timeline!.data;
    for (const s of series) {
      expect(s.heatDeliveredKw).toHaveLength(timeMinutes.length);
      expect(s.efficiency).toHaveLength(timeMinutes.length);
    }
  });

  it('series IDs are present and non-empty', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { series } = timeline!.data;
    for (const s of series) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.label).toBe('string');
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('events are passed through and non-empty', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(Array.isArray(timeline!.data.events)).toBe(true);
    expect(timeline!.data.events.length).toBeGreaterThan(0);
  });

  it('all events have valid kind and intensity', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const validKinds = new Set(['shower', 'bath', 'sink', 'dishwasher', 'washing_machine']);
    const validIntensities = new Set(['low', 'med', 'high']);
    for (const ev of timeline!.data.events) {
      expect(validKinds.has(ev.kind)).toBe(true);
      expect(validIntensities.has(ev.intensity)).toBe(true);
      expect(typeof ev.startMin).toBe('number');
      expect(typeof ev.endMin).toBe('number');
      expect(ev.endMin).toBeGreaterThan(ev.startMin);
    }
  });

  it('no NaN values in demandHeatKw', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const v of timeline!.data.demandHeatKw) {
      expect(isNaN(v)).toBe(false);
    }
  });

  it('no NaN values in any series heatDeliveredKw or efficiency', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      for (const v of s.heatDeliveredKw) expect(isNaN(v)).toBe(false);
      for (const v of s.efficiency)      expect(isNaN(v)).toBe(false);
    }
  });

  it('demandHeatKw values are non-negative and bounded by peak heat loss', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const peakKw = baseInput.heatLossWatts / 1000; // 8 kW
    for (const v of timeline!.data.demandHeatKw) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(peakKw + 0.01); // small float tolerance
    }
  });

  it('buildTimeline24hV1 accepts explicit systemIds and builds series for them', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'ashp']);
    expect(visual.type).toBe('timeline_24h');
    const { series } = visual.data;
    expect(series).toHaveLength(2);
    expect(series[0].id).toBe('on_demand');
    expect(series[1].id).toBe('ashp');
  });

  it('ASHP series efficiency values represent COP (> 1)', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'ashp']);
    const ashpSeries = visual.data.series.find((s: { id: string }) => s.id === 'ashp');
    expect(ashpSeries).toBeDefined();
    for (const v of ashpSeries!.efficiency) {
      expect(v).toBeGreaterThan(1); // COP is always > 1 for heat pumps
    }
  });

  it('combi/boiler series efficiency values represent η (≤ 1)', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'stored_vented']);
    const combiSeries = visual.data.series.find((s: { id: string }) => s.id === 'on_demand');
    expect(combiSeries).toBeDefined();
    for (const v of combiSeries!.efficiency) {
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThan(0);
    }
  });
});
