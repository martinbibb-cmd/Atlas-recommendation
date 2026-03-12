/**
 * BehaviourTimelinePanel.tsx
 *
 * Single instrument-stage timeline for BehaviourTimelineV1.
 *
 * Layout:
 *   ┌─ Header: title · TimelineLegend · assumption chips ──────────┐
 *   ├─ Main chart: Heat demand (area) + DHW demand (area) +         │
 *   │              Appliance output (dominant line)                 │
 *   ├─ TimelineEfficiencyStrip: η or COP (thin, subordinate)        │
 *   └─ TimelineEventRail: mode-derived event markers (lightest)     ┘
 *
 * All layers share the same 24-hour X-axis so they feel like one panel.
 * No engine logic — purely presentational.
 */
import { useState, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { BehaviourTimelineV1, TimelineSeriesPoint } from '../../contracts/EngineOutputV1';
import TimelineLegend from './TimelineLegend';
import TimelineEfficiencyStrip from './TimelineEfficiencyStrip';
import TimelineEventRail from './TimelineEventRail';

interface Props {
  timeline: BehaviourTimelineV1;
}

// ── Colour constants ──────────────────────────────────────────────────────────

const HEAT_COLOR   = '#e53e3e';
const DHW_COLOR    = '#3182ce';
const OUTPUT_COLOR = '#38a169';

// ── Shared axis formatting ────────────────────────────────────────────────────

/** Show only major hour ticks (every 6 h at 15-min resolution). */
function xTickFormatter(value: number): string {
  if (value % 6 !== 0 && value !== 24) return '';
  return `${Math.round(value)}`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipPayloadProps {
  active?: boolean;
  isAshp: boolean;
  allData: TimelineSeriesPoint[];
  hoverIndex: number | null;
}

function SharedTooltip({ active, allData, hoverIndex }: TooltipPayloadProps) {
  if (!active || hoverIndex === null) return null;
  const pt = allData[hoverIndex];
  if (!pt) return null;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 5, color: '#2d3748' }}>🕐 {pt.t}</div>
      <div style={{ color: HEAT_COLOR }}>Heat: <b>{pt.heatDemandKw.toFixed(2)} kW</b></div>
      <div style={{ color: DHW_COLOR }}>
        DHW: <b>{(pt.dhwDrawDemandKw ?? pt.dhwDemandKw).toFixed(2)} kW</b>
      </div>
      <div style={{ color: OUTPUT_COLOR }}>
        Output: <b>{pt.applianceOutKw.toFixed(2)} kW</b>
        {pt.applianceCapKw != null && (
          <span style={{ color: '#718096' }}> / cap {pt.applianceCapKw} kW</span>
        )}
      </div>
      {pt.mode && (
        <div style={{ color: '#718096', marginTop: 3, fontSize: 11 }}>Mode: {pt.mode}</div>
      )}
    </div>
  );
}

// ── Annotation callout ────────────────────────────────────────────────────────

