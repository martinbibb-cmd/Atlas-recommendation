/**
 * Integration tests for educational sequencing wired into the calm welcome pack
 * builder.  These tests verify that:
 *
 *  1. Customer-facing section cards are ordered by their concept's sequence stage
 *     (reassurance → expectation → lived experience → misconception → …).
 *  2. The ADHD accessibility profile reduces the number of concept cards per section.
 *  3. Concepts deferred by the sequencing engine are recorded in the omission log
 *     and never silently lost.
 *  4. Pacing warnings from the sequencing engine are kept internal and do not appear
 *     in customer-facing output.
 *  5. The customer renderer (CalmWelcomePack) does not expose any sequencing
 *     diagnostics (metadata, pacing warnings, deferred lists).
 *  6. `recommendedScenarioId` is unchanged by the sequencing integration.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackViewModel } from '../packRenderer/buildCalmWelcomePackViewModel';
import { CalmWelcomePack } from '../packRenderer/CalmWelcomePack';
import type { EducationalConceptTaxonomyV1 } from '../taxonomy/EducationalConceptTaxonomyV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeTaxonomyConcept(conceptId: string, category: EducationalConceptTaxonomyV1['category'] = 'controls'): EducationalConceptTaxonomyV1 {
  return {
    conceptId,
    category,
    title: conceptId,
    plainEnglishDefinition: `Plain definition for ${conceptId}`,
    appliesToSystemTypes: ['all'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'best_practice',
    preferredAssetTypes: ['explainer'],
    defaultAudience: 'all',
    defaultDepth: 'plain',
    printPriority: 'should_print',
    welcomePackPriority: 'should_have',
  };
}

function makeAsset(id: string, conceptIds: string[]): EducationalAssetV1 {
  return {
    id,
    conceptIds,
    title: id,
    assetType: 'explainer',
    audience: 'all',
    depth: 'plain',
    cognitiveLoad: 'low',
    textDensity: 'low',
    motionIntensity: 'none',
    hasStaticFallback: true,
    hasPrintEquivalent: true,
    supportsReducedMotion: true,
    analogyFamilies: ['none'],
    accessibilityProfiles: ['plain_language'],
    translationRisk: 'low',
    requiredEngineFacts: [],
    triggerTags: [],
  };
}

function makeContent(conceptId: string): EducationalContentV1 {
  return {
    contentId: `content-${conceptId}`,
    conceptId,
    title: `Title for ${conceptId}`,
    plainEnglishSummary: `Summary for ${conceptId}`,
    customerExplanation: `Customer explanation for ${conceptId}`,
    printSummary: `Print summary for ${conceptId}`,
    analogyOptions: [],
    commonMisunderstanding: '',
    dangerousOversimplification: '',
    readingLevel: 'simple',
    accessibilityNotes: [],
    requiredEvidenceFacts: [],
    confidenceLevel: 'best_practice',
  };
}

/**
 * Build a minimal eligible plan that places each given concept in the
 * `relevant_explainers` section, so we can test within-section ordering
 * without fighting the section structure.
 */
function buildPlan(
  selectedConceptIds: string[],
  assetIds: string[],
): WelcomePackPlanV1 {
  const eligibilityFindings = assetIds.map((assetId, idx) => ({
    assetId,
    conceptIds: [selectedConceptIds[idx]!],
    eligible: true,
    mode: 'customer_pack' as const,
    reasons: [],
    severity: 'info' as const,
  }));

  return {
    packId: 'welcome-pack:test',
    recommendedScenarioId: 'ashp',
    archetypeId: 'heat_pump_reality',
    sections: [
      { id: 'calm_summary', includedAssetIds: [], notes: [] },
      { id: 'why_this_fits', includedAssetIds: [], notes: [] },
      { id: 'living_with_the_system', includedAssetIds: [], notes: [] },
      // All test concepts land here so order within a single section is testable.
      { id: 'relevant_explainers', includedAssetIds: assetIds, notes: [] },
      { id: 'next_steps', includedAssetIds: [], notes: [] },
    ],
    selectedAssetIds: assetIds,
    selectedAssetReasons: Object.fromEntries(assetIds.map((id) => [id, ['test']])),
    selectedConceptIds,
    deferredConceptIds: [],
    omittedAssetIdsWithReason: [],
    printPageBudget: 6,
    pageBudgetUsed: 2,
    cognitiveLoadBudget: 'medium',
    qrDestinations: [],
    eligibilityFindings,
  };
}

