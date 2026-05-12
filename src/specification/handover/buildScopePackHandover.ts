import type {
  RequiredComplianceItem,
  RequiredQualification,
  RequiredValidation,
  SuggestedImplementationPackV1,
  UnresolvedRisk,
} from '../SuggestedImplementationPackV1';
import type { SpecificationLineV1 } from '../specLines/SpecificationLineV1';
import type { InstallationScopePackV1 } from '../scopePacks';
import type {
  ScopePackExcludedOrDeferredItemV1,
  ScopePackHandoverLineItemV1,
  ScopePackHandoverPackSummaryV1,
  ScopePackHandoverUnresolvedCheckV1,
  ScopePackHandoverV1,
} from './ScopePackHandoverV1';

function toHandoverLineItem(
  pack: InstallationScopePackV1,
  line: SpecificationLineV1,
): ScopePackHandoverLineItemV1 {
  return {
    lineId: line.lineId,
    packId: pack.packId,
    packLabel: pack.label,
    sectionKey: line.sectionKey,
    lineType: line.lineType,
    label: line.label,
    description: line.description,
  };
}

function collectValidationIds(lines: readonly SpecificationLineV1[]): Set<string> {
  return new Set(lines.flatMap((line) => line.linkedValidationIds));
}

function collectRiskIds(lines: readonly SpecificationLineV1[]): Set<string> {
  return new Set(lines.flatMap((line) => line.linkedRiskIds));
}

