import { getContentForConcepts } from '../content/contentLookup';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';
import { buildCalmWelcomePackViewModel } from '../packRenderer/buildCalmWelcomePackViewModel';
import { buildPrintableWelcomePackViewModel } from '../packRenderer/buildPrintableWelcomePackViewModel';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { printEquivalentRegistry } from '../printEquivalents/printEquivalentRegistry';
import type {
  WelcomePackValidationFixture,
  WelcomePackValidationFixtureId,
} from './validationFixtures/WelcomePackValidationFixtureV1';
import {
  welcomePackValidationFixtureList,
  getValidationFixture,
  welcomePackValidationFixtures,
} from './validationFixtures/welcomePackValidationFixtures';
import type { WelcomePackValidationReportV1 } from './WelcomePackValidationReportV1';
import type { EducationalContentV1 } from '../content/EducationalContentV1';

function buildValidationEducationalContent(selectedConceptIds: string[]): EducationalContentV1[] {
  const byConceptId = new Map<string, EducationalContentV1>();

  for (const entry of getContentForConcepts(selectedConceptIds)) {
    byConceptId.set(entry.conceptId, entry);
  }

  for (const conceptId of selectedConceptIds) {
    if (byConceptId.has(conceptId)) {
      continue;
    }
    const fallback = educationalContentRegistry.find((entry) => entry.requiredEvidenceFacts.includes(conceptId));
    if (!fallback) {
      continue;
    }
    byConceptId.set(conceptId, { ...fallback, conceptId });
  }

  return [...byConceptId.values()];
}

/**
 * Determine whether the fixture's known misconceptions are addressed
 * by any selected concept's content analogy options.
 */
function detectMissingAnalogies(
  fixture: WelcomePackValidationFixture,
  selectedConceptIds: string[],
): string[] {
  const content = getContentForConcepts(selectedConceptIds);
  const coveredAnalogyText = content
    .flatMap((entry) =>
      entry.analogyOptions.flatMap((opt) => [opt.title, opt.explanation, opt.whereItWorks]),
    )
    .join(' ')
    .toLowerCase();

  return fixture.knownMisconceptions.filter((misconception) => {
    const keywords = misconception
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return !keywords.some((keyword) => coveredAnalogyText.includes(keyword));
  });
}

/**
 * Detect readability concerns: accessibility preferences in the fixture
 * that are not matched by the plan composition.
 */
function detectReadabilityConcerns(
  fixture: WelcomePackValidationFixture,
  selectedAssetIds: string[],
  cognitiveLoadBudget: string,
): string[] {
  const concerns: string[] = [];
  const profiles = fixture.accessibilityPreferences.profiles ?? [];

  if ((profiles.includes('dyslexia') || profiles.includes('adhd')) && cognitiveLoadBudget !== 'low') {
    concerns.push(
      `Fixture requests dyslexia/ADHD profile but cognitive load budget resolved to "${cognitiveLoadBudget}" instead of "low".`,
    );
  }

  const assets = educationalAssetRegistry.filter((asset) => selectedAssetIds.includes(asset.id));

  if (profiles.includes('dyslexia') || profiles.includes('adhd')) {
    const highLoadAssets = assets.filter((asset) => asset.cognitiveLoad === 'high');
    if (highLoadAssets.length > 0) {
      concerns.push(
        `Dyslexia/ADHD fixture includes high cognitive-load assets: ${highLoadAssets.map((a) => a.id).join(', ')}.`,
      );
    }
  }

  if (fixture.accessibilityPreferences.prefersPrint) {
    const assetsWithoutPrintProfile = assets.filter(
      (asset) => !asset.accessibilityProfiles.includes('print_first') && !asset.hasPrintEquivalent,
    );
    if (assetsWithoutPrintProfile.length > 0) {
      concerns.push(
        `Print-first fixture includes assets without print profile: ${assetsWithoutPrintProfile.map((a) => a.id).join(', ')}.`,
      );
    }
  }

  return concerns;
}

/**
 * Detect trust risks: emotional/trust concerns from the fixture that
 * are not referenced by any selected concept or content entry.
 */
function detectTrustRisks(
  fixture: WelcomePackValidationFixture,
  selectedConceptIds: string[],
): string[] {
  const content = getContentForConcepts(selectedConceptIds);
  const coveredText = [
    ...content.map((entry) => entry.title),
    ...content.map((entry) => entry.summary),
    ...content.flatMap((entry) => entry.analogyOptions),
    ...selectedConceptIds,
  ]
    .join(' ')
    .toLowerCase();

  return fixture.emotionalTrustConcerns.filter((concern) => {
    const keywords = concern
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return !keywords.some((keyword) => coveredText.includes(keyword));
  });
}

