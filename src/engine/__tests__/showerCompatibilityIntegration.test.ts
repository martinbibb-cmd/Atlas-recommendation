/**
 * showerCompatibilityIntegration.test.ts
 *
 * PR26 — Integration tests verifying that the shower compatibility note flows
 * correctly through the decision, visual blocks, portal view model, and engineer
 * handoff layers.
 *
 * Coverage:
 *   Decision (buildDecisionFromScenarios):
 *     - Electric shower injects its customer summary into compatibilityWarnings.
 *     - Pumped shower injects its customer summary into compatibilityWarnings.
 *     - Mixer shower injects its customer summary into compatibilityWarnings.
 *     - Duplicate warning text is not emitted when the same string is already present.
 *     - No shower data → no shower text in compatibilityWarnings.
 *
 *   Visual blocks (buildVisualBlocks):
 *     - Pumped shower produces a warning block with severity 'important'.
 *     - Electric shower produces a warning block with severity 'info'.
 *     - Mixer shower produces a warning block with severity 'advisory'.
 *     - Shower warning block visualKey is 'shower_compatibility_warning'.
 *     - No shower note → no shower warning block emitted.
 *
 *   Portal (buildPortalViewModel):
 *     - Electric shower note appears as a proof card in whyCards.
 *     - Shower card title is 'Shower compatibility'.
 *     - Shower card text is not duplicated in the generic compatibility card.
 *
 *   Engineer handoff (buildEngineerHandoff):
 *     - Electric shower: install note mentions electric shower is independent.
 *     - Pumped shower: install note mentions removing or bypassing the pump.
 *     - Mixer shower: install note mentions balanced supply pressures.
 *     - No shower note → no shower text in installNotes.
 */

import { describe, it, expect } from 'vitest';
import { buildDecisionFromScenarios } from '../modules/buildDecisionFromScenarios';
import { buildVisualBlocks } from '../modules/buildVisualBlocks';
import { buildPortalViewModel } from '../modules/buildPortalViewModel';
import { buildEngineerHandoff } from '../modules/buildEngineerHandoff';
import { buildShowerCompatibilityNotes } from '../modules/buildShowerCompatibilityNotes';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: {
      type:    'system',
      summary: 'System boiler with unvented cylinder',
    },
    performance: {
      hotWater:    'excellent',
      heating:     'very_good',
      efficiency:  'good',
      reliability: 'excellent',
    },
    keyBenefits:     ['Reliable mains-fed supply'],
    keyConstraints:  [],
    dayToDayOutcomes: ['Consistent hot water pressure'],
    requiredWorks:   ['Install system boiler'],
    upgradePaths:    [],
    physicsFlags:    {
      hydraulicLimit:     false,
      combiFlowRisk:      false,
      highTempRequired:   false,
      pressureConstraint: false,
    },
    ...overrides,
  };
}

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId:  'system_unvented',
    headline:               'A system boiler is the right fit for this home.',
    summary:                'System boiler with unvented cylinder.',
    keyReasons:             ['Mains-fed supply suits household size'],
    avoidedRisks:           [],
    dayToDayOutcomes:       ['Consistent hot water pressure'],
    requiredWorks:          ['Install system boiler'],
    compatibilityWarnings:  [],
    includedItems:          [],
    quoteScope:             [],
    futureUpgradePaths:     [],
    supportingFacts:        [],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 5, condition: 'good' },
      expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [12, 15] },
      influencingFactors: {
        waterQuality:     'moderate',
        scaleRisk:        'low',
        usageIntensity:   'medium',
        maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary:        'System in good condition.',
    },
    ...overrides,
  };
}

// ─── Decision integration ─────────────────────────────────────────────────────

describe('shower compatibility — decision integration', () => {
  const scenarios = [makeScenario()];
  const baseInput = {
    scenarios,
    boilerType: 'combi' as const,
    ageYears:   5,
  };

  it('electric shower injects customer summary into compatibilityWarnings', () => {
    const decision = buildDecisionFromScenarios({
      ...baseInput,
      showerCompatibility: { currentShowerType: 'electric' },
    });
    expect(decision.compatibilityWarnings.some(w => /electric shower/i.test(w))).toBe(true);
  });

  it('pumped shower injects customer summary into compatibilityWarnings', () => {
    const decision = buildDecisionFromScenarios({
      ...baseInput,
      showerCompatibility: { currentShowerType: 'pumped_mixer' },
    });
    expect(decision.compatibilityWarnings.some(w => /unvented cylinder/i.test(w))).toBe(true);
  });

  it('mixer shower injects customer summary into compatibilityWarnings', () => {
    const decision = buildDecisionFromScenarios({
      ...baseInput,
      showerCompatibility: { currentShowerType: 'mixer' },
    });
    expect(decision.compatibilityWarnings.some(w => /balanced hot and cold supplies/i.test(w))).toBe(true);
  });

  it('duplicate warning text is not emitted when already present', () => {
    const showerNote = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    const decision = buildDecisionFromScenarios({
      ...baseInput,
      scenarios: [makeScenario({ physicsFlags: {} })],
      showerCompatibility: { currentShowerType: 'electric' },
    });
    const showerText = showerNote!.customerSummary;
    const count = decision.compatibilityWarnings.filter(
      w => w.trim().toLowerCase() === showerText.trim().toLowerCase(),
    ).length;
    expect(count).toBe(1);
  });

  it('no shower data → no shower text in compatibilityWarnings', () => {
    const decision = buildDecisionFromScenarios({ ...baseInput });
    expect(decision.compatibilityWarnings.some(w => /electric shower|unvented cylinder|balanced hot and cold/i.test(w))).toBe(false);
  });
});

