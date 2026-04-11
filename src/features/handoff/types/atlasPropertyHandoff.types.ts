/**
 * atlasPropertyHandoff.types.ts
 *
 * Types for the canonical AtlasPropertyV1 handoff/import boundary.
 *
 * These are recommendation-side seam types only.  They must not be pushed into
 * @atlas/contracts, which owns the canonical AtlasPropertyV1 shape and
 * cross-app shared contracts.
 *
 * Architecture note
 * ─────────────────
 * This import boundary is intentionally separate from the legacy scan package
 * import path (scanPackageImporter / scanImporter / scanMapper).  The two paths
 * co-exist and serve different source shapes:
 *
 *   legacy path   ScanBundleV1 → scanImporter → canonical draft
 *   handoff path  AtlasPropertyV1 → importAtlasProperty → import result
 *
 * Do NOT use these types inside the scanImport boundary, and do NOT use
 * scanImport types here.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { AtlasPropertyCompletenessSummary } from '../../atlasProperty/types/atlasPropertyAdapter.types';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Handoff source ───────────────────────────────────────────────────────────

/**
 * The origin of an AtlasPropertyV1 handoff payload.
 *
 * atlas_scan_handoff  — property arrived from Atlas Scan iOS via the new
 *                       canonical handoff channel (future: PR 5).
 * manual_import       — property was loaded manually (e.g. pasted JSON,
 *                       fixture-driven, or back-office upload).
 * dev_fixture         — synthetic property created from a developer fixture
 *                       for local testing or harness use only.
 */
export type HandoffSource =
  | 'atlas_scan_handoff'
  | 'manual_import'
  | 'dev_fixture';

// ─── Import result ────────────────────────────────────────────────────────────

/**
 * AtlasPropertyImportResult — the typed result returned by importAtlasProperty().
 *
 * Callers receive a clean result containing:
 *   - the validated canonical property
 *   - a partial EngineInputV2_3 derived from it
 *   - a completeness/readiness summary
 *   - any warnings detected during validation
 *   - the source tag that explains where the payload came from
 *
 * This mirrors the discipline of the existing ScanPackageImportResult:
 *   - import-boundary logic stays local
 *   - callers get canonical result + readiness
 *   - no raw import structures spread up the tree
 */
export interface AtlasPropertyImportResult {
  /** The validated canonical property. */
  atlasProperty: AtlasPropertyV1;
  /** Partial engine input derived from the canonical property. */
  engineInput: Partial<EngineInputV2_3>;
  /** Completeness summary for gating simulation / presenting warnings. */
  completeness: AtlasPropertyCompletenessSummary;
  /** Human-readable warnings detected during import. */
  warnings: string[];
  /** The origin of the payload. */
  source: HandoffSource;
}

// ─── Visit seed ───────────────────────────────────────────────────────────────

/**
 * VisitSeed — the lightweight bootstrap object for a visit that arrives from a
 * canonical property handoff.
 *
 * Consumed by UI that needs to prefill or display visit metadata on arrival,
 * before any DB write or full visit model is constructed.
 */
export interface VisitSeed {
  /** Full postal address or formatted location string, if available. */
  address?: string;
  /** Short property reference (e.g. UPRN, job ref, or internal ID). */
  reference?: string;
  /** Customer-safe display title (e.g. "3 Elm Street, SW1A 1AA"). */
  displayTitle?: string;
  /** Suggested lifecycle status hint for the created visit. */
  statusHint?: 'draft' | 'survey_in_progress' | 'ready_for_simulation';
}

// ─── Report seed ─────────────────────────────────────────────────────────────

/**
 * ReportSeed — the minimum ingredients needed to save a report row from a
 * canonical property handoff.
 *
 * The caller runs the engine after receiving an AtlasPropertyImportResult and
 * then passes engineOutput here to produce a complete seed ready for
 * persistence via the existing report API.
 *
 * Note: this seed is not a saved report — it is the pre-save assembly of
 * parts.  Persistence is the caller's responsibility.
 */
export interface ReportSeed {
  /** The canonical property that is the primary truth. */
  atlasProperty: AtlasPropertyV1;
  /** The partial engine input that was fed to the engine. */
  engineInput: Partial<EngineInputV2_3>;
  /** The engine output produced after running with the derived engine input. */
  engineOutput: EngineOutputV1;
  /** The origin of the payload, written into the report's source metadata. */
  source: HandoffSource;
}

// ─── Presentation seed ────────────────────────────────────────────────────────

/**
 * PresentationSeed — the minimum state needed to open Atlas Mind from a
 * canonical handoff payload.
 *
 * This is the hand-off packet that the arrival route passes to the simulator
 * or recommendation hub.  It is not persisted directly — it is a transient
 * route/navigation payload.
 */
export interface PresentationSeed {
  /** The canonical property. */
  atlasProperty: AtlasPropertyV1;
  /** Derived engine input ready to feed into the engine. */
  engineInput: Partial<EngineInputV2_3>;
  /** Completeness summary so the arrival surface can gate simulation. */
  completeness: AtlasPropertyCompletenessSummary;
  /** The origin of the payload. */
  source: HandoffSource;
  /**
   * Optional opaque launch context (e.g. route params or deep-link state).
   * Can be used to populate navigation or modal state on arrival.
   */
  launchContext?: Record<string, unknown>;
}

// ─── Route state ──────────────────────────────────────────────────────────────

/**
 * AtlasMindHandoffState — the shape placed into browser/navigation state when
 * Atlas Mind is opened from a canonical property handoff.
 *
 * Used by the arrival route to reconstruct the full presentation seed from the
 * navigation state without requiring a round-trip to the server.
 */
export interface AtlasMindHandoffState {
  source: HandoffSource;
  atlasProperty: AtlasPropertyV1;
  engineInput: Partial<EngineInputV2_3>;
  completeness: AtlasPropertyCompletenessSummary;
}