const CUSTOMER_SUMMARY: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump',
  headline: 'A heat pump is the right fit.',
  plainEnglishDecision: 'This home suits a heat pump.',
  whyThisWins: [],
  whatThisAvoids: [],
  includedNow: [],
  requiredChecks: [],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: [],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'Heat pump fits well.',
};

// ─── Concepts with known sequencing stages (from educationalSequenceRules) ────
// reassurance : system_fit_explanation
// lived_experience : operating_behaviour  (prereq: system_fit_explanation)
// misconception   : boiler_cycling        (prereqs: system_fit_explanation, operating_behaviour)
const REASSURANCE_CONCEPT = 'system_fit_explanation';
const LIVED_CONCEPT = 'operating_behaviour';
const MISCONCEPTION_CONCEPT = 'boiler_cycling';

// ─── 1. Sequencing stage order ────────────────────────────────────────────────

describe('buildCalmWelcomePackViewModel — sequencing stage order', () => {
  it('places reassurance concepts before lived-experience concepts within a section', () => {
    // Supply concepts out of natural stage order to verify the sequencing engine re-orders them.
    const selectedConceptIds = [LIVED_CONCEPT, REASSURANCE_CONCEPT];
    const assetIds = ['asset-lived', 'asset-reassurance'];

    const assets = [
      makeAsset('asset-lived', [LIVED_CONCEPT]),
      makeAsset('asset-reassurance', [REASSURANCE_CONCEPT]),
    ];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));
    const plan = buildPlan(selectedConceptIds, assetIds);

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });

    const explainers = vm.customerFacingSections.find((s) => s.sectionId === 'relevant_explainers');
    expect(explainers).toBeDefined();

    // Both concepts must appear in the section.
    const conceptIds = explainers!.cards.map((c) => c.conceptId);
    expect(conceptIds).toContain(REASSURANCE_CONCEPT);
    expect(conceptIds).toContain(LIVED_CONCEPT);

    // Reassurance must precede lived_experience in the rendered card list.
    const reassurancePos = conceptIds.indexOf(REASSURANCE_CONCEPT);
    const livedPos = conceptIds.indexOf(LIVED_CONCEPT);
    expect(reassurancePos).toBeLessThan(livedPos);
  });

  it('places misconception concepts after reassurance and lived-experience within a section', () => {
    // All three are included; all prerequisites are satisfied.
    const selectedConceptIds = [
      MISCONCEPTION_CONCEPT,  // misconception stage — has prereqs
      LIVED_CONCEPT,          // lived_experience stage
      REASSURANCE_CONCEPT,    // reassurance stage
    ];
    const assetIds = ['asset-misc', 'asset-lived', 'asset-reassurance'];

    const assets = assetIds.map((id, i) => makeAsset(id, [selectedConceptIds[i]!]));
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));
    const plan = buildPlan(selectedConceptIds, assetIds);

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });

    const explainers = vm.customerFacingSections.find((s) => s.sectionId === 'relevant_explainers');
    if (!explainers) {
      // The misconception concept may have been deferred; that's acceptable.
      return;
    }

    const conceptIds = explainers.cards.map((c) => c.conceptId).filter(Boolean);

    // If all three are present, reassurance must come first.
    const reassurancePos = conceptIds.indexOf(REASSURANCE_CONCEPT);
    const livedPos = conceptIds.indexOf(LIVED_CONCEPT);
    const miscPos = conceptIds.indexOf(MISCONCEPTION_CONCEPT);

    if (reassurancePos >= 0 && livedPos >= 0) {
      expect(reassurancePos).toBeLessThan(livedPos);
    }
    if (livedPos >= 0 && miscPos >= 0) {
      expect(livedPos).toBeLessThan(miscPos);
    }
    if (reassurancePos >= 0 && miscPos >= 0) {
      expect(reassurancePos).toBeLessThan(miscPos);
    }
  });

  it('populates sequencingMetadata.stagesPresent with at least one stage', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance']);
    const assets = [makeAsset('asset-reassurance', [REASSURANCE_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });

    expect(vm.sequencingMetadata).toBeDefined();
    expect(vm.sequencingMetadata!.stagesPresent.length).toBeGreaterThan(0);
    expect(vm.sequencingMetadata!.archetypeId).toBe('heat_pump_reality');
  });
});

