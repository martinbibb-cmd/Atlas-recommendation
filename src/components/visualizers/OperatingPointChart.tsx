/**
 * OperatingPointChart
 *
 * Plots the measured hydraulic operating point (dynamic flow L/min vs dynamic
 * pressure bar) on a background of soft supply-quality zones.
 *
 * The chart teaches the correct lesson:
 *   Static pressure is context.
 *   Dynamic pressure under flow matters.
 *   Flow matters.
 *   The operating point matters more than the drop.
 */

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

interface Props {
  /** Dynamic flow rate measured under partial load (L/min) */
  flowLpm: number;
  /** Dynamic pressure measured under partial load (bar) */
  pressureBar: number;
}

// ─── Zone boundaries ──────────────────────────────────────────────────────────
// X-axis: flow (L/min)   0 → 45
// Y-axis: pressure (bar) 0 → 5
//
// Zone definitions are intentionally approximate teaching aids, not hard gates.
// Hard eligibility gates live in CwsSupplyModule and the engine.
//
//   Excellent  ≥ 2.0 bar  (stored hot water — strongly favoured)
//   Strong     1.0–2.0 bar
//   Usable     0.5–1.0 bar
//   Weak       < 0.5 bar

const CHART_FLOW_MAX  = 45; // L/min display ceiling
const CHART_PRES_MAX  = 5;  // bar display ceiling

const FLOW_MIN_DISPLAY  = 0;
const PRES_MIN_DISPLAY  = 0;

// Minimum flow threshold for unvented suitability (teaching reference line)
const UNVENTED_FLOW_THRESHOLD_LPM = 10;
const UNVENTED_PRES_THRESHOLD_BAR = 1.0;

interface ZoneConfig {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
  label: string;
}

const ZONES: ZoneConfig[] = [
  // Weak supply — low pressure or low flow
  { x1: FLOW_MIN_DISPLAY, x2: CHART_FLOW_MAX, y1: PRES_MIN_DISPLAY, y2: 0.5,  fill: '#fed7d7', label: 'Weak' },
  // Usable
  { x1: FLOW_MIN_DISPLAY, x2: CHART_FLOW_MAX, y1: 0.5, y2: 1.0,              fill: '#fefcbf', label: 'Usable' },
  // Strong
  { x1: FLOW_MIN_DISPLAY, x2: CHART_FLOW_MAX, y1: 1.0, y2: 2.0,              fill: '#c6f6d5', label: 'Strong' },
  // Excellent — very well suited for stored hot water (unvented, Mixergy)
  { x1: FLOW_MIN_DISPLAY, x2: CHART_FLOW_MAX, y1: 2.0, y2: CHART_PRES_MAX,   fill: '#bee3f8', label: 'Excellent' },
];

function zoneLabel(pressureBar: number): { text: string; colour: string } {
  if (pressureBar >= 2.0) return { text: 'Excellent for stored hot water', colour: '#2b6cb0' };
  if (pressureBar >= 1.0) return { text: 'Strong supply under load',        colour: '#276749' };
  if (pressureBar >= 0.5) return { text: 'Usable — borderline under load',  colour: '#b7791f' };
  return                         { text: 'Weak under load',                  colour: '#c53030' };
}

// Custom dot for the single measured operating point
interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { flow: number; pressure: number };
}

function OperatingPointDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  return (
    <g>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="#2b6cb0" strokeWidth={2} opacity={0.5} />
      {/* Inner filled dot */}
      <circle cx={cx} cy={cy} r={5} fill="#2b6cb0" stroke="#fff" strokeWidth={1.5} />
    </g>
  );
}

// Tooltip for the operating point
function OperatingPointTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload || payload.length < 2) return null;
  const flow = payload[0].value;
  const pressure = payload[1].value;
  const { text, colour } = zoneLabel(pressure);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.8rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Operating point</div>
      <div>{flow.toFixed(1)} L/min @ {pressure.toFixed(1)} bar</div>
      <div style={{ color: colour, fontWeight: 600, marginTop: '0.2rem' }}>{text}</div>
    </div>
  );
}

export default function OperatingPointChart({ flowLpm, pressureBar }: Props) {
  const point = [{ flow: flowLpm, pressure: pressureBar }];
  const { text: zoneTxt, colour: zoneColour } = zoneLabel(pressureBar);

  return (
    <div>
      {/* Chart title */}
      <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
        Hydraulic operating point
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          {/* Background zones — rendered first so data sits on top */}
          {ZONES.map(z => (
            <ReferenceArea
              key={z.label}
              x1={z.x1} x2={z.x2}
              y1={z.y1} y2={z.y2}
              fill={z.fill}
              fillOpacity={0.7}
              ifOverflow="hidden"
            />
          ))}

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            type="number"
            dataKey="flow"
            domain={[FLOW_MIN_DISPLAY, CHART_FLOW_MAX]}
            tickCount={6}
            label={{ value: 'Flow (L/min)', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#718096' }}
            tick={{ fontSize: 11, fill: '#718096' }}
          />
          <YAxis
            type="number"
            dataKey="pressure"
            domain={[PRES_MIN_DISPLAY, CHART_PRES_MAX]}
            tickCount={6}
            label={{ value: 'Pressure (bar)', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#718096' }}
            tick={{ fontSize: 11, fill: '#718096' }}
          />

          {/* Unvented suitability threshold reference lines */}
          <ReferenceLine
            x={UNVENTED_FLOW_THRESHOLD_LPM}
            stroke="#718096"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <ReferenceLine
            y={UNVENTED_PRES_THRESHOLD_BAR}
            stroke="#718096"
            strokeDasharray="4 3"
            strokeWidth={1}
          />

          <Tooltip content={<OperatingPointTooltip />} />

          <Scatter
            data={point}
            shape={<OperatingPointDot />}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Zone label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#718096', marginTop: '-18px', paddingLeft: '2px', paddingRight: '16px' }}>
        <span style={{ background: '#fed7d7', padding: '1px 4px', borderRadius: '3px' }}>Weak</span>
        <span style={{ background: '#fefcbf', padding: '1px 4px', borderRadius: '3px' }}>Usable</span>
        <span style={{ background: '#c6f6d5', padding: '1px 4px', borderRadius: '3px' }}>Strong</span>
        <span style={{ background: '#bee3f8', padding: '1px 4px', borderRadius: '3px' }}>Excellent</span>
      </div>

      {/* Operating-point result callout */}
      <div style={{
        marginTop: '0.5rem',
        padding: '0.45rem 0.75rem',
        background: '#f7fafc',
        borderLeft: `4px solid ${zoneColour}`,
        borderRadius: '4px',
        fontSize: '0.8rem',
      }}>
        <span style={{ fontWeight: 700, color: zoneColour }}>{zoneTxt}</span>
        {' '}— {flowLpm.toFixed(1)} L/min @ {pressureBar.toFixed(1)} bar
      </div>

      {/* Educational note */}
      <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#718096', lineHeight: 1.5 }}>
        Pressure falls when water flows — this is normal. Suitability is based on the operating point under load.
      </div>
    </div>
  );
}
