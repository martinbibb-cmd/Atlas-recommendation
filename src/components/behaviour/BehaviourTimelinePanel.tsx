/**
 * BehaviourTimelinePanel.tsx
 *
 * Renders a BehaviourTimelineV1 as four stacked, time-synchronized rows:
 *   1. Heat demand (kW) — area line
 *   2. DHW demand (kW)  — bars
 *   3. Appliance output (kW) + capacity line
 *   4. Efficiency or COP
 *
 * All rows share a single hoverIndex (crosshair) driven by mouse/touch events.
 * No legends — each row has a direct label on the left.
 * Y-axis domains are locked (no auto-scaling):
 *   - Heat/output: 0 → max(peak * 1.1, 5)
 *   - Efficiency: 0.5 → 1.0 (boiler) / COP: 1 → 5 (ASHP)
 *
 * Timeline rendering is purely presentational — no physics in this component.
 */
import { useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { BehaviourTimelineV1, TimelineSeriesPoint } from '../../contracts/EngineOutputV1';

interface Props {
  timeline: BehaviourTimelineV1;
}

// ── Shared axis formatting ────────────────────────────────────────────────────

/** Show only every 4th label (every hour at 15-min resolution). */
function xTickFormatter(value: string, index: number): string {
  return index % 4 === 0 ? value : '';
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  label?: string;
  isAshp: boolean;
  allData: TimelineSeriesPoint[];
  hoverIndex: number | null;
}

function SharedTooltip({ active, label, isAshp, allData, hoverIndex }: TooltipProps) {
  if (!active || hoverIndex === null) return null;
  const pt = allData[hoverIndex];
  if (!pt) return null;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#2d3748' }}>🕐 {label ?? pt.t}</div>
      <div style={{ color: '#e53e3e' }}>Heat demand: <b>{pt.heatDemandKw.toFixed(2)} kW</b></div>
      <div style={{ color: '#3182ce' }}>DHW demand: <b>{pt.dhwDemandKw.toFixed(2)} kW</b></div>
      <div style={{ color: '#38a169' }}>
        Appliance output: <b>{pt.applianceOutKw.toFixed(2)} kW</b>
        {pt.applianceCapKw != null && (
          <span style={{ color: '#718096' }}> / cap {pt.applianceCapKw} kW</span>
        )}
      </div>
      <div style={{ color: '#805ad5' }}>
        {isAshp ? 'COP' : 'Efficiency'}:{' '}
        <b>
          {isAshp
            ? (pt.cop ?? '—')
            : pt.efficiency != null
            ? `${(pt.efficiency * 100).toFixed(1)}%`
            : '—'}
        </b>
      </div>
      {pt.mode && (
        <div style={{ color: '#718096', marginTop: 4 }}>Mode: {pt.mode}</div>
      )}
    </div>
  );
}

// ── Row label ─────────────────────────────────────────────────────────────────

function RowLabel({ label, callout }: { label: string; callout: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
        padding: '0 8px',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 13, color: '#2d3748' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#718096', fontStyle: 'italic' }}>{callout}</span>
    </div>
  );
}

// ── "Insufficient data" overlay ───────────────────────────────────────────────

function InsufficientDataOverlay({ height }: { height: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        height,
        background: 'rgba(255,255,255,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px dashed #cbd5e0',
        fontSize: 13,
        color: '#718096',
      }}
    >
      ⚠ Insufficient data for this row
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 110;
const COMMON_MARGIN = { top: 4, right: 16, left: 0, bottom: 0 };

