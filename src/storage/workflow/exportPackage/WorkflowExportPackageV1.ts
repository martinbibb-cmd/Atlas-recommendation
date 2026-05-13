import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { SuggestedImplementationPackV1 } from '../../../specification/SuggestedImplementationPackV1';
import type { SurveyFollowUpTaskV1, ScanHandoffEnvelopePreviewV1 } from '../../../specification/followUps';
import type { EngineerJobPackV1 } from '../../../specification/handover';
import type { SuggestedMaterialLineV1 } from '../../../specification/materials';
import type { InstallationScopePackV1 } from '../../../specification/scopePacks';
import type { SpecificationLineV1 } from '../../../specification/specLines';
import type { PersistedImplementationWorkflowV1 } from '../PersistedImplementationWorkflowV1';
import type { WorkflowStorageTarget } from '../WorkflowStorageAdapterV1';

export const WORKFLOW_EXPORT_PACKAGE_SCHEMA = 'atlas.workflow-export-package' as const;
export const WORKFLOW_EXPORT_PACKAGE_VERSION = '1.0' as const;

export const WORKFLOW_EXPORT_REQUIRED_FILES = [
  'manifest.json',
  'workflow-state.json',
  'implementation-pack.json',
  'specification-lines.json',
  'scope-packs.json',
  'materials-schedule.json',
  'engineer-job-pack.json',
  'follow-up-tasks.json',
  'scan-handoff-preview.json',
  'customer-summary.json',
  'README.md',
] as const;

export type WorkflowExportRequiredFileName = typeof WORKFLOW_EXPORT_REQUIRED_FILES[number];

export interface WorkflowExportPackageManifestV1 {
  readonly schema: typeof WORKFLOW_EXPORT_PACKAGE_SCHEMA;
  readonly version: typeof WORKFLOW_EXPORT_PACKAGE_VERSION;
  readonly exportedAt: string;
  readonly source: {
    readonly target: WorkflowStorageTarget | 'unknown';
    readonly surface: string;
  };
  readonly visitReference: string;
  readonly folderName: string;
}

export interface WorkflowExportPackagePayloadV1 {
  readonly workflowState: PersistedImplementationWorkflowV1;
  readonly implementationPack: SuggestedImplementationPackV1;
  readonly specificationLines: readonly SpecificationLineV1[];
  readonly scopePacks: readonly InstallationScopePackV1[];
  readonly materialsSchedule: readonly SuggestedMaterialLineV1[];
  readonly engineerJobPack: EngineerJobPackV1;
  readonly followUpTasks: readonly SurveyFollowUpTaskV1[];
  readonly scanHandoffPreview: ScanHandoffEnvelopePreviewV1;
  readonly customerSummary: CustomerSummaryV1;
}

export interface WorkflowExportPackageV1 {
  readonly schema: typeof WORKFLOW_EXPORT_PACKAGE_SCHEMA;
  readonly version: typeof WORKFLOW_EXPORT_PACKAGE_VERSION;
  readonly folderName: string;
  readonly files: Readonly<Record<WorkflowExportRequiredFileName, unknown>>;
}
