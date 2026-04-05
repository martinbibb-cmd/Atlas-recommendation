/**
 * scanValidation.ts
 *
 * Runtime validation for incoming scan bundles.
 *
 * All incoming scan data must pass through this module before it reaches any
 * other Atlas code.  The validator:
 *   1. Confirms the input is a non-null object.
 *   2. Checks the version field is present and supported.
 *   3. Validates required structural fields for the detected version.
 *
 * The validator does NOT attempt to parse or normalise coordinates — that is
 * the importer's responsibility.
 *
 * Design note: Zod is not a dependency of this project; we use bespoke
 * structural checks that mirror the pattern used elsewhere in Atlas
 * (e.g. SurveyDraftInput.ts).
 */

import {
  SUPPORTED_SCAN_BUNDLE_VERSIONS,
  type ScanBundle,
  type UnknownScanBundle,
} from './scanContracts';

// ─── Validation result types ──────────────────────────────────────────────────

export interface ScanValidationSuccess {
  ok: true;
  bundle: ScanBundle;
}

export interface ScanValidationFailure {
  ok: false;
  errors: string[];
}

export type ScanValidationResult = ScanValidationSuccess | ScanValidationFailure;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ─── Field-level validators ───────────────────────────────────────────────────

function validateScanPoint3D(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isNumber(value['x'])) errors.push(`${path}.x: must be a finite number`);
  if (!isNumber(value['y'])) errors.push(`${path}.y: must be a finite number`);
  if (!isNumber(value['z'])) errors.push(`${path}.z: must be a finite number`);
  return errors;
}

function validateScanPoint2D(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isNumber(value['x'])) errors.push(`${path}.x: must be a finite number`);
  if (!isNumber(value['y'])) errors.push(`${path}.y: must be a finite number`);
  return errors;
}

const VALID_CONFIDENCE_BANDS = ['high', 'medium', 'low'];

function validateConfidence(value: unknown, path: string): string[] {
  if (!VALID_CONFIDENCE_BANDS.includes(value as string)) {
    return [`${path}: must be 'high' | 'medium' | 'low', got '${String(value)}'`];
  }
  return [];
}

function validateScanOpening(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['id'])) errors.push(`${path}.id: must be a string`);
  if (!isNumber(value['widthM'])) errors.push(`${path}.widthM: must be a finite number`);
  if (!isNumber(value['heightM'])) errors.push(`${path}.heightM: must be a finite number`);
  if (!isNumber(value['offsetM'])) errors.push(`${path}.offsetM: must be a finite number`);
  const validOpeningTypes = ['door', 'window', 'unknown'];
  if (!validOpeningTypes.includes(value['type'] as string)) {
    errors.push(`${path}.type: must be 'door' | 'window' | 'unknown'`);
  }
  errors.push(...validateConfidence(value['confidence'], `${path}.confidence`));
  return errors;
}

function validateScanWall(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['id'])) errors.push(`${path}.id: must be a string`);
  errors.push(...validateScanPoint3D(value['start'], `${path}.start`));
  errors.push(...validateScanPoint3D(value['end'], `${path}.end`));
  if (!isNumber(value['heightM'])) errors.push(`${path}.heightM: must be a finite number`);
  if (!isNumber(value['thicknessMm'])) errors.push(`${path}.thicknessMm: must be a finite number`);
  const validKinds = ['internal', 'external', 'unknown'];
  if (!validKinds.includes(value['kind'] as string)) {
    errors.push(`${path}.kind: must be 'internal' | 'external' | 'unknown'`);
  }
  if (!isArray(value['openings'])) {
    errors.push(`${path}.openings: must be an array`);
  } else {
    value['openings'].forEach((o, i) => {
      errors.push(...validateScanOpening(o, `${path}.openings[${i}]`));
    });
  }
  errors.push(...validateConfidence(value['confidence'], `${path}.confidence`));
  return errors;
}

