/**
 * CombiDhwPhaseModel.ts — PR5: Combi service-switching and direct-DHW phase model.
 *
 * Implements the core semantic correction for combi boiler DHW systems:
 *
 *   Combi sequence
 *   1.  CH active (space heating running)
 *   2.  flow detected (tap/shower opens)
 *   3.  CH interrupted (diverter valve switches to DHW circuit)
 *   4.  ignition / stabilisation (burner fires, HEX temperature rises to steady state)
 *   5.  direct DHW delivery (hot water served directly from appliance, not from a store)
 *   6.  purge / fan overrun (combustion gases cleared; burner off but fan continues)
 *   7.  CH return (diverter valve returns to CH circuit)
 *
 * Design rules:
 *   - tap performance comes from appliance transient + steady-state capability,
 *     not from a virtual store (Rule 1)
 *   - DHW demand always interrupts CH service via the diverter valve (Rule 2)
 *   - short draws (< 15 s) incur a warm-up penalty; the HEX never reaches
 *     steady-state condensing mode before the draw ends (Rule 3)
 *   - purge/fan overrun is combi-only behaviour; hydronic stored families must
 *     never emit this phase (Rule 4)
 *   - usedStoredDhwPath is always false — combi draws never come from a store (Rule 5)
 *
 * Stored systems are not served by this module — they use StoredDhwPhaseModel exclusively.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../utils/efficiency';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Seconds from tap-open until the combi heat exchanger reaches steady-state
 * delivery temperature.
 *
 * Mirrors the existing ramp-phase model in CombiDhwModule:
 *   ignition_purge    0 –  2 s
 *   temperature_ramp  2 –  6 s
 *   stabilising       6 – 10 s
 *   steady           10 s +
 */
const STEADY_STATE_DELIVERY_S = 10;

/**
 * Threshold below which a draw is classified as "short" and the warmup
 * overhead dominates useful delivery.
 *
 * Aligns with the existing CombiStressModule short-draw definition:
 * draws < 15 seconds end before the HEX reaches steady-state condensing mode,
 * collapsing effective efficiency to ~28 %.
 */
const SHORT_DRAW_THRESHOLD_S = 15;

/**
 * Effective efficiency for a short draw (draw ends before steady-state delivery).
 *
 * The unit never reaches steady-state condensing mode for draws shorter than
 * the warm-up period. Source: CombiStressModule SHORT_DRAW_EFFICIENCY_PCT.
 */
const SHORT_DRAW_EFFICIENCY_PCT = 28;

/**
 * Fan overrun duration (seconds) after the combi burner cuts out following a DHW draw.
 *
 * Represents the post-purge cycle: the induced-draught fan continues to run
 * to clear residual combustion gases from the heat exchanger and flue, ensuring
 * safe ignition on the next demand cycle.
 *
 * Typical UK combi value: 30 seconds.
 */
const COMBI_PURGE_OVERRUN_S = 30;

/** Default tap target temperature (°C). */
const DEFAULT_TAP_TARGET_TEMP_C = 40;

/** Default cold mains temperature (°C). */
const DEFAULT_COLD_WATER_TEMP_C = 10;

/**
 * Maximum occupancy count used when scaling the representative draw volume.
 *
 * Caps at 3 to represent the practical peak demand for a combi shower scenario:
 * beyond 3 concurrent occupants the combi simultaneous-demand gate in
 * CombiDhwModuleV1 already flags a hard failure, so scaling above this
 * threshold adds no additional diagnostic value.
 */
const MAX_OCCUPANCY_FOR_DRAW_SCALING = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Discrete phase states that occur during a combi DHW service event.
 *
 *   ch_active           — space heating is running (baseline state before request)
 *   dhw_request         — tap/shower opens; DHW demand is detected
 *   ch_interrupted      — diverter valve switches from CH to DHW circuit
 *   ignition_active     — burner fires; heat exchanger temperature rising toward steady state
 *   delivery_active     — steady-state DHW delivery: hot water at target temperature
 *   purge_active        — fan overrun after burner cut-out (post-purge cycle)
 *   return_to_ch_pending — diverter valve returning to CH position; CH can resume
 */
