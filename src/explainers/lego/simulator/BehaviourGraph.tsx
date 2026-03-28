/**
 * BehaviourGraph — live "System Behaviour" panel for the Simulator Dashboard.
 *
 * Renders two compact synchronized charts driven by the rolling timeline buffer
 * produced by useBehaviourTimeline:
 *
 *   Chart 1 – Services Demand:  space-heating demand (kW) + DHW demand (kW)
 *   Chart 2 – System Response:  heat-source output (kW) + optional efficiency band
 *
 * Both charts share the same tick-based x-axis so they are visually aligned.
 * Event markers (tap opened, heating paused, burner on, recovery) appear as
 * vertical reference lines on the demand chart.
 *
 * Rules enforced:
 *   - No Math.random() — all data comes from the live simulator state via
 *     useBehaviourTimeline.
 *   - Efficiency shown only for boiler systems using computeCurrentEfficiencyPct
 *     (imported from engine/utils/efficiency).
 *   - Heat pump systems show COP instead of efficiency %.
 */

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipProps,
} from 'recharts'
import type { BehaviourTimelineState, BehaviourEventKind } from './useBehaviourTimeline'
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback'
import './behaviourGraph.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Rolling timeline data from useBehaviourTimeline. */
  timeline: BehaviourTimelineState
  /** Current simulator system choice — controls labelling and series visibility. */
  systemChoice: SimulatorSystemChoice
  /**
   * Maximum kW to show on the y-axis of the System Response chart.
   * Typically max(boilerOutputKw, combiPowerKw) or heatLossKw.
   */
  maxKw: number
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const EVENT_STROKE: Record<BehaviourEventKind, string> = {
  tap_opened:     '#0bc5ea',
  heating_paused: '#e53e3e',
  burner_ramped:  '#dd6b20',
  recovery:       '#48bb78',
}

/** Fractional padding added above the max kW value for the y-axis domain. */
const Y_AXIS_PADDING_MULTIPLIER = 1.15

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function DemandTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bgi-tooltip">
      {payload.map(p => (
        <div key={p.dataKey as string} style={{ color: p.color }}>
          {p.name}: <strong>{(p.value as number).toFixed(1)} kW</strong>
        </div>
      ))}
    </div>
  )
}

function ResponseTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bgi-tooltip">
      {payload.map(p => {
        const unit = (p.dataKey as string) === 'efficiencyPct' ? '%' : 'kW'
        return (
          <div key={p.dataKey as string} style={{ color: p.color }}>
            {p.name}: <strong>{(p.value as number).toFixed(1)}{unit}</strong>
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BehaviourGraph({ timeline, systemChoice, maxKw }: Props) {
  const { ticks, eventMarkers } = timeline

  const isHeatPump = systemChoice === 'heat_pump'

  // Show loading state while the buffer fills.
  if (ticks.length < 4) {
    return (
      <div className="behaviour-graph behaviour-graph--loading" aria-live="polite">
        <span className="behaviour-graph__waiting">Building timeline…</span>
      </div>
    )
  }

  const yDemandMax = Math.ceil(maxKw * Y_AXIS_PADDING_MULTIPLIER)
  const yResponseMax = Math.ceil(maxKw * Y_AXIS_PADDING_MULTIPLIER)
  const efficiencyInChart = !isHeatPump && ticks.some(t => t.efficiencyPct !== null)

  return (
    <div className="behaviour-graph" data-testid="behaviour-graph">

      {/* ── Chart 1: Services Demand ── */}
      <div className="behaviour-graph__section">
        <div className="behaviour-graph__label">Services demand</div>
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart
            data={ticks}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            syncId="behaviour"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis
              domain={[0, yDemandMax]}
              tickCount={3}
              tick={{ fontSize: 9, fill: '#718096' }}
              tickFormatter={v => `${v}k`}
              width={28}
              allowDecimals={false}
            />
            <Tooltip content={<DemandTooltip />} />

            {/* Space-heating demand — filled area */}
            <Area
              type="stepAfter"
              dataKey="heatDemandKw"
              name="Heat demand"
              stroke="#4299e1"
              fill="#bee3f8"
              fillOpacity={0.6}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* DHW demand — teal filled area */}
            <Area
              type="stepAfter"
              dataKey="dhwDemandKw"
              name="DHW demand"
              stroke="#0bc5ea"
              fill="#c4f1f9"
              fillOpacity={0.55}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Event markers */}
            {eventMarkers.map(ev => (
              <ReferenceLine
                key={`d-${ev.t}-${ev.kind}`}
                x={ev.t}
                stroke={EVENT_STROKE[ev.kind]}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={{
                  value: ev.label,
                  position: 'insideTopRight',
                  fontSize: 8,
                  fill: EVENT_STROKE[ev.kind],
                  offset: 3,
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Chart 2: System Response ── */}
      <div className="behaviour-graph__section">
        <div className="behaviour-graph__label">System response</div>
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart
            data={ticks}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            syncId="behaviour"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis
              yAxisId="kw"
              domain={[0, yResponseMax]}
              tickCount={3}
              tick={{ fontSize: 9, fill: '#718096' }}
              tickFormatter={v => `${v}k`}
              width={28}
              allowDecimals={false}
            />
            {efficiencyInChart && (
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[50, 100]}
                tickCount={3}
                tick={{ fontSize: 9, fill: '#718096' }}
                tickFormatter={v => `${v}%`}
                width={30}
              />
            )}
            <Tooltip content={<ResponseTooltip />} />

            {/* Heat-source output — orange filled area (stepped) */}
            <Area
              yAxisId="kw"
              type="stepAfter"
              dataKey="heatKw"
              name={isHeatPump ? 'HP output' : 'Boiler output'}
              stroke="#dd6b20"
              fill="#fbd38d"
              fillOpacity={0.55}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Efficiency band — only for boiler systems */}
            {efficiencyInChart && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="efficiencyPct"
                name="Efficiency"
                stroke="#68d391"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}

            {/* Mirror event markers so both charts stay aligned */}
            {eventMarkers.map(ev => (
              <ReferenceLine
                key={`r-${ev.t}-${ev.kind}`}
                yAxisId="kw"
                x={ev.t}
                stroke={EVENT_STROKE[ev.kind]}
                strokeWidth={1}
                strokeDasharray="3 2"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
