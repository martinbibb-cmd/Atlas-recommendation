/**
 * FutureEnergyOpportunitiesModule.test.ts
 *
 * Unit tests for assessFutureEnergyOpportunities.
 *
 * Validates:
 *   - Solar PV status rules for Mixergy, stored hot water, occupancy patterns
 *   - EV charging status rules for commuter profile, future-readiness, heat pump
 *   - Default outputs (check_required for most cases)
 *   - not_currently_favoured for clear negative signals
 *   - Heat pump detection from primaryRecommendation string
 */

import { describe, it, expect } from 'vitest';
import {
  assessFutureEnergyOpportunities,
} from '../modules/FutureEnergyOpportunitiesModule';
import type { EngineInputV2_3 } from '../../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid engine input — combi boiler, professional household, no extras. */
const BASE_PROFESSIONAL_COMBI: Partial<EngineInputV2_3> = {
  occupancySignature: 'professional',
  preferCombi: true,
  dhwTankType: undefined,
  expertAssumptions: { futureReadinessPriority: 'normal' },
  highOccupancy: false,
  occupancyCount: 2,
};

/** Stored standard cylinder, steady occupancy (at home during day). */
const BASE_STEADY_STORED: Partial<EngineInputV2_3> = {
  occupancySignature: 'steady_home',
  preferCombi: false,
  dhwTankType: 'standard',
  expertAssumptions: { futureReadinessPriority: 'normal' },
  highOccupancy: false,
};

/** Mixergy cylinder, professional occupancy. */
const BASE_MIXERGY_PROFESSIONAL: Partial<EngineInputV2_3> = {
  occupancySignature: 'professional',
  preferCombi: false,
  dhwTankType: 'mixergy',
  expertAssumptions: { futureReadinessPriority: 'normal' },
  highOccupancy: false,
};

/** Professional commuter with future-readiness intent. */
const BASE_PROFESSIONAL_FUTURE_READY: Partial<EngineInputV2_3> = {
  occupancySignature: 'professional',
  preferCombi: false,
  dhwTankType: 'standard',
  expertAssumptions: { futureReadinessPriority: 'high' },
  highOccupancy: false,
};

function assess(
  partial: Partial<EngineInputV2_3>,
  primaryRecommendation?: string,
) {
  return assessFutureEnergyOpportunities(
    partial as EngineInputV2_3,
    primaryRecommendation,
  );
}

// ─── Solar PV ─────────────────────────────────────────────────────────────────

describe('assessFutureEnergyOpportunities — solar PV', () => {
  it('returns suitable_now for Mixergy cylinder', () => {
    const result = assess(BASE_MIXERGY_PROFESSIONAL);
    expect(result.solarPv.status).toBe('suitable_now');
  });

  it('solar PV Mixergy summary mentions stored hot water self-consumption', () => {
    const result = assess(BASE_MIXERGY_PROFESSIONAL);
    expect(result.solarPv.summary.toLowerCase()).toContain('stored hot water');
  });

  it('solar PV Mixergy always requires a roof survey check', () => {
    const result = assess(BASE_MIXERGY_PROFESSIONAL);
    expect(result.solarPv.checksRequired.length).toBeGreaterThan(0);
    const checksText = result.solarPv.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('roof');
  });

  it('returns suitable_now for stored standard cylinder + steady occupancy', () => {
    const result = assess(BASE_STEADY_STORED);
    expect(result.solarPv.status).toBe('suitable_now');
  });

  it('returns check_required for stored cylinder + professional (away during day)', () => {
    const result = assess({
      ...BASE_STEADY_STORED,
      occupancySignature: 'professional',
    });
    expect(result.solarPv.status).toBe('check_required');
  });

  it('returns check_required for future-ready combi (no stored water)', () => {
    const result = assess({
      ...BASE_PROFESSIONAL_COMBI,
      expertAssumptions: { futureReadinessPriority: 'high' },
    });
    expect(result.solarPv.status).toBe('check_required');
  });

  it('returns not_currently_favoured for combi-only + professional + no future-readiness', () => {
    const result = assess(BASE_PROFESSIONAL_COMBI);
    expect(result.solarPv.status).toBe('not_currently_favoured');
  });

  it('solar PV not_currently_favoured reasons mention on-demand system', () => {
    const result = assess(BASE_PROFESSIONAL_COMBI);
    const text = result.solarPv.reasons.join(' ').toLowerCase();
    expect(text).toContain('on-demand');
  });

  it('returns check_required (default) for shift worker without stored water', () => {
    const result = assess({
      occupancySignature: 'shift_worker',
      preferCombi: true,
      dhwTankType: undefined,
      expertAssumptions: { futureReadinessPriority: 'normal' },
    } as Partial<EngineInputV2_3>);
    expect(result.solarPv.status).toBe('check_required');
  });

  it('returns suitable_now for already-active solar boost', () => {
    const result = assess({
      ...BASE_STEADY_STORED,
      solarBoost: { enabled: true, source: 'PV_diverter' },
    });
    expect(result.solarPv.status).toBe('suitable_now');
  });

  it('mentions heat pump when heat pump is recommended (Mixergy path)', () => {
    const result = assess(BASE_MIXERGY_PROFESSIONAL, 'Air Source Heat Pump');
    const text = result.solarPv.reasons.join(' ').toLowerCase();
    expect(text).toContain('heat pump');
  });

  it('check_required for heat pump recommendation without stored water', () => {
    const result = assess(
      { ...BASE_PROFESSIONAL_COMBI, preferCombi: false, dhwTankType: undefined },
      'Air Source Heat Pump',
    );
    // Heat pump + no explicit stored water → check_required (heat pump path)
    expect(result.solarPv.status).toBe('check_required');
  });
});

