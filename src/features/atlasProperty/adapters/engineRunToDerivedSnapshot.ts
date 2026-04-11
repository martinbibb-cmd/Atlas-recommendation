/**
 * engineRunToDerivedSnapshot.ts
 *
 * Converts an engine run result into the safe derived snapshot stored under
 * AtlasPropertyV1.derived and AtlasPropertyV1.recommendations.
 *
 * Architecture note
 * ─────────────────
 * The engine output is rich and contains internal simulation runtime state.
 * This adapter distils only the safe, stable, cross-app summary fields:
 *
 *   derived.heatLoss    — peak heat loss in watts (from engine input, not output)
 *   derived.hydraulics  — mains pressure / flow (from engine input)
 *   derived.engineInputSnapshot — opaque key-value snapshot of the inputs used
 *
 *   recommendations.engineRef  — stable reference to this engine run
 *   recommendations.lastRunAt  — ISO-8601 run timestamp
 *   recommendations.status     — 'draft' (awaiting engineer review)
 *   recommendations.items      — one summary item per viable engine option
 *
 * What this adapter must NOT include:
 *   - Full simulator UI state or rendering data
 *   - Internal engine runtime object graphs
 *   - Report rendering state
 *   - Dev-only debug fields
 */

import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type {
  DerivedModelV1,
  RecommendationWorkspaceV1,
  RecommendationItemSummaryV1,
} from '@atlas/contracts';
import type { EngineRunMeta } from '../types/atlasPropertyAdapter.types';

// ─── Option-to-category mapping ───────────────────────────────────────────────

type RecommendationCategory = RecommendationItemSummaryV1['category'];

function mapOptionIdToCategory(optionId: string): RecommendationCategory {
  switch (optionId) {
    case 'ashp':            return 'air_source_heat_pump';
    case 'stored_vented':   return 'hot_water_cylinder';
    case 'stored_unvented': return 'hot_water_cylinder';
    case 'combi':           return 'replacement_boiler';
    case 'regular_vented':  return 'replacement_boiler';
    case 'system_unvented': return 'replacement_boiler';
    default:                return 'other';
  }
}

// ─── Status mapping ───────────────────────────────────────────────────────────

type ItemStatus = RecommendationItemSummaryV1['status'];

function mapOptionStatusToItemStatus(
  _status: 'viable' | 'caution' | 'rejected',
): ItemStatus {
  // All options from the engine start as 'draft' regardless of viability.
  // The engineer review step will update status to 'accepted' or 'rejected'.
  return 'draft';
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Result shape returned by engineRunToDerivedSnapshot.
 */
export interface EngineRunDerivedSnapshot {
  /** Derived calculation fields to store under AtlasPropertyV1.derived. */
  derived: Partial<DerivedModelV1>;
  /** Recommendation workspace to store under AtlasPropertyV1.recommendations. */
  recommendations: RecommendationWorkspaceV1;
}

/**
 * Distils a safe derived snapshot from an engine run result.
 *
 * Only stable, cross-app summary fields are included.  Internal engine
 * runtime state, simulation UI state, and report rendering data are excluded.
 *
 * @param output  The EngineOutputV1 produced by the engine run.
 * @param meta    Metadata about the run (ID, timestamp, inputs used).
 * @returns       Partial derived and recommendations objects suitable for
 *                storage in AtlasPropertyV1.
 */
export function engineRunToDerivedSnapshot(
  output: EngineOutputV1,
  meta: EngineRunMeta,
): EngineRunDerivedSnapshot {
  const ranAt = meta.ranAt ?? new Date().toISOString();

  // ── Derived model ──────────────────────────────────────────────────────────

  const derived: Partial<DerivedModelV1> = {
    engineInputSnapshot: meta.usedInput,
  };

  // Populate heat-loss and hydraulics from the used engine input (the engine
  // receives these as inputs, not outputs — so we echo them back as derived
  // fields for cross-app access).
  if (meta.usedInput != null) {
    const input = meta.usedInput as Record<string, unknown>;

    // Heat loss: flat EngineInputV2_3 carries heatLossWatts at the top level
    const peakWatts = typeof input['heatLossWatts'] === 'number'
      ? input['heatLossWatts']
      : undefined;

    if (peakWatts != null) {
      derived.heatLoss = {
        peakWatts: {
          value:      peakWatts,
          source:     'derived',
          confidence: 'medium',
        },
      };
    }

    // Hydraulics
    const dynamicBar = typeof input['dynamicMainsPressureBar'] === 'number'
      ? input['dynamicMainsPressureBar']
      : typeof input['dynamicMainsPressure'] === 'number'
        ? input['dynamicMainsPressure']
        : undefined;

    const flowLpm = typeof input['mainsDynamicFlowLpm'] === 'number'
      ? input['mainsDynamicFlowLpm']
      : undefined;

    if (dynamicBar != null || flowLpm != null) {
      derived.hydraulics = {
        dynamicPressureBar: dynamicBar != null
          ? { value: dynamicBar, source: 'measured', confidence: 'high' }
          : undefined,
        mainsFlowLpm: flowLpm != null
          ? { value: flowLpm, source: 'measured', confidence: 'high' }
          : undefined,
      };
    }
  }

  // ── Recommendation workspace ───────────────────────────────────────────────

  const items: RecommendationItemSummaryV1[] = (output.options ?? []).map((option, index) => ({
    itemId:    `${meta.runId}:${option.id}`,
    category:  mapOptionIdToCategory(option.id),
    label:     option.label,
    rank:      index + 1,
    status:    mapOptionStatusToItemStatus(option.status),
  }));

  // Prefer selected plan primary option as rank 1 when plans data is present
  const primaryOptionId = output.recommendation?.primary;
  if (primaryOptionId) {
    const primaryIndex = items.findIndex(i => i.itemId.endsWith(`:${primaryOptionId}`));
    if (primaryIndex > 0) {
      const [primaryItem] = items.splice(primaryIndex, 1);
      items.unshift({ ...primaryItem, rank: 1 });
      items.forEach((item, idx) => { item.rank = idx + 1; });
    }
  }

  const recommendations: RecommendationWorkspaceV1 = {
    engineRef:  meta.runId,
    lastRunAt:  ranAt,
    status:     'draft',
    items,
    engineMeta: {
      contractVersion: output.meta?.contractVersion,
      engineVersion:   output.meta?.engineVersion,
      confidence:      output.meta?.confidence?.level,
    },
  };

  return { derived, recommendations };
}
