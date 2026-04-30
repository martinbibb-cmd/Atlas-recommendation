/**
 * atlasVisitPackageReader.ts
 *
 * Reads an `.atlasvisit` package (a ZIP file) and returns the parsed contents.
 *
 * An `.atlasvisit` package contains:
 *   - workspace.json          (required) — visit reference and property metadata
 *   - session_capture_v2.json (required) — full SessionCaptureV2 payload
 *   - review_decisions.json   (optional) — pre-saved per-item review decisions
 *   - photos/                 (optional) — captured photo files
 *   - floorplans/             (optional) — floor-plan image files
 *
 * Binary image files are not stored as blobs — the reader records the count
 * and filenames only.  Photo URI patching is handled by the caller if needed.
 */

import JSZip from 'jszip';
import type { SessionCaptureV2 } from '../../features/scanImport/contracts/sessionCaptureV2';
import { validateSessionCaptureV2 } from '../../features/scanImport/contracts/sessionCaptureV2';
import type { VisitWorkspaceReviewDecision } from '../visitWorkspace/VisitWorkspaceV1';

// ─── Workspace metadata ───────────────────────────────────────────────────────

/**
 * AtlasVisitWorkspaceMeta — the shape of workspace.json inside an .atlasvisit
 * package.  Carries visit reference and property metadata that supplement (and
 * override) equivalent fields in session_capture_v2.json.
 */
