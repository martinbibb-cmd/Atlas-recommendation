/**
 * PerformanceBandLadder
 *
 * Interactive SEDBUK-equivalent efficiency band ladder (A–G).
 * Renders four annotated markers against the band background:
 *   • As manufactured   (nominalPct)
 *   • Likely current    (currentEffectivePct)
 *   • After clean & protect (restoredPct)
 *   • New boiler baseline   (newBaselinePct)
 *
 * Hover a band   → tooltip: efficiency range + 1-line description
 * Hover a marker → tooltip: pct + borderline label + confidence + contributors
 *
 * SEDBUK band thresholds (problem statement):
 *   A ≥ 90 %
 *   B 86–89 %
 *   C 82–85 %
 *   D 78–81 %
 *   E 74–77 %
 *   F 70–73 %
 *   G  < 70 %
 */
import { useState } from 'react';

// ── SEDBUK band definitions ────────────────────────────────────────────────────

interface Band {
  label: string;          // 'A' … 'G'
  minPct: number;         // inclusive lower bound (G uses 0)
  maxPct: number;         // inclusive upper bound
  color: string;          // fill colour
  description: string;    // 1-line "what it usually feels like"
  /** Relative height multiplier (G = tallest to emphasise the loss). */
  heightRatio: number;
}

const BANDS: Band[] = [
  {
    label: 'A', minPct: 90, maxPct: Infinity,
    color: '#276749',
    description: 'Efficient condensing — low bills, comfortable heat output year-round.',
    heightRatio: 1,
  },
  {
    label: 'B', minPct: 86, maxPct: 89,
    color: '#38a169',
    description: 'High-efficiency condensing — very close to band A in running cost.',
    heightRatio: 1,
  },
  {
    label: 'C', minPct: 82, maxPct: 85,
    color: '#68d391',
    description: 'Mid-range condensing — good performance, modest room for improvement.',
    heightRatio: 1.05,
  },
  {
    label: 'D', minPct: 78, maxPct: 81,
    color: '#f6e05e',
    description: 'Lower condensing — noticeable running-cost gap vs new plant.',
    heightRatio: 1.1,
  },
  {
    label: 'E', minPct: 74, maxPct: 77,
    color: '#f6ad55',
    description: 'Marginal condensing — annual spend is materially higher than A/B.',
    heightRatio: 1.15,
  },
  {
    label: 'F', minPct: 70, maxPct: 73,
    color: '#fc8181',
    description: 'Non-condensing or very early condensing — significant cost penalty.',
    heightRatio: 1.2,
  },
  {
    label: 'G', minPct: 0, maxPct: 69,
    color: '#e53e3e',
    description: 'Pre-condensing atmospheric boiler — heat loss is materially above modern plant.',
    heightRatio: 1.3,
  },
];

const BAND_BOUNDARY_PCTS = [90, 86, 82, 78, 74, 70]; // fences between A/B, B/C … F/G

