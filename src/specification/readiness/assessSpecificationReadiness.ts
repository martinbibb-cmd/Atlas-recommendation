import type { ScopePackHandoverV1, EngineerJobPackV1 } from '../handover';
import type { SuggestedMaterialLineV1 } from '../materials';
import type { InstallationScopePackV1 } from '../scopePacks';
import type { SpecificationLineV1 } from '../specLines';
import type { SuggestedImplementationPackV1 } from '../SuggestedImplementationPackV1';
import { incrementBand, type SpecificationReadinessV1 } from './SpecificationReadinessV1';

interface AssessSpecificationReadinessInput {
  implementationPack: SuggestedImplementationPackV1;
  specificationLines: readonly SpecificationLineV1[];
  scopePacks: readonly InstallationScopePackV1[];
  handover: ScopePackHandoverV1;
  engineerJobPack: EngineerJobPackV1;
  materialsSchedule: readonly SuggestedMaterialLineV1[];
}

type EngineerSectionKey = Exclude<keyof EngineerJobPackV1, 'jobPackVersion' | 'surveyData' | 'scanData'>;

const ENGINEER_SECTION_LABELS: Record<EngineerSectionKey, string> = {
  jobSummary: 'Job summary',
  fitThis: 'Fit this',
  removeThis: 'Remove this',
  checkThis: 'Check this',
  discussWithCustomer: 'Discuss with customer',
  locationsAndRoutes: 'Locations and routes',
  commissioning: 'Commissioning',
  unresolvedBeforeInstall: 'Unresolved before install',
  doNotMiss: 'Do not miss',
  locationsToConfirm: 'Locations to confirm',
};

const ENGINEER_LOCATION_BLOCKING_SECTIONS = new Set<EngineerSectionKey>([
  'checkThis',
  'locationsAndRoutes',
  'commissioning',
  'unresolvedBeforeInstall',
  'doNotMiss',
]);

function stableDeduplicate(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    deduped.push(value);
  }
  return deduped;
}

function lowerIncludesAny(text: string, fragments: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}

function isSafetyOrComplianceLine(line: SpecificationLineV1): boolean {
  return (
    line.sectionKey === 'safety_compliance'
    || line.lineType === 'compliance_item'
    || line.lineType === 'required_validation'
  );
}

function isTechnicalOnlyCustomerLine(line: SpecificationLineV1): boolean {
  if (!line.customerVisible) return false;
  return line.lineType !== 'included_scope' && line.lineType !== 'provisional_allowance';
}

