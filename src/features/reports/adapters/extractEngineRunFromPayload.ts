/**
 * extractEngineRunFromPayload.ts
 *
 * PR3 — Extracts a PersistedEngineRunV1 from any report payload shape.
 *
 * Prefers the canonical engineRun block; falls back to assembling one from
 * legacy engineOutput/engineInput when only a legacy payload is available.
 * Returns null when no usable engine output is found — never throws.
 */

import {
  isCanonicalReportPayloadV1,
  isLegacyReportPayloadV1,
} from '../types/reportPayload.types';
import type { PersistedEngineRunV1 } from '../types/reportPayload.types';

/**
 * Returns PersistedEngineRunV1 from a canonical payload, or assembles one from
 * legacy engineOutput when only a legacy payload is available.
 *
 * @returns PersistedEngineRunV1 or null if no usable engine output is found.
 */
export function extractEngineRunFromPayload(payload: unknown): PersistedEngineRunV1 | null {
  if (isCanonicalReportPayloadV1(payload)) {
    return payload.engineRun;
  }

  if (isLegacyReportPayloadV1(payload) && payload.engineOutput != null) {
    return {
      engineInput: payload.engineInput ?? undefined,
      engineOutput: payload.engineOutput,
    };
  }

  return null;
}
