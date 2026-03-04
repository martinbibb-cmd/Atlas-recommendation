// src/explainers/lego/animation/render/TokensLayer.tsx

import type { LabToken } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'
import { mapSToPath } from './pathMap'
import type { Pt } from './pathMap'

export function TokensLayer(props: {
  tokens: LabToken[]
  coldInletC: number
  polyMain: Pt[]
  polyA: Pt[]
  polyB: Pt[]
  polyC: Pt[]
}) {
  const { tokens, coldInletC, polyMain, polyA, polyB, polyC } = props

  return (
    <>
      {tokens.map(t => {
        const tempC = heatToTempC({ coldInletC, hJPerKg: t.hJPerKg })
        const fill = tempToThermalColor(tempC)

        const poly =
          t.route === 'MAIN' ? polyMain :
          t.route === 'A'    ? polyA :
          t.route === 'B'    ? polyB : polyC

        const pos = mapSToPath(t.s, poly)

        // token size from pressure proxy (p)
        const r = 4 + t.p * 3

        return (
          <circle
            key={t.id}
            cx={pos.x}
            cy={pos.y}
            r={r}
            fill={fill}
            opacity={0.95}
          />
        )
      })}
    </>
  )
}
