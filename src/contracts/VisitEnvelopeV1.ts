/**
 * VisitEnvelopeV1.ts — Canonical visit data envelope.
 *
 * Single source of truth for all data associated with one Atlas visit.
 *
 * ─── Ownership rules ────────────────────────────────────────────────────────
 *
 * Every surface (portal, simulator, PDF, scan) READS from VisitEnvelopeV1
 * and WRITES ONLY the sub-section it owns.  No surface may own the whole
 * envelope.
 *
 * Sub-section ownership:
 *   identity          — Atlas Scan (originates visit)
 *   customer          — Atlas Mind survey flow (writes once, privacy-safe ref only)
 *   property          — Atlas Mind survey flow
 *   survey            — Atlas Mind survey flow (FullSurveyModelV1)
 *   evidence          — Atlas Scan (photos, voice notes)
 *   topology          — Atlas Mind engine (derived from survey)
 *   recommendation    — Atlas Mind engine (FinalPresentationPayload)
 *   educationalPayload — Atlas Mind (keyed to library registry)
 *   simulatorPayload  — Atlas Simulator (derived from recommendation)
 *   pdfPayload        — Atlas PDF pipeline (embedded JSON artifact)
 *   workspace         — Atlas workspace settings
 *
 * ─── Privacy rules ──────────────────────────────────────────────────────────
 *
 * - The `customer` section must carry ONLY a display label and privacy mode —
 *   never raw name/address strings in pdfPayload.
 * - `evidence` carries file REFERENCES only — no blobs.
 * - `pdfPayload` must never include PII fields.
 *
 * ─── Versioning ─────────────────────────────────────────────────────────────
 *
 * version: '1' is the discriminant.  When breaking changes are needed,
 * introduce VisitEnvelopeV2 and provide a migration function.
 */

import type { AtlasVisitV1 } from '../features/scanHandoff/contracts/AtlasVisitV1';
import type { FinalPresentationPayload } from './FinalPresentationPayload';
import type { DailyUseSimulation } from './DailyUseSimulation';
import type { EmbeddedPayloadPdfV1 } from './EmbeddedPayloadPdfV1';

// ─── Identity ─────────────────────────────────────────────────────────────────

/**
 * Minimal visit identity — wraps AtlasVisitV1 for cross-app handoff.
 * Extends it with a local envelope version discriminant.
 */
export interface VisitIdentityV1 extends AtlasVisitV1 {
  /** Discriminant for the enclosing VisitEnvelopeV1 schema version. */
  envelopeVersion: '1';
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * Privacy-safe customer reference.
 *
 * Stores only a display label and access mode — never raw PII strings.
 * Full customer record (name, address) lives in the workspace server and
 * is never persisted in the envelope or PDF payload.
 */
export interface VisitCustomerRefV1 {
  /** Display label shown in customer-facing surfaces, e.g. "Smith household". */
  displayLabel?: string;
  /** How much personal data is permitted in this envelope context. */
  personalDataMode: 'none' | 'display_label_only' | 'address_summary' | 'full_customer_record';
  /** Privacy-safe address summary, e.g. "SW1A 2AA" — only when personalDataMode allows. */
  addressSummary?: string;
}

// ─── Property ─────────────────────────────────────────────────────────────────

/**
 * Physical property facts derived from the survey.
 * All fields are physics-relevant only — no customer PII.
 */
export interface VisitPropertyV1 {
  propertyType?: 'detached' | 'semi_detached' | 'terraced' | 'flat' | 'bungalow' | 'other';
  constructionEra?: string;
  floorAreaM2?: number;
  storeys?: number;
  wallType?: string;
  glazingType?: string;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

/**
 * Evidence collected during the site survey.
 * File references only — no blobs.
 */
export interface VisitEvidenceV1 {
  /** References to photos captured during the survey (file URI, not content). */
  photoRefs: readonly string[];
  /** Voice note transcription references (not raw audio). */
  voiceNoteRefs: readonly string[];
}

// ─── Topology ─────────────────────────────────────────────────────────────────

/**
 * Resolved heating system topology for this visit.
 *
 * The topologyId drives which canonical template is rendered across all
 * surfaces (portal diagrams, simulator, PDF topology section).
 */
export interface VisitTopologyV1 {
  /**
   * Canonical topology identifier — maps to a template in
   * src/library/visualTopologies/templates/.
   *
   * Values: 'combi' | 'sealed_system_unvented' | 'open_vented' |
   *          'thermal_store' | 'heat_pump' | 'hybrid'
   */
  topologyId: string;
  /** Whether zoning is present (multiple heating zones). */
  hasZoning?: boolean;
  /** Whether a low-loss header is present. */
  hasLowLossHeader?: boolean;
  /** Cylinder variant if present. */
  cylinderVariant?: 'unvented' | 'vented' | 'mixergy' | 'thermal_store' | 'none';
}

// ─── Educational payload ──────────────────────────────────────────────────────

/**
 * Educational content payload for this visit.
 *
 * References content IDs from educationalContentRegistry — never embeds
 * raw content strings (those live in the registry).
 */
export interface VisitEducationalPayloadV1 {
  /** Ordered list of educational content IDs relevant to this visit. */
  contentIds: readonly string[];
  /** Section IDs from atlasMvpContentMapRegistry to include in the portal journey. */
  portalSectionIds: readonly string[];
}

// ─── Simulator payload ────────────────────────────────────────────────────────

/**
 * Simulator payload for this visit.
 *
 * Derived from the recommendation; used by the Simulator surface to
 * render behavioural storytelling.  Never contains raw engine outputs —
 * those are in the recommendation sub-section.
 */
export interface VisitSimulatorPayloadV1 {
  /** Daily-use simulation model derived from the selected scenario. */
  dailyUse?: DailyUseSimulation;
  /** Whether to display the Mixergy demand-mirroring story in the simulator. */
  showMixergyStory?: boolean;
}

// ─── Workspace ────────────────────────────────────────────────────────────────

/**
 * Workspace and branding context for this visit.
 */
export interface VisitWorkspaceV1 {
  workspaceId: string;
  brandId: string;
  /** ISO-8601 timestamp when the workspace context was last updated. */
  updatedAt?: string;
}

// ─── Envelope ─────────────────────────────────────────────────────────────────

/**
 * VisitEnvelopeV1
 *
 * The single source of truth for one Atlas customer visit.
 *
 * All surfaces (portal, simulator, PDF, scan) derive from this.
 * No surface may hold independent visit data that is not present here.
 *
 * Usage:
 *   import type { VisitEnvelopeV1 } from '../contracts/VisitEnvelopeV1';
 *   const envelope = buildVisitEnvelopeV1(survey, context);
 *   // Read a sub-section:
 *   const { recommendation, topology } = envelope;
 */
export interface VisitEnvelopeV1 {
  /** Discriminant — always "1". */
  readonly version: '1';

