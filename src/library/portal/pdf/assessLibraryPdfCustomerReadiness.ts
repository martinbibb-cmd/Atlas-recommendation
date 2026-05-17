import type { PortalJourneyPrintModelV1, SurveySystemConditionV1 } from './buildPortalJourneyPrintModel';
import type { LibraryProjectionSafetyV1 } from '../../projections/qa/LibraryProjectionSafetyV1';
import type { PdfComparisonAuditV1 } from '../../pdfQa/PdfComparisonAuditV1';

export interface LibraryPdfCustomerReadinessInput {
  readonly printModel: PortalJourneyPrintModelV1;
  readonly projectionSafety: LibraryProjectionSafetyV1;
  readonly pdfComparisonAudit: PdfComparisonAuditV1;
  readonly surveyCondition?: SurveySystemConditionV1;
}

export interface LibraryPdfCustomerReadinessResult {
  readonly readyForCustomer: boolean;
  readonly blockingReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly positiveChecks: readonly string[];
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function hasPassedCheck(audit: PdfComparisonAuditV1, checkId: string): boolean {
  return audit.positiveChecks.some((check) => check.checkId === checkId && check.passed);
}

export function assessLibraryPdfCustomerReadiness(
  input: LibraryPdfCustomerReadinessInput,
): LibraryPdfCustomerReadinessResult {
  const {
    printModel,
    projectionSafety,
    pdfComparisonAudit,
    surveyCondition,
  } = input;

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (pdfComparisonAudit.guessedCapacityFindings.length > 0) {
    blockingReasons.push('PDF QA blocked: guessed CWS/vented tank capacity detected.');
  }

  if (pdfComparisonAudit.forbiddenTermFindings.length > 0) {
    blockingReasons.push('PDF QA blocked: forbidden technical wording leaked into customer content.');
  }

  if (pdfComparisonAudit.legacyHeadingFindings.length > 0) {
    blockingReasons.push('PDF QA blocked: legacy report headings detected.');
  }

  if (pdfComparisonAudit.misleadingPhrasingFindings.length > 0) {
    blockingReasons.push('PDF QA blocked: misleading "unchanged/untouched" phrasing found without protection context.');
  }

  if (!projectionSafety.safeForCustomer) {
    for (const reason of projectionSafety.blockingReasons) {
      blockingReasons.push(`Projection safety: ${reason}`);
    }
  }

  if (surveyCondition == null) {
    warnings.push('Survey condition data unavailable; verify system-protection evidence manually before release.');
  }

  if (surveyCondition != null && !hasPassedCheck(pdfComparisonAudit, 'system_protection_present')) {
    warnings.push('System-protection section is missing despite survey condition evidence.');
  }

  if (!hasPassedCheck(pdfComparisonAudit, 'lived_experience_present')) {
    warnings.push('Lived-experience section is missing.');
  }

  if (!hasPassedCheck(pdfComparisonAudit, 'expectation_delta_present')) {
    warnings.push('Expectation-delta content is missing.');
  }

  const positiveChecks = unique([
    `Print model ready: ${printModel.cover.title}`,
    ...pdfComparisonAudit.positiveChecks
      .filter((check) => check.passed)
      .map((check) => check.description),
    ...(projectionSafety.safeForCustomer ? ['Projection safety passed.'] : []),
  ]);

  return {
    readyForCustomer: blockingReasons.length === 0,
    blockingReasons: unique(blockingReasons),
    warnings: unique(warnings),
    positiveChecks,
  };
}