export type CombiDhwPhaseState =
  | 'ch_active'
  | 'dhw_request'
  | 'ch_interrupted'
  | 'ignition_active'
  | 'delivery_active'
  | 'purge_active'
  | 'return_to_ch_pending';

/**
 * A single timed phase event in the combi DHW service sequence.
 */
export interface CombiPhaseEvent {
  /** Phase that was active during this event. */
  phase: CombiDhwPhaseState;
  /** Elapsed seconds from DHW request (tap open) when this phase started. */
  startS: number;
  /** Duration of this phase (seconds). 0 for instantaneous transition events. */
  durationS: number;
}

/**
 * Result of modelling a single direct DHW draw from a combi boiler.
 *
 * The key invariant: delivery comes directly from the appliance transient
 * response — not from a store or cylinder.
 */
export interface CombiDrawOffResult {
  /**
   * Volume of hot water delivered over the draw duration (litres).
   *
   * Equal to drawVolumeLitres: for a combi the flow is direct appliance output,
   * not store-limited. Volume shortfall is captured in deliveredTempC instead.
   */
  deliveredVolumeLitres: number;

  /**
   * Volumetric flow rate at the tap outlet (L/min).
   *
   * Equals the requested draw flow rate — for combi systems the flow is
   * mains-pressure-determined at the outlet, not restricted by a cylinder.
   */
  deliveredFlowLpm: number;

  /**
   * Representative delivery temperature at the tap outlet (°C).
   *
   * Equals tapTargetTempC when steady state was reached.
   * Below tapTargetTempC for very short draws where the HEX temperature
   * never reached the target (average of warm-up phase: (cold + target) / 2).
   */
  deliveredTempC: number;

  /**
   * Seconds from tap-open before steady-state delivery temperature was reached.
   *
   * Equal to STEADY_STATE_DELIVERY_S (10 s) when the draw is long enough;
   * equal to the draw duration when the draw ended before steady state.
   */
  warmupSeconds: number;

  /**
   * Whether the draw lasted long enough to reach steady-state delivery.
   *
   * False for draws shorter than STEADY_STATE_DELIVERY_S (10 s).
   */
  steadyStateReached: boolean;

  /**
   * Duration of the fan overrun / post-purge cycle after delivery ended (seconds).
   *
   * Combi-only behaviour: the induced-draught fan continues to run after the
   * burner cuts out to clear residual combustion gases.
   */
  purgeSeconds: number;

  /**
   * Whether space heating (CH) was active when the DHW request arrived and
   * was consequently interrupted by the diverter valve switching to DHW mode.
   *
   * True only when simultaneousChActive is true in the phase input.
   */
  chInterruptionOccurred: boolean;
}

/**
 * Top-level result produced by `runCombiDhwPhaseModel`.
 *
 * Captures the full combi DHW service-switching sequence: CH interruption,
 * ignition/stabilisation, direct delivery, and purge/overrun.
 */
export interface CombiDhwPhaseResult {
  /**
   * Ordered sequence of phase events from DHW request through return-to-CH.
   *
   * Timestamps are relative to the DHW request (tap-open = 0 s).
   */
  phaseTimeline: CombiPhaseEvent[];

  /**
   * Result of the direct DHW draw-off from the combi appliance.
   */
  drawOffResult: CombiDrawOffResult;

  /**
   * Whether a short-draw transient penalty was applied to this draw event.
   *
   * True when the total draw duration is < SHORT_DRAW_THRESHOLD_S (15 s).
   * Short draws end before the HEX reaches steady-state condensing mode,
   * meaning most of the action is warm-up/purge overhead rather than
   * useful hot-water delivery.
   */
  shortDrawPenaltyApplied: boolean;

