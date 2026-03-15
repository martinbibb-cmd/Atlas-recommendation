/**
 * adaptFloorplanToAtlasInputs.ts
 *
 * Canonical adapter: converts DerivedFloorplanOutput into Atlas-facing inputs.
 *
 * The adapter output is consumed by:
 *  - buildAdviceFromCompare  (confidence uplift, siting/emitter hints)
 *  - DecisionSynthesisPage   (UI provenance banners)
 *
 * Design rules:
 *  - No Math.random() — all outputs deterministic from the same input.
 *  - Pipe estimates are planning hints only — do not claim route precision.
 *  - Graceful fallback: absent or incomplete floor plans return isReliable=false.
 *  - Heat-loss aggregation is additive across all heated rooms.
 */

import type {
  DerivedFloorplanOutput,
  SitingFlag,
} from '../../components/floorplan/floorplanDerivations';

// ─── Output types ─────────────────────────────────────────────────────────────

/** Per-room emitter adequacy assessment derived from room heat-loss targets. */
export interface EmitterAdequacyHint {
  roomId: string;
  roomName: string;
  /** Suggested minimum emitter output to meet room fabric heat loss (kW). */
  suggestedRadiatorKw: number;
  /**
   * Actual installed emitter output for the room (kW), summed from placed
   * emitter nodes that carry an emitterOutputKw value.
   * Undefined when no such nodes are present.
   */
  roomEmitterOutputKw?: number;
  /**
   * Adequacy assessment for this room.
   *
   * When installed emitter output data is available (roomEmitterOutputKw is set):
   *   'undersized' — coverage ratio < 1 (emitters cannot meet room heat demand).
   *   'oversized'  — coverage ratio > 1.8 (emitters far exceed room heat demand).
   *   'adequate'   — coverage ratio 1–1.8.
   *
   * When no installed output data is available, falls back to the suggested
   * output heuristic:
   *   'review_recommended' — suggestedRadiatorKw ≥ 2.5 kW.
   *   'adequate'           — suggestedRadiatorKw < 2.5 kW.
   */
  status: 'adequate' | 'review_recommended' | 'undersized' | 'oversized';
}

/** Aggregated siting constraint summary for one object type. */
export interface SitingConstraintHint {
  objectType: SitingFlag['objectType'];
  /** true when any placed item of this type carries a warn status. */
  hasWarning: boolean;
  /** Human-readable warning messages collected from placement flags. */
  warningMessages: string[];
}

/** Pipe length estimate for planning use only — not a precise route quantity. */
export interface PipeLengthHints {
  /** Estimated total pipe length (m). */
  totalEstimateM: number;
  /** Human-readable planning label. */
  label: string;
}

/**
 * Atlas-facing inputs derived from a DerivedFloorplanOutput.
 * All fields are populated regardless of reliability;
 * consumers MUST check isReliable before treating values as authoritative.
 */
export interface AtlasFloorplanInputs {
  /** Sum of all heated-room fabric heat losses (kW). Higher confidence than survey-only preset. */
  refinedHeatLossKw: number;
  /** Per-room emitter adequacy hints derived from room heat-loss targets. */
  emitterAdequacyHints: EmitterAdequacyHint[];
  /** Per-room heat loss breakdown — direct passthrough for downstream use. */
  roomHeatLossBreakdown: Array<{ roomId: string; roomName: string; heatLossKw: number }>;
  /** Aggregated siting constraint hints per object type. */
  sitingConstraintHints: SitingConstraintHint[];
  /** Pipe length estimates for planning purposes only. */
  pipeLengthEstimateHints: PipeLengthHints;
  /**
   * Whether the floor plan provides enough coverage to act as a reliable Atlas input.
   * true when at least one heated room with non-zero heat loss is present.
   * Consumers MUST fall back to survey-only estimates when false.
   */
  isReliable: boolean;
}

// ─── Internal thresholds ──────────────────────────────────────────────────────

/**
 * Suggested radiator output (kW) above which a room is flagged for review.
 * Rooms below this threshold are considered "adequate" for planning purposes.
 */
const EMITTER_REVIEW_THRESHOLD_KW = 2.5;

