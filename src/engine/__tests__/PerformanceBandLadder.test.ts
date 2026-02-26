/**
 * Tests for PerformanceBandLadder and RecoveryStepsPanel logic helpers.
 *
 * These tests cover:
 *  - borderlineLabel() — borderline band-boundary detection
 *  - shouldShowHydraulics() — gate logic for the hydraulics recovery step
 */
import { describe, it, expect } from 'vitest';
import { borderlineLabel } from '../../components/PerformanceBandLadder';
import { shouldShowHydraulics } from '../../components/RecoveryStepsPanel';
import type { HydraulicModuleV1Result } from '../schema/EngineInputV2_3';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeHydraulic(overrides: Partial<HydraulicModuleV1Result> = {}): HydraulicModuleV1Result {
  return {
    boiler:  { deltaT: 20, flowLpm: 5.7 },
    ashp:    { deltaT: 5,  flowLpm: 22.8, velocityMs: 0.9 },
    verdict: { boilerRisk: 'pass', ashpRisk: 'pass' },
    velocityPenalty: 0,
    effectiveCOP: 3.2,
    flowDeratePct: 0,
    notes: [],
    ...overrides,
  };
}

// ─── borderlineLabel ──────────────────────────────────────────────────────────

describe('borderlineLabel', () => {
  it('returns null when efficiency is well inside a band', () => {
    expect(borderlineLabel(88)).toBeNull();   // middle of B (86–89)
    expect(borderlineLabel(84)).toBeNull();   // middle of C (82–85)
    expect(borderlineLabel(65)).toBeNull();   // middle of G (< 70)
  });

  it('detects A/B borderline at 90% (exactly on boundary)', () => {
    const label = borderlineLabel(90);
    expect(label).toBe('borderline A/B');
  });

  it('detects B/C borderline at 86% (exactly on boundary)', () => {
    const label = borderlineLabel(86);
    expect(label).toBe('borderline B/C');
  });

  it('detects A/B borderline at 90.4% (within 0.5%)', () => {
    const label = borderlineLabel(90.4);
    expect(label).toBe('borderline A/B');
  });

  it('detects A/B borderline at 89.6% (within 0.5% below)', () => {
    const label = borderlineLabel(89.6);
    expect(label).toBe('borderline A/B');
  });

  it('returns null at 90.6% (just outside 0.5% tolerance)', () => {
    expect(borderlineLabel(90.6)).toBeNull();
  });

  it('detects C/D borderline at 82%', () => {
    const label = borderlineLabel(82);
    expect(label).toBe('borderline C/D');
  });

  it('detects D/E borderline at 78%', () => {
    const label = borderlineLabel(78);
    expect(label).toBe('borderline D/E');
  });

  it('detects E/F borderline at 74%', () => {
    const label = borderlineLabel(74);
    expect(label).toBe('borderline E/F');
  });

  it('detects F/G borderline at 70%', () => {
    const label = borderlineLabel(70);
    expect(label).toBe('borderline F/G');
  });
});

// ─── shouldShowHydraulics ─────────────────────────────────────────────────────

describe('shouldShowHydraulics', () => {
  // Hidden cases — no ASHP

  it('is hidden when neither system is ASHP, even with velocity penalty', () => {
    const h = makeHydraulic({ velocityPenalty: 0.5, verdict: { boilerRisk: 'pass', ashpRisk: 'fail' } });
    expect(shouldShowHydraulics('boiler', 'boiler', h)).toBe(false);
  });

  it('is hidden when neither system is ASHP and no penalty', () => {
    const h = makeHydraulic();
    expect(shouldShowHydraulics('boiler', 'stored_unvented', h)).toBe(false);
  });

  it('is hidden when undefined system types and no penalty', () => {
    const h = makeHydraulic();
    expect(shouldShowHydraulics(undefined, undefined, h)).toBe(false);
  });

  // Hidden cases — ASHP present but no constraining hydraulics

  it('is hidden when systemB is ASHP but velocity penalty = 0 and ashpRisk = pass', () => {
    const h = makeHydraulic({ velocityPenalty: 0, verdict: { boilerRisk: 'pass', ashpRisk: 'pass' } });
    expect(shouldShowHydraulics('boiler', 'ashp', h)).toBe(false);
  });

  it('is hidden when systemA is ASHP but velocity penalty = 0.05 (below threshold)', () => {
    const h = makeHydraulic({ velocityPenalty: 0.05 });
    expect(shouldShowHydraulics('ashp', 'boiler', h)).toBe(false);
  });

  // Shown cases — ASHP + hydraulic constraint

  it('is shown when systemB is ASHP and velocity penalty > 0.1', () => {
    const h = makeHydraulic({ velocityPenalty: 0.15 });
    expect(shouldShowHydraulics('boiler', 'ashp', h)).toBe(true);
  });

  it('is shown when systemA is ASHP and ashpRisk = warn', () => {
    const h = makeHydraulic({ verdict: { boilerRisk: 'pass', ashpRisk: 'warn' } });
    expect(shouldShowHydraulics('ashp', 'boiler', h)).toBe(true);
  });

  it('is shown when systemA is ASHP and ashpRisk = fail', () => {
    const h = makeHydraulic({ verdict: { boilerRisk: 'pass', ashpRisk: 'fail' } });
    expect(shouldShowHydraulics('ashp', 'boiler', h)).toBe(true);
  });

  it('is shown when systemB is ASHP and velocity penalty exactly 0.1 (boundary)', () => {
    // 0.1 is NOT > 0.1, so should still be hidden
    const h = makeHydraulic({ velocityPenalty: 0.1 });
    expect(shouldShowHydraulics('boiler', 'ashp', h)).toBe(false);
  });

  it('is shown when systemB is ASHP and velocity penalty = 0.11 (just above threshold)', () => {
    const h = makeHydraulic({ velocityPenalty: 0.11 });
    expect(shouldShowHydraulics('boiler', 'ashp', h)).toBe(true);
  });

  it('is shown when gshp is systemA and ashpRisk = warn', () => {
    const h = makeHydraulic({ verdict: { boilerRisk: 'pass', ashpRisk: 'warn' } });
    expect(shouldShowHydraulics('gshp', 'boiler', h)).toBe(true);
  });

  it('is shown when both systems are ASHP with no penalty (ashpRisk = warn)', () => {
    const h = makeHydraulic({ verdict: { boilerRisk: 'pass', ashpRisk: 'warn' } });
    expect(shouldShowHydraulics('ashp', 'ashp', h)).toBe(true);
  });
});
