// src/explainers/lego/animation/render/TokensLayer.tsx

import type { LabToken } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'

export function TokensLayer(props: {
  tokens: LabToken[]
  coldInletC: number
}) {
  const { tokens, coldInletC } = props

  return (
    <>
      {tokens.map(t => {
        const tempC = heatToTempC({ coldInletC, hJPerKg: t.hJPerKg })
        const fill = tempToThermalColor(tempC)

        // PR1: render tokens on a simple horizontal guide.
        // We'll later render along actual block paths.
        const x = 80 + t.s * 800
        const y = 120

        // token size from pressure proxy (p)
        const r = 4 + t.p * 3

        return (
          <circle
            key={t.id}
            cx={x}
            cy={y}
            r={r}
            fill={fill}
            opacity={0.95}
          />
        )
      })}
    </>
  )
}
