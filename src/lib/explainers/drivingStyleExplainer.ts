/**
 * drivingStyleExplainer.ts
 *
 * Lane-state generation logic for DrivingStylePhysicsExplainer.
 *
 * Produces a declarative snapshot of each lane's state from a set of household
 * inputs.  The component consumes these states without performing any physics
 * calculations itself — keeping UI logic separate from physics reasoning.
 *
 * Physics mapping:
 *   combi     — purge / startup loss, stop/start cycling, one-tap-at-a-time limit
 *   system    — decoupled generation, longer steady burner runs
 *   mixergy   — stratified storage, smart control smoothing, lowest gas use
 *   heatpump  — low-power continuous, high efficiency, slower recovery
 */

import type {
  LaneState,
  LaneEvent,
  DrivetrainId,
  DrivingStyleExplainerInput,
  LaneMotionState,
} from '../../types/explainers';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Progress fraction at which gas lanes consider themselves "finished". */
const GAS_FINISH_PROGRESS = 1.0;

/**
 * Heat pump finishes later than gas lanes — represents slower DHW recovery /
 * comfort recovery from setback.  Values > 1.0 means the token overruns the
 * visual finish line at the time gas lanes arrive.
 */
const HP_FINISH_PROGRESS = 0.88;

/** Base energy levels at finish for each drivetrain. */
const BASE_ENERGY_AT_FINISH: Record<DrivetrainId, number> = {
  combi:    0.28,
  system:   0.44,
  mixergy:  0.56,
  heatpump: 0.72,
};

/** Energy rank (1 = most efficient) for each drivetrain. */
const ENERGY_RANK: Record<DrivetrainId, 1 | 2 | 3 | 4> = {
  heatpump: 1,
  mixergy:  2,
  system:   3,
  combi:    4,
};

/** Short captions for each lane. */
const CAPTIONS: Record<DrivetrainId, string> = {
  combi:    'Fast launch, lots of stop-start.',
  system:   'Steadier output with stored hot water.',
  mixergy:  'Smarter stored hot water, less wasted effort.',
  heatpump: 'Lowest-energy route, but slower to accelerate.',
};

/** Display labels for each lane. */
const LABELS: Record<DrivetrainId, string> = {
  combi:    'Boy Racer / Hot Hatch',
  system:   'Mondeo',
  mixergy:  'Hyper-miler',
  heatpump: 'Electric Hyper-miler',
};

// ─── Motion state derivation ──────────────────────────────────────────────────

/**
 * Determines the combi motion state.
 *
 * The combi lane starts with a brief reversal (purge/startup) then accelerates
 * hard.  When concurrent outlets are >= 2 it switches into warning/braking.
 */
function combiMotionState(
  concurrentOutlets: number,
  phase: 'launch' | 'cruise' | 'finish',
): LaneMotionState {
  if (phase === 'finish') return 'finished';
  if (concurrentOutlets >= 2) return 'warning';
  if (phase === 'launch') return 'reversing';
  return 'cruising';
}

/**
 * Determines the system/regular boiler motion state.
 * No reversal, steady cruise, no warning.
 */
function systemMotionState(phase: 'launch' | 'cruise' | 'finish'): LaneMotionState {
  if (phase === 'finish') return 'finished';
  return 'cruising';
}

/**
 * Determines the Mixergy motion state.
 * Smoothest gas lane — always cruising except at finish.
 */
function mixergyMotionState(phase: 'launch' | 'cruise' | 'finish'): LaneMotionState {
  if (phase === 'finish') return 'finished';
  return 'cruising';
}

/**
 * Determines the heat pump motion state.
 * Slow launch, then smooth cruise.
 */
function heatpumpMotionState(phase: 'launch' | 'cruise' | 'finish'): LaneMotionState {
  if (phase === 'finish') return 'finished';
  if (phase === 'launch') return 'launching';
  return 'cruising';
}

// ─── Progress derivation ──────────────────────────────────────────────────────

/**
 * Adjusts base energy levels for concurrent outlets and controls quality.
 * More concurrent outlets drains combi faster; better controls reduces
 * Mixergy waste.
 */
