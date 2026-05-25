import type { CanonicalVisitPackageV1 } from './CanonicalVisitPackageV1';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import {
  VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
  VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
  type VisitPackagePdfEnvelopeV1,
  type VisitPackagePdfProcessingContextV1,
} from './VisitPackagePdfEnvelopeV1';
import { ENGINE_VERSION } from '../../contracts/versions';

export interface BuildVisitPackagePdfEnvelopeInput {
  readonly packagePayload: CanonicalVisitPackageV1;
  readonly generatedAt?: string;
  /** Scan capture packages for this visit, when available. */
  readonly scanPackages?: readonly SessionCaptureV2[];
}

function hasText(value: string | undefined): value is string {
  return value != null && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function readNumberCandidate(
  source: Record<string, unknown> | undefined,
  keys: readonly string[],
): number | undefined {
  if (source == null) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function readEngineHeatLossKw(pkg: CanonicalVisitPackageV1): number | undefined {
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  const heatLossWatts = readNumberCandidate(engineInput, ['heatLossWatts']);
  if (heatLossWatts == null) return undefined;
  return heatLossWatts / 1000;
}

function readDecisionPeakHeatLossKw(pkg: CanonicalVisitPackageV1): number | undefined {
  const decision = isRecord(pkg.proposalTruth?.decision) ? pkg.proposalTruth?.decision : undefined;
  const energyMetrics = isRecord(decision?.['energyMetrics']) ? decision['energyMetrics'] : undefined;
  return readNumberCandidate(energyMetrics, ['peakLoadKw', 'peakHeatLossKw']);
}

function readHotWaterDemandLitres(pkg: CanonicalVisitPackageV1): number | undefined {
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  const fromEngine = readNumberCandidate(engineInput, [
    'dailyHotWaterLitres',
    'dailyHotWaterDemandLitres',
  ]);
  if (fromEngine != null) return fromEngine;
  const decision = isRecord(pkg.proposalTruth?.decision) ? pkg.proposalTruth?.decision : undefined;
  const energyMetrics = isRecord(decision?.['energyMetrics']) ? decision['energyMetrics'] : undefined;
  return readNumberCandidate(energyMetrics, [
    'dailyHotWaterLitres',
    'dailyHotWaterDemandLitres',
  ]);
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
  const peakHeatLossKw = readEngineHeatLossKw(pkg) ?? readDecisionPeakHeatLossKw(pkg);
  if (peakHeatLossKw != null) {
    lines.push(`Peak heat loss: ${peakHeatLossKw.toFixed(1)} kW`);
  }
  const hotWaterDemandLitres = readHotWaterDemandLitres(pkg);
  if (hotWaterDemandLitres != null) {
    lines.push(`Hot water demand: ${Math.round(hotWaterDemandLitres)} L/day`);
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

function buildProcessingContext(pkg: CanonicalVisitPackageV1): VisitPackagePdfProcessingContextV1 {
  const decision = pkg.proposalTruth?.decision;
  const customerSummary = pkg.proposalTruth?.customerSummary;
  const recommendedSystemLabel = customerSummary?.recommendedSystemLabel;
  const notes: string[] = [
    `Atlas engine version: ${ENGINE_VERSION}`,
    `Package exported at: ${pkg.importExportMetadata.exportedAt}`,
  ];
  if (hasText(recommendedSystemLabel)) {
    notes.push(`Recommended system: ${recommendedSystemLabel}`);
  }
  if (hasText(customerSummary?.headline)) {
    notes.push(`Recommendation headline: ${customerSummary?.headline}`);
  }
  if (hasText(customerSummary?.plainEnglishDecision)) {
    notes.push(`Plain English decision: ${customerSummary?.plainEnglishDecision}`);
  }
  if (decision?.dayToDayOutcomes != null && decision.dayToDayOutcomes.length > 0) {
    notes.push(`Key day-to-day outcome: ${decision.dayToDayOutcomes[0]}`);
  }
  if (hasText(pkg.proposalTruth?.selectedScenarioId)) {
    notes.push(`Selected scenario: ${pkg.proposalTruth?.selectedScenarioId}`);
  }
  const engineInput = pkg.engineInputSnapshot;
  if (engineInput != null) {
    if (hasText(engineInput.currentHeatSourceType)) {
      notes.push(`Current heat source: ${engineInput.currentHeatSourceType}`);
    }
  }
  return {
    atlasEngineVersion: ENGINE_VERSION,
    recommendedSystemLabel: recommendedSystemLabel ?? undefined,
    processingNotes: notes,
  };
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
  const scanPackages =
    input.scanPackages != null && input.scanPackages.length > 0
      ? input.scanPackages
      : undefined;
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
    scanPackages,
    processingContext: buildProcessingContext(pkg),
  };
}
