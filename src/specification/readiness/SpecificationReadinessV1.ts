import type { SpecificationLineConfidence } from '../specLines';

export interface ConfidenceBandSummaryV1 {
  readonly confirmed: number;
  readonly inferred: number;
  readonly needs_survey: number;
  readonly total: number;
}

export interface LocationConfidenceSummaryV1 {
  readonly confirmed: number;
  readonly inferred: number;
  readonly needs_survey: number;
  readonly unknown: number;
  readonly total: number;
}

export interface SpecificationReadinessConfidenceSummaryV1 {
  readonly specificationLines: ConfidenceBandSummaryV1;
  readonly materialsSchedule: ConfidenceBandSummaryV1;
  readonly engineerLocations: LocationConfidenceSummaryV1;
}

export interface SpecificationReadinessV1 {
  readonly readyForOfficeReview: boolean;
  readonly readyForInstallerHandover: boolean;
  readonly readyForMaterialsOrdering: boolean;
  readonly blockingReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly unresolvedChecks: readonly string[];
  readonly confidenceSummary: SpecificationReadinessConfidenceSummaryV1;
}

export function emptyConfidenceSummary(): SpecificationReadinessConfidenceSummaryV1 {
  return {
    specificationLines: {
      confirmed: 0,
      inferred: 0,
      needs_survey: 0,
      total: 0,
    },
    materialsSchedule: {
      confirmed: 0,
      inferred: 0,
      needs_survey: 0,
      total: 0,
    },
    engineerLocations: {
      confirmed: 0,
      inferred: 0,
      needs_survey: 0,
      unknown: 0,
      total: 0,
    },
  };
}

export function incrementBand(
  summary: ConfidenceBandSummaryV1,
  confidence: SpecificationLineConfidence,
): ConfidenceBandSummaryV1 {
  if (confidence === 'confirmed') {
    return {
      ...summary,
      confirmed: summary.confirmed + 1,
      total: summary.total + 1,
    };
  }
  if (confidence === 'inferred') {
    return {
      ...summary,
      inferred: summary.inferred + 1,
      total: summary.total + 1,
    };
  }
  return {
    ...summary,
    needs_survey: summary.needs_survey + 1,
    total: summary.total + 1,
  };
}
