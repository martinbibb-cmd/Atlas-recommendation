// src/explainers/lego/animation/render/TokensLayer.tsx

import type { LabToken } from '../types'
import { heatToTempC, tempToThermalColor } from '../thermal'
import { mapSToPath } from './pathMap'
import type { Pt } from './pathMap'

export function TokensLayer(props: {
  tokens: LabToken[]
  coldInletC: number
  mainPolyline: Pt[]
  /** Outlet-A branch polyline — empty array when outlets === 1. */
  branch1: Pt[]
  /** Outlet-B branch polyline — empty array when outlets === 1. */
  branch2: Pt[]
  outlets: number
}) {
  const { tokens, coldInletC, mainPolyline, branch1, branch2, outlets } = props

  return (
    <>
      {tokens.map(t => {
        const tempC = heatToTempC({ coldInletC, hJPerKg: t.hJPerKg })
        const fill = tempToThermalColor(tempC)

        let pos: Pt

        if (outlets > 1 && branch1.length > 0 && branch2.length > 0) {
          // Tokens split at the splitter (s = 1 on main polyline).
          // Before splitting: map along main polyline up to s = 1.
          // After splitting: map along branch based on token-id parity.
          const tokenNum = parseInt(t.id.replace(/\D/g, ''), 10)
          const isOdd = tokenNum % 2 !== 0

          // Trunk covers s 0..0.8; branch covers s 0.8..1
          const SPLIT_S = 0.8
          if (t.s <= SPLIT_S) {
            // Still on trunk — normalise s so 0..SPLIT_S maps to full main polyline
            pos = mapSToPath(t.s / SPLIT_S, mainPolyline)
          } else {
            // On a branch — normalise remaining progress
            const branchS = (t.s - SPLIT_S) / (1 - SPLIT_S)
            pos = mapSToPath(branchS, isOdd ? branch2 : branch1)
          }
        } else {
          pos = mapSToPath(t.s, mainPolyline)
        }

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
