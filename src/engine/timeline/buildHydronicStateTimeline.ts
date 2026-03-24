/**
 * buildHydronicStateTimeline.ts — PR6: Hydronic family writer for the internal state timeline.
 *
 * Translates a `StoredDhwPhaseResult` into a `SystemStateTimeline`.
 *
 * The stored-water phase sequence maps onto the shared timeline contract as follows:
 *
 *   slotIndex  Phase                     SystemServiceMode    Notes
 *   ─────────  ────────────────────────  ───────────────────  ──────────────────────────────
 *   0          store_draw_active         store_draw_active     draw-off from cylinder
 *   1          recharge_decision         recharge_decision     only when reheat was evaluated
 *   2          recharge_active           recharge_active       only when reheat was triggered
 *   3          recharge_complete         recharge_complete     only when reheat was triggered
 *
 * Design rules (from PR6 spec):
 *   - draw-off changes store state (captured in storeStateSummary)
 *   - recharge decision is recorded distinctly from draw-off delivery
 *   - recharge active appears only when trigger conditions were met
 *   - no combi-only states appear in hydronic timelines (enforced by
 *     assertValidStateTimeline in SystemStateTimeline.ts)
 */

import type { StoredDhwPhaseResult, StoredDhwReheatReason } from '../modules/StoredDhwPhaseModel';
import type {
  TimelineApplianceFamily,
  SystemStateTick,
  SystemStateTimeline,
  StoreStateSummary,
  StateTransitionReason,
} from './SystemStateTimeline';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Delay (seconds) between the recharge decision tick and the recharge active tick.
 *
 * In practice the appliance may take a few seconds to respond to the cylinder
 * thermostat call.  A 1-second nominal offset separates the decision timestamp
 * from the active timestamp, ensuring the timeline is non-degenerate and the
 * two ticks remain visually distinct in any downstream consumer.
 */
const RECHARGE_DECISION_DELAY_S = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives a coarse `StoreStateSummary` from the store's usable volume
 * relative to the cylinder nominal volume.
 *
 *   available — usable fraction > 30 % of nominal
 *   partial   — usable fraction 1 – 30 % of nominal (at risk of shortfall)
 *   depleted  — usable fraction ≤ 0 (no usable hot water)
 */
function deriveStoreStateSummary(
  usableHotWaterLitres: number,
  cylinderVolumeLitres: number,
): StoreStateSummary {
  if (usableHotWaterLitres <= 0) return 'depleted';
  const usableFraction = usableHotWaterLitres / cylinderVolumeLitres;
  return usableFraction > 0.30 ? 'available' : 'partial';
}

/**
 * Maps a `StoredDhwReheatReason` to the corresponding `StateTransitionReason`.
 */