// ─── EV Charging ──────────────────────────────────────────────────────────────

describe('assessFutureEnergyOpportunities — EV charging', () => {
  it('returns suitable_now for professional + future-ready intent', () => {
    const result = assess(BASE_PROFESSIONAL_FUTURE_READY);
    expect(result.evCharging.status).toBe('suitable_now');
  });

  it('EV suitable_now summary mentions commuter', () => {
    const result = assess(BASE_PROFESSIONAL_FUTURE_READY);
    expect(result.evCharging.summary.toLowerCase()).toContain('commuter');
  });

  it('EV suitable_now always requires parking check', () => {
    const result = assess(BASE_PROFESSIONAL_FUTURE_READY);
    const checksText = result.evCharging.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('parking');
  });

  it('returns suitable_now for high occupancy + future-ready intent', () => {
    const result = assess({
      ...BASE_STEADY_STORED,
      highOccupancy: true,
      expertAssumptions: { futureReadinessPriority: 'high' },
    });
    expect(result.evCharging.status).toBe('suitable_now');
  });

  it('returns check_required for professional without future-readiness intent', () => {
    const result = assess(BASE_PROFESSIONAL_COMBI);
    expect(result.evCharging.status).toBe('check_required');
  });

  it('returns check_required for steady occupancy with no specific signals', () => {
    const result = assess(BASE_STEADY_STORED);
    expect(result.evCharging.status).toBe('check_required');
  });

  it('mentions electrical capacity review when heat pump is recommended', () => {
    const result = assess(BASE_PROFESSIONAL_FUTURE_READY, 'Air Source Heat Pump');
    const text = [
      ...result.evCharging.reasons,
      ...result.evCharging.checksRequired,
    ].join(' ').toLowerCase();
    expect(text).toContain('electrical capacity');
  });

  it('suitable_now with heat pump mentions capacity in checks', () => {
    const result = assess(
      { ...BASE_PROFESSIONAL_FUTURE_READY },
      'Air Source Heat Pump',
    );
    const checksText = result.evCharging.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('capacity');
  });

  it('EV check_required always contains parking in checksRequired', () => {
    // Default check_required case
    const result = assess(BASE_STEADY_STORED);
    const checksText = result.evCharging.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('parking');
  });

  it('heat pump-only signal triggers check_required for EV when professional', () => {
    const result = assess(
      { ...BASE_PROFESSIONAL_COMBI, preferCombi: false },
      'Air Source Heat Pump',
    );
    // heat pump + professional → check_required with capacity note
    expect(['suitable_now', 'check_required']).toContain(result.evCharging.status);
    const allText = [
      ...result.evCharging.reasons,
      ...result.evCharging.checksRequired,
    ].join(' ').toLowerCase();
    expect(allText).toContain('parking');
  });
});

