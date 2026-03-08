// src/explainers/lego/animation/render/TokensLayer.tsx

import type { FlowParticle } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'
import { HEX_END } from '../simulation'
import { mapSToPath } from './pathMap'
import type { Pt } from './pathMap'

/** Small epsilon to avoid division by zero when computing throttle ratio. */
const THROTTLE_EPSILON = 0.01

export function TokensLayer(props: {
  particles: FlowParticle[]
  coldInletC: number
  polyMain: Pt[]
  polyA: Pt[]
  polyB: Pt[]
  polyC: Pt[]
  /** Cold supply bypass polyline for TMV outlet A. May be empty when TMV is off. */
  polyColdA: Pt[]
  /**
   * Dynamic outlet branch polylines for outlets beyond A, B, C.
   * Keyed by outlet slot label (e.g. 'D', 'E', …).
   */
  extraPolylines?: Record<string, Pt[]>
  /** Actual hydraulic flow delivered (L/min) — used for throttle shape morphing. */
  hydraulicFlowLpm: number
  /** Total demand requested (L/min) — used for throttle shape morphing. */
  demandTotalLpm: number
  /**
   * The colour that post-HEX pipe segments use (from achieved outlet temp or
   * cylinder store temp). When supplied every token in the post-HEX segment
   * (MAIN s ≥ hexEnd, or any branch) is tinted with the same colour, so
   * token and pipe colours always stay in sync regardless of the token's
   * stored heat content.
   * Cold supply bypass tokens (COLD_A) always use the cold inlet colour and
   * are never overridden by this prop.
   */
  postHexThermalColor?: string
  /**
   * Override the s-fraction at which MAIN tokens transition from cold to
   * post-HEX colour.  When undefined the default `HEX_END` constant from
   * simulation.ts is used (combi systems).  Pass `STORED_HEX_END` for
   * stored-cylinder systems so the colour transition happens at the cylinder
   * top exit rather than the boiler exit.
   */
  hexEnd?: number
}) {
  const { particles, coldInletC, polyMain, polyA, polyB, polyC, polyColdA,
          extraPolylines, hydraulicFlowLpm, demandTotalLpm, postHexThermalColor, hexEnd } = props

  // Effective HEX end: use caller-supplied value for stored systems (STORED_HEX_END),
  // or fall back to the default combi constant.
  const effectiveHexEnd = hexEnd ?? HEX_END

  // throttle ∈ [1, 3]: 1 = demand fully met, 3 = badly throttled/restricted.
  // Guard demandTotalLpm === 0 explicitly (no demand → no restriction).
  const throttle = demandTotalLpm < THROTTLE_EPSILON
    ? 1
    : Math.min(3, Math.max(1, demandTotalLpm / Math.max(THROTTLE_EPSILON, hydraulicFlowLpm)))

  return (
    <>
      {particles.map(t => {
        // Derive colour from the segment the token is currently in, not from
        // the token's stored heat content.  This keeps tokens in sync with
        // the pipe-segment colour which is driven by summary.achievedOutTempC
        // (combi) or cylinderTempC (stored), both of which may differ from
        // the animation-clamped heat injected on the token.
        //
        // Cold supply bypass (COLD_A): always cold-inlet colour — these tokens
        // bypass the HEX and carry no heat.
        // Pre-HEX  (MAIN, s < HEX_END):  use the cold-inlet colour.
        // Post-HEX (MAIN s ≥ HEX_END, or any branch except COLD_A): use
        //          postHexThermalColor when provided; otherwise fall back to
        //          heatToTempC so cylinder tokens still render correctly.
        const isColdBypass = t.route === 'COLD_A'
        const isPostHex = !isColdBypass && (t.route !== 'MAIN' || t.s >= effectiveHexEnd)
        const fill = isColdBypass
          ? tempToThermalColor(coldInletC)  // cold supply — always cold colour
          : (isPostHex && postHexThermalColor)
            ? postHexThermalColor
            : tempToThermalColor(heatToTempC({ coldInletC, hJPerKg: t.hJPerKg }))

        // Resolve which polyline this token should travel along.
        // A/B/C use the named legacy props; extra slots use extraPolylines.
        const poly =
          t.route === 'MAIN'   ? polyMain :
          t.route === 'A'      ? polyA :
          t.route === 'B'      ? polyB :
          t.route === 'COLD_A' ? (() => {
            if (import.meta.env?.DEV && polyColdA.length === 0) {
              console.warn('[TokensLayer] COLD_A token present but polyColdA is empty — TMV polyline missing')
            }
            return polyColdA.length > 0 ? polyColdA : polyA
          })() :
          t.route === 'C'      ? polyC :
          // Dynamic extra branch (D, E, F, …) — look up in extraPolylines.
          (extraPolylines?.[t.route] ?? polyC)

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
