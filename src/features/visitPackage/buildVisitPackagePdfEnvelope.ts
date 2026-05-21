import type { CanonicalVisitPackageV1 } from './CanonicalVisitPackageV1';
import {
  VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
  VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
  type VisitPackagePdfEnvelopeV1,
} from './VisitPackagePdfEnvelopeV1';

export interface BuildVisitPackagePdfEnvelopeInput {
  readonly packagePayload: CanonicalVisitPackageV1;
  readonly generatedAt?: string;
}

function hasText(value: string | undefined): value is string {
  return value != null && value.trim().length > 0;
}

function isProposalReady(pkg: CanonicalVisitPackageV1): boolean {
  return (
    hasText(pkg.proposalTruth?.selectedScenarioId)
    && hasText(pkg.proposalTruth?.customerSummary?.recommendedSystemLabel)
    && hasText(pkg.proposalTruth?.visitEnvelope?.identity?.visitId)
  );
}

function buildCustomerPropertySummary(pkg: CanonicalVisitPackageV1): readonly string[] {
  const lines: string[] = [];
  const survey = pkg.surveyDraft;
  if (hasText(pkg.visitIdentity.visitReference)) {
    lines.push(`Visit reference: ${pkg.visitIdentity.visitReference}`);
  } else if (hasText(pkg.visitIdentity.visitId)) {
    lines.push(`Visit id: ${pkg.visitIdentity.visitId}`);
  }
  if (survey.occupancyCount != null) {
    lines.push(`Household size: ${survey.occupancyCount}`);
  }
  if (survey.bathroomCount != null) {
    lines.push(`Bathrooms: ${survey.bathroomCount}`);
  }
  for (const fact of pkg.customerPropertyDetails.propertyFacts ?? []) {
    if (hasText(fact)) lines.push(`Property: ${fact}`);
  }
  for (const fact of pkg.customerPropertyDetails.usageFacts ?? []) {
    if (hasText(fact)) lines.push(`Usage: ${fact}`);
  }
  if (lines.length === 0) {
    lines.push('Customer and property summary pending in visit package.');
  }
  return lines.slice(0, 8);
}

function buildGeneratedOutputStatus(pkg: CanonicalVisitPackageV1): string {
  const lifecycleState = pkg.generatedOutputStatus?.lifecycleState;
  if (hasText(lifecycleState)) {
    return `Generated output status: ${lifecycleState}`;
  }
  return 'Generated output status: pending review output state.';
}

function buildRecommendationSummary(pkg: CanonicalVisitPackageV1): string | undefined {
  if (!isProposalReady(pkg)) return undefined;
  const summary = pkg.proposalTruth?.customerSummary;
  if (summary == null) return undefined;
  return `${summary.recommendedSystemLabel}: ${summary.headline}`;
}

export function buildVisitPackagePdfEnvelope(
  input: BuildVisitPackagePdfEnvelopeInput,
): VisitPackagePdfEnvelopeV1 {
  const pkg = input.packagePayload;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const visitReference = pkg.visitIdentity.visitReference ?? pkg.visitIdentity.visitId ?? 'atlas-visit';
  const recommendationTitle = isProposalReady(pkg)
    ? pkg.proposalTruth?.customerSummary?.recommendedSystemLabel
    : undefined;
  const title = hasText(recommendationTitle)
    ? `Atlas Recommendation: ${recommendationTitle}`
    : 'Atlas Recommendation Summary';
  return {
    schema: VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
    version: VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
    generatedAt,
    visitReference,
    title,
    visibleContent: {
      customerPropertySummary: buildCustomerPropertySummary(pkg),
      recommendationSummary: buildRecommendationSummary(pkg),
      generatedOutputStatus: buildGeneratedOutputStatus(pkg),
      openWithAtlasInstructions: [
        'Open this PDF in Atlas to import the full visit package payload.',
        'The embedded package is canonical and matches the Atlas visit export.',
      ],
    },
    canonicalVisitPackage: pkg,
  };
}
