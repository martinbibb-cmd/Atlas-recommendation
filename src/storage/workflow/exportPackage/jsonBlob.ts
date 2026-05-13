import {
  WORKFLOW_EXPORT_PACKAGE_SCHEMA,
  WORKFLOW_EXPORT_PACKAGE_VERSION,
  WORKFLOW_EXPORT_REQUIRED_FILES,
  type WorkflowExportPackageV1,
} from './WorkflowExportPackageV1';

type WorkflowExportImportResult =
  | { readonly ok: true; readonly pkg: WorkflowExportPackageV1 }
  | { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAllRequiredFiles(files: Record<string, unknown>): boolean {
  return WORKFLOW_EXPORT_REQUIRED_FILES.every((name) => name in files);
}

function hasPdfBinary(files: Record<string, unknown>): boolean {
  return Object.keys(files).some((name) => name.toLowerCase().endsWith('.pdf'));
}

function validateWorkflowExportPackage(raw: unknown): WorkflowExportImportResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'Import failed: package root must be an object.' };
  }
  if (raw['schema'] !== WORKFLOW_EXPORT_PACKAGE_SCHEMA) {
    return { ok: false, reason: `Import failed: schema mismatch. Expected "${WORKFLOW_EXPORT_PACKAGE_SCHEMA}".` };
  }
  if (raw['version'] !== WORKFLOW_EXPORT_PACKAGE_VERSION) {
    return { ok: false, reason: `Import failed: version mismatch. Expected "${WORKFLOW_EXPORT_PACKAGE_VERSION}".` };
  }
  if (typeof raw['folderName'] !== 'string') {
    return { ok: false, reason: 'Import failed: missing folderName.' };
  }
  if (!isRecord(raw['files'])) {
    return { ok: false, reason: 'Import failed: files must be an object.' };
  }

  const files = raw['files'];
  if (!hasAllRequiredFiles(files)) {
    return { ok: false, reason: 'Import failed: package is missing required files.' };
  }
  if (hasPdfBinary(files)) {
    return { ok: false, reason: 'Import failed: customer PDF binaries are not allowed in workflow packages.' };
  }
  const manifest = files['manifest.json'];
  if (!isRecord(manifest)) {
    return { ok: false, reason: 'Import failed: manifest.json must be an object.' };
  }
  if (manifest['schema'] !== WORKFLOW_EXPORT_PACKAGE_SCHEMA || manifest['version'] !== WORKFLOW_EXPORT_PACKAGE_VERSION) {
    return { ok: false, reason: 'Import failed: manifest schema/version mismatch.' };
  }
  if (typeof manifest['exportedAt'] !== 'string') {
    return { ok: false, reason: 'Import failed: manifest missing exportedAt.' };
  }
  if (!isRecord(manifest['source'])) {
    return { ok: false, reason: 'Import failed: manifest missing source.' };
  }

  return { ok: true, pkg: raw as unknown as WorkflowExportPackageV1 };
}

export function exportPackageAsJsonBlob(pkg: WorkflowExportPackageV1): Blob {
  return new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
}

export async function importPackageFromJsonBlob(blob: Blob): Promise<WorkflowExportImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await blob.text());
  } catch {
    return { ok: false, reason: 'Import failed: invalid JSON blob.' };
  }
  return validateWorkflowExportPackage(parsed);
}
