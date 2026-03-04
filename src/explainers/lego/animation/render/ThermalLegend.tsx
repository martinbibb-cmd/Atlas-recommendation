// src/explainers/lego/animation/render/ThermalLegend.tsx

import type { ThermalBand } from '../thermal'

interface ThermalLegendProps {
  coldInletC: number
  setpointC: number
  bands: ThermalBand[]
}

/**
 * A compact FLIR-style vertical gradient legend.
 * Renders a colour bar from cold inlet to DHW setpoint with °C labels.
 */
export function ThermalLegend({ coldInletC, setpointC, bands }: ThermalLegendProps) {
  const gradientId = 'thermal-legend-grad'

  // Build gradient stops from the thermal palette
  const minT = bands[0].t
  const maxT = bands[bands.length - 1].t
  const range = maxT - minT || 1

  return (
    <svg width={52} height={140} aria-label="Thermal colour legend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          {bands.map((b, i) => {
            const offset = ((b.t - minT) / range) * 100
            return <stop key={i} offset={`${offset.toFixed(1)}%`} stopColor={b.hex} />
          })}
        </linearGradient>
      </defs>

      {/* Colour bar */}
      <rect x={10} y={10} width={16} height={100} fill={`url(#${gradientId})`} rx={3} />

      {/* Cold inlet tick */}
      {(() => {
        const yPos = 10 + 100 - ((coldInletC - minT) / range) * 100
        return (
          <>
            <line x1={10} y1={yPos} x2={30} y2={yPos} stroke="#334155" strokeWidth={1} />
            <text x={32} y={yPos + 4} fontSize={9} fill="#334155">{coldInletC} °C</text>
          </>
        )
      })()}

      {/* Setpoint tick */}
      {(() => {
        const clampedSetpoint = Math.min(setpointC, maxT)
        const yPos = 10 + 100 - ((clampedSetpoint - minT) / range) * 100
        return (
          <>
            <line x1={10} y1={yPos} x2={30} y2={yPos} stroke="#334155" strokeWidth={1} />
            <text x={32} y={yPos + 4} fontSize={9} fill="#334155">{setpointC} °C</text>
          </>
        )
      })()}

      {/* Legend label */}
      <text
        x={18}
        y={128}
        fontSize={8}
        fill="#64748b"
        textAnchor="middle"
      >
        °C
      </text>

      <title>Thermal palette: cold inlet {coldInletC} °C → setpoint {setpointC} °C</title>
    </svg>
  )
}
