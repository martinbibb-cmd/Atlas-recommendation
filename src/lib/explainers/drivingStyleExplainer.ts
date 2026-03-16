/**
 * drivingStyleExplainer.ts
 *
 * Static row-descriptor generation for DrivingStylePhysicsExplainer.
 *
 * Produces a declarative snapshot of each row's descriptor from a set of
 * household inputs.  The component consumes these descriptors without
 * performing any physics calculations itself — keeping UI logic separate from
 * physics reasoning.
 *
 * Physics mapping:
 *   combi     — purge / startup loss, stop/start cycling, one-tap-at-a-time limit
 *   system    — decoupled generation, longer steady burner runs
 *   mixergy   — stratified storage, smart control smoothing, lowest gas use
 *   heatpump  — low-power continuous, high efficiency, slower recovery
 */

import type {
  DrivingStyleRow,
  DrivetrainId,
  DrivingStyleExplainerInput,
  EnergyRank,
  PathVariant,
} from '../../types/explainers';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Energy-use rank for each drivetrain (4 = most energy consumed). */
const ENERGY_RANK: Record<DrivetrainId, EnergyRank> = {
  heatpump: 1,
  mixergy:  2,
  system:   3,
  combi:    4,
};

/** Fixed path/track shape for each drivetrain. */
const PATH_VARIANT: Record<DrivetrainId, PathVariant> = {
  combi:    'jagged-reverse',
  system:   'steady',
  mixergy:  'smooth',
  heatpump: 'slow-smooth',
};

/** Primary heading — the driving analogy label. */
const TITLES: Record<DrivetrainId, string> = {
  combi:    'Boy Racer / Hot Hatch',
  system:   'Mondeo',
  mixergy:  'Hyper-miler',
  heatpump: 'Electric Hyper-miler',
};

/** Secondary descriptor line. */
const SUBTITLES: Record<DrivetrainId, string> = {
  combi:    'On-demand hot water',
  system:   'Stored hot water system',
  mixergy:  'Smart stored hot water',
  heatpump: 'Electric heat pump',
};

/** Short vehicle label used in compact mode. */
const VEHICLE_LABELS: Record<DrivetrainId, string> = {
  combi:    'Hot Hatch',
  system:   'Mondeo',
  mixergy:  'Hyper-miler',
  heatpump: 'Electric',
};

/** Heating system label. */
const SYSTEM_LABELS: Record<DrivetrainId, string> = {
  combi:    'Combi',
  system:   'Gas system + cylinder',
  mixergy:  'Mixergy + strong controls',
  heatpump: 'Heat pump',
};

/** Short badge describing the power characteristic. */
const POWER_BADGE: Record<DrivetrainId, string> = {
  combi:    'High burst power',
  system:   'Moderate steady power',
  mixergy:  'Smarter matched power',
  heatpump: 'Low continuous power',
};

/** Optional fixed informational chip. */
const EVENT_CHIP: Partial<Record<DrivetrainId, string>> = {
  system:   'Stored hot water buffer',
  mixergy:  'Smart storage',
  heatpump: 'Low and slow',
};

/** Warning chip text shown on the combi row. */
const COMBI_WARNING_CHIP = 'Second tap warning';

/** One-line captions for each row. */
const CAPTIONS: Record<DrivetrainId, string> = {
  combi:    'Fast launch, lots of stop-start. Needs high power for on-demand hot water.',
  system:   'Steadier output with stored hot water. Better for larger or more simultaneous demand.',
  mixergy:  'Smarter stored hot water, less wasted effort.',
  heatpump: 'Lowest-energy route, but slower to accelerate.',
};

/** Visible fuel/energy label shown alongside the energy bar. */
const FUEL_LABELS: Record<DrivetrainId, string> = {
  combi:    'Gas used',
  system:   'Gas used',
  mixergy:  'Gas used',
  heatpump: 'Electric used',
};

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Builds the static row descriptors for all four drivetrain types from
 * household inputs.
 *
 * No animation phases or motion states are used.  The returned descriptors
 * are purely declarative and suitable for print/PDF contexts.
 *
 * @param input   Resolved household inputs.
 */
export function buildDrivingStyleRows(
  input: DrivingStyleExplainerInput,
): DrivingStyleRow[] {
  const drivetrains: DrivetrainId[] = ['combi', 'system', 'mixergy', 'heatpump'];

  return drivetrains.map((id): DrivingStyleRow => {
    const warningChip =
      id === 'combi' && input.peakConcurrentOutlets >= 2
        ? COMBI_WARNING_CHIP
        : undefined;

    return {
      id,
      title:       TITLES[id],
      subtitle:    SUBTITLES[id],
      vehicleLabel: VEHICLE_LABELS[id],
      systemLabel: SYSTEM_LABELS[id],
      pathVariant: PATH_VARIANT[id],
      energyRank:  ENERGY_RANK[id],
      powerBadge:  POWER_BADGE[id],
      eventChip:   EVENT_CHIP[id],
      warningChip,
      caption:     CAPTIONS[id],
      fuelLabel:   FUEL_LABELS[id],
    };
  });
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