function includesKeyword(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function filterQualificationsForScope(
  qualifications: readonly RequiredQualification[],
  relevantComplianceLabels: ReadonlySet<string>,
): RequiredQualification[] {
  return qualifications.filter((qualification) =>
    relevantComplianceLabels.has(qualification.label),
  );
}

function filterComplianceForScope(
  complianceItems: readonly RequiredComplianceItem[],
  includedPacks: readonly InstallationScopePackV1[],
  qualifications: readonly RequiredQualification[],
): RequiredComplianceItem[] {
  if (includedPacks.length === 0) return [];

  const hasG3 = qualifications.some((qualification) => qualification.id === 'g3_unvented');
  const hasMcs = qualifications.some((qualification) => qualification.id === 'mcs_installer');

  if (!hasG3 && !hasMcs) {
    return [...complianceItems];
  }

  return complianceItems.filter((item) => {
    const haystack = `${item.description} ${item.regulatoryRef ?? ''}`.toLowerCase();
    if (hasG3 && includesKeyword(haystack, ['g3', 'unvented', 'part g'])) return true;
    if (hasMcs && includesKeyword(haystack, ['mcs', 'heat pump'])) return true;
    return false;
  });
}

export function buildScopePackHandover(
  scopePacks: readonly InstallationScopePackV1[],
  specificationLines: readonly SpecificationLineV1[],
  implementationPack: SuggestedImplementationPackV1,
): ScopePackHandoverV1 {
  const lineById = new Map(specificationLines.map((line) => [line.lineId, line]));
  const includedPacks = scopePacks.filter((pack) => pack.reviewStatus !== 'rejected');

  const customerPacks: ScopePackHandoverPackSummaryV1[] = [];
  const engineerPacks: ScopePackHandoverPackSummaryV1[] = [];
  const officePacks: ScopePackHandoverPackSummaryV1[] = [];
  const unresolvedChecks: ScopePackHandoverUnresolvedCheckV1[] = [];
  const excludedOrDeferredItems: ScopePackExcludedOrDeferredItemV1[] = [];

  const engineerVisibleLines: SpecificationLineV1[] = [];
  const officeVisibleLines: SpecificationLineV1[] = [];

  for (const pack of scopePacks) {
    if (pack.reviewStatus === 'rejected') {
      excludedOrDeferredItems.push({
        sourceType: 'pack',
        sourceId: pack.packId,
        label: pack.label,
        detail: 'Scope pack rejected from handover.',
        status: pack.reviewStatus,
      });
      continue;
    }

    if (pack.reviewStatus === 'needs_check') {
      unresolvedChecks.push({
        sourceType: 'pack',
        sourceId: pack.packId,
        label: pack.label,
        detail: 'Scope pack flagged for review before final handover.',
      });
    }

    const includedLines = pack.defaultIncludedLineIds
      .map((lineId) => lineById.get(lineId))
      .filter((line): line is SpecificationLineV1 => line !== undefined);

    const optionalLines = pack.defaultExcludedLineIds
      .map((lineId) => lineById.get(lineId))
      .filter((line): line is SpecificationLineV1 => line !== undefined);

    for (const line of optionalLines) {
      excludedOrDeferredItems.push({
        sourceType: 'line',
        sourceId: line.lineId,
        label: line.label,
        detail: line.description,
        status: 'deferred',
      });
    }

    const activeLines = includedLines.filter((line) => line.status !== 'removed');
    for (const line of includedLines.filter((candidate) => candidate.status === 'removed')) {
      excludedOrDeferredItems.push({
        sourceType: 'line',
        sourceId: line.lineId,
        label: line.label,
        detail: line.description,
        status: line.status,
      });
    }

    const customerLines = activeLines
      .filter((line) => line.customerVisible && line.status !== 'needs_check')
      .map((line) => toHandoverLineItem(pack, line));
    const engineerLines = activeLines
      .filter((line) => line.engineerVisible && line.status !== 'needs_check')
      .map((line) => toHandoverLineItem(pack, line));
    const officeLines = activeLines
      .filter((line) => line.officeVisible && line.status !== 'needs_check')
      .map((line) => toHandoverLineItem(pack, line));

    engineerVisibleLines.push(
      ...activeLines.filter((line) => line.engineerVisible),
    );
    officeVisibleLines.push(
      ...activeLines.filter((line) => line.officeVisible),
    );

    for (const line of activeLines.filter((candidate) => candidate.status === 'needs_check')) {
      unresolvedChecks.push({
        sourceType: 'line',
        sourceId: line.lineId,
        label: line.label,
        detail: line.description,
      });
    }

    customerPacks.push({
      packId: pack.packId,
      packLabel: pack.label,
      summary: pack.customerSummary,
      lines: customerLines,
    });
    engineerPacks.push({
      packId: pack.packId,
      packLabel: pack.label,
      summary: pack.engineerSummary,
      lines: engineerLines,
    });
    officePacks.push({
      packId: pack.packId,
      packLabel: pack.label,
      summary: pack.officeSummary,
      lines: officeLines,
    });
  }

  const relevantComplianceLabels = new Set(
    officeVisibleLines
      .filter((line) => line.lineType === 'compliance_item')
      .map((line) => line.label),
  );
  const relevantQualifications = filterQualificationsForScope(
    implementationPack.allRequiredQualifications,
    relevantComplianceLabels,
  );
  const relevantCompliance = filterComplianceForScope(
    implementationPack.allRequiredComplianceItems,
    includedPacks,
    relevantQualifications,
  );

  const validationIds = collectValidationIds(engineerVisibleLines);
  const riskIds = collectRiskIds(engineerVisibleLines);

  const validations = implementationPack.allRequiredValidations.filter((validation) =>
    validationIds.has(validation.id),
  );
  const risks = implementationPack.allUnresolvedRisks.filter((risk) => riskIds.has(risk.id));

  return {
    handoverVersion: 'v1',
    customerScopeSummary: {
      packs: customerPacks,
    },
    engineerInstallNotes: {
      packs: engineerPacks,
      validations,
      risks,
      commissioningNotes: [...implementationPack.commissioning.steps],
      unresolvedChecks,
    },
    officeReviewSummary: {
      packs: officePacks,
      qualifications: relevantQualifications,
      compliance: relevantCompliance,
      unresolvedChecks,
    },
    complianceChecklist: [
      ...relevantQualifications.map((qualification) => ({
        id: qualification.id,
        category: 'qualification' as const,
        label: qualification.label,
        detail: qualification.triggeredBy,
      })),
      ...relevantCompliance.map((item) => ({
        id: item.id,
        category: 'compliance' as const,
        label: item.description,
        detail: item.regulatoryRef ?? item.timing,
      })),
    ],
    validationChecklist: validations.map((validation) => ({
      id: validation.id,
      check: validation.check,
      reason: validation.reason,
      severity: validation.severity,
    })),
    excludedOrDeferredItems,
  };
}
