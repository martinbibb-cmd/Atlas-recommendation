import {
  SCAN_LAUNCH_PAYLOAD_SCHEMA,
  SCAN_LAUNCH_PAYLOAD_VERSION,
  type ScanLaunchPayloadV1,
} from './ScanLaunchPayloadV1';

export type ScanLaunchPayloadValidationResult =
  | { readonly ok: true; readonly payload: ScanLaunchPayloadV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateShape(raw: unknown): ScanLaunchPayloadValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Scan launch payload root must be an object.'] };
  }

  if (raw['schema'] !== SCAN_LAUNCH_PAYLOAD_SCHEMA) {
    return {
      ok: false,
      errors: [
        `Schema mismatch: expected "${SCAN_LAUNCH_PAYLOAD_SCHEMA}" but received "${String(raw['schema'])}".`,
      ],
    };
  }

  if (raw['version'] !== SCAN_LAUNCH_PAYLOAD_VERSION) {
    return {
      ok: false,
      errors: [
        `Version mismatch: expected "${SCAN_LAUNCH_PAYLOAD_VERSION}" but received "${String(raw['version'])}".`,
      ],
    };
  }

  if (!isRecord(raw['visitIdentity'])) {
    return { ok: false, errors: ['visitIdentity must be an object.'] };
  }

  const visitIdentity = raw['visitIdentity'];
  if (!hasText(visitIdentity['visitId']) && !hasText(visitIdentity['visitReference'])) {
    return { ok: false, errors: ['visitIdentity must include visitId or visitReference.'] };
  }

  if (!isRecord(raw['workspaceBrandReference'])) {
    return { ok: false, errors: ['workspaceBrandReference must be an object.'] };
  }

  if (!isRecord(raw['customerPropertyDetails'])) {
    return { ok: false, errors: ['customerPropertyDetails must be an object.'] };
  }

  if (!isRecord(raw['surveyDraft'])) {
    return { ok: false, errors: ['surveyDraft must be an object.'] };
  }

  if (!isRecord(raw['importExportMetadata'])) {
    return { ok: false, errors: ['importExportMetadata must be an object.'] };
  }

  const metadata = raw['importExportMetadata'];
  if (!hasText(metadata['exportedAt'])) {
    return { ok: false, errors: ['importExportMetadata.exportedAt must be a non-empty string.'] };
  }

  if (!hasText(raw['builtAt'])) {
    return { ok: false, errors: ['builtAt must be a non-empty string.'] };
  }

  return { ok: true, payload: raw as unknown as ScanLaunchPayloadV1 };
}

export function validateScanLaunchPayload(raw: unknown): ScanLaunchPayloadValidationResult {
  return validateShape(raw);
}

export function parseScanLaunchPayload(
  input: string | unknown,
): ScanLaunchPayloadValidationResult {
  if (typeof input !== 'string') {
    return validateScanLaunchPayload(input);
  }

  try {
    return validateScanLaunchPayload(JSON.parse(input) as unknown);
  } catch {
    return { ok: false, errors: ['Scan launch payload is not valid JSON.'] };
  }
}
