/**
 * HouseSimulatorOutletNode — a room cell that shows live outlet telemetry.
 *
 * Each outlet node represents a single water outlet (shower, bath, kitchen tap,
 * cold tap) within a named room in the HouseSimulatorCanvas grid.
 *
 * When the outlet is active (open), it renders the outlet icon, label, and one
 * or more LiveMetricChip instances showing live flow and temperature data.
 *
 * When inactive it shows just the outlet icon and label as a quiet placeholder.
 *
 * All state comes from the adapter layer (buildHouseSimulatorViewModel).  No
 * physics logic lives here.
 */

import LiveMetricChip from './LiveMetricChip';
import type { LiveMetricChipProps } from './LiveMetricChip';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HouseSimulatorOutletNodeProps {
  /** Outlet slot identifier, e.g. "shower", "bath", "kitchen". */
  outletId: string;
  /** Human-readable label, e.g. "Shower". */
  label: string;
  /** Emoji icon for the outlet, e.g. "🚿". */
  icon: string;
  /** Whether this outlet is currently active (open). */
  active: boolean;
  /** Whether the outlet is receiving constrained flow. */
  constrained?: boolean;
  /** Metric chips to display when the outlet is active. */
  metrics?: LiveMetricChipProps[];
  /** Optional click/tap handler for direct interaction in the house canvas. */
  onPress?: () => void;
  /** Visual selected state for detail popover focus. */
  selected?: boolean;
  /** Whether this outlet is currently operable by the simulator controls. */
  supported?: boolean;
  /** True when this node proxies another channel (e.g. washing machine -> cold tap). */
  synthetic?: boolean;
  /** Absolute node position class name. */
  positionClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseSimulatorOutletNode({
  outletId,
  label,
  icon,
  active,
  constrained = false,
  metrics = [],
  onPress,
  selected = false,
  supported = true,
  synthetic = false,
  positionClassName,
}: HouseSimulatorOutletNodeProps) {
  let stateClass = ' hs-outlet-node--inactive';
  let stateLabel = 'inactive';
  if (!supported) {
    stateClass = ' hs-outlet-node--unavailable';
    stateLabel = 'unavailable';
  } else if (active) {
    stateClass = ' hs-outlet-node--active';
    stateLabel = 'active';
  }
  return (
    <button
      type="button"
      className={`hs-outlet-node${stateClass}${constrained ? ' hs-outlet-node--constrained' : ''}${selected ? ' hs-outlet-node--selected' : ''}${synthetic ? ' hs-outlet-node--synthetic' : ''}${positionClassName ? ` ${positionClassName}` : ''}`}
      data-outlet-id={outletId}
      onClick={onPress}
      disabled={!supported}
      aria-pressed={selected}
      aria-label={`${label} — ${stateLabel}${synthetic ? ', proxy control' : ''}${constrained ? ', constrained' : ''}`}
    >
      <span className="hs-outlet-node__icon" aria-hidden="true">{icon}</span>
      <span className="hs-outlet-node__label">{label}</span>
      {active && metrics.length > 0 && (
        <div className="hs-outlet-node__chips">
          {metrics.map((m, i) => (
            <LiveMetricChip key={i} {...m} compact />
          ))}
        </div>
      )}
      {constrained && (
        <span className="hs-outlet-node__constraint-flag" aria-hidden="true">⚠</span>
      )}
      {synthetic && (
        <span className="hs-outlet-node__synthetic-flag" aria-hidden="true">Proxy</span>
      )}
    </button>
  );
}
