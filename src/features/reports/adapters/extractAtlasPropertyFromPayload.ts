/**
 * extractAtlasPropertyFromPayload.ts
 *
 * PR3 — Extracts atlasProperty from any report payload shape.
 *
 * Prefers canonical field; falls back to building one from legacy surveyData
 * via the PR2 adapter seam when only a legacy payload is available.
 * Returns null when neither source is present — never throws.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import {
  isCanonicalReportPayloadV1,
  isLegacyReportPayloadV1,
} from '../types/reportPayload.types';
import { fullSurveyToAtlasPropertyPatch } from '../../atlasProperty/adapters/fullSurveyToAtlasPropertyPatch';
import { mergeAtlasPropertyPatches } from '../../atlasProperty/adapters/mergeAtlasPropertyPatches';

/**
 * Returns atlasProperty from a canonical payload, or derives a partial patch
 * from legacy surveyData when only a legacy payload is available.
 *
 * @returns AtlasPropertyV1 or null if no usable source is found.
 */
export function extractAtlasPropertyFromPayload(payload: unknown): AtlasPropertyV1 | null {
  if (isCanonicalReportPayloadV1(payload)) {
    return payload.atlasProperty;
  }

  if (isLegacyReportPayloadV1(payload) && payload.surveyData != null) {
    const patch = fullSurveyToAtlasPropertyPatch(payload.surveyData);
    return mergeAtlasPropertyPatches(patch) as unknown as AtlasPropertyV1;
  }

  return null;
}
