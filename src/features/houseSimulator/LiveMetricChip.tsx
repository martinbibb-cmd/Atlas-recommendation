/**
 * LiveMetricChip — compact live telemetry chip for the House Simulator.
 *
 * Displays a single metric (flow, temperature, pressure, stored volume, etc.)
 * beside an active outlet node or roof widget.
 *
 * All values come from the adapter layer (buildHouseSimulatorViewModel) which
 * reshapes existing simulator playback state.  No physics logic lives here.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricStatus = 'good' | 'warning' | 'critical' | 'idle';

export interface LiveMetricChipProps {
  /** Short metric label, e.g. "Flow", "Temperature", "Pressure". */
  label: string;
  /** Current numeric or string value. */
  value: string | number;
  /** Unit suffix, e.g. "L/min", "°C", "bar". */
  unit?: string;
  /** Peak value shown as a secondary context figure, e.g. "peak 12.4". */
  peak?: string | number;
  /** Visual status tone applied to the chip border and value colour. */
  status?: MetricStatus;
  /** Delta indicator, e.g. "+2.1" or "−0.4". */
  delta?: string | number;
  /** When true renders a more compact single-line layout suitable for inline placement. */
  compact?: boolean;
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<MetricStatus, string> = {
  good:     '#276749',
  warning:  '#744210',
  critical: '#742a2a',
  idle:     '#4a5568',
};

const STATUS_BORDER: Record<MetricStatus, string> = {
  good:     '#c6f6d5',
  warning:  '#fefcbf',
  critical: '#fed7d7',
  idle:     '#e2e8f0',
};

const STATUS_BG: Record<MetricStatus, string> = {
  good:     '#f0fff4',
  warning:  '#fffff0',
  critical: '#fff5f5',
  idle:     '#f7fafc',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveMetricChip({
  label,
  value,
  unit,
  peak,
  status = 'idle',
  delta,
  compact = false,
}: LiveMetricChipProps) {
  const color  = STATUS_COLOR[status];
  const border = STATUS_BORDER[status];
  const bg     = STATUS_BG[status];

  // \u202F = narrow no-break space — keeps value and unit visually joined without
  // the wide gap a regular space would produce at larger font weights.
  const displayValue = unit != null ? `${value}\u202F${unit}` : String(value);

  if (compact) {
    return (
      <span
        className="hs-chip hs-chip--compact"
        role="status"
        aria-label={`${label}: ${displayValue}`}
        style={{ borderColor: border, background: bg }}
      >
        <span className="hs-chip__label">{label}</span>
        <strong className="hs-chip__value" style={{ color }}>{displayValue}</strong>
        {delta != null && (
          <span className="hs-chip__delta" aria-hidden="true">{delta}</span>
        )}
      </span>
    );
  }

  return (
    <div
      className="hs-chip"
      role="status"
      aria-label={`${label}: ${displayValue}${peak != null ? `, peak ${peak}` : ''}`}
      style={{ borderColor: border, background: bg }}
    >
      <span className="hs-chip__label">{label}</span>
      <strong className="hs-chip__value" style={{ color }}>{displayValue}</strong>
      {peak != null && (
        <span className="hs-chip__peak">peak {peak}{unit ? `\u202F${unit}` : ''}</span>
      )}
      {delta != null && (
        <span className="hs-chip__delta" aria-hidden="true">{delta}</span>
      )}
    </div>
  );
}