// ─── Visual blocks integration ────────────────────────────────────────────────

describe('shower compatibility — visual blocks', () => {
  const scenarios = [makeScenario()];
  const decision  = makeDecision({ lifecycle: { ...makeDecision().lifecycle, currentSystem: { type: 'combi', ageYears: 5, condition: 'good' } } });

  it('pumped shower produces a warning block with severity important', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' })!;
    const blocks = buildVisualBlocks(decision, scenarios, undefined, note);
    const warn   = blocks.find(b => b.id === `shower-warning-${note.warningKey}`);
    expect(warn).toBeDefined();
    expect(warn?.type).toBe('warning');
    if (warn?.type === 'warning') expect(warn.severity).toBe('important');
  });

  it('electric shower produces a warning block with severity info', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    const blocks = buildVisualBlocks(decision, scenarios, undefined, note);
    const warn   = blocks.find(b => b.id === `shower-warning-${note.warningKey}`);
    expect(warn?.type).toBe('warning');
    if (warn?.type === 'warning') expect(warn.severity).toBe('info');
  });

  it('mixer shower produces a warning block with severity advisory', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const blocks = buildVisualBlocks(decision, scenarios, undefined, note);
    const warn   = blocks.find(b => b.id === `shower-warning-${note.warningKey}`);
    expect(warn?.type).toBe('warning');
    if (warn?.type === 'warning') expect(warn.severity).toBe('advisory');
  });

  it('shower warning block visualKey is shower_compatibility_warning', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const blocks = buildVisualBlocks(decision, scenarios, undefined, note);
    const warn   = blocks.find(b => b.id === `shower-warning-${note.warningKey}`);
    expect(warn?.visualKey).toBe('shower_compatibility_warning');
  });

  it('no shower note → no shower warning block emitted', () => {
    const blocks = buildVisualBlocks(decision, scenarios);
    const hasShowerBlock = blocks.some(b => b.id?.startsWith('shower-warning-'));
    expect(hasShowerBlock).toBe(false);
  });
});

// ─── Portal integration ───────────────────────────────────────────────────────

describe('shower compatibility — portal whyCards', () => {
  const scenarios = [makeScenario()];
  const decision  = makeDecision();
  const blocks    = buildVisualBlocks(decision, scenarios);

  it('electric shower note appears as a proof card in whyCards', () => {
    const note  = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    const model = buildPortalViewModel(decision, scenarios, blocks, note);
    const card  = model.whyCards.find(c => c.id === `shower-${note.warningKey}`);
    expect(card).toBeDefined();
  });

  it('shower proof card title is Shower compatibility', () => {
    const note  = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const model = buildPortalViewModel(decision, scenarios, blocks, note);
    const card  = model.whyCards.find(c => c.id === `shower-${note.warningKey}`);
    expect(card?.title).toBe('Shower compatibility');
  });

  it('shower card value matches the customerSummary', () => {
    const note  = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' })!;
    const model = buildPortalViewModel(decision, scenarios, blocks, note);
    const card  = model.whyCards.find(c => c.id === `shower-${note.warningKey}`);
    expect(card?.value).toBe(note.customerSummary);
  });

  it('shower card text is not duplicated in the generic compatibility card', () => {
    // Put the shower customer summary into compatibilityWarnings so the dedup
    // logic is exercised.
    const note         = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    const decisionWithWarning = makeDecision({
      compatibilityWarnings: [note.customerSummary],
    });
    const model = buildPortalViewModel(decisionWithWarning, scenarios, blocks, note);
    const showerCards = model.whyCards.filter(c => c.value === note.customerSummary);
    expect(showerCards.length).toBe(1);
  });

  it('no shower note → no shower proof card in whyCards', () => {
    const model = buildPortalViewModel(decision, scenarios, blocks);
    const hasShowerCard = model.whyCards.some(c => c.title === 'Shower compatibility');
    expect(hasShowerCard).toBe(false);
  });
});

// ─── Engineer handoff integration ─────────────────────────────────────────────

describe('shower compatibility — engineer handoff install notes', () => {
  const scenarios = [makeScenario()];
  const decision  = makeDecision();

  it('electric shower: install note states electric shower is independent of DHW system', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'electric' })!;
    const result = buildEngineerHandoff(decision, scenarios, undefined, undefined, note);
    expect(result.installNotes.some(n => /electric shower/i.test(n) && /independent/i.test(n))).toBe(true);
  });

  it('pumped shower: install note mentions removing or bypassing the pump', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' })!;
    const result = buildEngineerHandoff(decision, scenarios, undefined, undefined, note);
    expect(result.installNotes.some(n => /remove or bypass/i.test(n))).toBe(true);
  });

  it('mixer shower: install note mentions verifying balanced supply pressures', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' })!;
    const result = buildEngineerHandoff(decision, scenarios, undefined, undefined, note);
    expect(result.installNotes.some(n => /balanced/i.test(n))).toBe(true);
  });

  it('thermostatic shower: install note mentions balanced supply pressures', () => {
    const note   = buildShowerCompatibilityNotes({ currentShowerType: 'thermostatic' })!;
    const result = buildEngineerHandoff(decision, scenarios, undefined, undefined, note);
    expect(result.installNotes.some(n => /balanced/i.test(n))).toBe(true);
  });

  it('no shower note → no shower text in installNotes', () => {
    const result = buildEngineerHandoff(decision, scenarios);
    expect(result.installNotes.some(n => /electric shower|remove or bypass|balanced supply/i.test(n))).toBe(false);
  });
});
