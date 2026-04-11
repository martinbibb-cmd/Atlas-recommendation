/**
 * extractPresentationStateFromPayload.ts
 *
 * PR3 — Extracts RecommendationPresentationState from any report payload shape.
 *
 * Both the canonical and legacy payload shapes carry presentationState at the
 * same top-level key, so this helper simply reads it safely.
 * Returns null when absent — never throws.
 */

import type { RecommendationPresentationState } from '../../../lib/selection/optionSelection';
import {
  isCanonicalReportPayloadV1,
  isLegacyReportPayloadV1,
} from '../types/reportPayload.types';

/**
 * Returns the presentationState from any report payload, or null if absent.
 */
export function extractPresentationStateFromPayload(
  payload: unknown,
): RecommendationPresentationState | null {
  if (isCanonicalReportPayloadV1(payload)) {
    return payload.presentationState ?? null;
  }

  if (isLegacyReportPayloadV1(payload)) {
    return payload.presentationState ?? null;
  }

  return null;
}
