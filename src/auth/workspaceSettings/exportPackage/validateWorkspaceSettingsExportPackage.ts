import type { AtlasWorkspaceV1, WorkspaceMembershipV1 } from '../../profile';
import { WORKSPACE_SETTINGS_SCHEMA_VERSION, type PersistedWorkspaceSettingsV1 } from '../storage';
import {
  WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA,
  WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION,
  WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES,
  type WorkspaceSettingsExportPackageV1,
  type WorkspaceSettingsImportPreviewV1,
} from './WorkspaceSettingsExportPackageV1';

export interface WorkspaceSettingsExportValidationOptions {
  readonly currentWorkspaceId?: string;
  readonly allowWorkspaceReplacement?: boolean;
  readonly googleDriveConnectorAvailable?: boolean;
}

export type WorkspaceSettingsExportValidationResult =
  | { readonly ok: true; readonly preview: WorkspaceSettingsImportPreviewV1; readonly pkg: WorkspaceSettingsExportPackageV1 }
  | { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasAllRequiredFiles(files: Record<string, unknown>): boolean {
  return WORKSPACE_SETTINGS_EXPORT_REQUIRED_FILES.every((name) => name in files);
}

function isWorkspaceStoragePreference(value: unknown): value is AtlasWorkspaceV1['storagePreference'] {
  return value === 'disabled' || value === 'local_only' || value === 'google_drive';
}

function isWorkspaceBrandPolicy(value: unknown): value is AtlasWorkspaceV1['brandPolicy'] {
  return value === 'locked' || value === 'workspace_default' || value === 'user_selectable';
}

function normaliseStringArray(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function canManageWorkspace(member: WorkspaceMembershipV1): boolean {
  return member.permissions.includes('manage_workspace');
}

function parseWorkspaceMembers(raw: unknown, workspaceId: string): WorkspaceMembershipV1[] | null {
  if (!Array.isArray(raw)) return null;

  const members: WorkspaceMembershipV1[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const role = item['role'];
    const permissions = item['permissions'];
    const userId = item['userId'];

    if (
      typeof userId !== 'string' ||
      typeof role !== 'string' ||
      !Array.isArray(permissions) ||
      permissions.some((permission) => typeof permission !== 'string')
    ) {
      return null;
    }

    members.push({
      workspaceId,
      userId,
      role: role as WorkspaceMembershipV1['role'],
      permissions: permissions as WorkspaceMembershipV1['permissions'],
    });
  }

  return members;
}

function parseInvites(raw: unknown): PersistedWorkspaceSettingsV1['invites'] | null {
  if (!Array.isArray(raw)) return null;
  if (
    raw.some(
      (item) =>
        !isRecord(item) ||
        typeof item['inviteId'] !== 'string' ||
        typeof item['workspaceId'] !== 'string' ||
        typeof item['email'] !== 'string' ||
        typeof item['role'] !== 'string' ||
        !Array.isArray(item['permissions']) ||
        (item['permissions'] as unknown[]).some((permission) => typeof permission !== 'string') ||
        typeof item['createdAt'] !== 'string',
    )
  ) {
    return null;
  }
  return raw as PersistedWorkspaceSettingsV1['invites'];
}

function parseJoinDecisions(raw: unknown): PersistedWorkspaceSettingsV1['joinRequestDecisions'] | null {
  if (!Array.isArray(raw)) return null;
  if (
    raw.some(
      (item) =>
        !isRecord(item) ||
        typeof item['requestId'] !== 'string' ||
        (item['decision'] !== 'approved' && item['decision'] !== 'rejected') ||
        (item['role'] !== undefined && typeof item['role'] !== 'string') ||
        typeof item['decidedAt'] !== 'string',
    )
  ) {
    return null;
  }
  return raw as PersistedWorkspaceSettingsV1['joinRequestDecisions'];
}

export function validateWorkspaceSettingsExportPackage(
  rawPackage: unknown,
  options: WorkspaceSettingsExportValidationOptions = {},
): WorkspaceSettingsExportValidationResult {
  if (!isRecord(rawPackage)) {
    return { ok: false, reason: 'Import failed: package root must be an object.' };
  }
  if (rawPackage['schema'] !== WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA) {
    return {
      ok: false,
      reason: `Import failed: schema mismatch. Expected "${WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA}".`,
    };
  }
  if (rawPackage['version'] !== WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION) {
    return {
      ok: false,
      reason: `Import failed: version mismatch. Expected "${WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION}".`,
    };
  }
  if (typeof rawPackage['folderName'] !== 'string') {
    return { ok: false, reason: 'Import failed: missing folderName.' };
  }
  if (!isRecord(rawPackage['files'])) {
    return { ok: false, reason: 'Import failed: files must be an object.' };
  }

  const files = rawPackage['files'];
  if (!hasAllRequiredFiles(files)) {
    return { ok: false, reason: 'Import failed: package is missing required files.' };
  }

  const manifest = files['manifest.json'];
  const workspaceRecord = files['workspace.json'];
  const membersRecord = files['members.json'];
  const brandPolicyRecord = files['brand-policy.json'];
  const storageRecord = files['storage-preference.json'];
  const invitesRecord = files['invites.json'];
  const joinDecisionsRecord = files['join-decisions.json'];

  if (!isRecord(manifest)) {
    return { ok: false, reason: 'Import failed: manifest.json must be an object.' };
  }
  if (
    manifest['schema'] !== WORKSPACE_SETTINGS_EXPORT_PACKAGE_SCHEMA ||
    manifest['version'] !== WORKSPACE_SETTINGS_EXPORT_PACKAGE_VERSION
  ) {
    return { ok: false, reason: 'Import failed: manifest schema/version mismatch.' };
  }
  if (typeof manifest['workspaceId'] !== 'string') {
    return { ok: false, reason: 'Import failed: manifest missing workspaceId.' };
  }
  if (typeof manifest['exportedAt'] !== 'string') {
    return { ok: false, reason: 'Import failed: manifest missing exportedAt.' };
  }

  if (!isRecord(workspaceRecord)) {
    return { ok: false, reason: 'Import failed: workspace.json must be an object.' };
  }
  if (!isRecord(brandPolicyRecord)) {
    return { ok: false, reason: 'Import failed: brand-policy.json must be an object.' };
  }
  if (!isRecord(storageRecord)) {
    return { ok: false, reason: 'Import failed: storage-preference.json must be an object.' };
  }

  const workspaceId = workspaceRecord['workspaceId'];
  const workspaceName = workspaceRecord['name'];
  const workspaceSlug = workspaceRecord['slug'];
  const ownerUserId = workspaceRecord['ownerUserId'];
  const createdAt = workspaceRecord['createdAt'];
  const updatedAt = workspaceRecord['updatedAt'];

  if (
    typeof workspaceId !== 'string' ||
    typeof workspaceName !== 'string' ||
    typeof workspaceSlug !== 'string' ||
    typeof ownerUserId !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return { ok: false, reason: 'Import failed: workspace.json has invalid fields.' };
  }

  if (workspaceId !== manifest['workspaceId']) {
    return {
      ok: false,
      reason: 'Import failed: workspace.json workspaceId does not match manifest workspaceId.',
    };
  }

  const members = parseWorkspaceMembers(membersRecord, workspaceId);
  if (members === null) {
    return { ok: false, reason: 'Import failed: members.json must be a valid member list.' };
  }

  const policy = brandPolicyRecord['policy'];
  const defaultBrandId =
    typeof brandPolicyRecord['defaultBrandId'] === 'string'
      ? brandPolicyRecord['defaultBrandId'].trim()
      : '';
  const allowedBrandIds = Array.isArray(brandPolicyRecord['allowedBrandIds'])
    ? brandPolicyRecord['allowedBrandIds']
    : null;

  if (!isWorkspaceBrandPolicy(policy) || allowedBrandIds === null) {
    return { ok: false, reason: 'Import failed: brand-policy.json has invalid fields.' };
  }

  if (allowedBrandIds.some((brandId) => typeof brandId !== 'string')) {
    return { ok: false, reason: 'Import failed: brand-policy.json allowedBrandIds must be strings.' };
  }

  const normalisedAllowedBrandIds = normaliseStringArray(allowedBrandIds as string[]);

  const storagePreference = storageRecord['storagePreference'];
  if (!isWorkspaceStoragePreference(storagePreference)) {
    return { ok: false, reason: 'Import failed: storage-preference.json has invalid storagePreference.' };
  }

  const invites = parseInvites(invitesRecord);
  if (invites === null) {
    return { ok: false, reason: 'Import failed: invites.json must be a valid invite list.' };
  }

  const joinRequestDecisions = parseJoinDecisions(joinDecisionsRecord);
  if (joinRequestDecisions === null) {
    return { ok: false, reason: 'Import failed: join-decisions.json must be a valid decision list.' };
  }

  const workspace: AtlasWorkspaceV1 = {
    workspaceId,
    name: workspaceName,
    slug: workspaceSlug,
    ownerUserId,
    members,
    storagePreference,
    defaultBrandId,
    allowedBrandIds: normalisedAllowedBrandIds,
    brandPolicy: policy,
    createdAt,
    updatedAt,
  };

  const persistedSettings: PersistedWorkspaceSettingsV1 = {
    schemaVersion: WORKSPACE_SETTINGS_SCHEMA_VERSION,
    workspaceId,
    savedAt: manifest['exportedAt'],
    workspace,
    invites,
    joinRequestDecisions,
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!defaultBrandId || normalisedAllowedBrandIds.length === 0) {
    blockingReasons.push('Invalid brand policy: default brand and allowed brands are required.');
  }
  if (policy === 'locked' && !defaultBrandId) {
    blockingReasons.push('Invalid brand policy: locked policy requires a default brand.');
  }
  if (!normalisedAllowedBrandIds.includes(defaultBrandId)) {
    blockingReasons.push('Invalid brand policy: default brand must be included in allowed brands.');
  }

  const managerCount = members.filter(canManageWorkspace).length;
  if (managerCount === 0) {
    blockingReasons.push('At least one owner/admin must retain manage workspace permission.');
  }

  const requiresWorkspaceReplacementConfirmation =
    typeof options.currentWorkspaceId === 'string' && options.currentWorkspaceId !== workspaceId;

  if (requiresWorkspaceReplacementConfirmation && !options.allowWorkspaceReplacement) {
    blockingReasons.push(
      `Workspace ID mismatch: package is for "${workspaceId}" but current workspace is "${options.currentWorkspaceId}". Admin confirmation is required to replace local settings.`,
    );
  }

  if (storagePreference === 'google_drive' && options.googleDriveConnectorAvailable === false) {
    warnings.push(
      'Google Drive connector is unavailable. Settings can be imported, but Google Drive synchronization is unavailable.',
    );
  }

  return {
    ok: true,
    pkg: rawPackage as unknown as WorkspaceSettingsExportPackageV1,
    preview: {
      persistedSettings,
      blockingReasons,
      warnings,
      requiresWorkspaceReplacementConfirmation,
    },
  };
}
