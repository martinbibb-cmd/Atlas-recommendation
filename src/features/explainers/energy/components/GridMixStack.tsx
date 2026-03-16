/**
 * GridMixStack.tsx
 *
 * Horizontal stacked bar showing approximate grid generation mix.
 * Each segment is proportional to the source's contribution.
 * Data comes from energySourceFacts.ts; layout is pure CSS.
 */

import EnergyExplainerCard from './EnergyExplainerCard';
import './GridMixStack.css';

// ─── Default UK 2023 generation mix ──────────────────────────────────────────

export interface GridMixSegment {
  label: string;
  pct: number;
  color: string;
}

interface Props {
  segments?: GridMixSegment[];
}

const DEFAULT_MIX: GridMixSegment[] = [
  { label: 'Wind', pct: 28, color: '#38a169' },
  { label: 'Gas', pct: 32, color: '#e53e3e' },
  { label: 'Nuclear', pct: 15, color: '#3182ce' },
  { label: 'Solar', pct: 5, color: '#d69e2e' },
  { label: 'Hydro / tidal', pct: 3, color: '#6366f1' },
  { label: 'Imports', pct: 8, color: '#718096' },
  { label: 'Other', pct: 9, color: '#a0aec0' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function GridMixStack({ segments = DEFAULT_MIX }: Props) {
  const total = segments.reduce((s, seg) => s + seg.pct, 0);

  return (
    <EnergyExplainerCard title="Where electricity comes from" badge="Data" className="gms">
      <p className="gms__subtitle">
        Approximate UK grid generation mix (2023 average). Source: National Grid ESO.
      </p>

      {/* ── Stacked bar ──────────────────────────────────────────────────── */}
      <div className="gms__bar" role="img" aria-label="Grid generation mix bar chart">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="gms__segment"
            style={{
              width: `${(seg.pct / total) * 100}%`,
              background: seg.color,
            }}
            title={`${seg.label}: ${seg.pct}%`}
          />
        ))}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="gms__legend">
        {segments.map((seg) => (
          <div key={seg.label} className="gms__legend-item">
            <span
              className="gms__legend-dot"
              style={{ background: seg.color }}
              aria-hidden="true"
            />
            <span className="gms__legend-label">{seg.label}</span>
            <span className="gms__legend-pct">{seg.pct}%</span>
          </div>
        ))}
      </div>

      <p className="gms__note">
        Intermittent sources (wind, solar) vary minute-to-minute. Gas provides
        the majority of balancing capacity when wind drops.
      </p>
    </EnergyExplainerCard>
  );
}
