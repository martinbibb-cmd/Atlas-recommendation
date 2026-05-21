import {
  VISIT_PACKAGE_PDF_NO_MARKER_ERROR,
  type CanonicalVisitPackageIntegrityResult,
  type CanonicalVisitPackageV1,
} from '../visitPackage';
import type { VisitHomeSessionStatus } from './VisitHomeDashboard';

export type WorkflowImportSurface = 'app_home_import' | 'visit_home_import';
export type WorkflowQaChecklistStatus = 'complete' | 'pending' | 'blocked';

export interface VisitPackageOpenHistoryEntry {
  readonly visitReference: string;
  readonly importedAt: string;
  readonly sourceLabel: string;
  readonly integrityStatus: 'verified' | 'modified' | 'unverified';
}

export interface WorkflowImportFailureDiagnostic {
  readonly occurredAt: string;
  readonly filename?: string;
  readonly errors: readonly string[];
}

export interface WorkflowQaChecklistItem {
  readonly id:
    | 'import_package'
    | 'open_scan'
    | 'receive_scan_return'
    | 'regenerate_delivery_outputs'
    | 'export_package_again';
  readonly label: string;
  readonly status: WorkflowQaChecklistStatus;
  readonly detail: string;
}

export type LocalSessionStatusTone = 'success' | 'warning' | 'error';
export type LocalSessionStatus = VisitHomeSessionStatus & { tone: LocalSessionStatusTone };

const IMPORT_SURFACE_LABELS: Record<WorkflowImportSurface, string> = {
  app_home_import: 'App Home',
  visit_home_import: 'Visit Home',
};

export function toImportSurfaceLabel(surface: WorkflowImportSurface): string {
  return IMPORT_SURFACE_LABELS[surface];
}

export function appendPackageOpenHistory(
  history: readonly VisitPackageOpenHistoryEntry[],
  entry: VisitPackageOpenHistoryEntry,
  limit = 6,
): VisitPackageOpenHistoryEntry[] {
  const next = [entry, ...history].slice(0, limit);
  return next;
}

export function buildPackageImportStatusMessage(
  visitReference: string,
  importSurface: WorkflowImportSurface,
  integrity: CanonicalVisitPackageIntegrityResult,
): LocalSessionStatus {
  const importedMessage = `Imported visit package ${visitReference} from ${IMPORT_SURFACE_LABELS[importSurface]}.`;
  if (integrity.status === 'verified') {
    return {
      tone: 'success',
      type: 'import',
      message: `${importedMessage} Integrity checks passed. Atlas does not store this package in cloud storage.`,
      importSummary: {
        integrityStatus: 'verified',
      },
    };
  }
  if (integrity.status === 'modified') {
    return {
      tone: 'warning',
      type: 'import',
      message: `${importedMessage} Atlas imported it with warnings. Package contents appear to have changed after export, so packaged portal URLs were ignored.`,
      importSummary: {
        integrityStatus: 'modified',
        warnings: integrity.warnings,
      },
    };
  }
  return {
    tone: 'warning',
    type: 'import',
    message: `${importedMessage} Atlas imported it as unverified. This package is missing verification metadata, so packaged portal URLs were ignored.`,
    importSummary: {
      integrityStatus: 'unverified',
      warnings: integrity.warnings,
    },
  };
}

