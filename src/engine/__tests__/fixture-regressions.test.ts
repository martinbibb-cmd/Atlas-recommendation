/**
 * fixture-regressions.test.ts
 *
 * Engine regression tests driven by JSON fixtures in the /fixtures directory.
 * Each fixture represents a real-world survey scenario with specific physical
 * constraints. Tests assert expected engine flags, recommendations, and
 * limiter presence so that future changes cannot silently alter outcomes.
 *
 * Fixture inventory:
 *   combi-good-1bath        — single bathroom, adequate mains pressure and flow
 *   combi-bad-low-mains     — low pressure (0.8 bar) forcing combi rejection
 *   system-cylinder-family  — stored water, 2 bathrooms, ASHP flagged
 *   open-vented-loft-risk   — tank-fed cold water supply from loft tank, no mains pressure benefit
 *   ashp-22mm-high-load     — high heat load through 22mm pipework
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runEngine } from '../Engine';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFixture(relativePath: string): EngineInputV2_3 {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), relativePath), 'utf8'),
  );
  // Strip the human-readable annotation field before passing to the engine
  delete (raw as Record<string, unknown>)._comment;
  return raw as EngineInputV2_3;
}

// ─── combi-good-1bath ────────────────────────────────────────────────────────

describe('fixture: combi-good-1bath', () => {
  const input = loadFixture('fixtures/combi-good-1bath.json');
  const result = runEngine(input);

  it('does not reject combi via red-flag module', () => {
    expect(result.redFlags.rejectCombi).toBe(false);
  });

  it('does not reject stored-water via red-flag module', () => {
    expect(result.redFlags.rejectStored).toBe(false);
  });

  it('does not flag ASHP concerns', () => {
    expect(result.redFlags.flagAshp).toBe(false);
  });

  it('does not present a hydraulic bottleneck', () => {
    expect(result.hydraulic.isBottleneck).toBe(false);
  });

  it('mains pressure is above the pressure-lockout threshold', () => {
    // 2.5 bar dynamic pressure is well above the 1.0 bar combi minimum
    expect(result.pressureAnalysis.dynamicBar).toBeGreaterThan(1.0);
  });

  it('engine produces a recommendation', () => {
    expect(result.engineOutput.recommendation.primary).toBeDefined();
    expect(result.engineOutput.recommendation.primary.length).toBeGreaterThan(0);
  });
});

// ─── combi-bad-low-mains ─────────────────────────────────────────────────────

describe('fixture: combi-bad-low-mains', () => {
  const input = loadFixture('fixtures/combi-bad-low-mains.json');
  const result = runEngine(input);

  it('rejects combi via red-flag module due to low mains pressure', () => {
    expect(result.redFlags.rejectCombi).toBe(true);
  });

  it('rejection reason mentions pressure or lockout', () => {
    const reasonText = result.redFlags.reasons.join(' ').toLowerCase();
    expect(reasonText).toMatch(/pressure|lockout/);
  });

  it('does not reject stored-water option', () => {
    expect(result.redFlags.rejectStored).toBe(false);
  });

  it('combiDhwV1 flags a pressure-lockout flag', () => {
    const flagIds = result.combiDhwV1.flags.map(f => f.id);
    expect(flagIds).toContain('combi-pressure-lockout');
  });

  it('combiDhwV1 verdict is fail', () => {
    expect(result.combiDhwV1.verdict.combiRisk).toBe('fail');
  });

  it('dynamic mains pressure is below the 1.0 bar combi minimum', () => {
    expect(result.pressureAnalysis.dynamicBar).toBeLessThan(1.0);
  });
});

// ─── system-cylinder-family ──────────────────────────────────────────────────

describe('fixture: system-cylinder-family', () => {
  const input = loadFixture('fixtures/system-cylinder-family.json');
  const result = runEngine(input);

  it('flags ASHP due to 22mm primary pipework with high heat load', () => {
    expect(result.redFlags.flagAshp).toBe(true);
  });

  it('ASHP flag reason mentions pipe diameter', () => {
    const reasonText = result.redFlags.reasons.join(' ').toLowerCase();
    expect(reasonText).toMatch(/22mm|pipe/);
  });

  it('combi is rejected due to simultaneous-demand risk (2 bathrooms)', () => {
    const flagIds = result.combiDhwV1.flags.map(f => f.id);
    expect(flagIds).toContain('combi-simultaneous-demand');
  });

  it('recommends stored hot water as the primary option', () => {
    expect(result.engineOutput.recommendation.primary.toLowerCase()).toMatch(/stored/);
  });

  it('does not reject stored-water option', () => {
    expect(result.redFlags.rejectStored).toBe(false);
  });
});

// ─── open-vented-loft-risk ───────────────────────────────────────────────────

describe('fixture: open-vented-loft-risk', () => {
  const input = loadFixture('fixtures/open-vented-loft-risk.json');
  const result = runEngine(input);

  it('flags ASHP due to 22mm pipework', () => {
    expect(result.redFlags.flagAshp).toBe(true);
  });

  it('does not reject combi based on mains pressure (2.5 bar is adequate)', () => {
    expect(result.redFlags.rejectCombi).toBe(false);
  });

  it('combiDhwV1 flags a DHW shortfall (high flow demand vs combi output)', () => {
    const flagIds = result.combiDhwV1.flags.map(f => f.id);
    expect(flagIds).toContain('combi-dhw-shortfall');
  });

  it('recommends stored hot water as the primary option', () => {
    expect(result.engineOutput.recommendation.primary.toLowerCase()).toMatch(/stored/);
  });
});

// ─── ashp-22mm-high-load ─────────────────────────────────────────────────────

describe('fixture: ashp-22mm-high-load', () => {
  const input = loadFixture('fixtures/ashp-22mm-high-load.json');
  const result = runEngine(input);

  it('flags ASHP due to 22mm pipework and high heat load (14 kW)', () => {
    expect(result.redFlags.flagAshp).toBe(true);
  });

  it('ASHP flag reason mentions 22mm and heat load', () => {
    const reasonText = result.redFlags.reasons.join(' ').toLowerCase();
    expect(reasonText).toMatch(/22mm/);
  });

  it('combi rejected due to simultaneous-demand risk (2 bathrooms)', () => {
    const flagIds = result.combiDhwV1.flags.map(f => f.id);
    expect(flagIds).toContain('combi-simultaneous-demand');
  });

  it('combiDhwV1 verdict is fail', () => {
    expect(result.combiDhwV1.verdict.combiRisk).toBe('fail');
  });

  it('recommends stored hot water as the primary option', () => {
    expect(result.engineOutput.recommendation.primary.toLowerCase()).toMatch(/stored/);
  });

  it('does not reject stored-water option', () => {
    expect(result.redFlags.rejectStored).toBe(false);
  });
});
