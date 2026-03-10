// src/explainers/lego/animation/render/DrawOffPanel.tsx
import type { OutletDisplayState } from '../../state/outletDisplayState'
import type { SystemMode } from '../types'

export interface DrawOffPanelProps {
  outletStates: OutletDisplayState[]
  systemMode?: SystemMode
  isCylinder?: boolean
  serviceSwitchingActive?: boolean
  combiAtCapacity?: boolean
  mode?: 'auto' | 'manual'
  onSetMode?: (mode: 'auto' | 'manual') => void
  onToggleHeating?: () => void
  onToggleShower?: () => void
  onToggleBath?: () => void
  onToggleKitchen?: () => void
  onPresetOne?: () => void
  onPresetTwo?: () => void
  onPresetBathFill?: () => void
  heatingEnabled?: boolean
  showerOn?: boolean
  bathOn?: boolean
  kitchenOn?: boolean
}

const MAX_FLOW = 12


function serviceLabel(state: OutletDisplayState): string {
  if (!state.open || state.service === 'off') return 'Closed'
  if (state.service === 'cold_only') return 'Cold'
  if (state.service === 'hot_only') return 'Hot'
  if (state.service === 'mixed_cold_running') return 'Mixed — cold'
  return 'Mixed'
}

function tempColor(tempC: number | undefined): string {
  if (tempC === undefined) return '#cbd5e1'
  if (tempC < 35) return '#60a5fa'
  if (tempC < 45) return '#f59e0b'
  return '#ef4444'
}

function targetTemp(state: OutletDisplayState): number | undefined {
  if (state.label.includes('Shower')) return 50
  if (state.label.includes('Bath')) return 45
  if (state.label.includes('Kitchen')) return 50
  return undefined
}

function OutletRow({ state }: { state: OutletDisplayState }) {
  const desiredFlow = state.open ? (state.isConstrained ? state.flowLpm + 1.5 : state.flowLpm) : 0
  const flowPct = Math.max(0, Math.min(100, (state.flowLpm / MAX_FLOW) * 100))
  const desiredPct = Math.max(0, Math.min(100, (desiredFlow / MAX_FLOW) * 100))
  const deliveredTemp = state.deliveredTempC
  const desiredTemp = targetTemp(state)
  const coldSourceNote = state.open && state.service === 'cold_only' && state.coldSource ? (state.coldSource === 'cws' ? 'tank-fed supply' : 'mains-fed supply') : undefined
  const hotSourceNote = state.open && (state.service === 'hot_only' || state.service === 'mixed_hot_running') && state.hotSource ? (state.hotSource === 'on_demand' ? 'on-demand hot water' : 'stored hot water') : undefined

  return (
    <div className={`draw-off-row${state.open ? ' draw-off-row--open' : ' draw-off-row--closed'}`}>
      <div className="draw-off-row__top">
        <span className="draw-off-row__name">{state.label}</span>
        <span className="draw-off-badge">{serviceLabel(state)}</span>
        {state.open && <span className="draw-off-row__metrics">{state.flowLpm.toFixed(1)} L/min</span>}
      </div>

      <div className="draw-off-bar" aria-label={`${state.label} flow`}> 
        <div className="draw-off-bar__actual" style={{ width: `${flowPct}%` }} />
        <div className="draw-off-bar__desired" style={{ left: `${desiredPct}%` }} />
      </div>

      <div className="draw-off-row__tempband">
        <div
          className="draw-off-row__tempfill"
          style={{ width: `${Math.max(0, Math.min(100, ((deliveredTemp ?? 0) / 60) * 100))}%`, background: tempColor(deliveredTemp) }}
        />
        {desiredTemp !== undefined && (
          <div className="draw-off-row__tempmarker" style={{ left: `${Math.max(0, Math.min(100, (desiredTemp / 60) * 100))}%` }} />
        )}
      </div>

      <div className="draw-off-row__meta">
        {deliveredTemp !== undefined ? `${Math.round(deliveredTemp)} °C` : '—'}
        {coldSourceNote && <span className="draw-off-row__cold-source">{coldSourceNote}</span>}
        {hotSourceNote && <span className="draw-off-row__hot-source">{hotSourceNote}</span>}
        {state.service === 'mixed_cold_running' && <span className="draw-off-row__warning" role="status">Delivered temperature falling — hot water not yet arrived</span>}
        {state.isConstrained && <span className="draw-off-row__warning" role="status">⚠ Flow reduced by concurrent demand{state.constraintReason ? ` · ${state.constraintReason}` : ''}</span>}
      </div>
    </div>
  )
}

function SystemBanners({ systemMode, isCylinder, serviceSwitchingActive, combiAtCapacity }: Pick<DrawOffPanelProps, 'systemMode' | 'isCylinder' | 'serviceSwitchingActive' | 'combiAtCapacity'>) {
  const banners: string[] = []
  if (serviceSwitchingActive) banners.push('On-demand hot water active · CH temporarily suspended')
  if (isCylinder && (systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat')) banners.push('Stored hot water buffering peak demand')
  if (combiAtCapacity) banners.push('On-demand hot water at capacity')
  if (!banners.length) return null
  return <div className="draw-off-panel__banners">{banners.map((msg, i) => <div key={i} className="draw-off-banner" role="status">ℹ {msg}</div>)}</div>
}

export function DrawOffPanel(props: DrawOffPanelProps) {
  const {
    outletStates, systemMode, isCylinder, serviceSwitchingActive, combiAtCapacity,
    mode = 'auto', onSetMode,
    onToggleHeating, onToggleShower, onToggleBath, onToggleKitchen,
    onPresetOne, onPresetTwo, onPresetBathFill,
    heatingEnabled, showerOn, bathOn, kitchenOn,
  } = props
  if (!outletStates.length) return null

  return (
    <div className="draw-off-panel" aria-label="Draw-off outlets">
      <div className="draw-off-panel__header">Draw-off</div>
      <div className="draw-off-controls">
        <button className={`sim-demand-btn${mode === 'auto' ? ' sim-demand-btn--active' : ''}`} onClick={() => onSetMode?.('auto')}>Auto demo</button>
        <button className={`sim-demand-btn${mode === 'manual' ? ' sim-demand-btn--active' : ''}`} onClick={() => onSetMode?.('manual')}>Manual</button>
        <button className={`sim-demand-btn${heatingEnabled ? ' sim-demand-btn--active' : ''}`} onClick={onToggleHeating}>Heating</button>
        <button className={`sim-demand-btn sim-demand-btn--outlet${showerOn ? ' sim-demand-btn--active' : ''}`} onClick={onToggleShower}>Shower</button>
        <button className={`sim-demand-btn sim-demand-btn--outlet${bathOn ? ' sim-demand-btn--active' : ''}`} onClick={onToggleBath}>Bath</button>
        <button className={`sim-demand-btn sim-demand-btn--outlet${kitchenOn ? ' sim-demand-btn--active' : ''}`} onClick={onToggleKitchen}>Kitchen tap</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={onPresetOne}>One outlet</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={onPresetTwo}>Two outlets</button>
        <button className="sim-demand-btn sim-demand-btn--preset" onClick={onPresetBathFill}>Bath fill</button>
      </div>
      <SystemBanners
        systemMode={systemMode}
        isCylinder={isCylinder}
        serviceSwitchingActive={serviceSwitchingActive}
        combiAtCapacity={combiAtCapacity}
      />
      <div className="draw-off-panel__rows">
        {outletStates.map(state => <OutletRow key={state.outletId} state={state} />)}
      </div>
    </div>
  )
}