export interface AtlasVisitWorkspaceMeta {
  /** Optional visit / job reference (e.g. "JOB-2024-001"). */
  visitReference?: string;
  /** Optional property address details. */
  property?: {
    address?: string;
    postcode?: string;
  };
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface AtlasVisitPackageReadSuccess {
  ok: true;
  /** Parsed workspace.json metadata. */
  meta: AtlasVisitWorkspaceMeta;
  /** Validated SessionCaptureV2 payload from session_capture_v2.json. */
  sessionCapture: SessionCaptureV2;
  /**
   * Pre-saved review decisions from review_decisions.json.
   * Null when the file is absent from the package (caller should generate
   * fresh decisions via buildInitialReviewDecisions instead).
   */
  reviewDecisions: VisitWorkspaceReviewDecision[] | null;
  /** Number of photo files detected in the photos/ folder. */
  photoFileCount: number;
  /** Names of detected photo files. */
  photoFileNames: string[];
  /** Number of floor-plan image files detected in the floorplans/ folder. */
  floorplanFileCount: number;
  /** Names of detected floor-plan files. */
  floorplanFileNames: string[];
}

export interface AtlasVisitPackageReadFailure {
  ok: false;
  errors: string[];
}

export type AtlasVisitPackageReadResult =
  | AtlasVisitPackageReadSuccess
  | AtlasVisitPackageReadFailure;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/** Parse workspace.json contents into AtlasVisitWorkspaceMeta. */
function parseWorkspaceMeta(raw: unknown): AtlasVisitWorkspaceMeta {
  if (!isObject(raw)) return {};
  const meta: AtlasVisitWorkspaceMeta = {};
  if (isString(raw['visitReference'])) {
    meta.visitReference = raw['visitReference'];
  }
  if (isObject(raw['property'])) {
    meta.property = {};
    if (isString(raw['property']['address'])) meta.property.address = raw['property']['address'];
    if (isString(raw['property']['postcode'])) meta.property.postcode = raw['property']['postcode'];
  }
  return meta;
}

/** Validate that review_decisions.json is an array of decision objects. */
function parseReviewDecisions(raw: unknown): VisitWorkspaceReviewDecision[] | null {
  if (!Array.isArray(raw)) return null;
  const decisions: VisitWorkspaceReviewDecision[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    if (
      !isString(item['ref']) ||
      !isString(item['kind']) ||
      !isString(item['reviewStatus'])
    ) {
      continue;
    }
    const validKinds = ['photo', 'object_pin', 'floor_plan_snapshot', 'voice_note', 'room'] as const;
    const validStatuses = ['pending', 'confirmed', 'rejected'] as const;
    const kind = item['kind'] as string;
    const status = item['reviewStatus'] as string;
    if (
      !validKinds.includes(kind as typeof validKinds[number]) ||
      !validStatuses.includes(status as typeof validStatuses[number])
    ) {
      continue;
    }
    decisions.push({
      ref: item['ref'] as string,
      kind: kind as VisitWorkspaceReviewDecision['kind'],
      reviewStatus: status as VisitWorkspaceReviewDecision['reviewStatus'],
      includeInCustomerReport:
        typeof item['includeInCustomerReport'] === 'boolean'
          ? item['includeInCustomerReport']
          : false,
    });
  }
  return decisions;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif']);

function hasImageExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.has(lower.substring(lower.lastIndexOf('.')));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * readAtlasVisitPackage — reads and parses an `.atlasvisit` ZIP file.
 *
 * Returns a discriminated result:
 *   ok: true  — package is valid; parsed contents are ready for import
 *   ok: false — one or more required files are missing or malformed
 */
export async function readAtlasVisitPackage(
  file: File,
): Promise<AtlasVisitPackageReadResult> {
  const errors: string[] = [];

  // 1. Open the ZIP
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    return {
      ok: false,
      errors: [`Could not open package as a ZIP file: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 2. Locate required files (case-insensitive search by basename)
  function findEntry(name: string): JSZip.JSZipObject | null {
    const lower = name.toLowerCase();
    let match: JSZip.JSZipObject | null = null;
    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      const basename = relativePath.split('/').pop()?.toLowerCase() ?? '';
      if (basename === lower) match = entry;
    });
    return match;
  }

  const workspaceEntry   = findEntry('workspace.json');
  const captureEntry     = findEntry('session_capture_v2.json');
  const decisionsEntry   = findEntry('review_decisions.json');

  if (!workspaceEntry) errors.push('workspace.json not found in the package');
  if (!captureEntry)   errors.push('session_capture_v2.json not found in the package');

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 3. Parse workspace.json
  let meta: AtlasVisitWorkspaceMeta = {};
  try {
    const workspaceText = await workspaceEntry!.async('text');
    const workspaceRaw = safeParseJson(workspaceText);
    if (workspaceRaw === null) {
      errors.push('workspace.json is not valid JSON');
    } else {
      meta = parseWorkspaceMeta(workspaceRaw);
    }
  } catch (err) {
    errors.push(`Could not read workspace.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Parse and validate session_capture_v2.json
  let sessionCapture: SessionCaptureV2 | null = null;
  try {
    const captureText = await captureEntry!.async('text');
    const captureRaw = safeParseJson(captureText);
    if (captureRaw === null) {
      errors.push('session_capture_v2.json is not valid JSON');
    } else {
      const validationResult = validateSessionCaptureV2(captureRaw);
      if (!validationResult.ok) {
        errors.push(
          `session_capture_v2.json validation failed: ${validationResult.errors.slice(0, 3).join('; ')}`,
        );
      } else {
        sessionCapture = validationResult.session;
      }
    }
  } catch (err) {
    errors.push(`Could not read session_capture_v2.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 5. Parse review_decisions.json (optional — null when absent)
  let reviewDecisions: VisitWorkspaceReviewDecision[] | null = null;
  if (decisionsEntry) {
    try {
      const decisionsText = await decisionsEntry.async('text');
      const decisionsRaw = safeParseJson(decisionsText);
      if (decisionsRaw !== null) {
        reviewDecisions = parseReviewDecisions(decisionsRaw);
      }
    } catch {
      // Non-fatal — fall back to generated decisions
    }
  }

  // 6. Detect photo and floor-plan files
  const photoFileNames: string[] = [];
  const floorplanFileNames: string[] = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const lower = relativePath.toLowerCase();
    const basename = relativePath.split('/').pop() ?? relativePath;
    if (!hasImageExtension(basename)) return;

    if (lower.startsWith('photos/') || lower.startsWith('photos\\')) {
      photoFileNames.push(basename);
    } else if (lower.startsWith('floorplans/') || lower.startsWith('floorplans\\')) {
      floorplanFileNames.push(basename);
    }
  });

  return {
    ok: true,
    meta,
    sessionCapture: sessionCapture!,
    reviewDecisions,
    photoFileCount: photoFileNames.length,
    photoFileNames,
    floorplanFileCount: floorplanFileNames.length,
    floorplanFileNames,
  };
}
