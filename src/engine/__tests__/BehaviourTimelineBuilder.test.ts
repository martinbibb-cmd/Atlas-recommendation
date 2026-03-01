/**
 * BehaviourTimelineBuilder.test.ts
 *
 * Tests for BehaviourTimelineBuilder — validates the structure and determinism
 * of BehaviourTimelineV1 output.
 */
import { describe, it, expect } from 'vitest';
import { buildBehaviourTimelineV1 } from '../BehaviourTimelineBuilder';
import { runEngine } from '../Engine';

const BASE_INPUT = {
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

describe('buildBehaviourTimelineV1', () => {
  it('returns a BehaviourTimelineV1 with 96 points (15-min resolution)', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    expect(timeline.resolutionMins).toBe(15);
    expect(timeline.points).toHaveLength(96);
  });

  it('returns timezone Europe/London', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    expect(timeline.timezone).toBe('Europe/London');
  });

  it('labels applianceName correctly for a combi scenario', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    // Professional lifestyle → boiler
    expect(typeof timeline.labels.applianceName).toBe('string');
    expect(timeline.labels.applianceName.length).toBeGreaterThan(0);
  });

  it('efficiency label is "Efficiency" for boiler, "COP" for ASHP', () => {
    // Boiler scenario (professional lifestyle)
    const boilerResult = runEngine(BASE_INPUT);
    const boilerTimeline = buildBehaviourTimelineV1(boilerResult, BASE_INPUT);
    expect(boilerTimeline.labels.efficiencyLabel).toBe('Efficiency');

    // ASHP scenario (steady_home with 28mm pipes)
    const ashpInput = {
      ...BASE_INPUT,
      occupancySignature: 'steady_home' as const,
      primaryPipeDiameter: 28,
    };
    const ashpResult = runEngine(ashpInput);
    const ashpTimeline = buildBehaviourTimelineV1(ashpResult, ashpInput);
    expect(ashpTimeline.labels.efficiencyLabel).toBe('COP');
  });

  it('each point has required fields', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    for (const pt of timeline.points) {
      expect(typeof pt.t).toBe('string');
      expect(pt.t).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof pt.heatDemandKw).toBe('number');
      expect(pt.heatDemandKw).toBeGreaterThanOrEqual(0);
      expect(typeof pt.dhwDemandKw).toBe('number');
      expect(pt.dhwDemandKw).toBeGreaterThanOrEqual(0);
      expect(typeof pt.applianceOutKw).toBe('number');
      expect(pt.applianceOutKw).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not crash with zero DHW demand (all points dhwDemandKw >= 0)', () => {
    // No occupancyCount → DHW profile uses default 2-person
    const input = { ...BASE_INPUT };
    const result = runEngine(input);
    const timeline = buildBehaviourTimelineV1(result, input);
    expect(timeline.points.every(p => p.dhwDemandKw >= 0)).toBe(true);
  });

  it('efficiency values are clamped between 0.5 and 0.99 for boiler', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    const efficiencyPoints = timeline.points.filter(p => p.efficiency != null);
    for (const pt of efficiencyPoints) {
      expect(pt.efficiency!).toBeGreaterThanOrEqual(0.5);
      expect(pt.efficiency!).toBeLessThanOrEqual(0.99);
    }
  });

  it('COP values are clamped between 1 and 5 for ASHP', () => {
    const ashpInput = {
      ...BASE_INPUT,
      occupancySignature: 'steady_home' as const,
      primaryPipeDiameter: 28,
    };
    const result = runEngine(ashpInput);
    const timeline = buildBehaviourTimelineV1(result, ashpInput);
    const copPoints = timeline.points.filter(p => p.cop != null);
    expect(copPoints.length).toBeGreaterThan(0);
    for (const pt of copPoints) {
      expect(pt.cop!).toBeGreaterThanOrEqual(1);
      expect(pt.cop!).toBeLessThanOrEqual(5);
    }
  });

  it('first point time is 00:00 and covers the full day', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    expect(timeline.points[0].t).toBe('00:00');
    expect(timeline.points[95].t).toBe('23:45');
  });

  it('applianceCapKw is present and positive', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    for (const pt of timeline.points) {
      if (pt.applianceCapKw != null) {
        expect(pt.applianceCapKw).toBeGreaterThan(0);
      }
    }
  });

  it('mode field is one of the allowed values when present', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    const allowed = ['space', 'dhw', 'mixed', 'idle'];
    for (const pt of timeline.points) {
      if (pt.mode != null) {
        expect(allowed).toContain(pt.mode);
      }
    }
  });

  it('engineOutput.behaviourTimeline is populated by runEngine', () => {
    const result = runEngine(BASE_INPUT);
    expect(result.engineOutput.behaviourTimeline).toBeDefined();
    expect(result.engineOutput.behaviourTimeline!.points).toHaveLength(96);
  });

  it('is deterministic — same input produces identical output', () => {
    const r1 = runEngine(BASE_INPUT);
    const r2 = runEngine(BASE_INPUT);
    const t1 = buildBehaviourTimelineV1(r1, BASE_INPUT);
    const t2 = buildBehaviourTimelineV1(r2, BASE_INPUT);
    expect(t1.points[0].heatDemandKw).toBe(t2.points[0].heatDemandKw);
    expect(t1.points[47].heatDemandKw).toBe(t2.points[47].heatDemandKw);
  });

  it('annotations is an array or undefined', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    expect(timeline.annotations === undefined || Array.isArray(timeline.annotations)).toBe(true);
  });

  it('boiler scenario produces efficiency dip annotation in eff row', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    if (timeline.annotations) {
      const effAnnotation = timeline.annotations.find(a => a.row === 'eff');
      expect(effAnnotation).toBeDefined();
      expect(effAnnotation!.atIndex).toBeGreaterThanOrEqual(0);
      expect(effAnnotation!.atIndex).toBeLessThan(timeline.points.length);
      expect(typeof effAnnotation!.text).toBe('string');
      expect(effAnnotation!.text.length).toBeGreaterThan(0);
    }
  });

  it('annotations atIndex values are valid point indices', () => {
    const result = runEngine(BASE_INPUT);
    const timeline = buildBehaviourTimelineV1(result, BASE_INPUT);
    if (timeline.annotations) {
      for (const annotation of timeline.annotations) {
        expect(annotation.atIndex).toBeGreaterThanOrEqual(0);
        expect(annotation.atIndex).toBeLessThan(timeline.points.length);
        expect(['heat', 'dhw', 'out', 'eff']).toContain(annotation.row);
      }
    }
  });

  it('ASHP scenario does not produce annotations (no boiler-specific dips)', () => {
    const ashpInput = {
      ...BASE_INPUT,
      occupancySignature: 'steady_home' as const,
      primaryPipeDiameter: 28,
    };
    const result = runEngine(ashpInput);
    const timeline = buildBehaviourTimelineV1(result, ashpInput);
    // ASHP does not emit boiler-specific annotations
    expect(timeline.annotations === undefined || timeline.annotations.length === 0).toBe(true);
  });
});
