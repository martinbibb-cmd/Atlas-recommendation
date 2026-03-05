// src/explainers/lego/animation/render/TokensLayer.tsx

import type { LabToken } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'
import { HEX_END } from '../simulation'
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
  /**
   * The colour that post-HEX pipe segments use (from achieved outlet temp or
   * cylinder store temp). When supplied every token in the post-HEX segment
   * (MAIN s ≥ HEX_END, or any branch) is tinted with the same colour, so
   * token and pipe colours always stay in sync regardless of the token's
   * stored heat content.
   */
  postHexThermalColor?: string
}) {
  const { tokens, coldInletC, polyMain, polyA, polyB, polyC, hydraulicFlowLpm, demandTotalLpm, postHexThermalColor } = props

  // throttle ∈ [1, 3]: 1 = demand fully met, 3 = badly throttled/restricted.
  // Guard demandTotalLpm === 0 explicitly (no demand → no restriction).
  const throttle = demandTotalLpm < THROTTLE_EPSILON
    ? 1
    : Math.min(3, Math.max(1, demandTotalLpm / Math.max(THROTTLE_EPSILON, hydraulicFlowLpm)))

  return (
    <>
      {tokens.map(t => {
        // Derive colour from the segment the token is currently in, not from
        // the token's stored heat content.  This keeps tokens in sync with
        // the pipe-segment colour which is driven by summary.achievedOutTempC
        // (combi) or cylinderTempC (stored), both of which may differ from
        // the animation-clamped heat injected on the token.
        //
        // Pre-HEX  (MAIN, s < HEX_END):  use the cold-inlet colour.
        // Post-HEX (MAIN s ≥ HEX_END, or any branch): use postHexThermalColor
        //          when provided; otherwise fall back to heatToTempC so
        //          cylinder tokens (which carry real store heat) still render
        //          correctly when the prop is absent.
        const isPostHex = t.route !== 'MAIN' || t.s >= HEX_END
        const fill = (isPostHex && postHexThermalColor)
          ? postHexThermalColor
          : tempToThermalColor(heatToTempC({ coldInletC, hJPerKg: t.hJPerKg }))

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