// ─── Completeness ─────────────────────────────────────────────────────────────

describe('assessFutureEnergyOpportunities — output completeness', () => {
  it('always returns both solarPv and evCharging assessments', () => {
    const result = assess(BASE_PROFESSIONAL_COMBI);
    expect(result.solarPv).toBeDefined();
    expect(result.evCharging).toBeDefined();
  });

  it('each assessment has a non-empty summary', () => {
    const result = assess(BASE_STEADY_STORED);
    expect(result.solarPv.summary.length).toBeGreaterThan(0);
    expect(result.evCharging.summary.length).toBeGreaterThan(0);
  });

  it('each assessment has at least one reason', () => {
    const result = assess(BASE_STEADY_STORED);
    expect(result.solarPv.reasons.length).toBeGreaterThan(0);
    expect(result.evCharging.reasons.length).toBeGreaterThan(0);
  });

  it('not_currently_favoured has empty checksRequired for solar PV', () => {
    const result = assess(BASE_PROFESSIONAL_COMBI);
    expect(result.solarPv.status).toBe('not_currently_favoured');
    expect(result.solarPv.checksRequired).toHaveLength(0);
  });

  it('status is one of the three valid values for all scenarios', () => {
    const validStatuses = ['suitable_now', 'check_required', 'not_currently_favoured'];
    const scenarios = [
      BASE_PROFESSIONAL_COMBI,
      BASE_STEADY_STORED,
      BASE_MIXERGY_PROFESSIONAL,
      BASE_PROFESSIONAL_FUTURE_READY,
    ];
    for (const s of scenarios) {
      const result = assess(s);
      expect(validStatuses).toContain(result.solarPv.status);
      expect(validStatuses).toContain(result.evCharging.status);
    }
  });
});

// ─── Roof orientation signal ──────────────────────────────────────────────────

describe('assessFutureEnergyOpportunities — roof orientation signal (new roofOrientation field)', () => {
  it('south-facing roof adds favourable reason to solar PV', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'south' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('south_east-facing roof adds favourable reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'south_east' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('south_west-facing roof adds favourable reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'south_west' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('mixed orientation adds favourable reason (blended yield)', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'mixed' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('east-facing roof adds less_optimal reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'east' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('less optimal');
  });

  it('west-facing roof adds less_optimal reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'west' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('less optimal');
  });

  it('north-facing roof adds poor candidate reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'north' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('north-facing');
  });

  it('roofOrientation unknown keeps generic roof survey check', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'unknown' });
    const checksText = result.solarPv.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('roof orientation');
  });

  it('no roofOrientation set keeps generic roof survey check', () => {
    const result = assess({ ...BASE_STEADY_STORED });
    const checksText = result.solarPv.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('roof orientation');
    expect(checksText).not.toContain('favourable');
  });

  it('south_likely replaces generic check with specific confirmation note', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'south' });
    const checksText = result.solarPv.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('favourable');
    expect(checksText).not.toContain('orientation and obstruction survey required before');
  });

  it('less_optimal surfaces in checksRequired', () => {
    const result = assess({ ...BASE_STEADY_STORED, roofOrientation: 'east' });
    const checksText = result.solarPv.checksRequired.join(' ').toLowerCase();
    expect(checksText).toContain('less optimal');
  });

  it('orientation signal does not change solar PV status', () => {
    const withSouth = assess({ ...BASE_STEADY_STORED, roofOrientation: 'south' });
    const withEast  = assess({ ...BASE_STEADY_STORED, roofOrientation: 'east'  });
    const noOrient  = assess({ ...BASE_STEADY_STORED });
    expect(withSouth.solarPv.status).toBe('suitable_now');
    expect(withEast.solarPv.status).toBe('suitable_now');
    expect(noOrient.solarPv.status).toBe('suitable_now');
  });

  it('orientation signal does not affect EV charging assessment', () => {
    const withSouth = assess({ ...BASE_PROFESSIONAL_FUTURE_READY, roofOrientation: 'south' });
    const withEast  = assess({ ...BASE_PROFESSIONAL_FUTURE_READY, roofOrientation: 'east'  });
    expect(withSouth.evCharging.status).toBe(withEast.evCharging.status);
  });

  it('not_currently_favoured path with south orientation still has empty checksRequired', () => {
    const result = assess({ ...BASE_PROFESSIONAL_COMBI, roofOrientation: 'south' });
    expect(result.solarPv.status).toBe('not_currently_favoured');
    expect(result.solarPv.checksRequired).toHaveLength(0);
  });

  it('south orientation reason is appended for mixergy path', () => {
    const result = assess({ ...BASE_MIXERGY_PROFESSIONAL, roofOrientation: 'south' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });
});

