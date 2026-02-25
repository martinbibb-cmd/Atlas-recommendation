import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { Timeline24hV1 } from '../../contracts/EngineOutputV1';

// ── Colour palette for A/B series ────────────────────────────────────────────
const SERIES_COLOURS = ['#3182ce', '#e53e3e'] as const;
const DEMAND_COLOUR  = '#a0aec0';
const SETPOINT_COLOUR = '#48bb78';

/** Band fill colours by kind. */
const BAND_COLOURS: Record<string, string> = {
  sh_on:      'rgba(72,187,120,0.07)',
  dhw_on:     'rgba(66,153,225,0.14)',
  defrost:    'rgba(144,205,244,0.20)',
  anti_cycle: 'rgba(237,137,54,0.14)',
};

/** Colour for DHW bar chart by kind. */
const DHW_BAR_COLOURS: Record<string, string> = {
  bath:    '#805ad5',
  sink:    '#38a169',
  charge:  '#dd6b20',
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
      row[`${s.id}_heatKw`]    = s.heatDeliveredKw[i];
      row[`${s.id}_eff`]       = s.efficiency[i];
      row[`${s.id}_dhwTotalKw`] = s.dhwTotalKw?.[i] ?? 0;
      if (s.comfortTempC)   row[`${s.id}_comfort`]  = s.comfortTempC[i];
      if (s.dhwOutletTempC) row[`${s.id}_dhwTemp`]  = s.dhwOutletTempC[i];
      if (s.roomTempC)      row[`${s.id}_roomTemp`] = s.roomTempC[i];
      if (s.dhwState)       row[`${s.id}_dhwState`] = s.dhwState[i];
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
  onHoverIndexChange?: (index: number | null) => void;
}

/**
 * Timeline24hRenderer
 *
 * Renders four synchronised 24-hour rows (mobile-first):
 *  1. Space Heat Demand (kW) — with optional indoor temp line
 *  2. DHW Events — hot-water draw bar track (kW, colour by kind)
 *  3. Heat Source Output (kW) — thick line per system
 *  4. Performance (η / COP) — kind-dependent axis bounds
 *
 * All rows share the same X axis and vertical band annotations.
 */