/**
 * Detect accessibility risks: accessibility notes from the fixture that
 * are not addressed by the plan.
 */
function detectAccessibilityRisks(
  fixture: WelcomePackValidationFixture,
  selectedAssetIds: string[],
): string[] {
  const risks: string[] = [];
  const assets = educationalAssetRegistry.filter((asset) => selectedAssetIds.includes(asset.id));
  const profiles = fixture.accessibilityPreferences.profiles ?? [];

  if (profiles.includes('dyslexia')) {
    const nonPlainAssets = assets.filter(
      (asset) => !asset.accessibilityProfiles.includes('plain_language') && asset.cognitiveLoad === 'high',
    );
    if (nonPlainAssets.length > 0) {
      risks.push(
        `Dyslexia fixture has high-cognitive-load assets without plain-language profile: ${nonPlainAssets.map((a) => a.id).join(', ')}.`,
      );
    }
  }

  if (fixture.accessibilityNotes.some((note) => /screen.?reader|aria|alt.?text/i.test(note))) {
    const assetsWithoutScreenReader = assets.filter(
      (asset) => !asset.accessibilityProfiles.includes('screen_reader'),
    );
    if (assetsWithoutScreenReader.length > 0) {
      risks.push(
        `Screen-reader accessibility noted but assets lack screen_reader profile: ${assetsWithoutScreenReader.map((a) => a.id).join(', ')}.`,
      );
    }
  }

  return risks;
}

/**
 * Detect print risks: print-first fixture with assets that have no print equivalent.
 */
function detectPrintRisks(
  fixture: WelcomePackValidationFixture,
  selectedAssetIds: string[],
): string[] {
  if (!fixture.accessibilityPreferences.prefersPrint) {
    return [];
  }

  const printEquivalentByAssetId = new Map(printEquivalentRegistry.map((entry) => [entry.assetId, entry]));
  const assets = educationalAssetRegistry.filter((asset) => selectedAssetIds.includes(asset.id));

  return assets
    .filter((asset) => {
      if (asset.hasPrintEquivalent && printEquivalentByAssetId.has(asset.id)) {
        return false;
      }
      if (asset.printComponentPath) {
        return false;
      }
      return true;
    })
    .map(
      (asset) =>
        `Asset "${asset.id}" is selected for a print-first fixture but has no registered print equivalent.`,
    );
}

/**
 * Detect cognitive overload warnings: high-load assets selected for a low-budget fixture.
 */
function detectCognitiveOverloadWarnings(
  fixture: WelcomePackValidationFixture,
  selectedAssetIds: string[],
  cognitiveLoadBudget: string,
): string[] {
  const profiles = fixture.accessibilityPreferences.profiles ?? [];
  if (!profiles.includes('dyslexia') && !profiles.includes('adhd') && cognitiveLoadBudget !== 'low') {
    return [];
  }

  const assets = educationalAssetRegistry.filter((asset) => selectedAssetIds.includes(asset.id));
  const highLoadAssets = assets.filter((asset) => asset.cognitiveLoad === 'high');

  return highLoadAssets.map(
    (asset) =>
      `High cognitive-load asset "${asset.id}" is selected for a low-budget (${cognitiveLoadBudget}) fixture profile.`,
  );
}

/**
 * Detect missing content: concepts selected by the plan but lacking
 * registered educational content entries.
 */
function detectMissingContent(selectedConceptIds: string[]): Array<{ conceptId: string; reason: string }> {
  const content = getContentForConcepts(selectedConceptIds);
  const coveredConceptIds = new Set(content.map((entry) => entry.conceptId));

  return selectedConceptIds
    .filter((conceptId) => !coveredConceptIds.has(conceptId))
    .map((conceptId) => ({
      conceptId,
      reason: `No registered educational content entry found for concept "${conceptId}".`,
    }));
}

/**
 * Detect missing print equivalents: assets selected but lacking a registered
 * print equivalent (only flagged when hasPrintEquivalent is true but none registered).
 */
function detectMissingPrintEquivalents(
  selectedAssetIds: string[],
): Array<{ assetId: string; reason: string }> {
  const printEquivalentByAssetId = new Map(printEquivalentRegistry.map((entry) => [entry.assetId, entry]));
  const assets = educationalAssetRegistry.filter((asset) => selectedAssetIds.includes(asset.id));

  return assets
    .filter((asset) => {
      if (!asset.hasPrintEquivalent) {
        return false;
      }
      if (asset.printComponentPath) {
        return false;
      }
      if (!asset.printEquivalentId) {
        return false;
      }
      return !printEquivalentByAssetId.has(asset.printEquivalentId);
    })
    .map((asset) => ({
      assetId: asset.id,
      reason: `Asset "${asset.id}" declares hasPrintEquivalent=true but no print equivalent is registered for it.`,
    }));
}

