/**
 * buildReportSeedFromAtlasProperty.ts
 *
 * Creates the minimum ingredients needed to save a report from a canonical
 * AtlasPropertyV1 handoff.
 *
 * Architecture note
 * ──────────────────
 * This function assembles the ReportSeed — it does NOT persist anything.
 * The caller is responsible for running the engine and then passing
 * engineOutput here before handing the seed to the report persistence layer.
 *
 * Typical call sequence:
 *   1. importAtlasProperty(raw)               → AtlasPropertyImportResult
 *   2. runEngine(result.engineInput)           → EngineOutputV1
 *   3. buildReportSeedFromAtlasProperty(...)   → ReportSeed
 *   4. buildCanonicalReportPayload(seed)       → CanonicalReportPayloadV1
 *   5. reportApi.save(payload)                 → persisted
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { HandoffSource, ReportSeed } from '../types/atlasPropertyHandoff.types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildReportSeedFromAtlasProperty — assemble a ReportSeed from a canonical
 * handoff result and a completed engine output.
 *
 * The seed is used to build a CanonicalReportPayloadV1 for persistence.
 * See buildCanonicalReportPayload() in src/features/reports/adapters/ for
 * the next step.
 *
 * @param atlasProperty  The canonical property received at the handoff boundary.
 * @param engineInput    The partial engine input derived from the property.
 * @param engineOutput   The engine output produced after running the engine.
 * @param source         The handoff source tag to write into the report metadata.
 * @returns              A ReportSeed ready for the report persistence layer.
 */
export function buildReportSeedFromAtlasProperty(
  atlasProperty: AtlasPropertyV1,
  engineInput: Partial<EngineInputV2_3>,
  engineOutput: EngineOutputV1,
  source: HandoffSource,
): ReportSeed {
  return {
    atlasProperty,
    engineInput,
    engineOutput,
    source,
  };
}