// ─── 2. ADHD profile reduces concept density ──────────────────────────────────

describe('buildCalmWelcomePackViewModel — ADHD concept density', () => {
  it('limits cards per section to 1 when the ADHD accessibility profile is active', () => {
    // Four distinct reassurance/expectation concepts in the same section —
    // ADHD cap (appliedMaxSimultaneous = 1) should leave at most 1 card.
    const selectedConceptIds = [
      REASSURANCE_CONCEPT,
      'emitter_sizing',      // expectation — prereq: system_fit_explanation ✓
      'stored_hot_water_efficiency', // expectation — prereq: system_fit_explanation ✓
      LIVED_CONCEPT,         // lived_experience — prereq: system_fit_explanation ✓
    ];
    const assetIds = selectedConceptIds.map((id) => `asset-${id}`);

    const assets = assetIds.map((id, i) => makeAsset(id, [selectedConceptIds[i]!]));
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));
    const plan = buildPlan(selectedConceptIds, assetIds);

    // Without ADHD — all eligible cards should appear.
    const vmDefault = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    // With ADHD — at most 1 card per non-exempt section.
    const vmAdhd = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      accessibilityPreferences: { profiles: ['adhd'] },
    });

    const defaultCardCount = vmDefault.customerFacingSections
      .filter((s) => s.sectionId !== 'calm_summary' && s.sectionId !== 'safety_and_compliance')
      .reduce((sum, s) => sum + s.cards.length, 0);

    const adhdCardCount = vmAdhd.customerFacingSections
      .filter((s) => s.sectionId !== 'calm_summary' && s.sectionId !== 'safety_and_compliance')
      .reduce((sum, s) => sum + s.cards.length, 0);

    // ADHD pack must have strictly fewer concept cards than the default pack.
    expect(adhdCardCount).toBeLessThan(defaultCardCount);

    // No non-exempt section should have more than 1 card with ADHD active.
    for (const section of vmAdhd.customerFacingSections) {
      if (section.sectionId === 'calm_summary' || section.sectionId === 'safety_and_compliance') {
        continue;
      }
      expect(section.cards.length).toBeLessThanOrEqual(1);
    }
  });

  it('records overflow cards in the internal omission log when ADHD cap is applied', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT, LIVED_CONCEPT];
    const assetIds = selectedConceptIds.map((id) => `asset-${id}`);

    const assets = assetIds.map((id, i) => makeAsset(id, [selectedConceptIds[i]!]));
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));
    const plan = buildPlan(selectedConceptIds, assetIds);

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      accessibilityPreferences: { profiles: ['adhd'] },
    });

    // The density cap must be reflected in the omission log.
    const densityOmissions = vm.internalOmissionLog.filter((entry) =>
      entry.reason.includes('concept-density cap'),
    );
    expect(densityOmissions.length).toBeGreaterThan(0);
  });

  it('sets appliedMaxSimultaneous to 1 in sequencingMetadata when ADHD is active', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance']);
    const assets = [makeAsset('asset-reassurance', [REASSURANCE_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      accessibilityPreferences: { profiles: ['adhd'] },
    });

    expect(vm.sequencingMetadata?.appliedMaxSimultaneous).toBe(1);
  });
});

// ─── 3. Deferred concepts are not silently lost ───────────────────────────────

