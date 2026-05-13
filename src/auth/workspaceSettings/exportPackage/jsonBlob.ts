import type { WorkspaceSettingsExportPackageV1 } from './WorkspaceSettingsExportPackageV1';
import {
  validateWorkspaceSettingsExportPackage,
  type WorkspaceSettingsExportValidationOptions,
  type WorkspaceSettingsExportValidationResult,
} from './validateWorkspaceSettingsExportPackage';

export function exportWorkspaceSettingsPackageAsJsonBlob(
  pkg: WorkspaceSettingsExportPackageV1,
): Blob {
  return new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
}

export async function importWorkspaceSettingsPackageFromJsonBlob(
  blob: Blob,
  options: WorkspaceSettingsExportValidationOptions = {},
): Promise<WorkspaceSettingsExportValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await blob.text());
  } catch {
    return { ok: false, reason: 'Import failed: invalid JSON blob.' };
  }
  return validateWorkspaceSettingsExportPackage(parsed, options);
}
