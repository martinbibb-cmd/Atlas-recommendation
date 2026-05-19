/**
 * EmbeddedPayloadPdfV1.ts — Embedded PDF payload contract.
 *
 * A compact, versioned JSON schema representing the data embedded inside
 * a generated Atlas PDF artifact.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 *
 * 1. NO PII — this payload is embedded in a file that may be shared freely.
 *    It must never carry customer name, address, phone, or email.
 *
 * 2. COMPACT — include only what is needed to restore a visit session.
 *    Heavy data (raw audio, photos) stays outside this payload.
 *
 * 3. VERSIONED — version: '1' is the discriminant; bump to '2' on breaking
 *    changes and ship a migration function alongside.
 *
 * 4. SELF-DESCRIBING — a reader with no context should understand what
 *    system this PDF represents from the payload alone.
 *
 * ─── Embedding approach ──────────────────────────────────────────────────────
 *
 * The JSON payload is serialised and attached as a named embedded-file stream
 * inside the PDF binary (PDF specification §7.11).  The attachment is named
 * "atlas-visit-payload.json" with MIME type "application/json".
 *
 * Extraction is performed by `extractPayloadFromPdf(file)` which returns
 * `EmbeddedPayloadPdfV1 | null` (null for PDFs without an embedded payload,
 * i.e. all PDFs generated before this feature was introduced).
 *
 * ─── Compatibility ───────────────────────────────────────────────────────────
 *
 * - PDFs generated before this feature carry no embedded payload.
 *   `extractPayloadFromPdf` must gracefully return null for these.
 * - The `visitId` field enables server-side lookup as a fallback when the
 *   embedded payload is present but incomplete.
 */

// ─── Recommendation snapshot ──────────────────────────────────────────────────

/**
 * Compact recommendation snapshot embedded in the PDF.
 *
 * Carries only the minimum needed to identify and display the recommendation
 * without running the engine again.
 */
export interface PdfRecommendationSnapshotV1 {
  /** Selected scenario identifier. */
  selectedScenarioId: string;
  /** Human-readable system label, e.g. "Air source heat pump". */
  systemLabel: string;
  /** Canonical topology identifier matching a template in the topology library. */
  topologyId: string;
  /** Hot water arrangement. */
  hotWaterArrangement: 'on_demand' | 'stored_unvented' | 'stored_vented' | 'thermal_store' | 'mixergy' | 'unknown';
  /** Cylinder variant if applicable. */
  cylinderVariant?: 'unvented' | 'vented' | 'mixergy' | 'thermal_store' | 'none';
}

// ─── Property snapshot ────────────────────────────────────────────────────────

/**
 * Non-PII property facts embedded in the PDF.
 * No customer name, address, or contact information.
 */
export interface PdfPropertySnapshotV1 {
  propertyType?: string;
  constructionEra?: string;
  floorAreaM2?: number;
}

// ─── Educational content refs ─────────────────────────────────────────────────

/**
 * Educational content references embedded in the PDF.
 * IDs only — full content text is not embedded to keep the payload compact.
 */
export interface PdfEducationalRefsV1 {
  /** Portal section IDs rendered in this PDF. */
  portalSectionIds: readonly string[];
  /** Educational content IDs relevant to this visit. */
  contentIds: readonly string[];
}

// ─── Workspace ref ────────────────────────────────────────────────────────────

/**
 * Workspace identity embedded in the PDF for Portal open / Scan open flows.
 * No workspace secrets or API keys.
 */
export interface PdfWorkspaceRefV1 {
  brandId: string;
  workspaceId: string;
}

// ─── Payload ──────────────────────────────────────────────────────────────────

/**
 * EmbeddedPayloadPdfV1
 *
 * The complete JSON payload embedded inside an Atlas PDF artifact.
 *
 * All consuming surfaces (Portal load, Scan open, Simulator open) must call
 * `extractPayloadFromPdf` and handle a null return gracefully.
 *
 * Usage:
 *   import type { EmbeddedPayloadPdfV1 } from '../contracts/EmbeddedPayloadPdfV1';
 *   const payload = await extractPayloadFromPdf(pdfFile);
 *   if (payload != null) {
 *     // restore session from payload
 *   }
 */
export interface EmbeddedPayloadPdfV1 {
  /** Discriminant — always "1". */
  readonly version: '1';

  /** ISO-8601 timestamp when this PDF was generated. */
  readonly generatedAt: string;

  /** Atlas visit identifier — enables server-side lookup as a fallback. */
  readonly visitId: string;

  /** Workspace and brand context. */
  readonly workspace: PdfWorkspaceRefV1;

  /** Non-PII property snapshot. */
  readonly property?: PdfPropertySnapshotV1;

  /** Compact recommendation snapshot. */
  readonly recommendation?: PdfRecommendationSnapshotV1;

  /** Educational content references rendered in this PDF. */
  readonly educationalRefs?: PdfEducationalRefsV1;

  /**
   * Opaque forward-compatibility bag for future minor additions.
   * Consumers must not depend on the shape of this field.
   */
  readonly extensions?: Readonly<Record<string, unknown>>;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal EmbeddedPayloadPdfV1 from required fields.
 */
export function buildEmbeddedPayloadPdfV1(
  visitId: string,
  workspace: PdfWorkspaceRefV1,
  opts: {
    generatedAt?: string;
    property?: PdfPropertySnapshotV1;
    recommendation?: PdfRecommendationSnapshotV1;
    educationalRefs?: PdfEducationalRefsV1;
  } = {},
): EmbeddedPayloadPdfV1 {
  return {
    version: '1',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    visitId,
    workspace,
    ...(opts.property != null && { property: opts.property }),
    ...(opts.recommendation != null && { recommendation: opts.recommendation }),
    ...(opts.educationalRefs != null && { educationalRefs: opts.educationalRefs }),
  };
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: returns true when value is a structurally valid EmbeddedPayloadPdfV1.
 */
export function isEmbeddedPayloadPdfV1(value: unknown): value is EmbeddedPayloadPdfV1 {
  if (!isObject(value)) return false;
  if (value['version'] !== '1') return false;
  if (typeof value['visitId'] !== 'string' || (value['visitId'] as string).length === 0) return false;
  if (typeof value['generatedAt'] !== 'string') return false;
  if (!isObject(value['workspace'])) return false;
  return true;
}

// ─── Extraction stub ──────────────────────────────────────────────────────────

/**
 * Extracts an embedded payload from a PDF file.
 *
 * This is the canonical entry point for the "PDF as data-bearing artifact"
 * architecture.  The actual PDF parsing is delegated to the pdf-lib integration
 * layer (not yet implemented — returns null until the embed pipeline is live).
 *
 * Returns null when:
 *   - The PDF has no embedded payload (all legacy PDFs).
 *   - The embedded JSON fails validation.
 *   - An error occurs during extraction.
 */
export async function extractPayloadFromPdf(
  _pdfFile: File | ArrayBuffer,
): Promise<EmbeddedPayloadPdfV1 | null> {
  // TODO: Implement PDF attachment extraction using pdf-lib.
  // 1. Parse PDF binary.
  // 2. Locate embedded file named "atlas-visit-payload.json".
  // 3. Deserialise JSON.
  // 4. Validate with isEmbeddedPayloadPdfV1().
  // 5. Return payload or null.
  return null;
}