/**
 * Coverage ratio below which the installed emitter output is considered
 * undersized relative to the room heat demand.
 */
const COVERAGE_UNDERSIZED_THRESHOLD = 1.0;

/**
 * Coverage ratio above which the installed emitter output is considered
 * oversized relative to the room heat demand.
 */
const COVERAGE_OVERSIZED_THRESHOLD = 1.8;

// ─── Object types to check ────────────────────────────────────────────────────

const SITING_OBJECT_TYPES: ReadonlyArray<SitingFlag['objectType']> = [
  'boiler',
  'cylinder',
  'heat_pump',
];

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Convert DerivedFloorplanOutput into Atlas-facing planning inputs.
 *
 * When the floor plan is empty or has no heated rooms,
 * isReliable is false and all numeric outputs are zero.
 * Consumers must fall back to survey-only estimates in that case.
 *
 * @param derived - The output of deriveFloorplanOutputs().
 * @returns AtlasFloorplanInputs ready for use by buildAdviceFromCompare.
 */
export function adaptFloorplanToAtlasInputs(
  derived: DerivedFloorplanOutput,
): AtlasFloorplanInputs {
  // ── Heat-loss refinement ─────────────────────────────────────────────────
  const refinedHeatLossKw = Number(
    derived.roomHeatLossKw
      .reduce((sum, r) => sum + r.heatLossKw, 0)
      .toFixed(2),
  );

  // ── Emitter adequacy hints ───────────────────────────────────────────────
  const emitterAdequacyHints: EmitterAdequacyHint[] = derived.emitterSizing.map(
    (item) => {
      const heatLossKw =
        derived.roomHeatLossKw.find((r) => r.roomId === item.roomId)?.heatLossKw ?? 0;

      // When installed emitter output is known, use the coverage ratio.
      if (item.roomEmitterOutputKw !== null && heatLossKw > 0) {
        const coverageRatio = item.roomEmitterOutputKw / heatLossKw;
        let status: EmitterAdequacyHint['status'];
        if (coverageRatio < COVERAGE_UNDERSIZED_THRESHOLD) {
          status = 'undersized';
        } else if (coverageRatio > COVERAGE_OVERSIZED_THRESHOLD) {
          status = 'oversized';
        } else {
          status = 'adequate';
        }
        return {
          roomId: item.roomId,
          roomName: item.roomName,
          suggestedRadiatorKw: item.suggestedRadiatorKw,
          roomEmitterOutputKw: item.roomEmitterOutputKw,
          status,
        };
      }

      // Fallback: no installed output data — use suggestedRadiatorKw heuristic.
      return {
        roomId: item.roomId,
        roomName: item.roomName,
        suggestedRadiatorKw: item.suggestedRadiatorKw,
        status:
          item.suggestedRadiatorKw >= EMITTER_REVIEW_THRESHOLD_KW
            ? 'review_recommended'
            : 'adequate',
      };
    },
  );

  // ── Siting constraint hints ──────────────────────────────────────────────
  const sitingConstraintHints: SitingConstraintHint[] = SITING_OBJECT_TYPES
    .filter((objectType) =>
      derived.sitingFlags.some((f) => f.objectType === objectType),
    )
    .map((objectType) => {
      const warnings = derived.sitingFlags.filter(
        (f) => f.objectType === objectType && f.status === 'warn',
      );
      return {
        objectType,
        hasWarning: warnings.length > 0,
        warningMessages: warnings.map((f) => f.message),
      };
    });

  // ── Pipe length hints ────────────────────────────────────────────────────
  const pipeLengthEstimateHints: PipeLengthHints = {
    totalEstimateM: derived.totalPipeLengthM,
    label: `Estimated pipe run: ~${derived.totalPipeLengthM} m (planning estimate only)`,
  };

  // ── Reliability check ────────────────────────────────────────────────────
  const isReliable = derived.roomHeatLossKw.length > 0 && refinedHeatLossKw > 0;

  return {
    refinedHeatLossKw,
    emitterAdequacyHints,
    roomHeatLossBreakdown: derived.roomHeatLossKw,
    sitingConstraintHints,
    pipeLengthEstimateHints,
    isReliable,
  };
}
