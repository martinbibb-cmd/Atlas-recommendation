/**
 * buildInsightPackExportBundle.ts
 *
 * Assembles the files that must be distributed alongside a printed PDF:
 *
 *   • The PDF blob itself (produced by the caller via window.print() or a
 *     server-side PDF renderer — this module is agnostic to how it was made).
 *   • accessible-summary.json  — machine-readable structured sidecar.
 *   • accessible-summary.txt   — plain-text sidecar for screen readers and AT.
 *
 * RULES (non-negotiable):
 *   - The grounding note lives only inside the sidecars, never in the PDF body.
 *   - The PDF blob is forwarded as-is; this module never re-derives content.
 *   - Both sidecar files are always included; omitting either is an error.
 */

import type { AccessibleTechnicalSummary } from './buildAccessibleTechnicalSummary';

// ─── Output type ─────────────────────────────────────────────────────────────

/**
 * The complete export bundle — main PDF plus both accessibility sidecars.
 *
 * Field names are the canonical filenames so that callers can attach them
 * directly to email payloads or ZIP archives without renaming.
 */
export interface InsightPackExportBundle {
  /** The main customer PDF. */
  pdf: Blob;
  /** Machine-readable structured sidecar (UTF-8 JSON string). */
  'accessible-summary.json': string;
  /** Plain-text sidecar for screen readers and assistive tools (UTF-8). */
  'accessible-summary.txt': string;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Assembles the insight pack export bundle from a pre-built PDF and the
 * accessible technical summary produced by buildAccessibleTechnicalSummary().
 *
 * @param pdf      The main customer PDF blob (produced externally).
 * @param summary  The accessible technical summary (both json and plainText).
 * @returns        The complete export bundle ready for email / download.
 */
export function buildInsightPackExportBundle(
  pdf: Blob,
  summary: AccessibleTechnicalSummary,
): InsightPackExportBundle {
  return {
    pdf,
    'accessible-summary.json': JSON.stringify(summary.json, null, 2),
    'accessible-summary.txt': summary.plainText,
  };
}
