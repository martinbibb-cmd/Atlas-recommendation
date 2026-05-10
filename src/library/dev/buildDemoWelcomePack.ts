import type { EducationalContentV1 } from '../content/EducationalContentV1';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { getContentForConcepts } from '../content/contentLookup';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';
import type { WelcomePackAccessibilityPreferencesV1, WelcomePackEligibilityMode } from '../packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackViewModel } from '../packRenderer/buildCalmWelcomePackViewModel';
import { buildPrintableWelcomePackViewModel } from '../packRenderer/buildPrintableWelcomePackViewModel';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import {
  getWelcomePackDemoFixture,
  type WelcomePackDemoFixture,
  type WelcomePackDemoFixtureId,
} from './welcomePackDemoFixtures';

export interface BuildDemoWelcomePackInput {
  fixtureId: WelcomePackDemoFixtureId;
  accessibilityOverrides?: Partial<WelcomePackAccessibilityPreferencesV1>;
  eligibilityMode?: WelcomePackEligibilityMode;
}

export interface BuildDemoWelcomePackResult {
  fixture: WelcomePackDemoFixture;
  plan: ReturnType<typeof buildWelcomePackPlan>;
  viewModel: ReturnType<typeof buildPrintableWelcomePackViewModel>;
  calmViewModel: ReturnType<typeof buildCalmWelcomePackViewModel>;
}

function mergeAccessibilityPreferences(
  base: WelcomePackAccessibilityPreferencesV1,
  overrides?: Partial<WelcomePackAccessibilityPreferencesV1>,
): WelcomePackAccessibilityPreferencesV1 {
  return {
    ...base,
    ...overrides,
    profiles: overrides?.profiles ?? base.profiles ?? [],
  };
}

function buildDemoEducationalContent(selectedConceptIds: string[]): EducationalContentV1[] {
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

    byConceptId.set(conceptId, {
      ...fallback,
      conceptId,
    });
  }

  return [...byConceptId.values()];
}

export function buildDemoWelcomePack(input: BuildDemoWelcomePackInput): BuildDemoWelcomePackResult {
  const fixture = getWelcomePackDemoFixture(input.fixtureId);
  const eligibilityMode = input.eligibilityMode ?? 'off';
  const accessibilityPreferences = mergeAccessibilityPreferences(
    fixture.accessibilityPreferences,
    input.accessibilityOverrides,
  );

  const plan = buildWelcomePackPlan({
    customerSummary: fixture.customerSummary,
    atlasDecision: fixture.atlasDecision,
    scenarios: fixture.scenarios,
    accessibilityPreferences,
    userConcernTags: fixture.userConcernTags,
    propertyConstraintTags: fixture.propertyConstraintTags,
    eligibilityMode,
  });

  const educationalContent = buildDemoEducationalContent(plan.selectedConceptIds);
  const viewModel = buildPrintableWelcomePackViewModel(
    plan,
    fixture.customerSummary,
    educationalConceptTaxonomy,
    educationalAssetRegistry,
    {
      educationalContent,
      includeTechnicalAppendix: accessibilityPreferences.includeTechnicalAppendix,
    },
  );
  const calmViewModel = buildCalmWelcomePackViewModel({
    plan,
    customerSummary: fixture.customerSummary,
    taxonomy: educationalConceptTaxonomy,
    assets: educationalAssetRegistry,
    educationalContent,
    eligibilityMode,
    includeTechnicalAppendix: accessibilityPreferences.includeTechnicalAppendix,
  });

  return {
    fixture,
    plan,
    viewModel,
    calmViewModel,
  };
}