export default function Timeline24hRenderer({ payload, compareAId, compareBId, onHoverIndexChange }: Props) {
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

  // Check whether physics-based room temp data is present
  const hasRoomTemp = !!(seriesA?.roomTempC?.length || seriesB?.roomTempC?.length);

  // Determine performance axis bounds from series kinds
  // If any series is COP, use cop range [0..6]; else use eta range [-0.2..1.05]
  const hasCop = payload.series.some(s => s.performanceKind === 'cop');
  const perfDomain = hasCop ? ([0, 6] as [number, number]) : ([-0.2, 1.05] as [number, number]);
  const perfLabel  = hasCop ? 'COP' : 'η';

  /** Shared X axis props reused across all charts. */
  const xAxisProps = {
    dataKey: 'label' as const,
    tick: { fontSize: 9 },
    interval: 3,
    tickFormatter: (_v: string, idx: number) =>
      xTickIndices.has(idx) ? data[idx].label as string : '',
  };

  /**
   * Background band shading derived from payload.bands (preferred) or
   * falling back to the legacy payload.events for backward compatibility.
   */
  const bandShading = (() => {
    const bandList = payload.bands?.bands ?? [];
    if (bandList.length > 0) {
      return bandList.map((band, idx) => {
        const startIdx   = Math.round(band.startMin / 15);
        const endIdx     = Math.round(band.endMin   / 15);
        const startLabel = data[Math.min(startIdx, data.length - 1)]?.label;
        const endLabel   = data[Math.min(endIdx,   data.length - 1)]?.label;
        return (
          <ReferenceArea
            key={idx}
            x1={startLabel}
            x2={endLabel}
            fill={BAND_COLOURS[band.kind] ?? 'rgba(160,174,192,0.10)'}
            stroke="none"
          />
        );
      });
    }
    // Fallback: shade from events (legacy)
    return payload.events.map((ev, idx) => {
      const startIdx   = Math.round(ev.startMin / 15);
      const endIdx     = Math.round(ev.endMin   / 15);
      const startLabel = data[Math.min(startIdx, data.length - 1)]?.label;
      const endLabel   = data[Math.min(endIdx,   data.length - 1)]?.label;
      return (
        <ReferenceArea
          key={idx}
          x1={startLabel}
          x2={endLabel}
          fill="rgba(66,153,225,0.14)"
          stroke="none"
        />
      );
    });
  })();

  const chartMargin = { top: 4, right: 12, left: 0, bottom: 4 };
  const subLabel = { marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.78rem', color: '#718096', fontWeight: 600 as const };

  // Collect DHW event kinds across both series for bar legend
  const dhwKinds = Array.from(
    new Set(
      payload.series.flatMap(s =>
        (s.dhwEventsActive ?? []).flatMap(entries => entries.map(e => e.kind)),
      ),
    ),
  );

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

      {/* Row 1: Space Heat Demand (+ optional indoor temp) */}
      <div style={subLabel}>Space Heat Demand (kW)</div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart key={`${chartKey}_demand`} data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fontSize: 9 }} width={32} unit="kW" />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined) => [v !== undefined ? `${v.toFixed(2)} kW` : ''] as [string]}
          />
          {bandShading}
          <Line
            type="monotone"
            dataKey="demandHeatKw"
            stroke={DEMAND_COLOUR}
            strokeWidth={1.5}
            dot={false}
            name="Space heat demand"
          />
          {/* Optional indoor temp lines (faint) */}
          {hasRoomTemp && seriesA?.roomTempC && (
            <Line
              type="monotone"
              dataKey={`${seriesA.id}_roomTemp`}
              stroke={colourA}
              strokeWidth={1}
              strokeDasharray="3 2"
              dot={false}
              yAxisId="right"
              name={`A indoor °C`}
            />
          )}
          {hasRoomTemp && seriesB?.roomTempC && (
            <Line
              type="monotone"
              dataKey={`${seriesB.id}_roomTemp`}
              stroke={colourB}
              strokeWidth={1}
              strokeDasharray="3 2"
              dot={false}
              yAxisId="right"
              name={`B indoor °C`}
            />
          )}
          {hasRoomTemp && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 8 }}
              width={28}
              unit="°C"
              domain={['auto', 'auto']}
            />
          )}
          {hasRoomTemp && (
            <ReferenceLine
              yAxisId="right"
              y={21}
              stroke={SETPOINT_COLOUR}
              strokeDasharray="5 3"
              strokeWidth={1}
              label={{ value: '21°C', fontSize: 7, fill: SETPOINT_COLOUR }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Row 2: DHW Events — hot-water draw bar track */}
      <div style={subLabel}>DHW Events — Hot-water Draw (kW)</div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart key={`${chartKey}_dhwbar`} data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fontSize: 9 }} width={32} unit="kW" />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined, name: string | undefined) => {
              const display = v !== undefined ? `${v.toFixed(2)} kW` : '';
              return [display, name ?? ''] as [string, string];
            }}
          />
          {bandShading}
          {/* Use series A dhwTotalKw as the primary bar; series B overlaid when present */}
          {seriesA && (
            <Bar
              dataKey={`${seriesA.id}_dhwTotalKw`}
              fill={DHW_BAR_COLOURS[dhwKinds[0] ?? 'sink'] ?? '#38a169'}
              opacity={0.85}
              name={`A: ${seriesA.label}`}
              isAnimationActive={false}
            />
          )}
          {seriesB && (
            <Bar
              dataKey={`${seriesB.id}_dhwTotalKw`}
              fill={colourB}
              opacity={0.5}
              name={`B: ${seriesB.label}`}
              isAnimationActive={false}
            />
          )}
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Row 3: Heat Source Output */}
      <div style={subLabel}>Heat Source Output (kW)</div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart key={`${chartKey}_output`} data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fontSize: 9 }} width={32} unit="kW" />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined) => [v !== undefined ? `${v.toFixed(2)} kW` : ''] as [string]}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.78rem' }}
            formatter={(value: string) => {
              if (seriesA && value === `${seriesA.id}_heatKw`) return `A: ${seriesA.label}`;
              if (seriesB && value === `${seriesB.id}_heatKw`) return `B: ${seriesB.label}`;
              return value;
            }}
          />
          {bandShading}
          {seriesA && (
            <Line
              type="monotone"
              dataKey={`${seriesA.id}_heatKw`}
              stroke={colourA}
              strokeWidth={2.5}
              dot={false}
            />
          )}
          {seriesB && (
            <Line
              type="monotone"
              dataKey={`${seriesB.id}_heatKw`}
              stroke={colourB}
              strokeWidth={2.5}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Row 4: Performance (η / COP) */}
      <div style={subLabel}>Performance ({perfLabel})</div>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart
          key={`${chartKey}_perf`}
          data={data}
          margin={chartMargin}
          onMouseMove={(state) => {
            const hoverIndex = state?.activeTooltipIndex;
            onHoverIndexChange?.(typeof hoverIndex === 'number' ? hoverIndex : null);
          }}
          onMouseLeave={() => onHoverIndexChange?.(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis {...xAxisProps} />
          <YAxis tick={{ fontSize: 9 }} width={32} domain={perfDomain} />
          <Tooltip
            contentStyle={{ fontSize: '0.78rem', borderRadius: '6px' }}
            formatter={(v: number | undefined, name: string | undefined) => {
              // Show η or COP label based on series kind
              const s = payload.series.find(s => (name ?? '').startsWith(s.id));
              const kind = s?.performanceKind ?? (hasCop ? 'cop' : 'eta');
              const display = v !== undefined ? `${kind === 'cop' ? 'COP' : 'η'} ${v.toFixed(2)}` : '';
              // Negative performance note
              const note = v !== undefined && v < 0 ? ' (net loss)' : '';
              return [`${display}${note}`, name ?? ''] as [string, string];
            }}
          />
          {/* Baseline at 0 for negative-performance context */}
          <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
          {/* Boiler η = 1 reference */}
          {!hasCop && (
            <ReferenceLine y={1} stroke="#e2e8f0" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'η 1.0', fontSize: 7, fill: '#a0aec0' }} />
          )}
          {bandShading}
          {seriesA && (
            <Line
              type="monotone"
              dataKey={`${seriesA.id}_eff`}
              stroke={colourA}
              strokeWidth={1.5}
              dot={false}
              name={`${seriesA.id}_${seriesA.performanceKind ?? 'eta'}`}
            />
          )}
          {seriesB && (
            <Line
              type="monotone"
              dataKey={`${seriesB.id}_eff`}
              stroke={colourB}
              strokeWidth={1.5}
              dot={false}
              name={`${seriesB.id}_${seriesB.performanceKind ?? 'eta'}`}
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
                background: DHW_BAR_COLOURS[ev.kind] ?? '#e2e8f0',
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
