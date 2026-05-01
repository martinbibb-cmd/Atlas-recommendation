/**
 * receiveScanHandoff.ts
 *
 * Entry-point function for the Scan-to-Mind handoff receive flow.
 *
 * Takes an unknown payload (e.g. parsed from a shared JSON file or deep-link
 * query param), validates it as a ScanToMindHandoffV1, and — if valid — stores
 * the capture in the scan handoff store.
 *
 * Design rules
 * ────────────
 * - Pure validation/storage logic — no React, no navigation side-effects.
 * - On invalid payload: returns errors and does NOT store anything.
 * - On valid payload: stores the capture and returns visit + capture + warnings.
 * - Callers are responsible for navigation after receiving the result.
 */

import type { AtlasVisitV1 } from './contracts/AtlasVisitV1';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { validateScanToMindHandoffV1 } from './contracts/ScanToMindHandoffV1';
import { storeScanCapture } from './scanHandoffStore';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ReceiveScanHandoffResult {
  /** True when the payload was valid and the capture has been stored. */
  ok: boolean;
  /** The validated visit reference, present when ok is true. */
  visit?: AtlasVisitV1;
  /** The validated session capture, present when ok is true. */
  capture?: SessionCaptureV2;
  /** Validation errors — non-empty when ok is false. */
  errors: string[];
  /** Non-fatal warnings from QA flags or schema notes. */
  warnings: string[];
}

// ─── Public function ──────────────────────────────────────────────────────────

/**
 * receiveScanHandoff — validate and store an incoming ScanToMindHandoffV1 payload.
 *
 * Steps:
 *   1. Safely check `payload` is a non-null object.
 *   2. Validate it as a ScanToMindHandoffV1 via validateScanToMindHandoffV1.
 *   3. If invalid, return errors and do not store.
 *   4. If valid, persist the capture via storeScanCapture and return the result.
 *
 * @param payload - Unknown incoming data (typically parsed JSON).
 * @returns       ReceiveScanHandoffResult with ok, visit, capture, errors, warnings.
 */
export function receiveScanHandoff(payload: unknown): ReceiveScanHandoffResult {
  const result = validateScanToMindHandoffV1(payload);

  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors,
      warnings: [],
    };
  }

  const { handoff, warnings } = result;

  try {
    storeScanCapture(handoff.visit.visitId, handoff.capture);
  } catch (err) {
    // Storage failure is non-fatal — the caller still gets visit + capture
    // and can proceed in-memory.  The warning is surfaced so the UI can
    // optionally inform the engineer.
    const message =
      err instanceof Error ? err.message : 'Unknown storage error';
    return {
      ok: true,
      visit: handoff.visit,
      capture: handoff.capture,
      errors: [],
      warnings: [...warnings, `Storage warning: ${message}`],
    };
  }

  return {
    ok: true,
    visit: handoff.visit,
    capture: handoff.capture,
    errors: [],
    warnings,
  };
}
