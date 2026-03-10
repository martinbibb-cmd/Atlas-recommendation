/**
 * DrawOffStatusPanel — live outlet monitor panel.
 *
 * PR4: driven by SystemDiagramDisplayState via useDrawOffPlayback.
 * Replaces the PR1 static placeholder.
 *
 * Architecture:
 *   SimulatorDashboard → useDrawOffPlayback(diagramState) → DrawOffDisplayState
 *   DrawOffStatusPanel({ state }) → DrawOffPanel (render layer)
 *
 * The panel is a display adapter: it never re-derives outlet truth from raw
 * systemType booleans.  useDrawOffPlayback is the single mapping layer.
 */

import { DrawOffPanel } from '../../animation/render/DrawOffPanel'
import type { DrawOffDisplayState } from '../useDrawOffPlayback'

interface DrawOffStatusPanelProps {
  state: DrawOffDisplayState
}

export default function DrawOffStatusPanel({ state }: DrawOffStatusPanelProps) {
  return (
    <DrawOffPanel
      outletStates={state.outletStates}
      systemMode={state.systemMode}
      isCylinder={state.isCylinder}
      serviceSwitchingActive={state.serviceSwitchingActive}
      combiAtCapacity={state.combiAtCapacity}
    />
  )
}
