/**
 * DeltaStrip.tsx
 *
 * Shows key metric deltas when the user edits inputs that trigger an engine
 * rerun. Compares `previous` engine output against `current` and surfaces
 * the most meaningful changes as a compact horizontal strip.
 *
 * Metrics tracked:
 *   - Peak heat demand (kW)  — from behaviourTimeline
 *   - Peak DHW demand (kW)   — from behaviourTimeline
 *   - Top option status      — from options[]
 *   - Highest constraint     — from limiters[]
 *
 * UI contract: purely presentational — no physics computed here.
 */
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

interface Props {
  previous: EngineOutputV1 | null;
  current: EngineOutputV1;
}

interface Delta {
  label: string;
  from: string;
  to: string;
  direction: 'up' | 'down' | 'same' | 'changed';
  /** True when an increase is good (e.g. efficiency going up). */
  upIsGood?: boolean;
}

function peakHeatKw(output: EngineOutputV1): number | null {
  const pts = output.behaviourTimeline?.points;
  if (!pts || pts.length === 0) return null;
  return Math.max(...pts.map(p => p.heatDemandKw));
}

function peakDhwKw(output: EngineOutputV1): number | null {
  const pts = output.behaviourTimeline?.points;
  if (!pts || pts.length === 0) return null;
  return Math.max(...pts.map(p => p.dhwDemandKw));
}

function highestConstraintLabel(output: EngineOutputV1): string | null {
  const limiters = output.limiters?.limiters ?? [];
  if (limiters.length === 0) return null;
  const ordered = [...limiters].sort((a, b) => {
    const rank = { fail: 0, warn: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
  const top = ordered[0];
  return `${top.title} (${top.severity})`;
}

function topOptionLabel(output: EngineOutputV1): string | null {
  const top = output.options?.find(o => o.status === 'viable') ?? output.options?.[0];
  if (!top) return null;
  return `${top.label} (${top.status})`;
}

function computeDeltas(previous: EngineOutputV1, current: EngineOutputV1): Delta[] {
  const deltas: Delta[] = [];

  // Peak heat demand
  const prevHeat = peakHeatKw(previous);
  const currHeat = peakHeatKw(current);
  if (prevHeat !== null && currHeat !== null && Math.abs(prevHeat - currHeat) >= 0.05) {
    deltas.push({
      label: 'Peak heat demand',
      from: `${prevHeat.toFixed(1)} kW`,
      to: `${currHeat.toFixed(1)} kW`,
      direction: currHeat > prevHeat ? 'up' : 'down',
      upIsGood: false,
    });
  }

  // Peak DHW demand
  const prevDhw = peakDhwKw(previous);
  const currDhw = peakDhwKw(current);
  if (prevDhw !== null && currDhw !== null && Math.abs(prevDhw - currDhw) >= 0.05) {
    deltas.push({
      label: 'Peak DHW demand',
      from: `${prevDhw.toFixed(1)} kW`,
      to: `${currDhw.toFixed(1)} kW`,
      direction: currDhw > prevDhw ? 'up' : 'down',
      upIsGood: false,
    });
  }

  // Top option
  const prevOption = topOptionLabel(previous);
  const currOption = topOptionLabel(current);
  if (prevOption !== currOption && prevOption !== null && currOption !== null) {
    deltas.push({
      label: 'Top recommendation',
      from: prevOption,
      to: currOption,
      direction: 'changed',
    });
  }

  // Highest constraint
  const prevConstraint = highestConstraintLabel(previous);
  const currConstraint = highestConstraintLabel(current);
  if (prevConstraint !== currConstraint && (prevConstraint !== null || currConstraint !== null)) {
    deltas.push({
      label: 'Top constraint',
      from: prevConstraint ?? 'None',
      to: currConstraint ?? 'None',
      direction: 'changed',
    });
  }

  return deltas;
}

function directionColour(direction: Delta['direction'], upIsGood?: boolean): string {
  if (direction === 'same') return '#718096';
  if (direction === 'changed') return '#3182ce';
  if (direction === 'up') return upIsGood ? '#276749' : '#e53e3e';
  return upIsGood ? '#e53e3e' : '#276749'; // 'down'
}

function directionArrow(direction: Delta['direction']): string {
  if (direction === 'same') return '→';
  if (direction === 'changed') return '↔';
  if (direction === 'up') return '↑ ';
  return '↓ ';
}

export default function DeltaStrip({ previous, current }: Props) {
  if (!previous) return null;

  const deltas = computeDeltas(previous, current);
  if (deltas.length === 0) return null;

  return (
    <div
      className="delta-strip"
      style={{
        background: '#ebf8ff',
        border: '1px solid #bee3f8',
        borderRadius: 8,
        padding: '8px 14px',
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 20px',
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: '#2b6cb0',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          flexShrink: 0,
        }}
      >
        What changed:
      </span>
      {deltas.map((d, i) => {
        const colour = directionColour(d.direction, d.upIsGood);
        const arrow = directionArrow(d.direction);
        return (
          <span key={i} style={{ color: '#4a5568' }}>
            <span style={{ color: '#718096' }}>{d.label}:</span>{' '}
            <span style={{ textDecoration: 'line-through', color: '#a0aec0' }}>{d.from}</span>
            {' '}
            <span style={{ color: colour, fontWeight: 700 }}>{arrow}{d.to}</span>
          </span>
        );
      })}
    </div>
  );
}