export default function BehaviourTimelinePanel({ timeline }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isAshp = timeline.labels.efficiencyLabel === 'COP';
  const pts = timeline.points;

  // Derived callout values
  const peakHeatKw = Math.max(...pts.map(p => p.heatDemandKw));
  const peakDhwKw  = Math.max(...pts.map(p => p.dhwDemandKw));
  const peakDhwIdx = pts.findIndex(p => p.dhwDemandKw === peakDhwKw);
  const peakDhwTime = pts[peakDhwIdx]?.t ?? '';

  // Saturation: how many 15-min steps is appliance at cap?
  const saturationSteps = pts.filter(
    p => p.applianceCapKw != null && p.applianceOutKw >= p.applianceCapKw * 0.98,
  ).length;
  const saturationMins = saturationSteps * timeline.resolutionMins;

  // Efficiency callout
  const minEfficiency = pts
    .filter(p => p.efficiency != null)
    .reduce((min, p) => (p.efficiency! < min ? p.efficiency! : min), 1);
  const minCop = pts
    .filter(p => p.cop != null)
    .reduce((min, p) => (p.cop! < min ? p.cop! : min), 5);

  // Y-axis domains
  const demandYMax = Math.max(peakHeatKw * 1.1, 5);
  const appYMax = Math.max(
    Math.max(...pts.map(p => p.applianceOutKw)) * 1.1,
    pts[0]?.applianceCapKw ?? 0,
    5,
  );

  // Shared chart event handlers using the Recharts parameter shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = useCallback((e: any) => {
    const idx = e?.activeTooltipIndex;
    if (typeof idx === 'number') setHoverIndex(idx);
  }, []);

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = useCallback((e: any) => {
    const idx = e?.activeTooltipIndex;
    if (typeof idx !== 'number') {
      setHoverIndex(null);
    } else if (hoverIndex === idx) {
      setHoverIndex(null);
    } else {
      setHoverIndex(idx);
    }
  }, [hoverIndex]);

  const tooltipProps = {
    content: (
      <SharedTooltip
        isAshp={isAshp}
        allData={pts}
        hoverIndex={hoverIndex}
      />
    ),
  };

  const xAxisProps = {
    dataKey: 't',
    tickFormatter: xTickFormatter,
    tick: { fontSize: 10, fill: '#718096' },
    interval: 0,
    height: 20,
  };

  const hasHeatData = pts.some(p => p.heatDemandKw > 0);
  const hasDhwData  = pts.some(p => p.dhwDemandKw > 0);
  const hasEffData  = pts.some(p => (p.efficiency ?? p.cop) != null);

  return (
    <div
      className="behaviour-timeline-panel"
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '16px 8px',
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ padding: '0 8px 12px', borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#2d3748' }}>
          Behaviour Timeline — {timeline.labels.applianceName}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>
          24-hour system behaviour at design conditions · 15-min resolution
        </p>
      </div>

      {/* Assumption badges */}
      {timeline.assumptionsUsed.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 12px' }}>
          {timeline.assumptionsUsed.map(a => (
            <span
              key={a.id}
              title={a.details}
              style={{
                background: a.severity === 'warn' ? '#fef3c7' : '#ebf8ff',
                border: `1px solid ${a.severity === 'warn' ? '#f59e0b' : '#90cdf4'}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                color: a.severity === 'warn' ? '#92400e' : '#2b6cb0',
                cursor: a.details ? 'help' : 'default',
              }}
            >
              {a.severity === 'warn' ? '⚠ ' : 'ℹ '}{a.label}
            </span>
          ))}
        </div>
      )}

      {/* Row 1: Heat demand */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <RowLabel
          label="Heat demand"
          callout={`Peak ${peakHeatKw.toFixed(1)} kW`}
        />
        {!hasHeatData && <InsufficientDataOverlay height={ROW_HEIGHT} />}
        <ResponsiveContainer width="100%" height={ROW_HEIGHT}>
          <AreaChart
            data={pts}
            margin={COMMON_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} hide />
            <YAxis
              domain={[0, demandYMax]}
              tick={{ fontSize: 10, fill: '#718096' }}
              width={32}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip {...tooltipProps} />
            {hoverIndex != null && (
              <ReferenceLine
                x={pts[hoverIndex]?.t}
                stroke="#718096"
                strokeDasharray="3 3"
              />
            )}
            <Area
              type="monotone"
              dataKey="heatDemandKw"
              stroke="#e53e3e"
              fill="#fed7d7"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: DHW demand (bars) */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <RowLabel
          label="Hot water"
          callout={peakDhwKw > 0 ? `Peak ${peakDhwKw.toFixed(1)} kW @ ${peakDhwTime}` : 'No DHW demand'}
        />
        {!hasDhwData && <InsufficientDataOverlay height={ROW_HEIGHT} />}
        <ResponsiveContainer width="100%" height={ROW_HEIGHT}>
          <BarChart
            data={pts}
            margin={COMMON_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} hide />
            <YAxis
              domain={[0, Math.max(peakDhwKw * 1.2, 5)]}
              tick={{ fontSize: 10, fill: '#718096' }}
              width={32}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip {...tooltipProps} />
            {hoverIndex != null && (
              <ReferenceLine
                x={pts[hoverIndex]?.t}
                stroke="#718096"
                strokeDasharray="3 3"
              />
            )}
            <Bar
              dataKey="dhwDemandKw"
              fill="#3182ce"
              opacity={0.75}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3: Appliance output + capacity line */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <RowLabel
          label="Appliance output"
          callout={
            saturationMins > 0
              ? `Saturated ${saturationMins}m`
              : `Peak ${Math.max(...pts.map(p => p.applianceOutKw)).toFixed(1)} kW`
          }
        />
        <ResponsiveContainer width="100%" height={ROW_HEIGHT}>
          <AreaChart
            data={pts}
            margin={COMMON_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} hide />
            <YAxis
              domain={[0, appYMax]}
              tick={{ fontSize: 10, fill: '#718096' }}
              width={32}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip {...tooltipProps} />
            {hoverIndex != null && (
              <ReferenceLine
                x={pts[hoverIndex]?.t}
                stroke="#718096"
                strokeDasharray="3 3"
              />
            )}
            <Area
              type="monotone"
              dataKey="applianceOutKw"
              stroke="#38a169"
              fill="#c6f6d5"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {/* Capacity line */}
            {pts[0]?.applianceCapKw != null && (
              <ReferenceLine
                y={pts[0].applianceCapKw}
                stroke="#38a169"
                strokeDasharray="5 3"
                strokeOpacity={0.6}
                label={{
                  value: `Cap ${pts[0].applianceCapKw} kW`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#38a169',
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4: Efficiency / COP */}
      <div style={{ position: 'relative' }}>
        <RowLabel
          label={timeline.labels.efficiencyLabel}
          callout={
            isAshp
              ? `Min COP ${minCop.toFixed(1)}`
              : hasEffData
              ? `Drops to ${(minEfficiency * 100).toFixed(0)}% during cycling`
              : 'No data'
          }
        />
        {!hasEffData && <InsufficientDataOverlay height={ROW_HEIGHT} />}
        <ResponsiveContainer width="100%" height={ROW_HEIGHT}>
          <LineChart
            data={pts}
            margin={COMMON_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} />
            <YAxis
              domain={isAshp ? [1, 5] : [0.5, 1.0]}
              tick={{ fontSize: 10, fill: '#718096' }}
              width={32}
              tickFormatter={v => isAshp ? v.toFixed(1) : `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip {...tooltipProps} />
            {hoverIndex != null && (
              <ReferenceLine
                x={pts[hoverIndex]?.t}
                stroke="#718096"
                strokeDasharray="3 3"
              />
            )}
            <Line
              type="monotone"
              dataKey={isAshp ? 'cop' : 'efficiency'}
              stroke="#805ad5"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
