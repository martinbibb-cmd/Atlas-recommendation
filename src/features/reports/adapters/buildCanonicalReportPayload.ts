/**
 * buildCanonicalReportPayload.ts
 *
 * PR3 — Builds the canonical CanonicalReportPayloadV1 for new report saves.
 *
 * Replaces the ad-hoc inline object literals that previously spread
 * surveyData + engineInput + engineOutput as parallel truths in:
 *   - UnifiedSimulatorView (simulator save)
 *   - VisitHubPage (portal bootstrap)
 *   - App.tsx (presentation bootstrap)
 *
 * Behaviour
 * ─────────
 * - If atlasProperty is supplied, use it directly as canonical truth.
 * - Otherwise derive a patch from surveyData via fullSurveyToAtlasPropertyPatch()
 *   and cast it to the canonical root.  (atlasProperty is required on the
 *   canonical payload type; callers that cannot supply it should always pass
 *   surveyData so the patch path is used.)
 * - Always embeds the legacy fields for backward compatibility so existing
 *   portal / print consumers keep working during the migration window.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';
import type { AdviceFromCompareResult } from '../../../lib/advice/buildAdviceFromCompare';
import { fullSurveyToAtlasPropertyPatch } from '../../atlasProperty/adapters/fullSurveyToAtlasPropertyPatch';
import { mergeAtlasPropertyPatches } from '../../atlasProperty/adapters/mergeAtlasPropertyPatches';
import type { AtlasPropertyPatch } from '../../atlasProperty/types/atlasPropertyAdapter.types';
import type {
  CanonicalReportPayloadV1,
  EngineRunSourceMeta,
} from '../types/reportPayload.types';

// ─── Builder options ──────────────────────────────────────────────────────────

export interface BuildCanonicalReportPayloadOptions {
  /** If provided, used as the canonical property root directly. */
  atlasProperty?: AtlasPropertyV1;
  /**
   * Legacy survey model — used to derive atlasProperty when atlasProperty is
   * not supplied, and always included in the legacy compatibility block.
   */
  surveyData?: FullSurveyModelV1;
  /** Engine input that was fed to the engine for this run. */
  engineInput?: Partial<EngineInputV2_3>;
  /** Engine output for this run — required to persist a meaningful report. */
  engineOutput: EngineOutputV1;
  /** Presentation-layer selection state (recommended / chosen option). */
  presentationState?: RecommendationPresentationState | null;
  /** Advice produced by the compare engine, if available. */
  decisionSynthesis?: AdviceFromCompareResult | null;
  /** Optional metadata identifying the origin and timing of this engine run. */
  runMeta?: EngineRunSourceMeta;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Produces a CanonicalReportPayloadV1 ready for persistence.
 *
 * Canonical truth (atlasProperty + engineRun) is always the primary section.
 * Legacy fields are included for backward-compatible reading by portal, print,
 * and visit consumers that have not yet migrated to canonical reads.
 */
export function buildCanonicalReportPayload(
  opts: BuildCanonicalReportPayloadOptions,
): CanonicalReportPayloadV1 {
  const {
    atlasProperty: suppliedProperty,
    surveyData,
    engineInput,
    engineOutput,
    presentationState,
    decisionSynthesis,
    runMeta,
  } = opts;

  // ── Resolve canonical atlasProperty ────────────────────────────────────────

  let atlasProperty: AtlasPropertyV1;

  if (suppliedProperty != null) {
    atlasProperty = suppliedProperty;
  } else if (surveyData != null) {
    // Derive from survey truth using the PR2 adapter seam.
    const surveyPatch: AtlasPropertyPatch = fullSurveyToAtlasPropertyPatch(surveyData);
    // Cast the merged patch to AtlasPropertyV1.  This is a migration-seam
    // cast: the patch covers the fields we have; required fields not yet
    // populated remain absent but will not cause runtime errors in readers.
    atlasProperty = mergeAtlasPropertyPatches(surveyPatch) as unknown as AtlasPropertyV1;
  } else {
    // Neither was supplied — create an empty property shell so the payload
    // remains structurally valid for the type system.  Callers should always
    // provide at least one of atlasProperty or surveyData.
    atlasProperty = {} as AtlasPropertyV1;
  }

  // ── Assemble canonical payload ──────────────────────────────────────────────

  const payload: CanonicalReportPayloadV1 = {
    schemaVersion: '2.0',
    atlasProperty,
    engineRun: {
      engineInput: engineInput ?? undefined,
      engineOutput,
      runMeta: runMeta ?? undefined,
    },
    presentationState: presentationState ?? null,
    decisionSynthesis: decisionSynthesis ?? null,
    // Include legacy fields for backward-compatible readers during migration.
    legacy: {
      surveyData: surveyData ?? undefined,
      engineInput: engineInput ?? undefined,
      engineOutput,
    },
  };

  return payload;
}
