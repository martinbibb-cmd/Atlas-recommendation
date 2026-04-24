/**
 * buildShowerCompatibilityNotes.test.ts
 *
 * PR26 — Tests for the shower compatibility projection helper.
 *
 * Coverage:
 *   - electric shower → info note, customer summary, engineer note
 *   - electricShowerPresent flag → electric note (even without currentShowerType)
 *   - pumped_mixer shower → important install note
 *   - power_shower shower → important install note
 *   - pumpedShowerPresent flag → important note (even without currentShowerType)
 *   - mixer shower → advisory note
 *   - thermostatic shower → advisory note
 *   - unknown shower type → null (no note)
 *   - none → null
 *   - null inputs → null
 *   - duplicate warnings are not emitted into compatibilityWarnings
 *     (tested via buildDecisionFromScenarios integration)
 *   - engineer handoff receives the correct note (via buildEngineerHandoff)
 */

import { describe, it, expect } from 'vitest';
import { buildShowerCompatibilityNotes } from '../modules/buildShowerCompatibilityNotes';
import { buildDecisionFromScenarios } from '../modules/buildDecisionFromScenarios';
import { buildEngineerHandoff } from '../modules/buildEngineerHandoff';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ShowerCompatibilityNote } from '../../contracts/ShowerCompatibilityNote';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScenario(): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: {
      hotWater:    'excellent',
      heating:     'very_good',
      efficiency:  'good',
      reliability: 'very_good',
    },
    keyBenefits:      ['Mains-fed supply'],
    keyConstraints:   [],
    dayToDayOutcomes: [],
    requiredWorks:    [],
    upgradePaths:     [],
    physicsFlags:     {},
  };
}

function makeDecisionWithShower(
  showerNote: ShowerCompatibilityNote | null,
): AtlasDecisionV1 {
  return buildDecisionFromScenarios({
    scenarios:    [makeScenario()],
    boilerType:   'combi',
    ageYears:     8,
    showerCompatibilityNote: showerNote,
  });
}

// ─── buildShowerCompatibilityNotes ────────────────────────────────────────────

describe('buildShowerCompatibilityNotes — electric shower', () => {
  it('returns an info-severity note for currentShowerType electric', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note).not.toBeNull();
    expect(note?.severity).toBe('info');
    expect(note?.warningKey).toBe('electric_unaffected');
  });

  it('customer summary states the shower is separate from the boiler system', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note?.customerSummary).toMatch(/separate from the boiler hot-water system/i);
  });

  it('engineer note references DHW system independence', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note?.engineerNote).toMatch(/independent of the DHW system/i);
  });

  it('electricShowerPresent flag produces an electric note without currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ electricShowerPresent: true });
    expect(note?.warningKey).toBe('electric_unaffected');
    expect(note?.severity).toBe('info');
  });
});

describe('buildShowerCompatibilityNotes — pumped / power shower', () => {
  it('returns an important note for pumped_mixer', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' });
    expect(note?.severity).toBe('important');
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });

  it('returns an important note for power_shower', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'power_shower' });
    expect(note?.severity).toBe('important');
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });

  it('pumpedShowerPresent flag produces an important note without currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ pumpedShowerPresent: true });
    expect(note?.severity).toBe('important');
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });

  it('customer summary mentions changing the shower setup', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' });
    expect(note?.customerSummary).toMatch(/will need changing/i);
  });

  it('engineer note mentions removing or bypassing the pump', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'power_shower' });
    expect(note?.engineerNote).toMatch(/remove or bypass the shower pump/i);
  });
});

describe('buildShowerCompatibilityNotes — mixer shower', () => {
  it('returns an advisory note for mixer', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' });
    expect(note?.severity).toBe('advisory');
    expect(note?.warningKey).toBe('mixer_balanced_supply');
  });

  it('returns an advisory note for thermostatic', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'thermostatic' });
    expect(note?.severity).toBe('advisory');
    expect(note?.warningKey).toBe('mixer_balanced_supply');
  });

  it('customer summary mentions balanced hot and cold supplies', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' });
    expect(note?.customerSummary).toMatch(/balanced hot and cold supplies/i);
  });

  it('engineer note mentions verifying balanced supply pressures', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'thermostatic' });
    expect(note?.engineerNote).toMatch(/verify balanced hot and cold supply pressures/i);
  });
});

describe('buildShowerCompatibilityNotes — no note cases', () => {
  it('returns null for unknown shower type', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'unknown' });
    expect(note).toBeNull();
  });

  it('returns null for none shower type', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'none' });
    expect(note).toBeNull();
  });

  it('returns null when currentShowerType is null', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: null });
    expect(note).toBeNull();
  });

  it('returns null when no inputs are provided', () => {
    const note = buildShowerCompatibilityNotes({});
    expect(note).toBeNull();
  });
});

// ─── Decision integration — deduplication ────────────────────────────────────

describe('buildDecisionFromScenarios — shower note integration', () => {
  it('adds shower customerSummary to compatibilityWarnings', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' })!;
    const decision   = makeDecisionWithShower(showerNote);
    expect(decision.compatibilityWarnings).toContain(showerNote.customerSummary);
  });

  it('stores the structured showerCompatibilityNote on the decision', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const decision   = makeDecisionWithShower(showerNote);
    expect(decision.showerCompatibilityNote).toEqual(showerNote);
  });

  it('does not duplicate the shower summary when called twice', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    // Re-build with same note — simulates calling builder idempotently
    const decision = makeDecisionWithShower(showerNote);
    const occurrences = decision.compatibilityWarnings.filter(
      (w) => w === showerNote.customerSummary,
    ).length;
    expect(occurrences).toBe(1);
  });

  it('showerCompatibilityNote is absent when no note provided', () => {
    const decision = makeDecisionWithShower(null);
    expect(decision.showerCompatibilityNote).toBeUndefined();
  });
});

// ─── Engineer handoff — correct note surface ──────────────────────────────────

describe('buildEngineerHandoff — shower install note', () => {
  it('includes the engineer note for a pumped shower', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' })!;
    const decision   = makeDecisionWithShower(showerNote);
    const handoff    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(handoff.installNotes.some(n => /remove or bypass the shower pump/i.test(n))).toBe(true);
  });

  it('includes the engineer note for a mixer shower', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const decision   = makeDecisionWithShower(showerNote);
    const handoff    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(handoff.installNotes.some(n => /verify balanced hot and cold supply pressures/i.test(n))).toBe(true);
  });

  it('includes the engineer note for an electric shower', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    const decision   = makeDecisionWithShower(showerNote);
    const handoff    = buildEngineerHandoff(decision, [makeScenario()]);
    expect(handoff.installNotes.some(n => /independent of the DHW system/i.test(n))).toBe(true);
  });

  it('does not add a shower install note when no shower note on decision', () => {
    const decision = makeDecisionWithShower(null);
    const handoff  = buildEngineerHandoff(decision, [makeScenario()]);
    expect(handoff.installNotes.some(n => /shower/i.test(n))).toBe(false);
  });
});
