/**
 * DrawOffStatusPanel — live outlet monitor panel.
 *
 * PR4:  driven by SystemDiagramDisplayState via useDrawOffPlayback.
 * PR15: adds stored hot water reserve indicator for cylinder systems.
 *
 * Architecture:
 *   SimulatorDashboard → useDrawOffPlayback(diagramState) → DrawOffDisplayState
 *   DrawOffStatusPanel({ state }) → DrawOffPanel (render layer)
 *                                 → StoredHotWaterReservePanel (cylinder only)
 *
 * The panel is a display adapter: it never re-derives outlet truth from raw
 * systemType booleans.  useDrawOffPlayback is the single mapping layer.
 */

import { DrawOffPanel } from '../../animation/render/DrawOffPanel'
import type { DrawOffDisplayState } from '../useDrawOffPlayback'
import StoredHotWaterReservePanel from './StoredHotWaterReservePanel'

interface DrawOffStatusPanelProps {
  state: DrawOffDisplayState
  mode: 'auto' | 'manual'
  heatingEnabled: boolean
  shower: boolean
  bath: boolean
  kitchen: boolean
  onSetMode: (mode: 'auto' | 'manual') => void
  onToggleHeating: () => void
  onToggleShower: () => void
  onToggleBath: () => void
  onToggleKitchen: () => void
  onPresetOne: () => void
  onPresetTwo: () => void
  onPresetBathFill: () => void
}

export default function DrawOffStatusPanel({ state, ...controls }: DrawOffStatusPanelProps) {
  return (
    <>
      <DrawOffPanel
        outletStates={state.outletStates}
        systemMode={state.systemMode}
        isCylinder={state.isCylinder}
        serviceSwitchingActive={state.serviceSwitchingActive}
        combiAtCapacity={state.combiAtCapacity}
        mode={controls.mode}
        heatingEnabled={controls.heatingEnabled}
        showerOn={controls.shower}
        bathOn={controls.bath}
        kitchenOn={controls.kitchen}
        onSetMode={controls.onSetMode}
        onToggleHeating={controls.onToggleHeating}
        onToggleShower={controls.onToggleShower}
        onToggleBath={controls.onToggleBath}
        onToggleKitchen={controls.onToggleKitchen}
        onPresetOne={controls.onPresetOne}
        onPresetTwo={controls.onPresetTwo}
        onPresetBathFill={controls.onPresetBathFill}
      />
      {state.storedHotWaterState !== null && (
        <StoredHotWaterReservePanel state={state.storedHotWaterState} />
      )}
    </>
  )
}