export function buildImportFailureStatus(
  errors: readonly string[],
): LocalSessionStatus {
  if (errors.length === 0) {
    return {
      tone: 'error',
      type: 'session',
      message: 'Package import blocked: the file could not be validated as an Atlas visit package.',
    };
  }
  const primaryError = errors[0]!;
  if (primaryError.toLowerCase().includes('schema mismatch')) {
    return {
      tone: 'error',
      type: 'session',
      message: 'Package import blocked: this file is not a supported Atlas visit package schema.',
    };
  }
  if (primaryError.toLowerCase().includes('version mismatch')) {
    return {
      tone: 'error',
      type: 'session',
      message: 'Package import blocked: this Atlas visit package version is not supported by this build.',
    };
  }
  if (primaryError.toLowerCase().includes('not valid json')) {
    return {
      tone: 'error',
      type: 'session',
      message: 'Package import blocked: this file is not a valid Atlas visit package export.',
    };
  }
  if (primaryError === VISIT_PACKAGE_PDF_NO_MARKER_ERROR) {
    return {
      tone: 'error',
      type: 'session',
      message: 'Package import blocked: this customer PDF is missing embedded Atlas package data. Download the customer PDF from Atlas to generate an importable .atlasvisit.pdf file.',
    };
  }
  return {
    tone: 'error',
    type: 'session',
    message: `Package import blocked: ${errors.slice(0, 2).join('; ')}`,
  };
}

function hasPackagedRecommendationSummary(pkg: CanonicalVisitPackageV1): boolean {
  return pkg.proposalTruth?.customerSummary != null || pkg.customerPropertyDetails.customerSummary != null;
}

export function buildExportConfirmationStatus(
  filename: string,
  pkg: CanonicalVisitPackageV1,
): LocalSessionStatus {
  const includedItems: string[] = [
    'Survey draft',
    'Visit identity and export metadata',
  ];
  if (pkg.engineInputSnapshot != null) includedItems.push('Engine input snapshot');
  if (hasPackagedRecommendationSummary(pkg)) {
    includedItems.push('Recommendation summary');
  }
  if (pkg.customerPropertyDetails.portalVisitContext != null) {
    includedItems.push('Customer portal context');
  }
  if (pkg.generatedOutputStatus?.generatedOutputs != null) {
    includedItems.push('Generated output state');
  }
  return {
    tone: 'success',
    type: 'export',
    message: `Downloaded customer PDF ${filename}. Printable content and embedded package data were saved to your device only.`,
    exportSummary: {
      includedItems,
    },
  };
}

export function buildWorkflowQaChecklist(input: {
  readonly hasImportedPackage: boolean;
  readonly canOpenScan: boolean;
  readonly hasScanReturn: boolean;
  readonly hasRegeneratedDeliveryOutputs: boolean;
  readonly hasExportedPackageAgain: boolean;
}): WorkflowQaChecklistItem[] {
  return [
    {
      id: 'import_package',
      label: 'Import package',
      status: input.hasImportedPackage ? 'complete' : 'pending',
      detail: input.hasImportedPackage
        ? 'Canonical package is loaded in this review session.'
        : 'Import a canonical package to begin deterministic roundtrip QA.',
    },
    {
      id: 'open_scan',
      label: 'Open scan',
      status: input.canOpenScan ? 'complete' : 'blocked',
      detail: input.canOpenScan
        ? 'Atlas Scan launch payload is available from this package.'
        : 'Scan launch requires an imported canonical package first.',
    },
    {
      id: 'receive_scan_return',
      label: 'Receive scan return',
      status: input.hasScanReturn ? 'complete' : 'pending',
      detail: input.hasScanReturn
        ? 'Scan handoff evidence is present for this visit.'
        : 'Run a scan return and merge the handoff payload for this visit.',
    },
    {
      id: 'regenerate_delivery_outputs',
      label: 'Regenerate portal / PDF',
      status: input.hasRegeneratedDeliveryOutputs ? 'complete' : 'pending',
      detail: input.hasRegeneratedDeliveryOutputs
        ? 'Customer delivery outputs were regenerated after roundtrip import.'
        : 'Generate customer portal and customer PDF to validate delivery outputs.',
    },
    {
      id: 'export_package_again',
      label: 'Export package again',
      status: input.hasExportedPackageAgain ? 'complete' : 'pending',
      detail: input.hasExportedPackageAgain
        ? 'Export lifecycle state confirms package roundtrip completion.'
        : 'Export package after regeneration to complete smoke workflow.',
    },
  ];
}
