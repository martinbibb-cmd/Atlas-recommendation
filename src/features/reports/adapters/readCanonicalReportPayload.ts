/**
 * readCanonicalReportPayload.ts
 *
 * PR3 — Normalised reader for any report payload shape.
 *
 * Accepts an unknown value (as read from the database) and returns a
 * discriminated read-result that callers can use without duplicating
 * detection logic across portal, print, and visit consumers.
 *
 * This is the single safe entry point for all report payload reads.
 * It never throws on partial or malformed data.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';
import type { AdviceFromCompareResult } from '../../../lib/advice/buildAdviceFromCompare';
import {
  isCanonicalReportPayloadV1,
  isLegacyReportPayloadV1,
} from '../types/reportPayload.types';
import type {
  CanonicalReportPayloadV1,
  LegacyReportPayloadV1,
  PersistedEngineRunV1,
} from '../types/reportPayload.types';

// ─── Read-result shape ────────────────────────────────────────────────────────

export type ReportPayloadVersion = 'canonical_v2' | 'legacy_v1' | 'unknown';

export interface ReadCanonicalReportPayloadResult {
  /** Which schema version was detected. */
  payloadVersion: ReportPayloadVersion;
  /** Canonical property root — present on canonical_v2 payloads. */
  atlasProperty?: AtlasPropertyV1;
  /** Engine run — present on canonical_v2 payloads. */
  engineRun?: PersistedEngineRunV1;
  /** Presentation state — present on both shapes when saved. */
  presentationState?: RecommendationPresentationState | null;
  /** Decision synthesis advice — present on both shapes when saved. */
  decisionSynthesis?: AdviceFromCompareResult | null;
  /** Legacy fields from pre-PR3 payloads, or the legacy block of a PR3 payload. */
  legacy?: LegacyReportPayloadV1;
}

// ─── Reader ───────────────────────────────────────────────────────────────────

/**
 * Normalises any report payload into a consistent read result.
 *
 * Detection order:
 *   1. schemaVersion === '2.0' with atlasProperty → canonical_v2
 *   2. surveyData or engineOutput present          → legacy_v1
 *   3. anything else                               → unknown (returns empty result)
 *
 * Never throws on partial payloads.
 */
export function readCanonicalReportPayload(payload: unknown): ReadCanonicalReportPayloadResult {
  // ── Canonical V2 ───────────────────────────────────────────────────────────
  if (isCanonicalReportPayloadV1(payload)) {
    const p: CanonicalReportPayloadV1 = payload;
    return {
      payloadVersion: 'canonical_v2',
      atlasProperty: p.atlasProperty,
      engineRun: p.engineRun,
      presentationState: p.presentationState ?? null,
      decisionSynthesis: (p.decisionSynthesis as AdviceFromCompareResult | null | undefined) ?? null,
      legacy: p.legacy
        ? {
            surveyData: p.legacy.surveyData,
            engineInput: p.legacy.engineInput,
            engineOutput: p.legacy.engineOutput,
          }
        : undefined,
    };
  }

  // ── Legacy V1 ─────────────────────────────────────────────────────────────
  if (isLegacyReportPayloadV1(payload)) {
    const p: LegacyReportPayloadV1 = payload;
    return {
      payloadVersion: 'legacy_v1',
      presentationState: p.presentationState ?? null,
      decisionSynthesis: (p.decisionSynthesis as AdviceFromCompareResult | null | undefined) ?? null,
      legacy: {
        surveyData: p.surveyData,
        engineInput: p.engineInput,
        engineOutput: p.engineOutput,
        floorplanOutput: p.floorplanOutput,
      },
    };
  }

  // ── Unknown ───────────────────────────────────────────────────────────────
  return { payloadVersion: 'unknown' };
}