/**
 * Derive likely customer confusion points from known misconceptions not covered by selected content.
 */
function deriveLikelyConfusionPoints(
  fixture: WelcomePackValidationFixture,
  missingAnalogies: string[],
  trustRisks: string[],
): string[] {
  const points: string[] = [];

  for (const misconception of fixture.knownMisconceptions) {
    if (missingAnalogies.some((gap) => gap.toLowerCase().includes(misconception.toLowerCase().slice(0, 20)))) {
      points.push(`Misconception likely unaddressed in pack: "${misconception}"`);
    }
  }

  for (const concern of fixture.emotionalTrustConcerns) {
    if (trustRisks.some((risk) => risk.toLowerCase().includes(concern.toLowerCase().slice(0, 20)))) {
      points.push(`Trust concern may not be resolved: "${concern}"`);
    }
  }

  return points;
}

/**
 * Derive recommended next content additions from identified gaps.
 */
function deriveRecommendedContentAdditions(
  missingContent: Array<{ conceptId: string; reason: string }>,
  missingAnalogies: string[],
  missingPrintEquivalents: Array<{ assetId: string; reason: string }>,
): string[] {
  const additions: string[] = [];

  for (const gap of missingContent) {
    additions.push(`Add educational content entry for concept "${gap.conceptId}".`);
  }

  for (const analogy of missingAnalogies) {
    additions.push(`Add analogy or explainer content that addresses: "${analogy}".`);
  }

  for (const printGap of missingPrintEquivalents) {
    additions.push(`Register a print equivalent for asset "${printGap.assetId}".`);
  }

  return [...new Set(additions)];
}

/**
 * Determine readiness level from plan output.
 */
function resolveReadiness(
  selectedAssetIds: string[],
  blockedAssets: Array<{ assetId: string; reason: string }>,
): WelcomePackValidationReportV1['readiness'] {
  if (selectedAssetIds.length === 0) {
    return 'blocked';
  }
  if (blockedAssets.length > 0) {
    return 'partial';
  }
  return 'ready';
}

/**
 * Run validation for a single fixture.
 *
 * Builds the welcome-pack plan from the fixture, then audits the output
 * for content gaps, routing gaps, accessibility risks, and trust risks.
 *
 * Rules:
 *   - Does not alter recommendation logic.
 *   - Does not modify any registry or routing rule.
 *   - Read-only diagnostic only.
 */
export function runFixtureValidation(
  fixture: WelcomePackValidationFixture,
  eligibilityMode: 'off' | 'warn' | 'filter' = 'warn',
): WelcomePackValidationReportV1 {
  const plan = buildWelcomePackPlan({
    customerSummary: fixture.customerSummary,
    atlasDecision: fixture.atlasDecision,
    scenarios: fixture.scenarios,
    accessibilityPreferences: fixture.accessibilityPreferences,
    userConcernTags: fixture.userConcernTags,
    propertyConstraintTags: fixture.propertyConstraintTags,
    eligibilityMode,
  });
  const educationalContent = buildValidationEducationalContent(plan.selectedConceptIds);
  buildCalmWelcomePackViewModel({
    plan,
    customerSummary: fixture.customerSummary,
    taxonomy: educationalConceptTaxonomy,
    assets: educationalAssetRegistry,
    educationalContent,
    eligibilityMode,
    includeTechnicalAppendix: fixture.accessibilityPreferences.includeTechnicalAppendix,
  });
  buildPrintableWelcomePackViewModel(
    plan,
    fixture.customerSummary,
    educationalConceptTaxonomy,
    educationalAssetRegistry,
    {
      educationalContent,
      includeTechnicalAppendix: fixture.accessibilityPreferences.includeTechnicalAppendix,
    },
  );

  const selectedAssetIds = plan.selectedAssetIds;
  const selectedConceptIds = plan.selectedConceptIds;
  const omittedAssets = plan.omittedAssetIdsWithReason;
  const blockedAssets: Array<{ assetId: string; reason: string }> =
    eligibilityMode !== 'off'
      ? (plan.eligibilityFindings ?? [])
          .filter((f) => !f.eligible)
          .map((f) => ({ assetId: f.assetId, reason: f.reasons.join(' ') }))
      : [];

  const qrDeferredConceptIds = plan.deferredConceptIds;
  const cognitiveLoadBudget = plan.cognitiveLoadBudget;

  const missingContent = detectMissingContent(selectedConceptIds);
  const missingPrintEquivalents = detectMissingPrintEquivalents(selectedAssetIds);
  const missingAnalogies = detectMissingAnalogies(fixture, selectedConceptIds);
  const readabilityConcerns = detectReadabilityConcerns(fixture, selectedAssetIds, cognitiveLoadBudget);
  const trustRisks = detectTrustRisks(fixture, selectedConceptIds);
  const accessibilityRisks = detectAccessibilityRisks(fixture, selectedAssetIds);
  const printRisks = detectPrintRisks(fixture, selectedAssetIds);
  const cognitiveOverloadWarnings = detectCognitiveOverloadWarnings(
    fixture,
    selectedAssetIds,
    cognitiveLoadBudget,
  );
  const likelyCustomerConfusionPoints = deriveLikelyConfusionPoints(fixture, missingAnalogies, trustRisks);
  const recommendedNextContentAdditions = deriveRecommendedContentAdditions(
    missingContent,
    missingAnalogies,
    missingPrintEquivalents,
  );

  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    archetypeId: plan.archetypeId,
    readiness: resolveReadiness(selectedAssetIds, blockedAssets),
    selectedAssetIds,
    selectedConceptIds,
    omittedAssets,
    blockedAssets,
    qrDeferredConceptIds,
    pageCount: plan.pageBudgetUsed,
    printPageBudget: plan.printPageBudget,
    cognitiveLoadBudget,
    missingContent,
    missingPrintEquivalents,
    missingAnalogies,
    readabilityConcerns,
    trustRisks,
    accessibilityRisks,
    printRisks,
    cognitiveOverloadWarnings,
    likelyCustomerConfusionPoints,
    recommendedNextContentAdditions,
  };
}

