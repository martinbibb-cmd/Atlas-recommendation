// src/lib/advice/__tests__/buildTradeOffSummary.test.ts
//
// Tests for buildTradeOffSummary — trade-off dimension derivation from engine output.

import { describe, it, expect } from 'vitest';
import { buildTradeOffSummary } from '../buildTradeOffSummary';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'Combi boiler' },
    explainers: [],
    options: [
      {
        id: 'combi',
        label: 'Combi boiler',
        status: 'viable',
        headline: 'Good match',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      },
    ],
    ...overrides,
  };
}

// ─── Null / no-recommendation cases ──────────────────────────────────────────

describe('buildTradeOffSummary — null cases', () => {
  it('returns null when there are no viable options', () => {
    const output = makeOutput({ options: [] });
    expect(buildTradeOffSummary(output)).toBeNull();
  });

  it('returns null when all options are not viable', () => {
    const output = makeOutput({
      options: [
        {
          id: 'ashp',
          label: 'Air source heat pump',
          status: 'not_viable',
          headline: '',
          why: [],
          requirements: [],
          typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
          heat: { status: 'ok', headline: '', bullets: [] },
          dhw:  { status: 'ok', headline: '', bullets: [] },
          engineering: { status: 'ok', headline: '', bullets: [] },
          sensitivities: [],
        },
      ],
    });
    expect(buildTradeOffSummary(output)).toBeNull();
  });
});

// ─── Dimension structure ──────────────────────────────────────────────────────

describe('buildTradeOffSummary — dimension structure', () => {
  it('returns 6 dimensions', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary).not.toBeNull();
    expect(summary!.dimensions).toHaveLength(6);
  });

  it('includes Efficiency as first dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[0].label).toBe('Efficiency');
  });

  it('includes Upfront cost as second dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[1].label).toBe('Upfront cost');
  });

  it('includes Disruption as third dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[2].label).toBe('Disruption');
  });

  it('includes Space impact as fourth dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[3].label).toBe('Space impact');
  });

  it('includes Hot water as fifth dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[4].label).toBe('Hot water');
  });

  it('includes Future-readiness as sixth dimension', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.dimensions[5].label).toBe('Future-readiness');
  });

  it('every dimension has a band of low/medium/high for both current and recommended', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'combi');
    expect(summary).not.toBeNull();
    const valid: string[] = ['low', 'medium', 'high'];
    for (const dim of summary!.dimensions) {
      expect(valid).toContain(dim.current);
      expect(valid).toContain(dim.recommended);
    }
  });
});

// ─── System labels ────────────────────────────────────────────────────────────

describe('buildTradeOffSummary — system labels', () => {
  it('labels combi current system correctly', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'combi');
    expect(summary!.currentSystemLabel).toBe('Combi boiler');
  });

  it('labels ashp current system correctly', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'ashp');
    expect(summary!.currentSystemLabel).toBe('Air source heat pump');
  });

  it('uses "Current system" label when no heat source type is provided', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.currentSystemLabel).toBe('Current system');
  });

  it('uses "Current system" label for unrecognised heat source type', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'unknown_type');
    expect(summary!.currentSystemLabel).toBe('Current system');
  });

  it('labels combi recommended system correctly', () => {
    const summary = buildTradeOffSummary(makeOutput());
    expect(summary!.recommendedSystemLabel).toBe('Combi boiler');
  });

  it('labels ASHP recommended system correctly', () => {
    const output = makeOutput({
      options: [{
        id: 'ashp',
        label: 'Air source heat pump',
        status: 'viable',
        headline: '',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      }],
    });
    const summary = buildTradeOffSummary(output);
    expect(summary!.recommendedSystemLabel).toBe('Air source heat pump');
  });
});

// ─── Profile correctness ──────────────────────────────────────────────────────

describe('buildTradeOffSummary — profile correctness', () => {
  it('combi recommendation has low upfront cost', () => {
    const summary = buildTradeOffSummary(makeOutput());
    const upfront = summary!.dimensions.find(d => d.label === 'Upfront cost');
    expect(upfront!.recommended).toBe('low');
  });

  it('ASHP recommendation has high efficiency', () => {
    const output = makeOutput({
      options: [{
        id: 'ashp',
        label: 'Air source heat pump',
        status: 'viable',
        headline: '',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      }],
    });
    const summary = buildTradeOffSummary(output);
    const efficiency = summary!.dimensions.find(d => d.label === 'Efficiency');
    expect(efficiency!.recommended).toBe('high');
  });

  it('ASHP recommendation has high future-readiness', () => {
    const output = makeOutput({
      options: [{
        id: 'ashp',
        label: 'Air source heat pump',
        status: 'viable',
        headline: '',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      }],
    });
    const summary = buildTradeOffSummary(output);
    const futureReadiness = summary!.dimensions.find(d => d.label === 'Future-readiness');
    expect(futureReadiness!.recommended).toBe('high');
  });

  it('combi current system has low disruption', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'combi');
    const disruption = summary!.dimensions.find(d => d.label === 'Disruption');
    expect(disruption!.current).toBe('low');
  });

  it('combi current system has low space impact', () => {
    const summary = buildTradeOffSummary(makeOutput(), 'combi');
    const space = summary!.dimensions.find(d => d.label === 'Space impact');
    expect(space!.current).toBe('low');
  });

  it('unvented system recommendation has high hot water', () => {
    const output = makeOutput({
      options: [{
        id: 'stored_unvented',
        label: 'Unvented cylinder system',
        status: 'viable',
        headline: '',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
        sensitivities: [],
      }],
    });
    const summary = buildTradeOffSummary(output);
    const hotWater = summary!.dimensions.find(d => d.label === 'Hot water');
    expect(hotWater!.recommended).toBe('high');
  });
});