function reheatReasonToTransitionReason(
  reason: StoredDhwReheatReason,
): StateTransitionReason {
  switch (reason) {
    case 'thermostat_threshold':  return 'thermostat_threshold_crossed';
    case 'hysteresis_threshold':  return 'hysteresis_threshold_crossed';
    case 'scheduled_window':      return 'scheduled_window_active';
    case 'priority_reheat':       return 'priority_reheat_triggered';
  }
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `SystemStateTimeline` from a `StoredDhwPhaseResult`.
 *
 * The function:
 *   1. Emits a `store_draw_active` tick representing delivery from the cylinder.
 *   2. After the draw completes, emits a `recharge_decision` tick reflecting
 *      the control logic evaluation.
 *   3. If recharge was triggered, emits `recharge_active` and `recharge_complete`
 *      ticks using estimated timestamps derived from `recoveryRateLph`.
 *
 * Timestamp derivation:
 *   - `store_draw_active` starts at timestampS 0.
 *   - Subsequent ticks are offset by the draw duration, then by recovery time.
 *   - Draw duration = deliveredVolumeLitres / deliveredFlowLpm × 60 (seconds).
 *   - Recovery duration = estimatedRecoveryMinutes × 60 (seconds).
 *
 * @param phaseResult  The result of `runStoredDhwPhaseModel`.
 * @param family       The hydronic appliance family (never `'combi'`).
 */
export function buildHydronicStateTimeline(
  phaseResult: StoredDhwPhaseResult,
  family: TimelineApplianceFamily,
): SystemStateTimeline {
  const ticks: SystemStateTick[] = [];
  const { drawOffResult, cylinderVolumeLitres } = phaseResult;

  // ── Draw duration (seconds) ──────────────────────────────────────────────
  const drawFlowLpm = Math.max(drawOffResult.deliveredFlowLpm, 0.1);
  const drawDurationS = (drawOffResult.deliveredVolumeLitres / drawFlowLpm) * 60;

  // ── Store state before draw ──────────────────────────────────────────────
  const preDrawStoreSummary = deriveStoreStateSummary(
    phaseResult.initialStoreState.usableHotWaterLitres,
    cylinderVolumeLitres,
  );

  // ── Store state after draw ───────────────────────────────────────────────
  const postDrawStoreSummary = deriveStoreStateSummary(
    drawOffResult.postDrawStoreState.usableHotWaterLitres,
    cylinderVolumeLitres,
  );

  // ── Tick 0: store draw active ────────────────────────────────────────────
  ticks.push({
    slotIndex: 0,
    timestampS: 0,
    activeFamily: family,
    serviceMode: 'store_draw_active',
    chAvailable: true,
    dhwAvailable: true,
    storeStateSummary: preDrawStoreSummary,
    heatingInterrupted: false,
    activeLimiterIds: [],
    transitionReason: 'store_draw_started',
  });

  // ── Tick 1: recharge decision (always emitted after draw) ────────────────
  // The recharge_decision tick records that the control logic evaluated
  // whether recharge is required.  This is distinct from draw-off delivery
  // and is always emitted (PR6 requirement: recharge decision is recorded
  // distinctly from draw-off delivery).
  const rechargeTransitionReason: StateTransitionReason =
    drawOffResult.reheatTriggered && drawOffResult.reheatTriggerReason
      ? reheatReasonToTransitionReason(drawOffResult.reheatTriggerReason)
      : 'store_draw_complete';

  ticks.push({
    slotIndex: 1,
    timestampS: drawDurationS,
    activeFamily: family,
    serviceMode: 'recharge_decision',
    chAvailable: true,
    dhwAvailable: false,
    storeStateSummary: postDrawStoreSummary,
    heatingInterrupted: drawOffResult.chInterruptedByReheat,
    activeLimiterIds: [],
    transitionReason: rechargeTransitionReason,
  });

  // ── Ticks 2–3: recharge active + complete (only when recharge triggered) ──
  if (drawOffResult.reheatTriggered) {
    const recoveryS = drawOffResult.postDrawStoreState.estimatedRecoveryMinutes * 60;
    const rechargeStartS = drawDurationS + RECHARGE_DECISION_DELAY_S; // offset after recharge decision

    // Tick 2: recharge active
    ticks.push({
      slotIndex: 2,
      timestampS: rechargeStartS,
      activeFamily: family,
      serviceMode: 'recharge_active',
      chAvailable: !drawOffResult.chInterruptedByReheat,
      dhwAvailable: false,
      storeStateSummary: postDrawStoreSummary,
      heatingInterrupted: drawOffResult.chInterruptedByReheat,
      activeLimiterIds: [],
      transitionReason: 'recharge_started',
    });

    // Tick 3: recharge complete
    ticks.push({
      slotIndex: 3,
      timestampS: rechargeStartS + recoveryS,
      activeFamily: family,
      serviceMode: 'recharge_complete',
      chAvailable: true,
      dhwAvailable: true,   // store has returned to target temperature; DHW is available
      storeStateSummary: 'available',
      heatingInterrupted: false,
      activeLimiterIds: [],
      transitionReason: 'recharge_complete',
    });
  }

  return ticks;
}
