import {
  CANONICAL_VISIT_PACKAGE_SCHEMA,
  CANONICAL_VISIT_PACKAGE_VERSION,
  type CanonicalVisitPackageV1,
} from './CanonicalVisitPackageV1';
import {
  verifyCanonicalVisitPackageIntegrity,
  type CanonicalVisitPackageIntegrityResult,
} from './packageIntegrity';

export type CanonicalVisitPackageValidationResult =
  | {
    readonly ok: true;
    readonly pkg: CanonicalVisitPackageV1;
    readonly integrity: CanonicalVisitPackageIntegrityResult;
  }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRootShape(rawPackage: unknown): CanonicalVisitPackageValidationResult {
  if (!isRecord(rawPackage)) {
    return { ok: false, errors: ['Package root must be an object.'] };
  }

  if (rawPackage['schema'] !== CANONICAL_VISIT_PACKAGE_SCHEMA) {
    return {
      ok: false,
      errors: [
        `Schema mismatch: expected "${CANONICAL_VISIT_PACKAGE_SCHEMA}" but received "${String(rawPackage['schema'])}".`,
      ],
    };
  }

  if (rawPackage['version'] !== CANONICAL_VISIT_PACKAGE_VERSION) {
    return {
      ok: false,
      errors: [
        `Version mismatch: expected "${CANONICAL_VISIT_PACKAGE_VERSION}" but received "${String(rawPackage['version'])}".`,
      ],
    };
  }

  if (!isRecord(rawPackage['visitIdentity'])) {
    return { ok: false, errors: ['visitIdentity must be an object.'] };
  }

  const visitIdentity = rawPackage['visitIdentity'];
  if (!hasText(visitIdentity['visitId']) && !hasText(visitIdentity['visitReference'])) {
    return { ok: false, errors: ['visitIdentity must include visitId or visitReference.'] };
  }

  if (!isRecord(rawPackage['workspaceBrandReference'])) {
    return { ok: false, errors: ['workspaceBrandReference must be an object.'] };
  }

  if (!isRecord(rawPackage['customerPropertyDetails'])) {
    return { ok: false, errors: ['customerPropertyDetails must be an object.'] };
  }

  if (!isRecord(rawPackage['surveyDraft'])) {
    return { ok: false, errors: ['surveyDraft must be an object.'] };
  }

  if (!isRecord(rawPackage['importExportMetadata'])) {
    return { ok: false, errors: ['importExportMetadata must be an object.'] };
  }

  const importExportMetadata = rawPackage['importExportMetadata'];
  if (!hasText(importExportMetadata['exportedAt'])) {
    return { ok: false, errors: ['importExportMetadata.exportedAt is required.'] };
  }

  if (!isRecord(importExportMetadata['source'])) {
    return { ok: false, errors: ['importExportMetadata.source must be an object.'] };
  }

  const source = importExportMetadata['source'];
  if (!hasText(source['surface']) || !hasText(source['target'])) {
    return {
      ok: false,
      errors: ['importExportMetadata.source must include non-empty target and surface.'],
    };
  }

  return {
    ok: true,
    pkg: rawPackage as unknown as CanonicalVisitPackageV1,
    integrity: verifyCanonicalVisitPackageIntegrity(rawPackage as CanonicalVisitPackageV1),
  };
}

export function validateCanonicalVisitPackage(
  rawPackage: unknown,
): CanonicalVisitPackageValidationResult {
  return validateRootShape(rawPackage);
}

export function parseCanonicalVisitPackage(
  input: string | unknown,
): CanonicalVisitPackageValidationResult {
  if (typeof input !== 'string') {
    return validateCanonicalVisitPackage(input);
  }

  try {
    return validateCanonicalVisitPackage(JSON.parse(input) as unknown);
  } catch {
    return {
      ok: false,
      errors: ['Package is not valid JSON.'],
    };
  }
}
