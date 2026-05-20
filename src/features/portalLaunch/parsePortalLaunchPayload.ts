/**
 * parsePortalLaunchPayload.ts
 *
 * Parser and validator for PortalLaunchPayloadV1.
 *
 * Validates the schema/version stamp and required structural fields before
 * the portal surface is allowed to consume the payload. Rejects malformed
 * payloads with descriptive error messages so callers can surface them.
 */

import {
  PORTAL_LAUNCH_PAYLOAD_SCHEMA,
  PORTAL_LAUNCH_PAYLOAD_VERSION,
  type PortalLaunchPayloadV1,
} from './PortalLaunchPayloadV1';

export type PortalLaunchPayloadValidationResult =
  | { readonly ok: true; readonly payload: PortalLaunchPayloadV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateShape(raw: unknown): PortalLaunchPayloadValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Portal launch payload root must be an object.'] };
  }

  if (raw['schema'] !== PORTAL_LAUNCH_PAYLOAD_SCHEMA) {
    return {
      ok: false,
      errors: [
        `Schema mismatch: expected "${PORTAL_LAUNCH_PAYLOAD_SCHEMA}" but received "${String(raw['schema'])}".`,
      ],
    };
  }

  if (raw['version'] !== PORTAL_LAUNCH_PAYLOAD_VERSION) {
    return {
      ok: false,
      errors: [
        `Version mismatch: expected "${PORTAL_LAUNCH_PAYLOAD_VERSION}" but received "${String(raw['version'])}".`,
      ],
    };
  }

  if (!isRecord(raw['visitIdentity'])) {
    return { ok: false, errors: ['visitIdentity must be an object.'] };
  }

  if (typeof raw['hasCustomerJourneyPack'] !== 'boolean') {
    return { ok: false, errors: ['hasCustomerJourneyPack must be a boolean.'] };
  }

  if (typeof raw['rebuildRequired'] !== 'boolean') {
    return { ok: false, errors: ['rebuildRequired must be a boolean.'] };
  }

  if (!isRecord(raw['generatedOutputMetadata'])) {
    return { ok: false, errors: ['generatedOutputMetadata must be an object.'] };
  }

  if (!hasText(raw['builtAt'])) {
    return { ok: false, errors: ['builtAt must be a non-empty string.'] };
  }

  if (!hasText(raw['sourcePackageExportedAt'])) {
    return { ok: false, errors: ['sourcePackageExportedAt must be a non-empty string.'] };
  }

  return { ok: true, payload: raw as unknown as PortalLaunchPayloadV1 };
}

export function validatePortalLaunchPayload(raw: unknown): PortalLaunchPayloadValidationResult {
  return validateShape(raw);
}

export function parsePortalLaunchPayload(
  input: string | unknown,
): PortalLaunchPayloadValidationResult {
  if (typeof input !== 'string') {
    return validatePortalLaunchPayload(input);
  }

  try {
    return validatePortalLaunchPayload(JSON.parse(input) as unknown);
  } catch {
    return {
      ok: false,
      errors: ['Portal launch payload is not valid JSON.'],
    };
  }
}