const BORDERLINE_TOLERANCE = 0.5; // % — show "borderline X/Y" when within this distance

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerformanceBandLadderProps {
  /** As-manufactured SEDBUK seasonal efficiency (%). */
  nominalPct: number;
  /** Engine-derived current effective efficiency (%). */
  currentEffectivePct: number;
  /** Post clean & protect efficiency (slider-derived or engine-computed). */
  restoredPct: number;
  /** Current new-boiler standard nominal (typically 92%). */
  newBaselinePct: number;
  /** Confidence in the current effective estimate. */
  confidence?: 'high' | 'medium' | 'low';
  /** Top 2–3 degradation contributors (optional). */
  contributors?: { label: string; valuePct: number }[];
  /** Called when the user hovers a marker; key is the markerKey or null on leave. */
  onMarkerHover?: (markerKey: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns "borderline X/Y" if pct is within BORDERLINE_TOLERANCE of a band boundary.
 * Returns null otherwise.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function borderlineLabel(pct: number): string | null {
  for (const boundary of BAND_BOUNDARY_PCTS) {
    if (Math.abs(pct - boundary) <= BORDERLINE_TOLERANCE) {
      const above = BANDS.find(b => b.minPct === boundary);
      const below = BANDS.find(b => b.maxPct === boundary - 1);
      if (above && below) {
        return `borderline ${above.label}/${below.label}`;
      }
    }
  }
  return null;
}

/** Map a percentage to a vertical position (0 = top = 99%, 1 = bottom = 50%). */
function pctToPosition(pct: number, minPct = 50, maxPct = 99): number {
  const clamped = Math.min(maxPct, Math.max(minPct, pct));
  return 1 - (clamped - minPct) / (maxPct - minPct);
}

// ── Marker config ──────────────────────────────────────────────────────────────

interface MarkerDef {
  key: string;
  label: string;
  pct: number;
  color: string;
  dashed?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerformanceBandLadder({
  nominalPct,
  currentEffectivePct,
  restoredPct,
  newBaselinePct,
  confidence = 'medium',
  contributors = [],
  onMarkerHover,
}: PerformanceBandLadderProps) {
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  const markers: MarkerDef[] = [
    { key: 'new_baseline',   label: 'New plant baseline (current standard)',   pct: newBaselinePct,       color: '#3182ce' },
    { key: 'as_manufactured', label: 'As manufactured',       pct: nominalPct,           color: '#2d3748' },
    { key: 'restored',        label: 'After clean & protect', pct: restoredPct,          color: '#276749', dashed: true },
    { key: 'current',         label: 'Likely current',        pct: currentEffectivePct,  color: '#c05621' },
  ];

  // Chart dimensions
  const CHART_HEIGHT = 280;
  const MIN_PCT = 50;
  const MAX_PCT = 99;

  // Total height ratio sum for proportional band heights
  const totalRatio = BANDS.reduce((s, b) => s + b.heightRatio, 0);

  // Build band segments (top-down) using reduce to avoid mid-render reassignment
  const bandSegments = BANDS.reduce<Array<Band & { y: number; height: number }>>(
    (acc, band) => {
      const yStart = acc.length > 0 ? acc[acc.length - 1].y + acc[acc.length - 1].height : 0;
      const h = (band.heightRatio / totalRatio) * CHART_HEIGHT;
      acc.push({ ...band, y: yStart, height: h });
      return acc;
    },
    [],
  );

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Band column + markers */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* Band column */}
        <div style={{ width: 36, position: 'relative', height: CHART_HEIGHT, flexShrink: 0 }}>
          {bandSegments.map(seg => (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredBand(seg.label)}
              onMouseLeave={() => setHoveredBand(null)}
              style={{
                position: 'absolute',
                top: seg.y,
                left: 0,
                width: 36,
                height: seg.height,
                background: seg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                borderBottom: seg.label !== 'G' ? '1px solid rgba(255,255,255,0.3)' : 'none',
                transition: 'filter 0.15s',
                filter: hoveredBand === seg.label ? 'brightness(1.15)' : 'none',
              }}
            >
              <span style={{
                color: ['A','B','C'].includes(seg.label) ? '#fff' : '#1a202c',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {seg.label}
              </span>
            </div>
          ))}
        </div>

        {/* Marker track */}
        <div style={{ position: 'relative', flex: 1, height: CHART_HEIGHT, borderLeft: '2px solid #e2e8f0' }}>
          {/* % scale ticks */}
          {[99, 90, 86, 82, 78, 74, 70, 60, 50].map(tick => {
            const yPos = pctToPosition(tick, MIN_PCT, MAX_PCT) * CHART_HEIGHT;
            return (
              <div key={tick} style={{
                position: 'absolute', top: yPos - 6, left: 0,
                width: '100%', pointerEvents: 'none',
              }}>
                <span style={{ fontSize: '0.65rem', color: '#a0aec0', paddingLeft: 4 }}>
                  {tick}%
                </span>
                <div style={{
                  position: 'absolute', top: 6, left: 24, right: 0,
                  borderTop: '1px dashed #e2e8f0',
                }} />
              </div>
            );
          })}

          {/* Marker lines + labels */}
          {markers.map((m, idx) => {
            const yPos = pctToPosition(m.pct, MIN_PCT, MAX_PCT) * CHART_HEIGHT;
            const isHovered = hoveredMarker === m.key;
            const bl = borderlineLabel(m.pct);
            const labelOffset = idx % 2 === 0 ? 28 : 48; // stagger labels
            return (
              <div
                key={m.key}
                onMouseEnter={() => { setHoveredMarker(m.key); onMarkerHover?.(m.key); }}
                onMouseLeave={() => { setHoveredMarker(null); onMarkerHover?.(null); }}
                style={{
                  position: 'absolute',
                  top: yPos - 1,
                  left: 0,
                  width: '100%',
                  cursor: 'pointer',
                  zIndex: isHovered ? 10 : 1,
                }}
              >
                {/* Horizontal marker line */}
                <div style={{
                  height: 2,
                  background: m.color,
                  borderStyle: m.dashed ? 'dashed' : 'solid',
                  borderWidth: m.dashed ? '0 0 2px 0' : 0,
                  opacity: isHovered ? 1 : 0.85,
                  transition: 'opacity 0.15s',
                }} />

                {/* Dot */}
                <div style={{
                  position: 'absolute', top: -4, left: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: m.color,
                  border: '2px solid #fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }} />

                {/* Label (staggered) */}
                <div style={{
                  position: 'absolute', top: -14, left: labelOffset,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: isHovered ? 700 : 500,
                    color: m.color,
                    background: 'rgba(255,255,255,0.85)',
                    padding: '0 3px',
                    borderRadius: 2,
                  }}>
                    {m.label} · {m.pct.toFixed(1)}%
                  </span>
                  {bl && (
                    <span style={{
                      fontSize: '0.62rem', color: '#744210',
                      marginLeft: 4, background: '#fefcbf',
                      padding: '0 3px', borderRadius: 2,
                    }}>
                      {bl}
                    </span>
                  )}
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 10, left: '30%',
                    background: '#1a202c', color: '#fff',
                    fontSize: '0.75rem', padding: '6px 10px',
                    borderRadius: 6, zIndex: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    minWidth: 160,
                    pointerEvents: 'none',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      {m.label}: {m.pct.toFixed(1)}%
                    </div>
                    {bl && (
                      <div style={{ color: '#fbd38d', marginBottom: 2, fontSize: '0.7rem' }}>
                        {bl}
                      </div>
                    )}
                    {m.key === 'current' && (
                      <>
                        <div style={{ color: '#a0aec0', fontSize: '0.7rem' }}>
                          Confidence: <strong style={{ color: '#fff' }}>{confidence}</strong>
                        </div>
                        {contributors.length > 0 && (
                          <div style={{ marginTop: 4, color: '#a0aec0', fontSize: '0.7rem' }}>
                            Top factors:
                            {contributors.map(c => (
                              <div key={c.label} style={{ color: '#e2e8f0' }}>
                                · {c.label} (−{c.valuePct.toFixed(1)}%)
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {m.key === 'restored' && (
                      <div style={{ color: '#a0aec0', fontSize: '0.7rem' }}>
                        After flush, inhibitor & filter service
                      </div>
                    )}
                    {m.key === 'new_baseline' && (
                      <div style={{ color: '#a0aec0', fontSize: '0.7rem' }}>
                        Current new condensing boiler standard
                      </div>
                    )}
                    {m.key === 'as_manufactured' && (
                      <div style={{ color: '#a0aec0', fontSize: '0.7rem' }}>
                        Original SEDBUK seasonal rating at install
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Band hover tooltip (bottom) */}
      {hoveredBand && (() => {
        const b = BANDS.find(x => x.label === hoveredBand);
        if (!b) return null;
        return (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            background: '#2d3748', color: '#e2e8f0',
            borderRadius: 6, fontSize: '0.75rem',
          }}>
            <strong>Band {b.label}</strong>
            {' '}({b.minPct === 0 ? `< 70` : b.maxPct === Infinity ? `≥ ${b.minPct}` : `${b.minPct}–${b.maxPct}`}%):{' '}
            {b.description}
          </div>
        );
      })()}

      {/* Footnote */}
      <p style={{
        marginTop: 10, fontSize: '0.65rem', color: '#a0aec0',
        lineHeight: 1.4,
      }}>
        Equivalent band reflects estimated seasonal efficiency under current operating conditions; not an official reclassification.
      </p>
    </div>
  );
}