  // ── Core identity ──────────────────────────────────────────────────────────

  /** Stable visit identity (wraps AtlasVisitV1). */
  readonly identity: VisitIdentityV1;

  /** Workspace and brand context. */
  readonly workspace: VisitWorkspaceV1;

  // ── Survey data ────────────────────────────────────────────────────────────

  /** Privacy-safe customer reference. */
  readonly customer?: VisitCustomerRefV1;

  /** Physical property facts. */
  readonly property?: VisitPropertyV1;

  /**
   * Raw survey model — contains EngineInputV2_3 and diagnostic fields.
   *
   * The full FullSurveyModelV1 type is not imported here to avoid circular
   * dependencies; consumers cast via `as FullSurveyModelV1`.
   * Type: FullSurveyModelV1
   */
  readonly survey?: unknown;

  /** Evidence collected during site survey. */
  readonly evidence?: VisitEvidenceV1;

  // ── Engine outputs ─────────────────────────────────────────────────────────

  /** Resolved topology for this visit. */
  readonly topology?: VisitTopologyV1;

  /**
   * Canonical recommendation payload.
   * All output surfaces (portal, PDF, engineer) derive from this field only.
   */
  readonly recommendation?: FinalPresentationPayload;

  // ── Surface payloads ───────────────────────────────────────────────────────

  /** Educational content payload (registry references, not raw content). */
  readonly educationalPayload?: VisitEducationalPayloadV1;

  /** Simulator surface payload. */
  readonly simulatorPayload?: VisitSimulatorPayloadV1;

  /**
   * Embedded PDF payload.
   * Populated by the PDF generation pipeline; used by PDF open/load flows.
   */
  readonly pdfPayload?: EmbeddedPayloadPdfV1;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Minimal context required to create a new VisitEnvelopeV1.
 */
export interface VisitEnvelopeCreateContextV1 {
  visitId: string;
  brandId: string;
  workspaceId: string;
  createdAt?: string;
}

/**
 * Factory: creates a minimal VisitEnvelopeV1 with identity and workspace set.
 *
 * Populate sub-sections by spreading the returned envelope:
 *   const envelope = buildVisitEnvelopeV1(ctx);
 *   const withSurvey = { ...envelope, survey: fullSurveyModel };
 */
export function buildVisitEnvelopeV1(
  ctx: VisitEnvelopeCreateContextV1,
): VisitEnvelopeV1 {
  const now = ctx.createdAt ?? new Date().toISOString();
  return {
    version: '1',
    identity: {
      version: '1',
      envelopeVersion: '1',
      visitId: ctx.visitId,
      brandId: ctx.brandId,
      createdAt: now,
    },
    workspace: {
      workspaceId: ctx.workspaceId,
      brandId: ctx.brandId,
      updatedAt: now,
    },
  };
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: returns true when value is structurally a VisitEnvelopeV1.
 * Only checks the discriminant and required top-level fields.
 */
export function isVisitEnvelopeV1(value: unknown): value is VisitEnvelopeV1 {
  if (!isObject(value)) return false;
  if (value['version'] !== '1') return false;
  if (!isObject(value['identity'])) return false;
  if (typeof (value['identity'] as Record<string, unknown>)['visitId'] !== 'string') return false;
  if (!isObject(value['workspace'])) return false;
  return true;
}