function AnnotationCallout({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 4,
        right: 8,
        background: '#fff3cd',
        border: '1px solid #f59e0b',
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 10,
        color: '#92400e',
        pointerEvents: 'none',
        zIndex: 1,
        maxWidth: '60%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={text}
    >
      📌 {text}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const MAIN_HEIGHT = 200;
const COMMON_MARGIN = { top: 4, right: 16, left: 0, bottom: 0 };

/** Background fill colour for the combi DHW-priority lockout band. */
const LOCKOUT_BAND_COLOR = DHW_COLOR;
const LOCKOUT_BAND_OPACITY = 0.08;

export default function BehaviourTimelinePanel({ timeline }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isAshp  = timeline.labels.efficiencyLabel === 'COP';
  const isCombi = timeline.labels.isCombi ?? false;
  const pts     = timeline.points;

  // ── Derived callout values ────────────────────────────────────────
  const peakHeatKw   = Math.max(...pts.map(p => p.heatDemandKw));
  const peakDhwKw    = Math.max(...pts.map(p => p.dhwApplianceOutKw ?? p.dhwDemandKw));
  const peakOutputKw = Math.max(...pts.map(p => p.applianceOutKw));

  const saturationSteps = pts.filter(
    p => p.applianceCapKw != null && p.applianceOutKw >= p.applianceCapKw * 0.98,
  ).length;
  const saturationMins = saturationSteps * timeline.resolutionMins;

  // ── Unified Y-axis for main chart ─────────────────────────────────
  const yMax = Math.max(peakHeatKw, peakDhwKw, peakOutputKw) * 1.1;
  const mainYMax = Math.max(yMax, 5);

  // ── Combi lockout bands ───────────────────────────────────────────
  const lockoutBands: Array<{ x1: number; x2: number }> = [];
  if (isCombi) {
    let bandStart: number | null = null;
    for (let i = 0; i < pts.length; i++) {
      const m = pts[i].mode;
      const inLockout = m === 'dhw' || m === 'mixed';
      if (inLockout && bandStart === null) {
        bandStart = pts[i].tHour;
      } else if (!inLockout && bandStart !== null) {
        lockoutBands.push({ x1: bandStart, x2: pts[i - 1].tHour });
        bandStart = null;
      }
    }
    if (bandStart !== null) {
      lockoutBands.push({ x1: bandStart, x2: pts[pts.length - 1].tHour });
    }
  }

  // ── Shared chart event handlers ───────────────────────────────────
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

  const xAxisProps = {
    type: 'number' as const,
    dataKey: 'tHour',
    domain: [0, 24] as [number, number],
    ticks: [0, 6, 12, 18, 24],
    tickFormatter: xTickFormatter,
    tick: { fontSize: 10, fill: '#718096' },
    interval: 0,
    height: 20,
  };

  const hasEffData = pts.some(p => (p.efficiency ?? p.cop) != null);

  // Annotations
  const annotations   = timeline.annotations ?? [];
  const outAnnotation = annotations.find(a => a.row === 'out');

  // Saturation callout for tooltip
  const outputCallout = saturationMins > 0
    ? `Saturated ${saturationMins}m`
    : `Peak ${peakOutputKw.toFixed(1)} kW`;

  return (
    <div className="btp-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="btp-header">
        <div className="btp-title-group">
          <span className="btp-header__title">
            Thermodynamic Timeline · {timeline.labels.applianceName}
          </span>
          <span className="btp-header__callout">{outputCallout}</span>
        </div>
        <TimelineLegend
          efficiencyLabel={timeline.labels.efficiencyLabel}
          showEfficiency={hasEffData}
        />
      </div>

      {/* ── Assumption chips ─────────────────────────────────────── */}
      {timeline.assumptionsUsed.length > 0 && (
        <div className="btp-chip-row">
          {timeline.assumptionsUsed.map(a => (
            <span
              key={a.id}
              title={a.details}
              className={`atlas-chip atlas-chip--${a.severity === 'warn' ? 'warn' : 'info'}`}
            >
              {a.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Main chart ───────────────────────────────────────────── */}
      <div className="btp-main" style={{ position: 'relative' }}>
        {outAnnotation && <AnnotationCallout text={outAnnotation.text} />}
        <ResponsiveContainer width="100%" height={MAIN_HEIGHT}>
          <ComposedChart
            data={pts}
            margin={COMMON_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            {/* X axis hidden — shared tick labels shown on efficiency strip below */}
            <XAxis {...xAxisProps} hide />
            <YAxis
              domain={[0, mainYMax]}
              tick={{ fontSize: 10, fill: '#718096' }}
              width={32}
              tickFormatter={v => v.toFixed(0)}
              unit=" kW"
            />
            <Tooltip
              content={
                <SharedTooltip
                  isAshp={isAshp}
                  allData={pts}
                  hoverIndex={hoverIndex}
                />
              }
            />
            {hoverIndex != null && (
              <ReferenceLine
                x={pts[hoverIndex]?.tHour}
                stroke="#718096"
                strokeDasharray="3 3"
              />
            )}

            {/* Combi lockout band shading */}
            {lockoutBands.map((band, i) => (
              <ReferenceArea
                key={i}
                x1={band.x1}
                x2={band.x2}
                fill={LOCKOUT_BAND_COLOR}
                fillOpacity={LOCKOUT_BAND_OPACITY}
                strokeOpacity={0}
              />
            ))}

            {/* Heat demand — secondary area (red, translucent) */}
            <Area
              type="monotone"
              dataKey="heatDemandKw"
              stroke={HEAT_COLOR}
              fill="#fed7d7"
              fillOpacity={0.5}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="Heat"
            />

            {/* DHW demand — secondary area (blue, translucent) */}
            <Area
              type="monotone"
              dataKey="dhwApplianceOutKw"
              stroke={DHW_COLOR}
              fill="#bee3f8"
              fillOpacity={0.5}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="DHW"
            />

            {/* Combi delivered-heat overlay — reveals lockout gap */}
            {isCombi && (
              <Area
                type="monotone"
                dataKey="deliveredHeatKw"
                stroke={OUTPUT_COLOR}
                fill="#c6f6d5"
                fillOpacity={0.3}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
                name="Delivered"
              />
            )}

            {/* Appliance output — dominant line (green, thick) */}
            <Line
              type="monotone"
              dataKey="applianceOutKw"
              stroke={OUTPUT_COLOR}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
              name="Output"
            />

            {/* Capacity ceiling line */}
            {pts[0]?.applianceCapKw != null && (
              <ReferenceLine
                y={pts[0].applianceCapKw}
                stroke={OUTPUT_COLOR}
                strokeDasharray="5 3"
                strokeOpacity={0.5}
                label={{
                  value: `Cap ${pts[0].applianceCapKw} kW`,
                  position: 'insideTopRight',
                  fontSize: 9,
                  fill: OUTPUT_COLOR,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Efficiency strip ─────────────────────────────────────── */}
      <TimelineEfficiencyStrip
        points={pts}
        isAshp={isAshp}
        hoverIndex={hoverIndex}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* ── Event rail ───────────────────────────────────────────── */}
      <TimelineEventRail points={pts} />
    </div>
  );
}
