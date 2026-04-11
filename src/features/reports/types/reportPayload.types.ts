/**
 * reportPayload.types.ts
 *
 * PR3 — Canonical report payload types.
 *
 * Introduces a versioned, canonical-first payload shape for Atlas report rows.
 * Existing legacy reports (pre-PR3) stored:
 *   { surveyData, engineInput, engineOutput, decisionSynthesis, presentationState }
 *
 * New reports (post-PR3) store:
 *   { schemaVersion: '2.0', atlasProperty, engineRun, presentationState,
 *     decisionSynthesis, legacy?: { surveyData, engineInput, engineOutput } }
 *
 * The schemaVersion: '2.0' marker makes forward-detection trivial in PR9+.
 * Readers should use readCanonicalReportPayload() to accept both shapes.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';
import type { AdviceFromCompareResult } from '../../../lib/advice/buildAdviceFromCompare';
import type { DerivedFloorplanOutput } from '../../../components/floorplan/floorplanDerivations';

// ─── Engine run ───────────────────────────────────────────────────────────────

/**
 * Metadata that identifies where and when a particular engine run originated.
 */
export interface EngineRunSourceMeta {
  runId?: string;
  createdAt?: string;
  source?: 'atlas_mind' | 'visit_hub' | 'portal_bootstrap';
}

/**
 * A single engine run persisted inside a report row.
 * engineInput is optional because early runs may not have been captured.
 */
export interface PersistedEngineRunV1 {
  engineInput?: Partial<EngineInputV2_3>;
  engineOutput: EngineOutputV1;
  runMeta?: EngineRunSourceMeta;
}

// ─── Canonical payload (schemaVersion: '2.0') ─────────────────────────────────

/**
 * The canonical persisted payload shape written by PR3+.
 *
 * atlasProperty is the primary property truth.
 * engineRun holds the engine result alongside optional engine input.
 * legacy carries backward-compatible copies of the old parallel-truth fields
 * so existing portal/print consumers keep working during the transition.
 */
export interface CanonicalReportPayloadV1 {
  schemaVersion: '2.0';
  atlasProperty: AtlasPropertyV1;
  engineRun: PersistedEngineRunV1;
  presentationState?: RecommendationPresentationState | null;
  decisionSynthesis?: AdviceFromCompareResult | null;
  /**
   * Backward-compatibility copies of the old parallel-truth fields.
   * Present on new saves during the migration window; absent on reads is safe.
   * Will be retired in a later PR once all consumers migrate to canonical fields.
   */
  legacy?: {
    surveyData?: FullSurveyModelV1;
    engineInput?: Partial<EngineInputV2_3>;
    engineOutput?: EngineOutputV1;
  };
}

// ─── Legacy payload (pre-PR3) ─────────────────────────────────────────────────

/**
 * The old payload shape written before PR3.
 * All fields are optional here because partial reads must not throw.
 */
export interface LegacyReportPayloadV1 {
  surveyData?: FullSurveyModelV1;
  engineInput?: Partial<EngineInputV2_3>;
  engineOutput?: EngineOutputV1;
  floorplanOutput?: DerivedFloorplanOutput;
  decisionSynthesis?: AdviceFromCompareResult | null;
  presentationState?: RecommendationPresentationState | null;
}

// ─── Reader union ─────────────────────────────────────────────────────────────

/**
 * Union of all known report payload shapes.
 * Use readCanonicalReportPayload() to normalise into a consistent read result.
 *
 * Note: reportApi.ts exports an AnyReportPayload union that includes the legacy
 * ReportPayload type used by the report API.  This is the self-contained type
 * used within the features/reports boundary.
 */
export type AnyReportPayload = CanonicalReportPayloadV1 | LegacyReportPayloadV1;

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Returns true if payload is the canonical V2 shape.
 * Safe to call on any unknown value.
 */
export function isCanonicalReportPayloadV1(payload: unknown): payload is CanonicalReportPayloadV1 {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return p['schemaVersion'] === '2.0' && typeof p['atlasProperty'] === 'object' && p['atlasProperty'] !== null;
}

/**
 * Returns true if payload looks like a legacy V1 shape (has surveyData or engineOutput).
 * Safe to call on any unknown value.
 */
export function isLegacyReportPayloadV1(payload: unknown): payload is LegacyReportPayloadV1 {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return 'surveyData' in p || 'engineOutput' in p;
}
