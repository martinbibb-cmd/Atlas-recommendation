/**
 * ClientFileReferenceV1.ts — Client-owned file reference contract.
 *
 * Atlas links to files that the client owns in their own storage.
 * Atlas NEVER stores file blobs, proxies file content, or carries raw URIs
 * through analytics or export pipelines.
 *
 * Design rules
 * ────────────
 * - Store references only — no file blobs.
 * - Never proxy files through Atlas-owned infrastructure.
 * - Analytics payloads must NEVER include uri or externalId.
 * - Export surfaces (CSV, PDF) must NEVER include file contents.
 * - accessMode documents who controls link validity; Atlas does not enforce it.
 */

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * External storage provider that holds the file.
 * 'other' covers any unlisted provider (e.g. Dropbox, SharePoint, NAS).
 */
export type ClientFileProvider =
  | 'google_drive'
  | 'onedrive'
  | 'icloud'
  | 'local_device'
  | 'other';

// ─── File kind ────────────────────────────────────────────────────────────────

/**
 * Semantic classification of the file from the client's perspective.
 * 'other' is the safe default for unrecognised file types.
 */
export type ClientFileKind =
  | 'scan'
  | 'photo'
  | 'report'
  | 'floor_plan'
  | 'transcript'
  | 'handoff'
  | 'other';

// ─── Access mode ──────────────────────────────────────────────────────────────

/**
 * Describes how access to the linked file is governed.
 *
 * - owner_controlled  — the client can revoke access at any time via their
 *                       provider; Atlas-held reference may become inaccessible.
 * - signed_link       — the URI is a time-limited signed URL; may expire
 *                       before expiresAt if the provider rotates it.
 * - local_only        — the file lives on the client's device; the reference
 *                       is not network-accessible.
 */
export type ClientFileAccessMode =
  | 'owner_controlled'
  | 'signed_link'
  | 'local_only';

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * ClientFileReferenceV1
 *
 * A reference to a file stored in a client-owned external storage provider.
 * Atlas holds only this descriptor — never the file payload.
 *
 * Usage
 * ─────
 * Attach an array of ClientFileReferenceV1 to visit records, handoff payloads,
 * or quote scope items where the client has shared supporting documents.
 *
 * Privacy invariants
 * ──────────────────
 * - `uri` and `externalId` are BLOCKED_CUSTOMER_KEYS in the analytics privacy
 *   guard and must never travel through the analytics or CSV export pipeline.
 * - File contents must never be fetched or stored by Atlas at any layer.
 */
export interface ClientFileReferenceV1 {
  /** Discriminant — always "1". */
  version: '1';

  /** Stable Atlas-generated identifier for this reference record. */
  referenceId: string;

  /** External storage provider that holds the file. */
  provider: ClientFileProvider;

  /** Semantic classification of the file. */
  fileKind: ClientFileKind;

  /**
   * Provider-addressable URI for the file.
   * May be a web URL, deep-link URI, or file-system path depending on provider.
   *
   * ⚠ Privacy — must NOT be included in analytics events or CSV exports.
   */
  uri: string;

  /**
   * Provider-native file identifier (e.g. Google Drive fileId, OneDrive itemId).
   * May be omitted when the provider is identified by URI alone.
   *
   * ⚠ Privacy — must NOT be included in analytics events or CSV exports.
   */
  externalId?: string;

  /**
   * Human-readable label for the file, set by the client or derived from the
   * provider's file name.  Used in UI list displays only.
   */
  displayName?: string;

  /**
   * MIME type reported by the provider (e.g. "application/pdf", "image/jpeg").
   * Informational only — Atlas does not validate or process file contents.
   */
  mimeType?: string;

  /** Describes how access to the file is governed. */
  accessMode: ClientFileAccessMode;

  /** ISO-8601 timestamp when this reference was created in Atlas. */
  createdAt: string;

  /**
   * ISO-8601 timestamp after which the reference should be considered stale.
   * Relevant for signed_link access mode where the URI may expire.
   */
  expiresAt?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_PROVIDERS: ReadonlySet<string> = new Set<ClientFileProvider>([
  'google_drive',
  'onedrive',
  'icloud',
  'local_device',
  'other',
]);

const VALID_FILE_KINDS: ReadonlySet<string> = new Set<ClientFileKind>([
  'scan',
  'photo',
  'report',
  'floor_plan',
  'transcript',
  'handoff',
  'other',
]);

const VALID_ACCESS_MODES: ReadonlySet<string> = new Set<ClientFileAccessMode>([
  'owner_controlled',
  'signed_link',
  'local_only',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns a list of field-level validation errors for an unknown
 * ClientFileReferenceV1 candidate.  An empty array means the value is valid.
 */
export function validateClientFileReferenceV1Fields(
  raw: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  if (raw['version'] !== '1') {
    errors.push(`version: expected '1', got '${String(raw['version'])}'`);
  }
  if (typeof raw['referenceId'] !== 'string' || raw['referenceId'].trim().length === 0) {
    errors.push('referenceId: must be a non-empty string');
  }
  if (typeof raw['provider'] !== 'string' || !VALID_PROVIDERS.has(raw['provider'] as string)) {
    errors.push(
      `provider: must be one of ${[...VALID_PROVIDERS].join(', ')}, got '${String(raw['provider'])}'`,
    );
  }
  if (typeof raw['fileKind'] !== 'string' || !VALID_FILE_KINDS.has(raw['fileKind'] as string)) {
    errors.push(
      `fileKind: must be one of ${[...VALID_FILE_KINDS].join(', ')}, got '${String(raw['fileKind'])}'`,
    );
  }
  if (typeof raw['uri'] !== 'string' || raw['uri'].trim().length === 0) {
    errors.push('uri: must be a non-empty string');
  }
  if (typeof raw['accessMode'] !== 'string' || !VALID_ACCESS_MODES.has(raw['accessMode'] as string)) {
    errors.push(
      `accessMode: must be one of ${[...VALID_ACCESS_MODES].join(', ')}, got '${String(raw['accessMode'])}'`,
    );
  }
  if (typeof raw['createdAt'] !== 'string' || raw['createdAt'].trim().length === 0) {
    errors.push('createdAt: must be a non-empty string');
  }
  if (raw['externalId'] !== undefined && typeof raw['externalId'] !== 'string') {
    errors.push('externalId: must be a string when present');
  }
  if (raw['displayName'] !== undefined && typeof raw['displayName'] !== 'string') {
    errors.push('displayName: must be a string when present');
  }
  if (raw['mimeType'] !== undefined && typeof raw['mimeType'] !== 'string') {
    errors.push('mimeType: must be a string when present');
  }
  if (raw['expiresAt'] !== undefined && typeof raw['expiresAt'] !== 'string') {
    errors.push('expiresAt: must be a string when present');
  }

  return errors;
}

/**
 * Type guard: returns true when value is a structurally valid ClientFileReferenceV1.
 */
export function isClientFileReferenceV1(value: unknown): value is ClientFileReferenceV1 {
  if (!isObject(value)) return false;
  return validateClientFileReferenceV1Fields(value).length === 0;
}
