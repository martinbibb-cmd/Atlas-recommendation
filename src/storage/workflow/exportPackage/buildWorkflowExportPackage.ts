import {
  WORKFLOW_EXPORT_PACKAGE_SCHEMA,
  WORKFLOW_EXPORT_PACKAGE_VERSION,
  type WorkflowExportPackageManifestV1,
  type WorkflowExportPackagePayloadV1,
  type WorkflowExportPackageV1,
  type WorkflowExportBrandContextV1,
} from './WorkflowExportPackageV1';
import type { WorkflowStorageTarget } from '../WorkflowStorageAdapterV1';
import type { AtlasVisitOwnershipV1 } from '../../../auth/profile/AtlasVisitOwnershipV1';
import { sanitizePortalVisitContextForExport } from '../../../lib/portal/portalVisitContext';

interface BuildWorkflowExportPackageInput {
  readonly payload: WorkflowExportPackagePayloadV1;
  readonly source?: {
    readonly target?: WorkflowStorageTarget | 'unknown';
    readonly surface?: string;
  };
  readonly exportedAt?: string;
  readonly folderName?: string;
  /**
   * Ownership context for the visit being exported.
   * When provided it is embedded in the manifest so workspace identity
   * travels with the package.  Absent for unowned / demo-mode visits.
   */
  readonly ownership?: AtlasVisitOwnershipV1;
  /**
   * Brand context resolved at export time.
   * When provided, carries the active brandId, resolution source, and workspace
   * identity so the package can be attributed correctly on import or PDF generation.
   * Absent when no workspace brand session was available at export time.
   */
  readonly brandContext?: WorkflowExportBrandContextV1;
}

function dateStamp(iso: string): string {
  return iso.slice(0, 10);
}

function sanitiseVisitReference(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');
  return cleaned.length > 0 ? cleaned : 'unknown';
}

export function buildWorkflowExportFolderName(visitReference: string, exportedAt: string): string {
  return `Atlas-${sanitiseVisitReference(visitReference)}-${dateStamp(exportedAt)}`;
}

function buildReadme(folderName: string): string {
  return [
    '# Atlas workflow export package',
    '',
    `Folder: ${folderName}`,
    '',
    'This package is a portable implementation workflow snapshot for local files',
    'or workspace storage targets (including future Google Drive integration).',
    '',
    'Contents:',
    '- manifest.json',
    '- workflow-state.json',
    '- implementation-pack.json',
    '- specification-lines.json',
    '- scope-packs.json',
    '- materials-schedule.json',
    '- engineer-job-pack.json',
    '- follow-up-tasks.json',
    '- scan-handoff-preview.json',
    '- customer-summary.json',
    '- portal-visit-context.json',
  ].join('\n');
}

export function buildWorkflowExportPackage({
  payload,
  source,
  exportedAt = new Date().toISOString(),
  folderName = buildWorkflowExportFolderName(payload.workflowState.visitReference, exportedAt),
  ownership,
  brandContext,
}: BuildWorkflowExportPackageInput): WorkflowExportPackageV1 {
  const portalVisitContext = sanitizePortalVisitContextForExport(payload.portalVisitContext);
  const manifest: WorkflowExportPackageManifestV1 = {
    schema: WORKFLOW_EXPORT_PACKAGE_SCHEMA,
    version: WORKFLOW_EXPORT_PACKAGE_VERSION,
    exportedAt,
    source: {
      target: source?.target ?? 'unknown',
      surface: source?.surface ?? 'atlas_workflow_storage',
    },
    visitReference: payload.workflowState.visitReference,
    folderName,
    ...(ownership !== undefined ? { ownership } : {}),
    ...(brandContext !== undefined ? { brandContext } : {}),
  };

  return {
    schema: WORKFLOW_EXPORT_PACKAGE_SCHEMA,
    version: WORKFLOW_EXPORT_PACKAGE_VERSION,
    folderName,
    files: {
      'manifest.json': manifest,
      'workflow-state.json': payload.workflowState,
      'implementation-pack.json': payload.implementationPack,
      'specification-lines.json': payload.specificationLines,
      'scope-packs.json': payload.scopePacks,
      'materials-schedule.json': payload.materialsSchedule,
      'engineer-job-pack.json': payload.engineerJobPack,
      'follow-up-tasks.json': payload.followUpTasks,
        'scan-handoff-preview.json': payload.scanHandoffPreview,
        'customer-summary.json': payload.customerSummary,
        'portal-visit-context.json': portalVisitContext,
        'README.md': buildReadme(folderName),
      },
  };
}