  /**
   * Effective combi efficiency for this draw event (percentage, 0–99).
   *
   * Nominal steady-state efficiency (~92 %) when the draw reaches steady state.
   * Reduced to ~28 % for short draws (see shortDrawPenaltyApplied).
   */
  effectiveEfficiencyPct: number;

  /**
   * Invariant marker: combi direct-DHW path never uses the stored-water phase model.
   *
   * This field is always `false`. It exists as a machine-checkable assertion
   * that the stored-water draw-off path was not invoked.
   */
  usedStoredDhwPath: false;
}

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Input parameters for `runCombiDhwPhaseModel`.
 *
 * Callers (the combi runner) should derive these from `EngineInputV2_3` via
 * `adaptEngineInputToCombiPhase`.  Direct construction is supported for testing.
 */
export interface CombiDhwPhaseInput {
  /** Volume of hot water requested at the tap (litres). */
  drawVolumeLitres: number;
  /** Draw flow rate at the tap outlet (L/min). Must be > 0. */
  drawFlowLpm: number;
  /** Target tap outlet temperature (°C). Default: 40. */
  tapTargetTempC?: number;
  /** Cold mains temperature (°C). Default: 10. */
  coldWaterTempC?: number;
  /** Whether CH is currently active when the DHW request arrives. Default: false. */
  simultaneousChActive?: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a `CombiDhwPhaseInput` from an `EngineInputV2_3`.
 *
 * This adapter centralises the derivation logic so that the combi runner does not
 * duplicate it.
 *
 * @param input  Engine input from the survey layer.
 */
export function adaptEngineInputToCombiPhase(input: EngineInputV2_3): CombiDhwPhaseInput {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;

  // Representative peak draw: occupancy-weighted morning shower event.
  // 9 L/min at 6 minutes duration = 54 L (standard UK shower peak draw).
  const drawFlowLpm = 9;
  const occupancyCount = input.occupancyCount ?? 2;
  // Scale draw volume with occupancy: one shower per occupant up to a practical maximum.
  const showerDurationMinutes = 6;
  const drawVolumeLitres = drawFlowLpm * showerDurationMinutes * Math.min(occupancyCount, MAX_OCCUPANCY_FOR_DRAW_SCALING);

  // CH is active when the DHW request arrives if the household has central heating demand.
  // Use heatLossWatts as a proxy: any meaningful heat loss implies CH may be running.
  const simultaneousChActive = (input.heatLossWatts ?? 0) > 0;

  return {
    drawVolumeLitres,
    drawFlowLpm,
    tapTargetTempC,
    coldWaterTempC,
    simultaneousChActive,
  };
}

/**
 * Model the combi DHW service-switching sequence as discrete phases.
 *
 * Phase 1 — CH interruption:
 *   When CH is active, the diverter valve switches to DHW mode, interrupting
 *   space heating.
 *
 * Phase 2 — Ignition / stabilisation:
 *   The burner fires and the heat exchanger temperature rises toward the target
 *   delivery temperature.  No useful hot water is delivered yet.
 *
 * Phase 3 — Direct DHW delivery:
 *   Hot water is served directly from the appliance (not from a store).
 *   This phase begins only when the HEX reaches steady-state temperature (10 s).
 *   For short draws (< 10 s) this phase does not occur.
 *
 * Phase 4 — Purge / fan overrun:
 *   After the draw ends, the fan continues to run to clear combustion gases.
 *   This is combi-only behaviour.
 *
 * Phase 5 — Return to CH:
 *   Diverter valve returns to CH position; space heating can resume.
 *
 * @param input  Phase model inputs (see `CombiDhwPhaseInput`).
 * @returns      `CombiDhwPhaseResult` describing the full service-switching sequence.
 */
export function runCombiDhwPhaseModel(input: CombiDhwPhaseInput): CombiDhwPhaseResult {
  const tapTargetTempC = input.tapTargetTempC ?? DEFAULT_TAP_TARGET_TEMP_C;
  const coldWaterTempC = input.coldWaterTempC ?? DEFAULT_COLD_WATER_TEMP_C;
  const simultaneousChActive = input.simultaneousChActive ?? false;

  // Guard against zero or negative flow rate
  const drawFlowLpm = Math.max(input.drawFlowLpm, 0.1);

  // ── Draw duration ─────────────────────────────────────────────────────────
  // Total time the tap is open (seconds).
  const drawDurationS = (input.drawVolumeLitres / drawFlowLpm) * 60;

  // ── Phase timing ──────────────────────────────────────────────────────────
  const warmupDurationS = Math.min(STEADY_STATE_DELIVERY_S, drawDurationS);
  const steadyDeliveryDurationS = Math.max(0, drawDurationS - STEADY_STATE_DELIVERY_S);
  const steadyStateReached = drawDurationS >= STEADY_STATE_DELIVERY_S;
  const shortDrawPenaltyApplied = drawDurationS < SHORT_DRAW_THRESHOLD_S;

  // ── Phase timeline ────────────────────────────────────────────────────────
  const phaseTimeline: CombiPhaseEvent[] = [];

  // DHW request: tap opens (instantaneous trigger event)
  phaseTimeline.push({
    phase: 'dhw_request',
    startS: 0,
    durationS: 0,
  });

  // CH interruption: diverter valve switches (only relevant when CH was active)
  if (simultaneousChActive) {
    phaseTimeline.push({
      phase: 'ch_interrupted',
      startS: 0,
      durationS: 0,
    });
  }

  // Ignition / stabilisation phase
  phaseTimeline.push({
    phase: 'ignition_active',
    startS: 0,
    durationS: warmupDurationS,
  });

  // Steady-state delivery phase (only present when draw is long enough)
  if (steadyStateReached) {
    phaseTimeline.push({
      phase: 'delivery_active',
      startS: STEADY_STATE_DELIVERY_S,
      durationS: steadyDeliveryDurationS,
    });
  }

  // Purge / fan overrun (always present — combi-only behaviour)
  phaseTimeline.push({
    phase: 'purge_active',
    startS: drawDurationS,
    durationS: COMBI_PURGE_OVERRUN_S,
  });

  // Return to CH pending (CH can resume after purge completes)
  phaseTimeline.push({
    phase: 'return_to_ch_pending',
    startS: drawDurationS + COMBI_PURGE_OVERRUN_S,
    durationS: 0,
  });

  // ── Delivered temperature ─────────────────────────────────────────────────
  // When steady state is reached the HEX delivers at the target temperature.
  // For short draws (warmup only), the average delivery temperature is the
  // midpoint of the warm-up ramp: (cold + target) / 2.
  const warmupAverageTempC = (coldWaterTempC + tapTargetTempC) / 2;
  const deliveredTempC = steadyStateReached ? tapTargetTempC : warmupAverageTempC;

  // ── Draw-off result ───────────────────────────────────────────────────────
  const drawOffResult: CombiDrawOffResult = {
    deliveredVolumeLitres: input.drawVolumeLitres,
    deliveredFlowLpm: drawFlowLpm,
    deliveredTempC,
    warmupSeconds: warmupDurationS,
    steadyStateReached,
    purgeSeconds: COMBI_PURGE_OVERRUN_S,
    chInterruptionOccurred: simultaneousChActive,
  };

  // ── Effective efficiency ──────────────────────────────────────────────────
  // Short draws never allow the HEX to enter steady-state condensing mode.
  // The unit incurs full warm-up overhead for minimal useful delivery.
  const effectiveEfficiencyPct = shortDrawPenaltyApplied
    ? SHORT_DRAW_EFFICIENCY_PCT
    : DEFAULT_NOMINAL_EFFICIENCY_PCT;

  return {
    phaseTimeline,
    drawOffResult,
    shortDrawPenaltyApplied,
    effectiveEfficiencyPct,
    usedStoredDhwPath: false,
  };
}