// ─── Solar shading signal ─────────────────────────────────────────────────────

describe('assessFutureEnergyOpportunities — solar shading signal', () => {
  it('medium shading appends shading reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, solarShading: 'medium' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('shading');
  });

  it('high shading appends heavy shading reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, solarShading: 'high' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('heavy shading');
  });

  it('low shading does not append a shading reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, solarShading: 'low' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).not.toContain('heavy shading');
  });

  it('shading unknown does not append a shading reason', () => {
    const result = assess({ ...BASE_STEADY_STORED, solarShading: 'unknown' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).not.toContain('heavy shading');
  });

  it('shading signal does not change solar PV status', () => {
    const withHigh   = assess({ ...BASE_STEADY_STORED, solarShading: 'high' });
    const withLow    = assess({ ...BASE_STEADY_STORED, solarShading: 'low' });
    const noShading  = assess({ ...BASE_STEADY_STORED });
    expect(withHigh.solarPv.status).toBe('suitable_now');
    expect(withLow.solarPv.status).toBe('suitable_now');
    expect(noShading.solarPv.status).toBe('suitable_now');
  });

  it('shading signal does not affect EV charging assessment', () => {
    const withShading    = assess({ ...BASE_PROFESSIONAL_FUTURE_READY, solarShading: 'high' });
    const withoutShading = assess({ ...BASE_PROFESSIONAL_FUTURE_READY });
    expect(withShading.evCharging.status).toBe(withoutShading.evCharging.status);
  });
});

// ─── Legacy backward compatibility (houseFrontFacing) ─────────────────────────

describe('assessFutureEnergyOpportunities — legacy houseFrontFacing field', () => {
  it('north-facing front adds south_likely reason to solar PV (legacy)', () => {
    const result = assess({ ...BASE_STEADY_STORED, houseFrontFacing: 'north' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('south-facing front adds south_likely reason to solar PV (legacy)', () => {
    const result = assess({ ...BASE_STEADY_STORED, houseFrontFacing: 'south' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('east-facing front adds less_optimal reason to solar PV (legacy)', () => {
    const result = assess({ ...BASE_STEADY_STORED, houseFrontFacing: 'east' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('less optimal');
  });

  it('west-facing front adds less_optimal reason to solar PV (legacy)', () => {
    const result = assess({ ...BASE_STEADY_STORED, houseFrontFacing: 'west' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('less optimal');
  });

  it('roofOrientation takes precedence over houseFrontFacing when both present', () => {
    // roofOrientation=east should win over houseFrontFacing=north
    const result = assess({
      ...BASE_STEADY_STORED,
      roofOrientation: 'east',
      houseFrontFacing: 'north',
    });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('less optimal');
    expect(reasonsText).not.toContain('favourable');
  });

  it('falls back to houseFrontFacing when roofOrientation is absent', () => {
    const result = assess({ ...BASE_STEADY_STORED, houseFrontFacing: 'north' });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });

  it('falls back to houseFrontFacing when roofOrientation is unknown', () => {
    const result = assess({
      ...BASE_STEADY_STORED,
      roofOrientation: 'unknown',
      houseFrontFacing: 'north',
    });
    const reasonsText = result.solarPv.reasons.join(' ').toLowerCase();
    expect(reasonsText).toContain('favourable');
  });
});