/**
 * Run validation for all registered validation fixtures.
 *
 * Returns one report per fixture. Safe to call in dev and test contexts.
 * Never alters recommendation logic.
 */
export function runWelcomePackValidation(
  eligibilityMode: 'off' | 'warn' | 'filter' = 'warn',
): WelcomePackValidationReportV1[] {
  return welcomePackValidationFixtureList.map((fixture) => runFixtureValidation(fixture, eligibilityMode));
}

/**
 * Run validation for a subset of fixtures by ID.
 */
export function runValidationForFixtures(
  fixtureIds: WelcomePackValidationFixtureId[],
  eligibilityMode: 'off' | 'warn' | 'filter' = 'warn',
): WelcomePackValidationReportV1[] {
  return fixtureIds.map((id) => {
    const fixture = getValidationFixture(id);
    return runFixtureValidation(fixture, eligibilityMode);
  });
}

/**
 * Detect concept IDs that are omitted across multiple fixtures (repeated omission pattern).
 *
 * Returns concept IDs that appear in omitted assets for at least `threshold` fixtures.
 */
export function detectRepeatedOmissionPatterns(
  reports: WelcomePackValidationReportV1[],
  threshold = 3,
): Array<{ assetId: string; omittedInFixtures: string[]; count: number }> {
  const omissionCount = new Map<string, string[]>();

  for (const report of reports) {
    for (const omitted of report.omittedAssets) {
      const fixtures = omissionCount.get(omitted.assetId) ?? [];
      fixtures.push(report.fixtureId);
      omissionCount.set(omitted.assetId, fixtures);
    }
  }

  return [...omissionCount.entries()]
    .filter(([, fixtures]) => fixtures.length >= threshold)
    .map(([assetId, fixtures]) => ({
      assetId,
      omittedInFixtures: fixtures,
      count: fixtures.length,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Collect all missing concept IDs across all reports, ranked by frequency.
 */
export function collectTopMissingConcepts(
  reports: WelcomePackValidationReportV1[],
): Array<{ conceptId: string; missingInFixtures: string[]; count: number }> {
  const missingCount = new Map<string, string[]>();

  for (const report of reports) {
    for (const gap of report.missingContent) {
      const fixtures = missingCount.get(gap.conceptId) ?? [];
      fixtures.push(report.fixtureId);
      missingCount.set(gap.conceptId, fixtures);
    }
  }

  return [...missingCount.entries()]
    .map(([conceptId, fixtures]) => ({
      conceptId,
      missingInFixtures: fixtures,
      count: fixtures.length,
    }))
    .sort((a, b) => b.count - a.count);
}

export type { WelcomePackValidationReportV1 };
export { welcomePackValidationFixtures, welcomePackValidationFixtureList, getValidationFixture };
