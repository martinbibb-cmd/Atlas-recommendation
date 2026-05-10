import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { getContentForConcepts } from '../content/contentLookup';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';
import type { WelcomePackAccessibilityPreferencesV1, WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { buildBrandedCalmWelcomePackViewModel } from './buildBrandedCalmWelcomePackViewModel';
import { buildCalmWelcomePackViewModel } from './buildCalmWelcomePackViewModel';
import type { CalmWelcomePackViewModelV1 } from './CalmWelcomePackViewModelV1';

export interface BuildCalmWelcomePackFromAtlasDecisionInputV1 {
  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  brandProfile?: BrandProfileV1;
  visitReference?: string;
  accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1;
  userConcernTags?: string[];
  propertyConstraintTags?: string[];
  includeTechnicalAppendix?: boolean;
}

export interface BuildCalmWelcomePackFromAtlasDecisionResultV1 {
  plan: WelcomePackPlanV1;
  calmViewModel: CalmWelcomePackViewModelV1;
  brandedViewModel: CalmWelcomePackViewModelV1;
  readiness: CalmWelcomePackViewModelV1['readiness'];
}

function stripCustomerDiagnostics(viewModel: CalmWelcomePackViewModelV1): CalmWelcomePackViewModelV1 {
  return {
    ...viewModel,
    internalOmissionLog: [],
  };
}

export function buildCalmWelcomePackFromAtlasDecision(
  input: BuildCalmWelcomePackFromAtlasDecisionInputV1,
): BuildCalmWelcomePackFromAtlasDecisionResultV1 {
  const includeTechnicalAppendix = input.includeTechnicalAppendix
    ?? input.accessibilityPreferences?.includeTechnicalAppendix
    ?? false;
  const accessibilityPreferences: WelcomePackAccessibilityPreferencesV1 = {
    ...(input.accessibilityPreferences ?? {}),
    includeTechnicalAppendix,
  };

  const plan = buildWelcomePackPlan({
    customerSummary: input.customerSummary,
    atlasDecision: input.atlasDecision,
    scenarios: input.scenarios,
    accessibilityPreferences,
    userConcernTags: input.userConcernTags,
    propertyConstraintTags: input.propertyConstraintTags,
    eligibilityMode: 'filter',
  });

  const educationalContent = getContentForConcepts(plan.selectedConceptIds);
  const calmViewModel = stripCustomerDiagnostics(buildCalmWelcomePackViewModel({
    plan,
    customerSummary: input.customerSummary,
    taxonomy: educationalConceptTaxonomy,
    assets: educationalAssetRegistry,
    educationalContent,
    eligibilityMode: 'filter',
    includeTechnicalAppendix,
  }));
  const brandedViewModel = stripCustomerDiagnostics(buildBrandedCalmWelcomePackViewModel({
    calmViewModel,
    brandProfile: input.brandProfile,
    visitReference: input.visitReference,
  }));

  return {
    plan,
    calmViewModel,
    brandedViewModel,
    readiness: brandedViewModel.readiness,
  };
}