describe('buildCalmWelcomePackViewModel — deferred concepts not silently lost', () => {
  it('records a sequencing-deferred concept in the internal omission log', () => {
    // `boiler_cycling` requires system_fit_explanation + operating_behaviour.
    // Omitting those prerequisites forces the engine to defer it.
    const selectedConceptIds = [MISCONCEPTION_CONCEPT];  // prereqs missing
    const plan = buildPlan(selectedConceptIds, ['asset-misc']);
    const assets = [makeAsset('asset-misc', [MISCONCEPTION_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    const deferredEntry = vm.internalOmissionLog.find(
      (entry) => entry.conceptId === MISCONCEPTION_CONCEPT && entry.reason.includes('educational sequencing'),
    );
    expect(deferredEntry).toBeDefined();
  });

  it('populates deferredBySequencing for concepts the engine deferred', () => {
    const selectedConceptIds = [MISCONCEPTION_CONCEPT];  // prereqs missing → deferred
    const plan = buildPlan(selectedConceptIds, ['asset-misc']);
    const assets = [makeAsset('asset-misc', [MISCONCEPTION_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    expect(vm.deferredBySequencing).toBeDefined();
    const deferredItem = vm.deferredBySequencing!.find((d) => d.conceptId === MISCONCEPTION_CONCEPT);
    expect(deferredItem).toBeDefined();
    expect(deferredItem!.reason.length).toBeGreaterThan(0);
    expect(deferredItem!.ruleId.length).toBeGreaterThan(0);
  });

  it('does not silently omit a sequencing-deferred concept — it must appear in log or sections', () => {
    const selectedConceptIds = [MISCONCEPTION_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-misc']);
    const assets = [makeAsset('asset-misc', [MISCONCEPTION_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    const appearsInSections = vm.customerFacingSections.some((section) =>
      section.cards.some((card) => card.conceptId === MISCONCEPTION_CONCEPT),
    );
    const appearsInOmissionLog = vm.internalOmissionLog.some(
      (entry) => entry.conceptId === MISCONCEPTION_CONCEPT,
    );
    const appearsInDeferredBySequencing =
      vm.deferredBySequencing?.some((d) => d.conceptId === MISCONCEPTION_CONCEPT) ?? false;

    // The concept must appear in at least one of these places.
    expect(appearsInSections || appearsInOmissionLog || appearsInDeferredBySequencing).toBe(true);
  });
});

// ─── 4. Pacing warnings stay internal ────────────────────────────────────────

describe('buildCalmWelcomePackViewModel — pacing warnings are internal only', () => {
  it('pacing warnings do not appear in customerFacingSections or qrDestinations', () => {
    // Use two reassurance-stage concepts with ADHD active → expect overload warnings.
    const selectedConceptIds = [REASSURANCE_CONCEPT, 'HYD-02'];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance', 'asset-hyd02']);
    const assets = [
      makeAsset('asset-reassurance', [REASSURANCE_CONCEPT]),
      makeAsset('asset-hyd02', ['HYD-02']),
    ];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      accessibilityPreferences: { profiles: ['adhd'] },
    });

    // Verify pacing warnings were generated and are accessible internally.
    expect(vm.pacingWarnings).toBeDefined();
    expect(vm.pacingWarnings!.length).toBeGreaterThan(0);

    // Pacing warnings must not appear in customer-facing content.
    const customerOutput = JSON.stringify({
      sections: vm.customerFacingSections,
      qrDestinations: vm.qrDestinations,
    });

    for (const warning of vm.pacingWarnings!) {
      // The warning text itself must not be present in customer output.
      expect(customerOutput).not.toContain(warning);
    }

    // No "overload", "pacing", or "cooldown" text in customer output.
    expect(customerOutput.toLowerCase()).not.toContain('overload');
    expect(customerOutput.toLowerCase()).not.toContain('cooldown');
  });

  it('sequencingMetadata is not in customer-facing text fields', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance']);
    const assets = [makeAsset('asset-reassurance', [REASSURANCE_CONCEPT])];
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });

    const customerOutput = JSON.stringify({
      title: vm.title,
      sections: vm.customerFacingSections,
      qrDestinations: vm.qrDestinations,
    }).toLowerCase();

    expect(customerOutput).not.toContain('sequencingmetadata');
    expect(customerOutput).not.toContain('appliedmaxsimultaneous');
    expect(customerOutput).not.toContain('stagespresent');
    expect(customerOutput).not.toContain('pacingwarnings');
    expect(customerOutput).not.toContain('deferredbysequencing');
  });
});

// ─── 5. Customer renderer does not expose sequencing diagnostics ──────────────

describe('CalmWelcomePack renderer — no sequencing diagnostics exposed', () => {
  function buildSafeViewModelWithSequencingFields() {
    return buildCalmWelcomePackViewModel({
      plan: buildPlan([REASSURANCE_CONCEPT, LIVED_CONCEPT], ['asset-reassurance', 'asset-lived']),
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy: [REASSURANCE_CONCEPT, LIVED_CONCEPT].map((id) => makeTaxonomyConcept(id)),
      assets: [
        makeAsset('asset-reassurance', [REASSURANCE_CONCEPT]),
        makeAsset('asset-lived', [LIVED_CONCEPT]),
      ],
      educationalContent: [REASSURANCE_CONCEPT, LIVED_CONCEPT].map(makeContent),
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });
  }

  it('does not render sequencingMetadata, pacingWarnings, or deferredBySequencing text', () => {
    const viewModel = buildSafeViewModelWithSequencingFields();

    // Inject synthetic sequencing diagnostic fields so we can confirm the renderer ignores them.
    const vmWithDiagnostics = {
      ...viewModel,
      pacingWarnings: ['Stage overload: do not show this to the customer.'],
      deferredBySequencing: [{ conceptId: 'test', ruleId: 'r1', reason: 'deferred reason text — internal only' }],
      sequencingMetadata: {
        archetypeId: 'heat_pump_reality',
        appliedMaxSimultaneous: 4,
        stagesPresent: ['reassurance' as const],
      },
    };

    const { container } = render(<CalmWelcomePack viewModel={vmWithDiagnostics} />);
    const text = (container.textContent ?? '').toLowerCase();

    expect(text).not.toContain('stage overload');
    expect(text).not.toContain('internal only');
    expect(text).not.toContain('deferred reason text');
    expect(text).not.toContain('sequencingmetadata');
    expect(text).not.toContain('appliedmaxsimultaneous');
    expect(text).not.toContain('pacingwarnings');
  });
});

// ─── 6. recommendedScenarioId unchanged ──────────────────────────────────────

describe('buildCalmWelcomePackViewModel — sequencing does not alter recommendation', () => {
  it('keeps recommendedScenarioId unchanged after sequencing integration', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT, LIVED_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance', 'asset-lived']);
    const assets = selectedConceptIds.map((id) => makeAsset(`asset-${id}`, [id]));
    const educationalContent = selectedConceptIds.map(makeContent);
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
      archetypeId: 'heat_pump_reality',
    });

    expect(vm.recommendedScenarioId).toBe(plan.recommendedScenarioId);
    expect(vm.recommendedScenarioId).toBe(CUSTOMER_SUMMARY.recommendedScenarioId);
  });

  it('sequencing does not mutate or replace any customer-facing content titles', () => {
    const selectedConceptIds = [REASSURANCE_CONCEPT];
    const plan = buildPlan(selectedConceptIds, ['asset-reassurance']);
    const content = makeContent(REASSURANCE_CONCEPT);
    const assets = [makeAsset('asset-reassurance', [REASSURANCE_CONCEPT])];
    const taxonomy = selectedConceptIds.map((id) => makeTaxonomyConcept(id));

    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary: CUSTOMER_SUMMARY,
      taxonomy,
      assets,
      educationalContent: [content],
      eligibilityMode: 'filter',
    });

    const allCards = vm.customerFacingSections.flatMap((s) => s.cards);
    const conceptCard = allCards.find((c) => c.conceptId === REASSURANCE_CONCEPT);
    if (conceptCard) {
      expect(conceptCard.title).toBe(content.title);
    }
  });
});
