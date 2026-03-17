// src/lib/compass/__tests__/buildCompassState.test.ts
//
// Tests for buildCompassState — compass position derivation from engine output.

import { describe, it, expect } from 'vitest';
import { buildCompassState } from '../buildCompassState';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'On Demand (Combi)' },
    explainers: [],
    options: [
      {
        id: 'combi',
        label: 'On Demand (Combi)',
        status: 'viable',
        headline: 'Good match',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
      },
    ],
    ...overrides,
  };
}

// ─── Current position ─────────────────────────────────────────────────────────

describe('buildCompassState — current position', () => {
  it('places current at center when no heat source type provided', () => {
    const state = buildCompassState(makeOutput());
    expect(state.current.x).toBe(0);
    expect(state.current.y).toBe(0);
    expect(state.current.type).toBe('current');
    expect(state.current.label).toBe('You are here');
  });

  it('places current at South for combi heat source', () => {
    const state = buildCompassState(makeOutput(), 'combi');
    expect(state.current.y).toBeLessThan(0);
    expect(state.current.type).toBe('current');
  });

  it('places current at North-East for ASHP heat source', () => {
    const state = buildCompassState(makeOutput(), 'ashp');
    expect(state.current.x).toBeGreaterThan(0);
    expect(state.current.y).toBeGreaterThan(0);
  });

  it('places current at center for unknown heat source type', () => {
    const state = buildCompassState(makeOutput(), 'unknown_type');
    expect(state.current.x).toBe(0);
    expect(state.current.y).toBe(0);
  });
});

// ─── Recommended position ─────────────────────────────────────────────────────

describe('buildCompassState — recommended position', () => {
  it('resolves recommended position for combi recommendation', () => {
    const state = buildCompassState(makeOutput({ recommendation: { primary: 'On Demand (Combi)' } }));
    expect(state.recommended).toBeDefined();
    expect(state.recommended!.type).toBe('recommended');
    expect(state.recommended!.y).toBeLessThan(0); // South
  });

  it('resolves recommended position for ASHP recommendation', () => {
    const output = makeOutput({
      recommendation: { primary: 'Air Source Heat Pump' },
      options: [
        {
          id: 'ashp',
          label: 'Air Source Heat Pump',
          status: 'viable',
          headline: '',
          why: [],
          requirements: [],
          typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
          heat: { status: 'ok', headline: '', bullets: [] },
          dhw:  { status: 'ok', headline: '', bullets: [] },
          engineering: { status: 'ok', headline: '', bullets: [] },
        },
      ],
    });
    const state = buildCompassState(output);
    expect(state.recommended).toBeDefined();
    expect(state.recommended!.x).toBeGreaterThan(0); // East
    expect(state.recommended!.y).toBeGreaterThan(0); // North
  });

  it('returns undefined recommended for withheld recommendation', () => {
    const state = buildCompassState(makeOutput({
      recommendation: { primary: 'Recommendation withheld — not enough measured data' },
    }));
    expect(state.recommended).toBeUndefined();
  });

  it('returns undefined recommended for multiple options', () => {
    const state = buildCompassState(makeOutput({
      recommendation: { primary: 'Multiple suitable options' },
    }));
    expect(state.recommended).toBeUndefined();
  });
});

// ─── Opportunity vectors ──────────────────────────────────────────────────────

describe('buildCompassState — opportunity vectors', () => {
  it('returns empty opportunities when futureEnergyOpportunities is absent', () => {
    const state = buildCompassState(makeOutput());
    expect(state.opportunities).toHaveLength(0);
  });

  it('includes solar PV opportunity when status is suitable_now', () => {
    const output = makeOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'suitable_now',
          summary: 'Good solar potential',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'not_currently_favoured',
          summary: 'No off-street parking',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const state = buildCompassState(output);
    expect(state.opportunities).toHaveLength(1);
    const pv = state.opportunities[0];
    expect(pv.type).toBe('opportunity');
    expect(pv.label).toContain('Solar');
    // Solar pushes West (x < recommended position)
    const recX = state.recommended?.x ?? 0;
    expect(pv.x).toBeLessThan(recX);
  });

  it('includes EV opportunity when status is check_required', () => {
    const output = makeOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'not_currently_favoured',
          summary: '',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'check_required',
          summary: 'Off-street parking available',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const state = buildCompassState(output);
    expect(state.opportunities).toHaveLength(1);
    const ev = state.opportunities[0];
    expect(ev.type).toBe('opportunity');
    expect(ev.label).toContain('EV');
    // EV pushes East (x > recommended position)
    const recX = state.recommended?.x ?? 0;
    expect(ev.x).toBeGreaterThan(recX);
  });

  it('excludes not_currently_favoured opportunities', () => {
    const output = makeOutput({
      futureEnergyOpportunities: {
        solarPv: {
          status: 'not_currently_favoured',
          summary: '',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'not_currently_favoured',
          summary: '',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const state = buildCompassState(output);
    expect(state.opportunities).toHaveLength(0);
  });

  it('all positions stay within [-1, 1]', () => {
    const output = makeOutput({
      recommendation: { primary: 'Air Source Heat Pump' },
      options: [{
        id: 'ashp',
        label: 'Air Source Heat Pump',
        status: 'viable',
        headline: '',
        why: [],
        requirements: [],
        typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        heat: { status: 'ok', headline: '', bullets: [] },
        dhw:  { status: 'ok', headline: '', bullets: [] },
        engineering: { status: 'ok', headline: '', bullets: [] },
      }],
      futureEnergyOpportunities: {
        solarPv: {
          status: 'suitable_now',
          summary: '',
          reasons: [],
          checksRequired: [],
        },
        evCharging: {
          status: 'suitable_now',
          summary: '',
          reasons: [],
          checksRequired: [],
        },
      },
    });
    const state = buildCompassState(output, 'combi');

    const allVectors = [
      state.current,
      ...(state.recommended != null ? [state.recommended] : []),
      ...state.opportunities,
    ];

    for (const v of allVectors) {
      expect(v.x).toBeGreaterThanOrEqual(-1);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(-1);
      expect(v.y).toBeLessThanOrEqual(1);
    }
  });
});
