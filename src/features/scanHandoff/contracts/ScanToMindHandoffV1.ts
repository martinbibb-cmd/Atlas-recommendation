/**
 * ScanToMindHandoffV1.ts
 *
 * Contract for the Scan-to-Mind handoff payload produced by Atlas Scan iOS.
 *
 * ScanToMindHandoffV1 is the typed JSON envelope shared from Atlas Scan to
 * Atlas Mind via deep-link or Web Share.  It packages a SessionCaptureV2
 * alongside a versioned AtlasVisitV1 reference so that Mind can immediately
 * associate the capture with an existing visit record.
 *
 * These types live locally until the shared @atlas/contracts package is
 * updated to own and export them.  When that migration happens this file
 * should become a re-export shim.
 *
 * Validation note: the validator is intentionally bespoke (no runtime schema
 * library) to keep the dependency footprint identical to the approach used
 * across the rest of the codebase.
 */

import type { AtlasVisitV1 } from './AtlasVisitV1';
import { validateAtlasVisitV1Fields } from './AtlasVisitV1';
import type { SessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';
import { validateSessionCaptureV2 } from '../../scanImport/contracts/sessionCaptureV2';

// ─── Contract ─────────────────────────────────────────────────────────────────

/** Discriminant kind string for ScanToMindHandoffV1. */
export const SCAN_TO_MIND_HANDOFF_KIND = 'scan-to-mind-handoff' as const;

/**
 * ScanToMindHandoffV1 — the typed envelope shared from Atlas Scan iOS to
 * Atlas Mind.
 *
 * Shape:
 *   {
 *     schemaVersion: 1,
 *     kind: "scan-to-mind-handoff",
 *     visit: AtlasVisitV1,
 *     capture: SessionCaptureV2,
 *   }
 */
export interface ScanToMindHandoffV1 {
  /** Schema version discriminant — always 1. */
  schemaVersion: 1;
  /** Kind discriminant — always "scan-to-mind-handoff". */
  kind: typeof SCAN_TO_MIND_HANDOFF_KIND;
  /** The visit this scan belongs to. */
  visit: AtlasVisitV1;
  /** The session capture produced by Atlas Scan. */
  capture: SessionCaptureV2;
}

// ─── Validation result types ──────────────────────────────────────────────────

export interface ScanToMindHandoffV1ValidationSuccess {
  ok: true;
  handoff: ScanToMindHandoffV1;
  warnings: string[];
}

export interface ScanToMindHandoffV1ValidationFailure {
  ok: false;
  errors: string[];
}

export type ScanToMindHandoffV1ValidationResult =
  | ScanToMindHandoffV1ValidationSuccess
  | ScanToMindHandoffV1ValidationFailure;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Public validator ─────────────────────────────────────────────────────────

/**
 * validateScanToMindHandoffV1 — entry-point validator for an unknown incoming
 * ScanToMindHandoffV1 payload.
 *
 * Validates:
 *   1. The top-level envelope (schemaVersion, kind).
 *   2. The nested AtlasVisitV1 (visit.*).
 *   3. The nested SessionCaptureV2 (capture.*) via validateSessionCaptureV2.
 *
 * Returns `{ ok: true, handoff, warnings }` on success, or `{ ok: false, errors }`.
 *
 * Warnings are generated for QA flags with severity "warn" in the capture.
 *
 * Usage:
 *   const result = validateScanToMindHandoffV1(parsedJson);
 *   if (!result.ok) { handle result.errors; }
 *   // result.handoff is typed as ScanToMindHandoffV1
 */
export function validateScanToMindHandoffV1(
  input: unknown,
): ScanToMindHandoffV1ValidationResult {
  if (!isObject(input)) {
    return {
      ok: false,
      errors: ['Handoff payload must be a non-null JSON object'],
    };
  }

  const raw = input as Record<string, unknown>;
  const errors: string[] = [];

  // ── 1. Top-level envelope ─────────────────────────────────────────────────

  if (raw['schemaVersion'] !== 1) {
    errors.push(
      `schemaVersion: expected 1, got '${String(raw['schemaVersion'])}'`,
    );
  }

  if (raw['kind'] !== SCAN_TO_MIND_HANDOFF_KIND) {
    errors.push(
      `kind: expected '${SCAN_TO_MIND_HANDOFF_KIND}', got '${String(raw['kind'])}'`,
    );
  }

  // ── 2. Visit reference ────────────────────────────────────────────────────

  if (!isObject(raw['visit'])) {
    errors.push('visit: must be a non-null object');
  } else {
    const visitErrors = validateAtlasVisitV1Fields(raw['visit']);
    errors.push(...visitErrors);
  }

  // ── 3. Capture ────────────────────────────────────────────────────────────

  if (!isObject(raw['capture'])) {
    errors.push('capture: must be a non-null object');
  } else {
    const captureResult = validateSessionCaptureV2(raw['capture']);
    if (!captureResult.ok) {
      errors.push(...captureResult.errors.map((e) => `capture.${e}`));
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // ── Build typed handoff ────────────────────────────────────────────────────
  // At this point both visit and capture have passed structural validation.
  // Re-run validateSessionCaptureV2 to get the typed SessionCaptureV2 value.
  const captureResult = validateSessionCaptureV2(raw['capture']);
  if (!captureResult.ok) {
    // Should not reach here given the check above, but satisfies TypeScript.
    return { ok: false, errors: captureResult.errors };
  }

  const handoff: ScanToMindHandoffV1 = {
    schemaVersion: 1,
    kind: SCAN_TO_MIND_HANDOFF_KIND,
    visit: raw['visit'] as AtlasVisitV1,
    capture: captureResult.session,
  };

  // ── 4. Warnings from QA flags ─────────────────────────────────────────────
  const warnings: string[] = handoff.capture.qaFlags
    .filter((f) => f.severity === 'warn' || f.severity === 'error')
    .map((f) => `QA: [${f.severity}] ${f.code}${f.message ? ` — ${f.message}` : ''}`);

  return { ok: true, handoff, warnings };
}
