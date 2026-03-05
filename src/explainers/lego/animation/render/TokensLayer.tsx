// src/explainers/lego/animation/render/TokensLayer.tsx

import type { LabToken } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'
import { mapSToPath } from './pathMap'
import type { Pt } from './pathMap'

/** Small epsilon to avoid division by zero when computing throttle ratio. */
const THROTTLE_EPSILON = 0.01

export function TokensLayer(props: {
  tokens: LabToken[]
  coldInletC: number
  polyMain: Pt[]
  polyA: Pt[]
  polyB: Pt[]
  polyC: Pt[]
  /** Actual hydraulic flow delivered (L/min) — used for throttle shape morphing. */
  hydraulicFlowLpm: number
  /** Total demand requested (L/min) — used for throttle shape morphing. */
  demandTotalLpm: number
}) {
  const { tokens, coldInletC, polyMain, polyA, polyB, polyC, hydraulicFlowLpm, demandTotalLpm } = props

  // throttle ∈ [1, 3]: 1 = demand fully met, 3 = badly throttled/restricted.
  // Guard demandTotalLpm === 0 explicitly (no demand → no restriction).
  const throttle = demandTotalLpm < THROTTLE_EPSILON
    ? 1
    : Math.min(3, Math.max(1, demandTotalLpm / Math.max(THROTTLE_EPSILON, hydraulicFlowLpm)))

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

        // Base token size from pressure proxy (p ∈ 0.25..1.1)
        const base = 4 + t.p * 2

        // rx widens with throttling (restricted flow "smears" the token horizontally)
        const rx = base * (1 + 0.6 * (throttle - 1))
        // ry grows with pressure (high pressure "pushes" the token vertically)
        const ry = base * (0.8 + 0.6 * t.p)

        return (
          <ellipse
            key={t.id}
            cx={pos.x}
            cy={pos.y}
            rx={rx}
            ry={ry}
            fill={fill}
            opacity={0.95}
          />
        )
      })}
    </>
  )
}
