import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import type { Timeline24hV1 } from '../../contracts/EngineOutputV1';

// ── Colour palette for A/B series ────────────────────────────────────────────
const SERIES_COLOURS = ['#3182ce', '#e53e3e'] as const;
const DEMAND_COLOUR  = '#a0aec0';
const EVENT_COLOURS: Record<string, string> = {
  shower:         'rgba(66,153,225,0.18)',
  bath:           'rgba(128,90,213,0.18)',
  sink:           'rgba(56,161,105,0.18)',
  dishwasher:     'rgba(214,158,46,0.14)',
  washing_machine:'rgba(214,158,46,0.14)',
};

/** Format minutes → "HH:MM" label. */
function minuteToLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Build the Recharts data array from the Timeline24hV1 payload. */
function buildChartData(payload: Timeline24hV1): Record<string, number | string>[] {
  return payload.timeMinutes.map((min, i) => {
    const row: Record<string, number | string> = {
      label: minuteToLabel(min),
      demandHeatKw: payload.demandHeatKw[i],
    };
    for (const s of payload.series) {
      row[`${s.id}_heatKw`]   = s.heatDeliveredKw[i];
      row[`${s.id}_eff`]      = s.efficiency[i];
      if (s.comfortTempC)    row[`${s.id}_comfort`]  = s.comfortTempC[i];
      if (s.dhwOutletTempC)  row[`${s.id}_dhwTemp`]  = s.dhwOutletTempC[i];
    }
    return row;
  });
}

interface Props {
  /** Timeline payload from VisualSpecV1.data. */
  payload: Timeline24hV1;
  /** A/B tile IDs that are currently selected (controls which series are highlighted). */
  compareAId?: string;
  compareBId?: string;
}

/**
 * Timeline24hRenderer
 *
 * Renders a single 24-hour comparative timeline with:
 *  - Heat demand baseline (grey)
 *  - Heat delivered lines for system A and B
 *  - DHW event shaded blocks
 */
export default function Timeline24hRenderer({ payload, compareAId, compareBId }: Props) {
  const data = buildChartData(payload);

  // Derive a key from the active series IDs so Recharts fully remounts when the pair changes
  const chartKey = payload.series.map(s => s.id).join('__');

  // Tick every 4 points = every hour (each point = 15 min)
  const xTickIndices = new Set(
    payload.timeMinutes
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m % 60 === 0)
      .map(({ i }) => i),
  );

  const seriesA = payload.series[0];
  const seriesB = payload.series[1];
  const colourA = SERIES_COLOURS[0];
  const colourB = SERIES_COLOURS[1];

  return (
    <div style={{ width: '100%' }}>
      {/* A/B compare labels */}
      {(compareAId || compareBId) && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          {seriesA && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 16, height: 3, background: colourA, display: 'inline-block', borderRadius: 2 }} />
              <strong style={{ color: colourA }}>A:</strong> {seriesA.label}
            </span>
          )}
          {seriesB && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 16, height: 3, background: colourB, display: 'inline-block', borderRadius: 2 }} />
              <strong style={{ color: colourB }}>B:</strong> {seriesB.label}
            </span>
          )}
        </div>
      )}

      {/* Main heat delivered chart */}
      <div style={{ marginBottom: '0.25rem', fontSize: '0.78rem', color: '#718096', fontWeight: 600 }}>
        Heat Delivered (kW)
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart key={chartKey} data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            interval={3}
            tickFormatter={(_v, idx) => xTickIndices.has(idx) ? data[idx].label as string : ''}
          />
          <YAxis tick={{ fontSize: 9 }} width={32} unit="kW" />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined) => [v !== undefined ? `${v.toFixed(2)} kW` : ''] as [string]}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.78rem' }}
            formatter={(value: string) => {
              if (value === 'demandHeatKw') return 'Heat demand';
              if (seriesA && value === `${seriesA.id}_heatKw`) return `A: ${seriesA.label}`;
              if (seriesB && value === `${seriesB.id}_heatKw`) return `B: ${seriesB.label}`;
              return value;
            }}
          />

          {/* DHW event shading */}
          {payload.events.map((ev, idx) => {
            const startIdx = Math.round(ev.startMin / 15);
            const endIdx   = Math.round(ev.endMin   / 15);
            const startLabel = data[Math.min(startIdx, data.length - 1)]?.label;
            const endLabel   = data[Math.min(endIdx,   data.length - 1)]?.label;
            return (
              <ReferenceArea
                key={idx}
                x1={startLabel}
                x2={endLabel}
                fill={EVENT_COLOURS[ev.kind] ?? 'rgba(160,174,192,0.15)'}
                stroke="none"
              />
            );
          })}

          <Line
            type="monotone"
            dataKey="demandHeatKw"
            stroke={DEMAND_COLOUR}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          {seriesA && (
            <Line
              type="monotone"
              dataKey={`${seriesA.id}_heatKw`}
              stroke={colourA}
              strokeWidth={2}
              dot={false}
            />
          )}
          {seriesB && (
            <Line
              type="monotone"
              dataKey={`${seriesB.id}_heatKw`}
              stroke={colourB}
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Efficiency mini-chart */}
      <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.78rem', color: '#718096', fontWeight: 600 }}>
        Efficiency (η / COP)
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart key={`${chartKey}_eff`} data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            interval={3}
            tickFormatter={(_v, idx) => xTickIndices.has(idx) ? data[idx].label as string : ''}
          />
          <YAxis tick={{ fontSize: 9 }} width={32} domain={[0, 5]} />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined) => [v !== undefined ? `${v.toFixed(2)}` : ''] as [string]}
          />

          {payload.events.map((ev, idx) => {
            const startIdx = Math.round(ev.startMin / 15);
            const endIdx   = Math.round(ev.endMin   / 15);
            const startLabel = data[Math.min(startIdx, data.length - 1)]?.label;
            const endLabel   = data[Math.min(endIdx,   data.length - 1)]?.label;
            return (
              <ReferenceArea
                key={idx}
                x1={startLabel}
                x2={endLabel}
                fill={EVENT_COLOURS[ev.kind] ?? 'rgba(160,174,192,0.15)'}
                stroke="none"
              />
            );
          })}

          {seriesA && (
            <Line
              type="monotone"
              dataKey={`${seriesA.id}_eff`}
              stroke={colourA}
              strokeWidth={1.5}
              dot={false}
            />
          )}
          {seriesB && (
            <Line
              type="monotone"
              dataKey={`${seriesB.id}_eff`}
              stroke={colourB}
              strokeWidth={1.5}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* DHW event legend */}
      {payload.events.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.74rem', color: '#718096' }}>
          <span style={{ fontWeight: 600 }}>DHW events:</span>
          {payload.events.map((ev, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{
                width: 12, height: 12, borderRadius: 2,
                background: EVENT_COLOURS[ev.kind] ?? '#e2e8f0',
                display: 'inline-block',
                border: '1px solid rgba(0,0,0,0.08)',
              }} />
              {minuteToLabel(ev.startMin)} {ev.kind} ({ev.intensity})
            </span>
          ))}
        </div>
      )}

      {/* Legend notes */}
      {payload.legendNotes && payload.legendNotes.length > 0 && (
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', fontSize: '0.72rem', color: '#a0aec0' }}>
          {payload.legendNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
