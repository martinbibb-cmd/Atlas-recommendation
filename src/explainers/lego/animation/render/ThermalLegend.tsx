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
 * The required-temperature (setpoint) marker uses a thicker orange stroke
 * with a subtle glow and a CSS-transition so it animates smoothly when the
 * target temperature changes.
 */
export function ThermalLegend({ coldInletC, setpointC, bands }: ThermalLegendProps) {
  const gradientId = 'thermal-legend-grad'
  const glowId     = 'setpoint-glow'

  // Build gradient stops from the thermal palette
  const minT = bands[0].t
  const maxT = bands[bands.length - 1].t
  const range = maxT - minT || 1

  const setpointYPos = 10 + 100 - ((Math.min(setpointC, maxT) - minT) / range) * 100

  return (
    <svg width={60} height={150} aria-label="Thermal colour legend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          {bands.map((b, i) => {
            const offset = ((b.t - minT) / range) * 100
            return <stop key={i} offset={`${offset.toFixed(1)}%`} stopColor={b.hex} />
          })}
        </linearGradient>

        {/* Glow filter for the required-temperature marker */}
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
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

      {/*
        Setpoint tick — orange, thicker, subtle glow, and CSS-transition so it
        eases smoothly to its new position when the required temperature changes.
        `transform: translateY(...)` is used (rather than a `y` attribute) because
        CSS transitions only animate transform / opacity on SVG elements in all
        major browsers.
      */}
      <g
        style={{
          transform: `translateY(${setpointYPos}px)`,
          transition: 'transform 300ms ease-in-out',
        }}
      >
        <line
          x1={8} y1={0} x2={32} y2={0}
          stroke="#ea580c"
          strokeWidth={2.5}
          filter={`url(#${glowId})`}
        />
        <text x={32} y={-4} fontSize={9} fill="#ea580c" fontWeight={700}>Target</text>
        <text x={32} y={8}  fontSize={9} fill="#ea580c">{setpointC} °C</text>
      </g>

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
