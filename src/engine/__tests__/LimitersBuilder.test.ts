/**
 * LimitersBuilder.test.ts
 *
 * Tests for the LimitersBuilder module — validates that canonical limiters
 * are emitted correctly from engine module results.
 */
import { describe, it, expect } from 'vitest';
import { buildLimitersV1 } from '../LimitersBuilder';
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

describe('buildLimitersV1', () => {
  it('returns a LimitersV1 object with a limiters array', () => {
    const result = runEngine(BASE_INPUT);
    const limiters = buildLimitersV1(result, BASE_INPUT);
    expect(limiters).toBeDefined();
    expect(Array.isArray(limiters.limiters)).toBe(true);
  });

  it('does not emit mains-flow-constraint when flow is adequate', () => {
    const input = { ...BASE_INPUT, mainsDynamicFlowLpm: 18 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const flowConstraint = limiters.find(l => l.id === 'mains-flow-constraint');
    expect(flowConstraint).toBeUndefined();
  });

  it('emits fail-severity mains-flow-constraint when flow < 10 L/min', () => {
    const input = { ...BASE_INPUT, mainsDynamicFlowLpm: 8, bathroomCount: 1 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const flowConstraint = limiters.find(l => l.id === 'mains-flow-constraint');
    expect(flowConstraint).toBeDefined();
    expect(flowConstraint!.severity).toBe('fail');
    expect(flowConstraint!.observed.value).toBe(8);
    expect(flowConstraint!.limit.value).toBe(12);
  });

  it('emits warn-severity mains-flow-constraint when flow is 10–11 L/min', () => {
    const input = { ...BASE_INPUT, mainsDynamicFlowLpm: 11, bathroomCount: 1 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const flowConstraint = limiters.find(l => l.id === 'mains-flow-constraint');
    expect(flowConstraint).toBeDefined();
    expect(flowConstraint!.severity).toBe('warn');
  });

  it('does not emit mains-flow-constraint when flow is exactly 12 L/min ("12@0 is fine")', () => {
    const input = { ...BASE_INPUT, mainsDynamicFlowLpm: 12, bathroomCount: 1 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const flowConstraint = limiters.find(l => l.id === 'mains-flow-constraint');
    expect(flowConstraint).toBeUndefined();
  });

  it('emits combi-concurrency-constraint when bathroomCount >= 2', () => {
    const input = { ...BASE_INPUT, currentHeatSourceType: 'combi' as const, bathroomCount: 2 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const concurrencyConstraint = limiters.find(l => l.id === 'combi-concurrency-constraint');
    expect(concurrencyConstraint).toBeDefined();
    expect(concurrencyConstraint!.severity).toBe('fail');
  });

  it('does not emit combi-concurrency-constraint when bathroomCount is 1', () => {
    const result = runEngine(BASE_INPUT);
    const { limiters } = buildLimitersV1(result, BASE_INPUT);
    const concurrencyConstraint = limiters.find(l => l.id === 'combi-concurrency-constraint');
    expect(concurrencyConstraint).toBeUndefined();
  });

  it('emits primary-pipe-constraint when ASHP risk is fail (22mm + 14kW)', () => {
    const input = { ...BASE_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    expect(pipeConstraint).toBeDefined();
    expect(pipeConstraint!.severity).toBe('fail');
  });

  it('emits primary-pipe-constraint warn when ASHP risk is warn', () => {
    const input = { ...BASE_INPUT, primaryPipeDiameter: 22, heatLossWatts: 8000 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    expect(pipeConstraint).toBeDefined();
    expect(pipeConstraint!.severity).toBe('warn');
  });

  it('does not emit primary-pipe-constraint when ASHP risk is pass (28mm)', () => {
    const input = { ...BASE_INPUT, primaryPipeDiameter: 28, heatLossWatts: 8000 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    expect(pipeConstraint).toBeUndefined();
  });

  it('limiters are sorted fail first, then warn, then info', () => {
    const input = {
      ...BASE_INPUT,
      mainsDynamicFlowLpm: 8,
      bathroomCount: 2,
      primaryPipeDiameter: 22,
      heatLossWatts: 14000,
    };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const severityOrder = { fail: 0, warn: 1, info: 2 };
    for (let i = 1; i < limiters.length; i++) {
      expect(severityOrder[limiters[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[limiters[i - 1].severity],
      );
    }
  });

  it('each limiter has required fields', () => {
    const input = { ...BASE_INPUT, mainsDynamicFlowLpm: 8 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    for (const limiter of limiters) {
      expect(typeof limiter.id).toBe('string');
      expect(typeof limiter.title).toBe('string');
      expect(['fail', 'warn', 'info']).toContain(limiter.severity);
      expect(typeof limiter.observed.value).toBe('number');
      expect(typeof limiter.limit.value).toBe('number');
      expect(typeof limiter.impact.summary).toBe('string');
      expect(['high', 'medium', 'low']).toContain(limiter.confidence);
      expect(Array.isArray(limiter.sources)).toBe(true);
      expect(Array.isArray(limiter.suggestedFixes)).toBe(true);
    }
  });

  it('engineOutput.limiters is populated by runEngine when input is provided', () => {
    const result = runEngine({ ...BASE_INPUT, mainsDynamicFlowLpm: 8 });
    expect(result.engineOutput.limiters).toBeDefined();
    expect(Array.isArray(result.engineOutput.limiters!.limiters)).toBe(true);
  });

  it('primary-pipe-constraint always has a derived source for the required flow', () => {
    // The "Required ASHP flow" is always derived (from heat loss + ΔT), not measured
    const input = { ...BASE_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    expect(pipeConstraint).toBeDefined();
    const derivedSource = pipeConstraint!.sources.find(s => s.kind === 'derived');
    expect(derivedSource).toBeDefined();
    expect(derivedSource!.note).toContain('derived');
  });

  it('primary-pipe-constraint has measured pipe source when diameter is provided', () => {
    const input = { ...BASE_INPUT, primaryPipeDiameter: 22, heatLossWatts: 14000 };
    const result = runEngine(input);
    const { limiters } = buildLimitersV1(result, input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    expect(pipeConstraint).toBeDefined();
    const measuredSource = pipeConstraint!.sources.find(s => s.kind === 'measured');
    expect(measuredSource).toBeDefined();
  });

  it('primary-pipe-constraint has assumed pipe source when diameter is not provided', () => {
    const input = { ...BASE_INPUT, heatLossWatts: 14000 };
    // Remove primaryPipeDiameter to trigger assumed path
    const { primaryPipeDiameter: _, ...inputNoPipe } = input as typeof input & { primaryPipeDiameter?: number };
    const result = runEngine(inputNoPipe as typeof input);
    const { limiters } = buildLimitersV1(result, inputNoPipe as typeof input);
    const pipeConstraint = limiters.find(l => l.id === 'primary-pipe-constraint');
    if (pipeConstraint) {
      const assumedSource = pipeConstraint.sources.find(s => s.kind === 'assumed');
      expect(assumedSource).toBeDefined();
    }
  });
});
