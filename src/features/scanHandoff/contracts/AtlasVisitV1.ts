/**
 * AtlasVisitV1.ts
 *
 * Versioned visit-reference contract used in cross-app handoff payloads.
 *
 * AtlasVisitV1 is the canonical visit identity carried by inter-app contracts
 * such as ScanToMindHandoffV1.  It is intentionally minimal — just enough to
 * open or create a matching visit in Atlas Mind.
 *
 * Design rules
 * ────────────
 * - visitId is the stable server-issued identifier (required).
 * - brandId is optional; Atlas Mind falls back to DEFAULT_BRAND_ID when absent.
 * - createdAt is an ISO-8601 timestamp set by the originating app.
 *
 * These types live locally until the shared @atlas/contracts package is
 * updated to own and export them.  When that migration happens this file
 * should become a re-export shim.
 */

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * AtlasVisitV1 — a versioned visit-reference used in cross-app handoff payloads.
 *
 * Produced by Atlas Scan iOS when sharing a session to Atlas Mind.  Consumed by
 * receiveScanHandoff to locate or create the corresponding visit record in Mind.
 */
export interface AtlasVisitV1 {
  /** Discriminant — always "1". */
  version: '1';
  /** Server-issued stable visit identifier (e.g. "visit_abc123"). */
  visitId: string;
  /**
   * Brand identifier controlling white-label theming.
   * Optional — Atlas Mind falls back to DEFAULT_BRAND_ID when absent.
   */
  brandId?: string;
  /** ISO-8601 timestamp when this visit reference was created by the sending app. */
  createdAt: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns a list of field-level validation errors for an unknown AtlasVisitV1 candidate.
 * An empty array means the value is valid.
 */
export function validateAtlasVisitV1Fields(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (raw['version'] !== '1') {
    errors.push(`visit.version: expected '1', got '${String(raw['version'])}'`);
  }
  if (typeof raw['visitId'] !== 'string' || raw['visitId'].trim().length === 0) {
    errors.push('visit.visitId: must be a non-empty string');
  }
  if (typeof raw['createdAt'] !== 'string') {
    errors.push('visit.createdAt: must be a string');
  }
  if (raw['brandId'] !== undefined && typeof raw['brandId'] !== 'string') {
    errors.push('visit.brandId: must be a string when present');
  }

  return errors;
}

/**
 * Type guard: returns true when value is a structurally valid AtlasVisitV1.
 */
export function isAtlasVisitV1(value: unknown): value is AtlasVisitV1 {
  if (!isObject(value)) return false;
  return validateAtlasVisitV1Fields(value).length === 0;
}
