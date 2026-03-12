/**
 * TimelineEfficiencyStrip.tsx
 *
 * Thin secondary band rendered directly below the main Timeline chart.
 * Shows boiler efficiency (%) or heat-pump COP over the 24-hour period.
 * X-axis alignment matches the main chart margins so both layers feel like
 * one integrated panel.
 *
 * Hidden cleanly (renders null) when no efficiency / COP data is present.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TimelineSeriesPoint } from '../../contracts/EngineOutputV1';

interface Props {
  points: TimelineSeriesPoint[];
  isAshp: boolean;
  hoverIndex: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMouseMove: (e: any) => void;
  onMouseLeave: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick: (e: any) => void;
}

const STRIP_HEIGHT = 64;
const STRIP_MARGIN = { top: 2, right: 16, left: 0, bottom: 0 };

/** Show only major hour ticks — same frequency as the main chart. */
function xTickFormatter(value: number): string {
  if (value % 6 !== 0 && value !== 24) return '';
  return `${Math.round(value)}`;
}

/** Format an efficiency/COP value consistently for axis ticks and tooltips. */
function formatPerfValue(v: number, isAshp: boolean): string {
  return isAshp ? `COP ${v.toFixed(2)}` : `η ${(v * 100).toFixed(1)}%`;
}

/** Short axis tick label (no prefix for COP, percent symbol for η). */
function perfTickFormatter(v: number, isAshp: boolean): string {
  return isAshp ? v.toFixed(1) : `${(v * 100).toFixed(0)}%`;
}

export default function TimelineEfficiencyStrip({
  points,
  isAshp,
  hoverIndex,
  onMouseMove,
  onMouseLeave,
  onClick,
}: Props) {
  const hasData = points.some(p => (isAshp ? p.cop != null : p.efficiency != null));
  if (!hasData) return null;

  const domain: [number, number] = isAshp ? [1, 5] : [0.5, 1.0];
  const refY = isAshp ? undefined : 1.0;
  const dataKey = isAshp ? 'cop' : 'efficiency';

  return (
    <div className="btp-efficiency-strip" aria-label={isAshp ? 'COP strip' : 'Efficiency strip'}>
      <span className="btp-strip-label">{isAshp ? 'COP' : 'Efficiency'}</span>
      <ResponsiveContainer width="100%" height={STRIP_HEIGHT}>
        <LineChart
          data={points}
          margin={STRIP_MARGIN}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            type="number"
            dataKey="tHour"
            domain={[0, 24]}
            ticks={[0, 6, 12, 18, 24]}
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 9, fill: '#718096' }}
            interval={0}
            height={16}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 9, fill: '#718096' }}
            width={32}
            tickFormatter={v => perfTickFormatter(v, isAshp)}
          />
          <Tooltip
            contentStyle={{ fontSize: '0.72rem', borderRadius: 6, padding: '4px 8px' }}
            formatter={(v: number | undefined) => {
              if (v == null) return ['—'];
              return [formatPerfValue(v, isAshp)];
            }}
          />
          {hoverIndex != null && (
            <ReferenceLine
              x={points[hoverIndex]?.tHour}
              stroke="#718096"
              strokeDasharray="3 3"
            />
          )}
          {refY != null && (
            <ReferenceLine
              y={refY}
              stroke="#e2e8f0"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#805ad5"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