function adjustedEnergyLevel(
  id: DrivetrainId,
  base: number,
  input: DrivingStyleExplainerInput,
): number {
  let level = base;

  if (id === 'combi') {
    // Each additional concurrent outlet beyond 1 accelerates fuel drain.
    const extra = Math.max(0, input.peakConcurrentOutlets - 1);
    level -= extra * 0.08;
  }

  if (id === 'mixergy') {
    // Better controls quality reduces waste further.
    const controlsBonus =
      input.controlsQuality === 'excellent' ? 0.06
      : input.controlsQuality === 'good'    ? 0.03
      : 0;
    level += controlsBonus;
  }

  // Clamp to [0.10, 0.95]
  return Math.min(0.95, Math.max(0.10, level));
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds the final-state snapshot for all four lanes from household inputs.
 *
 * The "phase" parameter represents where in the animation timeline we are:
 *   'launch'  — just started, combi is still reversing
 *   'cruise'  — mid-race, all lanes moving forward
 *   'finish'  — gas lanes have arrived; heat pump is still running
 *
 * @param input   Resolved household inputs.
 * @param phase   Current animation phase (defaults to 'finish' for static/compact use).
 */
export function buildDrivingStyleLaneStates(
  input: DrivingStyleExplainerInput,
  phase: 'launch' | 'cruise' | 'finish' = 'finish',
): LaneState[] {
  const drivetrains: DrivetrainId[] = ['combi', 'system', 'mixergy', 'heatpump'];

  return drivetrains.map((id) => {
    const baseEnergy = BASE_ENERGY_AT_FINISH[id];
    const energyLevel = adjustedEnergyLevel(id, baseEnergy, input);

    const progress =
      id === 'heatpump'
        ? phase === 'finish' ? HP_FINISH_PROGRESS : HP_FINISH_PROGRESS * 0.7
        : phase === 'finish' ? GAS_FINISH_PROGRESS
        : phase === 'cruise' ? 0.55
        : 0.0;

    const motionState: LaneMotionState =
      id === 'combi'    ? combiMotionState(input.peakConcurrentOutlets, phase)
      : id === 'system'   ? systemMotionState(phase)
      : id === 'mixergy'  ? mixergyMotionState(phase)
      : heatpumpMotionState(phase);

    const showConcurrentWarning =
      id === 'combi' && input.peakConcurrentOutlets >= 2;

    return {
      id,
      label:    LABELS[id],
      caption:  CAPTIONS[id],
      motionState,
      progress,
      energyLevel,
      energyRank: ENERGY_RANK[id],
      showConcurrentWarning,
    };
  });
}

// ─── Event builder ────────────────────────────────────────────────────────────

/**
 * Returns the list of labelled events to overlay on the race animation.
 * Events are sorted ascending by atProgress so the component can render them
 * in order.
 *
 * Events are conditional on household inputs:
 *   - DHW start (tap opened) always appears
 *   - Purge/warm-up always appears on the combi lane
 *   - Second tap event only appears when peakConcurrentOutlets >= 2
 *   - "Stored hot water buffers demand" appears for system/mixergy lanes
 *   - "Low-and-slow recovery" appears on the heat pump lane
 */
export function buildDrivingStyleEvents(
  input: DrivingStyleExplainerInput,
): LaneEvent[] {
  const events: LaneEvent[] = [
    { atProgress: 0.05, lane: 'combi',   label: 'Tap opened' },
    { atProgress: 0.10, lane: 'combi',   label: 'Purge / warm-up' },
    { atProgress: 0.15, lane: 'system',  label: 'Stored hot water buffers demand' },
    { atProgress: 0.15, lane: 'mixergy', label: 'Stored hot water buffers demand' },
    { atProgress: 0.20, lane: 'heatpump', label: 'Low-and-slow recovery' },
  ];

  if (input.peakConcurrentOutlets >= 2) {
    events.push({
      atProgress: 0.40,
      lane: 'combi',
      label: 'Second tap opened',
    });
  }

  return events.sort((a, b) => a.atProgress - b.atProgress);
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Returns a resolved DrivingStyleExplainerInput from partial component props,
 * filling missing fields with sensible defaults.
 */
export function resolveExplainerInput(partial: {
  peakConcurrentOutlets?: number;
  occupancySignature?: string;
  controlsQuality?: string;
  hasMixergy?: boolean;
}): DrivingStyleExplainerInput {
  return {
    peakConcurrentOutlets: partial.peakConcurrentOutlets ?? 1,
    occupancySignature:
      (partial.occupancySignature as DrivingStyleExplainerInput['occupancySignature']) ??
      'steady',
    controlsQuality:
      (partial.controlsQuality as DrivingStyleExplainerInput['controlsQuality']) ??
      'basic',
    hasMixergy: partial.hasMixergy ?? false,
  };
}