export function assessSpecificationReadiness(
  input: AssessSpecificationReadinessInput,
): SpecificationReadinessV1 {
  const {
    implementationPack,
    specificationLines,
    scopePacks,
    handover,
    engineerJobPack,
    materialsSchedule,
  } = input;

  const officeBlockingReasons: string[] = [];
  const installerBlockingReasons: string[] = [];
  const materialsBlockingReasons: string[] = [];
  const warnings: string[] = [];
  const unresolvedChecks: string[] = [];

  const lineById = new Map(specificationLines.map((line) => [line.lineId, line]));
  const requiredLineIds = new Set<string>();

  for (const pack of scopePacks) {
    const isRequiredPack =
      pack.requiredLineTypes.length > 0
      && pack.defaultIncludedLineIds.length > 0;
    if (pack.reviewStatus === 'rejected' && isRequiredPack) {
      officeBlockingReasons.push(`Required pack rejected: ${pack.label}.`);
    }
    if (pack.reviewStatus !== 'rejected') {
      for (const lineId of pack.defaultIncludedLineIds) {
        requiredLineIds.add(lineId);
      }
    }
  }

  for (const lineId of requiredLineIds) {
    const line = lineById.get(lineId);
    if (!line) continue;
    if (line.status === 'removed') {
      officeBlockingReasons.push(`Required specification line removed: ${line.label}.`);
    }
  }

  for (const requiredQualification of implementationPack.allRequiredQualifications) {
    const present = handover.officeReviewSummary.qualifications.some(
      (qualification) => qualification.id === requiredQualification.id,
    );
    if (!present) {
      officeBlockingReasons.push(`Missing required qualification: ${requiredQualification.label}.`);
    }
  }

  for (const line of specificationLines) {
    if (line.status !== 'needs_check') continue;
    unresolvedChecks.push(`${line.label} — ${line.description}`);
    if (isSafetyOrComplianceLine(line)) {
      officeBlockingReasons.push(`Safety/compliance check unresolved: ${line.label}.`);
      installerBlockingReasons.push(`Safety/compliance check unresolved: ${line.label}.`);
      continue;
    }
    warnings.push(`Specification line needs check: ${line.label}.`);
  }

  for (const line of specificationLines) {
    const searchText = `${line.label} ${line.description}`;
    const isUnresolved = line.status === 'suggested' || line.status === 'needs_check';
    if (!isUnresolved) continue;

    if (
      isSafetyOrComplianceLine(line)
      && lowerIncludesAny(searchText, ['g3', 'discharge', 'tundish'])
    ) {
      installerBlockingReasons.push(`Installer validation unresolved: ${line.label}.`);
    }
    if (line.lineType === 'required_validation' && lowerIncludesAny(searchText, ['emitter'])) {
      installerBlockingReasons.push(`Heat pump emitter review unresolved: ${line.label}.`);
    }
  }

  for (const material of materialsSchedule) {
    if (material.confidence === 'needs_survey') {
      materialsBlockingReasons.push(`Material needs survey confirmation: ${material.label}.`);
    }
    for (const check of material.unresolvedChecks) {
      unresolvedChecks.push(`${material.label} — ${check}`);
    }
    if (material.customerVisible) {
      officeBlockingReasons.push(`Technical material should not be customer-visible: ${material.label}.`);
    }
  }

  for (const unresolved of handover.engineerInstallNotes.unresolvedChecks) {
    unresolvedChecks.push(`${unresolved.label} — ${unresolved.detail}`);
  }

  for (const line of specificationLines) {
    if (isTechnicalOnlyCustomerLine(line)) {
      officeBlockingReasons.push(`Technical line is customer-visible: ${line.label}.`);
    }
  }

  const engineerSections: EngineerSectionKey[] = [
    'jobSummary',
    'fitThis',
    'removeThis',
    'checkThis',
    'discussWithCustomer',
    'locationsAndRoutes',
    'commissioning',
    'unresolvedBeforeInstall',
    'doNotMiss',
    'locationsToConfirm',
  ];

  for (const sectionKey of engineerSections) {
    const sectionItems = engineerJobPack[sectionKey];
    for (const item of sectionItems) {
      if (item.location?.type !== 'unknown') continue;
      const sectionLabel = ENGINEER_SECTION_LABELS[sectionKey];
      const message = `Unknown location in ${sectionLabel}: ${item.text}.`;
      if (ENGINEER_LOCATION_BLOCKING_SECTIONS.has(sectionKey)) {
        installerBlockingReasons.push(message);
      } else {
        warnings.push(message);
      }
      unresolvedChecks.push(message);
    }
  }

  let specificationLineConfidence = {
    confirmed: 0,
    inferred: 0,
    needs_survey: 0,
    total: 0,
  };
  for (const line of specificationLines) {
    specificationLineConfidence = incrementBand(
      specificationLineConfidence,
      line.confidence,
    );
  }

  let materialsConfidence = {
    confirmed: 0,
    inferred: 0,
    needs_survey: 0,
    total: 0,
  };
  for (const material of materialsSchedule) {
    materialsConfidence = incrementBand(
      materialsConfidence,
      material.confidence,
    );
  }

  let engineerLocationsConfidence = {
    confirmed: 0,
    inferred: 0,
    needs_survey: 0,
    unknown: 0,
    total: 0,
  };
  for (const sectionKey of engineerSections) {
    for (const item of engineerJobPack[sectionKey]) {
      const location = item.location;
      if (!location) continue;
      engineerLocationsConfidence = {
        ...engineerLocationsConfidence,
        total: engineerLocationsConfidence.total + 1,
      };
      if (location.type === 'unknown') {
        engineerLocationsConfidence = {
          ...engineerLocationsConfidence,
          unknown: engineerLocationsConfidence.unknown + 1,
        };
      }
      if (location.confidence === 'confirmed') {
        engineerLocationsConfidence = {
          ...engineerLocationsConfidence,
          confirmed: engineerLocationsConfidence.confirmed + 1,
        };
      } else if (location.confidence === 'inferred') {
        engineerLocationsConfidence = {
          ...engineerLocationsConfidence,
          inferred: engineerLocationsConfidence.inferred + 1,
        };
      } else {
        engineerLocationsConfidence = {
          ...engineerLocationsConfidence,
          needs_survey: engineerLocationsConfidence.needs_survey + 1,
        };
      }
    }
  }

  const dedupedOfficeBlocking = stableDeduplicate(officeBlockingReasons);
  const dedupedInstallerBlocking = stableDeduplicate(installerBlockingReasons);
  const dedupedMaterialsBlocking = stableDeduplicate(materialsBlockingReasons);

  return {
    readyForOfficeReview: dedupedOfficeBlocking.length === 0,
    readyForInstallerHandover: dedupedInstallerBlocking.length === 0,
    readyForMaterialsOrdering: dedupedMaterialsBlocking.length === 0,
    blockingReasons: stableDeduplicate([
      ...dedupedOfficeBlocking,
      ...dedupedInstallerBlocking,
      ...dedupedMaterialsBlocking,
    ]),
    warnings: stableDeduplicate(warnings),
    unresolvedChecks: stableDeduplicate(unresolvedChecks),
    confidenceSummary: {
      specificationLines: specificationLineConfidence,
      materialsSchedule: materialsConfidence,
      engineerLocations: engineerLocationsConfidence,
    },
  };
}