function validateScanRoom(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['id'])) errors.push(`${path}.id: must be a string`);
  if (!isString(value['label'])) errors.push(`${path}.label: must be a string`);
  if (!isNumber(value['floorIndex'])) errors.push(`${path}.floorIndex: must be a finite number`);
  if (!isNumber(value['areaM2'])) errors.push(`${path}.areaM2: must be a finite number`);
  if (!isNumber(value['heightM'])) errors.push(`${path}.heightM: must be a finite number`);
  if (!isArray(value['polygon'])) {
    errors.push(`${path}.polygon: must be an array`);
  } else {
    value['polygon'].forEach((p, i) => {
      errors.push(...validateScanPoint2D(p, `${path}.polygon[${i}]`));
    });
  }
  if (!isArray(value['walls'])) {
    errors.push(`${path}.walls: must be an array`);
  } else {
    value['walls'].forEach((w, i) => {
      errors.push(...validateScanWall(w, `${path}.walls[${i}]`));
    });
  }
  if (!isArray(value['detectedObjects'])) {
    errors.push(`${path}.detectedObjects: must be an array`);
  }
  errors.push(...validateConfidence(value['confidence'], `${path}.confidence`));
  return errors;
}

function validateScanMeta(value: unknown, path: string): string[] {
  if (!isObject(value)) return [`${path}: must be an object`];
  const errors: string[] = [];
  if (!isString(value['capturedAt'])) errors.push(`${path}.capturedAt: must be a string`);
  if (!isString(value['deviceModel'])) errors.push(`${path}.deviceModel: must be a string`);
  if (!isString(value['scannerApp'])) errors.push(`${path}.scannerApp: must be a string`);
  if (value['coordinateConvention'] !== 'metric_m') {
    errors.push(`${path}.coordinateConvention: must be 'metric_m'`);
  }
  return errors;
}

function validateBundleV1(raw: UnknownScanBundle): string[] {
  const errors: string[] = [];
  if (!isString(raw['bundleId'])) errors.push('bundleId: must be a string');
  if (!isArray(raw['rooms'])) {
    errors.push('rooms: must be an array');
  } else {
    raw['rooms'].forEach((r, i) => {
      errors.push(...validateScanRoom(r, `rooms[${i}]`));
    });
  }
  if (!isArray(raw['anchors'])) {
    errors.push('anchors: must be an array');
  }
  if (!isArray(raw['qaFlags'])) {
    errors.push('qaFlags: must be an array');
  }
  errors.push(...validateScanMeta(raw['meta'], 'meta'));
  return errors;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * validateScanBundle — entry-point validator for an unknown incoming payload.
 *
 * Returns `{ ok: true, bundle }` when the bundle passes all structural checks,
 * or `{ ok: false, errors }` with a list of human-readable error strings.
 *
 * Usage:
 *   const result = validateScanBundle(rawJson);
 *   if (!result.ok) {
 *     // handle result.errors
 *   }
 *   // result.bundle is now typed as ScanBundle
 */
export function validateScanBundle(input: unknown): ScanValidationResult {
  if (!isObject(input)) {
    return { ok: false, errors: ['Scan bundle must be a non-null JSON object'] };
  }

  const raw = input as UnknownScanBundle;

  // Version check first — produces a structured rejection before any deeper
  // structural validation so the importer can distinguish between
  // 'rejected_invalid' and 'rejected_unsupported_version'.
  if (!isString(raw['version'])) {
    return { ok: false, errors: ['version: must be a string'] };
  }

  const isSupported = (SUPPORTED_SCAN_BUNDLE_VERSIONS as readonly string[]).includes(raw['version']);
  if (!isSupported) {
    return {
      ok: false,
      errors: [
        `version '${raw['version']}' is not supported. ` +
          `Supported versions: ${SUPPORTED_SCAN_BUNDLE_VERSIONS.join(', ')}`,
      ],
    };
  }

  // Deep structural validation for the detected version.
  const structuralErrors = validateBundleV1(raw);
  if (structuralErrors.length > 0) {
    return { ok: false, errors: structuralErrors };
  }

  return { ok: true, bundle: raw as ScanBundle };
}

/**
 * isUnsupportedVersion — returns true if the input has a `version` field
 * whose value is not in SUPPORTED_SCAN_BUNDLE_VERSIONS.
 *
 * Useful so the importer can distinguish between a structurally invalid
 * bundle and one that is simply from a newer (unsupported) contract version.
 */
export function isUnsupportedVersion(input: unknown): boolean {
  if (!isObject(input)) return false;
  const v = (input as UnknownScanBundle)['version'];
  if (!isString(v)) return false;
  return !(SUPPORTED_SCAN_BUNDLE_VERSIONS as readonly string[]).includes(v);
}
