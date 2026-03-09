// src/explainers/lego/animation/render/DrawOffPanel.tsx
//
// Draw-off panel — dedicated side panel showing per-outlet state during playback.
//
// Reads from OutletDisplayState[] (derived in outletDisplayState.ts) and
// never infers outlet truth ad hoc.  Every outlet row shows:
//   - outlet name
//   - open / closed state
//   - hot / cold / mixed badge
//   - current L/min
//   - current °C
//   - concurrency warning where relevant
//
// Architecture:
//   deriveOutletDisplayStates(controls, frame)
//     → OutletDisplayState[]
//     → DrawOffPanel props
//     → rendered rows
//
// The render layer must NOT re-derive outlet service from raw colours,
// outlet.serviceClass, or systemMode independently.

import type { OutletDisplayState, OutletWaterService } from '../../state/outletDisplayState'
import type { SystemMode } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DrawOffPanelProps {
  /** Per-outlet display states derived from simulation frame. */
  outletStates: OutletDisplayState[]
  /** Current system operating mode — drives system-level context messages. */
  systemMode?: SystemMode
  /** True when the system has a hot-water cylinder (stored hot water). */
  isCylinder?: boolean
  /**
   * True when a combi boiler has diverted output to the DHW plate HEX,
   * temporarily suspending CH.  Authoritative source: scene.metadata.
   */
  serviceSwitchingActive?: boolean
  /**
   * True when the combi boiler cannot reach the DHW setpoint under current demand.
   * Derived from CapacitySummary in LabCanvas.
   */
  combiAtCapacity?: boolean
}

// ─── Service badge ────────────────────────────────────────────────────────────

interface ServiceBadgeProps {
  service: OutletWaterService
  open: boolean
}

function ServiceBadge({ service, open }: ServiceBadgeProps) {
  if (!open || service === 'off') {
    return (
      <span className="draw-off-badge draw-off-badge--closed">
        Closed
      </span>
    )
  }
  switch (service) {
    case 'cold_only':
      return <span className="draw-off-badge draw-off-badge--cold">Cold</span>
    case 'hot_only':
      return <span className="draw-off-badge draw-off-badge--hot">Hot</span>
    case 'mixed_hot_running':
      return <span className="draw-off-badge draw-off-badge--mixed">Mixed</span>
    case 'mixed_cold_running':
      return <span className="draw-off-badge draw-off-badge--mixed-cold">Mixed — cold</span>
    default:
      return null
  }
}

// ─── Outlet icon ─────────────────────────────────────────────────────────────

function outletKindEmoji(label: string): string {
  if (label.startsWith('Shower')) return '🚿'
  if (label.startsWith('Bath'))   return '🛁'
  if (label.startsWith('Cold tap')) return '🚰'
  return '🪠'
}

// ─── Per-outlet row ───────────────────────────────────────────────────────────

interface OutletRowProps {
  state: OutletDisplayState
}

function OutletRow({ state }: OutletRowProps) {
  const {
    label, open, service, flowLpm, deliveredTempC,
    isConstrained, constraintReason, coldSource,
  } = state

  // Derive concurrency message for this row.
  // Priority: explicit constraint reason > temperature-based inference.
  let concurrencyNote: string | undefined
  if (isConstrained && constraintReason) {
    concurrencyNote = `Flow reduced by concurrent demand · ${constraintReason}`
  } else if (open && service === 'mixed_cold_running') {
    concurrencyNote = 'Delivered temperature falling — hot water not yet arrived'
  }

  // Cold source note for open cold-only outlets.
  const coldSourceNote: string | undefined =
    open && service === 'cold_only' && coldSource
      ? (coldSource === 'cws' ? 'tank-fed supply' : 'mains-fed supply')
      : undefined

  return (
    <div className={`draw-off-row${open ? ' draw-off-row--open' : ' draw-off-row--closed'}`}>
      {/* Icon + name */}
      <span className="draw-off-row__name">
        <span aria-hidden="true">{outletKindEmoji(label)}</span>{' '}
        {label}
      </span>

      {/* Service badge */}
      <ServiceBadge service={service} open={open} />

      {/* Flow and temperature — only shown when open */}
      {open && (
        <span className="draw-off-row__metrics">
          {flowLpm > 0 && (
            <span className="draw-off-row__flow">{flowLpm.toFixed(1)} L/min</span>
          )}
          {deliveredTempC !== undefined && (
            <span className="draw-off-row__temp">{Math.round(deliveredTempC)} °C</span>
          )}
          {coldSourceNote && (
            <span className="draw-off-row__cold-source">{coldSourceNote}</span>
          )}
        </span>
      )}

      {/* Concurrency / constraint warning */}
      {concurrencyNote && (
        <span className="draw-off-row__warning" role="status">
          ⚠ {concurrencyNote}
        </span>
      )}
    </div>
  )
}

// ─── System-level context banners ─────────────────────────────────────────────

interface SystemBannerProps {
  systemMode?: SystemMode
  isCylinder?: boolean
  serviceSwitchingActive?: boolean
  combiAtCapacity?: boolean
}

function SystemBanners({
  systemMode,
  isCylinder,
  serviceSwitchingActive,
  combiAtCapacity,
}: SystemBannerProps) {
  const banners: string[] = []

  if (serviceSwitchingActive) {
    banners.push('On-demand hot water active · CH temporarily suspended')
  }
  if (isCylinder && (systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat')) {
    banners.push('Stored hot water buffering peak demand')
  }
  if (combiAtCapacity) {
    banners.push('On-demand hot water at capacity')
  }

  if (banners.length === 0) return null

  return (
    <div className="draw-off-panel__banners">
      {banners.map((msg, i) => (
        <div key={i} className="draw-off-banner" role="status">
          ℹ {msg}
        </div>
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/**
 * Draw-off panel — renders one row per outlet showing explicit runtime state.
 *
 * Must be driven exclusively by `outletStates` derived from
 * `deriveOutletDisplayStates(controls, frame)`.  The panel must never
 * infer outlet truth from raw colours, outlet.serviceClass, or systemMode.
 */
export function DrawOffPanel({
  outletStates,
  systemMode,
  isCylinder,
  serviceSwitchingActive,
  combiAtCapacity,
}: DrawOffPanelProps) {
  if (outletStates.length === 0) return null

  return (
    <div className="draw-off-panel" aria-label="Draw-off outlets">
      <div className="draw-off-panel__header">Draw-off</div>

      <SystemBanners
        systemMode={systemMode}
        isCylinder={isCylinder}
        serviceSwitchingActive={serviceSwitchingActive}
        combiAtCapacity={combiAtCapacity}
      />

      <div className="draw-off-panel__rows">
        {outletStates.map(state => (
          <OutletRow key={state.outletId} state={state} />
        ))}
      </div>
    </div>
  )
}
