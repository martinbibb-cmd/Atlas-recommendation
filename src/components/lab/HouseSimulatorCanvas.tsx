/**
 * HouseSimulatorCanvas — house-first draw-off simulator surface.
 *
 * Central panel for the System Lab (/?lab=1) house-first UI.  Renders a
 * cross-section house schematic with draw-off outlet hotspots placed in the
 * relevant rooms.  Tapping an outlet opens the full DrawOffFocusPanel
 * inspection view.  A cylinder / source status badge opens CylinderFocusPanel.
 *
 * Regime selector at the top lets the user switch between the four system
 * archetypes (Combi / Boiler cylinder / Heat pump cylinder / Mixergy cylinder).
 * All draw-off physics come from the same presentation-layer data model as
 * DrawOffWorkbench — no engine model is re-derived here.
 *
 * No Math.random() is used anywhere in this module.
 */

import { useState } from 'react';
import DrawOffFocusPanel from './DrawOffFocusPanel';
import CylinderFocusPanel from './CylinderFocusPanel';
import type { DrawOffViewModel, CylinderStatusViewModel, DrawOffStatus, BoilerState } from './drawOffTypes';

// ─── Regime ───────────────────────────────────────────────────────────────────

type Regime = 'combi' | 'boiler_cylinder' | 'heat_pump_cylinder' | 'mixergy_cylinder'

const REGIME_LABELS: Record<Regime, string> = {
  combi:              'Combi',
  boiler_cylinder:    'Boiler cyl.',
  heat_pump_cylinder: 'HP cylinder',
  mixergy_cylinder:   'Mixergy cyl.',
}

const REGIME_SYSTEM_LABEL: Record<Regime, string> = {
  combi:              'Gas combi boiler',
  boiler_cylinder:    'Boiler + cylinder',
  heat_pump_cylinder: 'Heat pump + cylinder',
  mixergy_cylinder:   'Mixergy cylinder',
}

// ─── Data constants ───────────────────────────────────────────────────────────

const DEFAULT_BOILER_OUTPUT_KW = 24
const MIN_BOILER_OUTPUT_KW     = 18
const MAX_BOILER_OUTPUT_KW     = 42
const COMBI_IGNITION_FLOW_LPM  = 2.5
const COMBI_SUSTAINED_FLOW_LPM = 7.0

function deriveBoilerState(hotSupplyAvailableFlowLpm: number): BoilerState {
  if (hotSupplyAvailableFlowLpm < COMBI_IGNITION_FLOW_LPM)  return 'fails_to_fire'
  if (hotSupplyAvailableFlowLpm < COMBI_SUSTAINED_FLOW_LPM) return 'marginal'
  return 'firing'
}

function scaleCombiFlow(baseFlowLpm: number, outputKw: number): number {
  const scale = outputKw / DEFAULT_BOILER_OUTPUT_KW
  return Math.round(Math.min(baseFlowLpm * scale, 12) * 10) / 10
}

// ─── Presentation-layer draw-off data ─────────────────────────────────────────

function getDrawOffData(regime: Regime, outputKw: number): DrawOffViewModel[] {
  if (regime === 'combi') {
    const hotFlow = scaleCombiFlow(10, outputKw)
    // Concurrent demand shares the boiler; each outlet receives ~60 % of solo rate.
    const concurrentHotFlow = scaleCombiFlow(3, outputKw)
    const hotTemp = 45 + Math.round((outputKw - DEFAULT_BOILER_OUTPUT_KW) * 0.15)
    const bathBoilerState = deriveBoilerState(concurrentHotFlow)
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp + 3,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 42,
        deliveredFlowLpm: Math.min(8, hotFlow * 0.8),
        note: 'On-demand supply stable at low draw rate. Temperature delivered within seconds.',
        limitingFactor: 'None — demand within appliance capacity',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp + 2,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 40,
        deliveredFlowLpm: Math.min(6, hotFlow * 0.6),
        note: 'Low-flow draw; appliance not approaching throughput limit.',
        limitingFactor: 'None — low-flow draw well within capacity',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: hotFlow >= 10 ? 'stable' : 'flow_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp,
        hotSupplyAvailableFlowLpm: hotFlow,
        deliveredTempC: 38,
        deliveredFlowLpm: Math.min(10, hotFlow),
        note: hotFlow >= 10
          ? 'Stable draw. Temperature held by adjusting blend ratio.'
          : 'Flow capped at appliance throughput limit. Temperature held by adjusting blend ratio.',
        limitingFactor: hotFlow >= 10 ? 'None' : 'Hot-side output constrained — appliance throughput limit reached',
        boilerState: deriveBoilerState(hotFlow),
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: bathBoilerState === 'fails_to_fire' ? 'below_ignition_threshold' : 'starved',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: hotTemp - 7,
        hotSupplyAvailableFlowLpm: concurrentHotFlow,
        deliveredTempC: 32,
        deliveredFlowLpm: Math.min(6, concurrentHotFlow + 2),
        note: bathBoilerState === 'fails_to_fire'
          ? 'Flow too low to fire combi — simultaneous demand below ignition threshold. Only cold water delivered.'
          : 'Concurrent demand has exhausted appliance capacity. Delivered temperature and flow both degraded.',
        limitingFactor: bathBoilerState === 'fails_to_fire'
          ? 'Below combi ignition threshold — burner cannot fire under simultaneous demand'
          : 'Concurrent demand exceeds appliance capacity — insufficient DHW flow to sustain burner',
        boilerState: bathBoilerState,
      },
    ]
  }

  if (regime === 'boiler_cylinder') {
    return [
      { id: 'kitchen', label: 'Kitchen sink',     icon: '🚰', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 60, hotSupplyAvailableFlowLpm: 15, deliveredTempC: 42, deliveredFlowLpm: 9,  note: 'Mains-pressure supply from stored cylinder. Ample hot fraction available.',                                                   limitingFactor: 'None — stored supply ample' },
      { id: 'basin',   label: 'Bathroom basin',   icon: '🪥', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 60, hotSupplyAvailableFlowLpm: 15, deliveredTempC: 40, deliveredFlowLpm: 7,  note: 'Stored supply stable. Cylinder temperature holding at set point.',                                                          limitingFactor: 'None — stored supply ample' },
      { id: 'shower',  label: 'Shower',           icon: '🚿', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 58, hotSupplyAvailableFlowLpm: 14, deliveredTempC: 38, deliveredFlowLpm: 11, note: 'High-temperature store allows small hot fraction. Concurrent draw within cylinder capacity.',                                limitingFactor: 'None — concurrent draw within cylinder capacity' },
      { id: 'bath',    label: 'Bath fill',        icon: '🛁', status: 'temp_limited', coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 52, hotSupplyAvailableFlowLpm: 12, deliveredTempC: 40, deliveredFlowLpm: 14, note: 'Store temperature dropping under sustained large-volume draw. Recovery active; thermocline falling.', limitingFactor: 'Store temperature declining — thermocline falling under large-volume draw' },
    ]
  }

  if (regime === 'heat_pump_cylinder') {
    return [
      { id: 'kitchen', label: 'Kitchen sink',     icon: '🚰', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 52, hotSupplyAvailableFlowLpm: 14, deliveredTempC: 42, deliveredFlowLpm: 9,  note: 'Stored supply from HP cylinder. Higher hot fraction needed due to lower storage temperature.',                                  limitingFactor: 'Lower store temperature — higher hot fraction required' },
      { id: 'basin',   label: 'Bathroom basin',   icon: '🪥', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 52, hotSupplyAvailableFlowLpm: 14, deliveredTempC: 40, deliveredFlowLpm: 7,  note: 'Stored supply stable. Cylinder temperature holding.',                                                                          limitingFactor: 'None — stored supply ample' },
      { id: 'shower',  label: 'Shower',           icon: '🚿', status: 'temp_limited', coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 50, hotSupplyAvailableFlowLpm: 13, deliveredTempC: 36, deliveredFlowLpm: 11, note: 'HP cylinder: lower storage temperature means larger hot fraction and earlier temperature limiting.',                              limitingFactor: 'Lower store temperature — TMV opening wider, temperature limiting sooner' },
      { id: 'bath',    label: 'Bath fill',        icon: '🛁', status: 'temp_limited', coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 45, hotSupplyAvailableFlowLpm: 10, deliveredTempC: 33, deliveredFlowLpm: 13, note: 'Usable volume depleting faster than HP recovery rate. Thermocline falling.',                                                  limitingFactor: 'Store temperature declining — HP reheat rate lags peak demand' },
    ]
  }

  // mixergy_cylinder
  return [
    { id: 'kitchen', label: 'Kitchen sink',     icon: '🚰', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 60, hotSupplyAvailableFlowLpm: 15, deliveredTempC: 42, deliveredFlowLpm: 9,  note: 'Top-down stratification maintains a high-temperature hot layer at the outlet.',                            limitingFactor: 'None — stratified hot layer at full temperature' },
    { id: 'basin',   label: 'Bathroom basin',   icon: '🪥', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 60, hotSupplyAvailableFlowLpm: 15, deliveredTempC: 40, deliveredFlowLpm: 7,  note: 'Stratification intact. Smaller draw well within available hot-layer volume.',                               limitingFactor: 'None — stratified supply ample' },
    { id: 'shower',  label: 'Shower',           icon: '🚿', status: 'stable',       coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 60, hotSupplyAvailableFlowLpm: 15, deliveredTempC: 38, deliveredFlowLpm: 11, note: 'Mixergy controller mirrors demand. Concurrent shower and kitchen draw within heated layer.',               limitingFactor: 'None — Mixergy stratification preserving upper zone' },
    { id: 'bath',    label: 'Bath fill',        icon: '🛁', status: 'temp_limited', coldSupplyTempC: 10, coldSupplyFlowLpm: 15, hotSupplyTempC: 55, hotSupplyAvailableFlowLpm: 12, deliveredTempC: 38, deliveredFlowLpm: 14, note: 'Large-volume draw drawing into lower cylinder zone. Thermocline approaching outlet level.',                 limitingFactor: 'None — Mixergy stratification preserving upper zone under concurrent load' },
  ]
}

function getCylinderData(regime: Regime): CylinderStatusViewModel {
  if (regime === 'combi') {
    return {
      storageRegime: 'on_demand_combi',
      recoverySource: 'None (on-demand hot water)',
      recoveryPowerTendency: 'N/A — no stored volume to recover',
      state: 'idle',
      recoveryNote: 'On-demand supply produced within seconds of opening a tap. No recharge cycle required.',
      storeNote: 'No cylinder storage. Concurrent demand degrades both flow and temperature simultaneously.',
    }
  }

  if (regime === 'boiler_cylinder') {
    return {
      storageRegime: 'boiler_cylinder',
      topTempC: 60,
      bulkTempC: 55,
      nominalVolumeL: 150,
      usableVolumeFactor: 0.78,
      recoverySource: 'Boiler',
      recoveryPowerTendency: 'High — rapid recovery via dedicated DHW zone',
      state: 'recovering',
      recoveryNote: 'Boiler firing on DHW zone. Cylinder top-up in progress; stratification holding upper zone temperature.',
      storeNote: 'Thermocline falling slowly under simultaneous shower and bath draw. Recovery rate exceeds draw rate.',
    }
  }

  if (regime === 'heat_pump_cylinder') {
    return {
      storageRegime: 'heat_pump_cylinder',
      topTempC: 52,
      bulkTempC: 46,
      nominalVolumeL: 200,
      usableVolumeFactor: 0.45,
      recoverySource: 'Heat pump',
      recoveryPowerTendency: 'Moderate — slower reheat than boiler under peak demand',
      state: 'recovering',
      recoveryNote: 'Heat pump recovering cylinder. Recharge at 55–60°C pushes COP down sharply — reheat rate lower than peak demand.',
      storeNote: 'Usable volume depleting faster than recovery rate. Thermocline falling — draw-off impact visible on bulk temperature.',
    }
  }

  // mixergy_cylinder
  return {
    storageRegime: 'mixergy_cylinder',
    topTempC: 60,
    heatedVolumeL: 128,
    heatedFractionPct: 85,
    nominalVolumeL: 150,
    usableVolumeFactor: 0.88,
    recoverySource: 'Boiler (Mixergy)',
    recoveryPowerTendency: 'Demand-mirrored heating — hot layer maintained; reduced reheat cycling',
    state: 'recovering',
    recoveryNote: 'Boiler firing via Mixergy controller. Top-down stratification actively grows the heated layer.',
    storeNote: 'Hot water delivered from a defined heated layer. 128 L (85%) heated at 60°C. Once the thermocline reaches the outlet level, hot delivery falls rapidly.',
  }
}

// ─── Status chip configuration ────────────────────────────────────────────────

const STATUS_CHIP_MOD: Record<DrawOffStatus, string> = {
  inactive:                 'house-outlet-chip--inactive',
  cold:                     'house-outlet-chip--inactive',
  stable:                   'house-outlet-chip--stable',
  flow_limited:             'house-outlet-chip--limited',
  temp_limited:             'house-outlet-chip--limited',
  starved:                  'house-outlet-chip--starved',
  below_ignition_threshold: 'house-outlet-chip--starved',
}

const STATUS_CHIP_LABEL: Record<DrawOffStatus, string> = {
  inactive:                 'Inactive',
  cold:                     'Cold',
  stable:                   'Stable',
  flow_limited:             'Flow limited',
  temp_limited:             'Temp limited',
  starved:                  'Starved',
  below_ignition_threshold: 'No fire',
}

// ─── Outlet chip ──────────────────────────────────────────────────────────────

function OutletChip({ outlet, onClick }: { outlet: DrawOffViewModel; onClick: () => void }) {
  const isInactive = outlet.status === 'inactive' || outlet.status === 'cold'
  return (
    <button
      className={`house-outlet-chip ${STATUS_CHIP_MOD[outlet.status]}`}
      onClick={onClick}
      aria-label={`${outlet.label}: ${STATUS_CHIP_LABEL[outlet.status]}${!isInactive ? ` — ${outlet.deliveredTempC}°C · ${outlet.deliveredFlowLpm} L/min` : ''}`}
    >
      <span className="house-outlet-chip__icon" aria-hidden="true">{outlet.icon}</span>
      <span className="house-outlet-chip__label">{outlet.label}</span>
      {!isInactive && (
        <span className="house-outlet-chip__metrics">
          {outlet.deliveredTempC}°C · {outlet.deliveredFlowLpm} L/min
        </span>
      )}
      <span className="house-outlet-chip__status">{STATUS_CHIP_LABEL[outlet.status]}</span>
    </button>
  )
}

// ─── Cylinder badge ───────────────────────────────────────────────────────────

function CylinderBadge({ cylinder, onClick }: { cylinder: CylinderStatusViewModel; onClick: () => void }) {
  const isCombi = cylinder.storageRegime === 'on_demand_combi'
  return (
    <button className="house-cylinder-badge" onClick={onClick} aria-label="View cylinder / source status">
      <span className="house-cylinder-badge__icon" aria-hidden="true">💧</span>
      <span className="house-cylinder-badge__body">
        {isCombi ? (
          <span className="house-cylinder-badge__name">On-demand supply</span>
        ) : (
          <>
            <span className="house-cylinder-badge__name">
              {cylinder.topTempC}°C · {cylinder.nominalVolumeL}L
            </span>
            <span className="house-cylinder-badge__state">{cylinder.state}</span>
          </>
        )}
      </span>
    </button>
  )
}

// ─── Focus target ─────────────────────────────────────────────────────────────

type FocusTarget =
  | { kind: 'outlet'; outletId: string }
  | { kind: 'cylinder' }

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseSimulatorCanvas() {
  const [regime, setRegime] = useState<Regime>('boiler_cylinder');
  const [boilerOutputKw, setBoilerOutputKw] = useState(DEFAULT_BOILER_OUTPUT_KW);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const isCombi = regime === 'combi';
  const outlets = getDrawOffData(regime, boilerOutputKw);
  const cylinder = getCylinderData(regime);

  const outletById = (id: string): DrawOffViewModel => outlets.find(o => o.id === id)!;

  const closeFocus = () => setFocusTarget(null);

  const focusedOutlet =
    focusTarget?.kind === 'outlet'
      ? outlets.find(o => o.id === focusTarget.outletId) ?? null
      : null;
  const focusCylinder = focusTarget?.kind === 'cylinder';

  return (
    <div className="house-sim-canvas" data-testid="house-simulator-canvas">

      {/* ── Regime selector ──────────────────────────────────────────────────── */}
      <div className="house-sim-canvas__regime-bar" role="group" aria-label="System regime">
        <span className="house-sim-canvas__regime-label">System:</span>
        {(Object.keys(REGIME_LABELS) as Regime[]).map(r => (
          <button
            key={r}
            className={`house-sim-canvas__regime-btn${regime === r ? ' house-sim-canvas__regime-btn--active' : ''}`}
            onClick={() => setRegime(r)}
            aria-pressed={regime === r}
          >
            {REGIME_LABELS[r]}
          </button>
        ))}
      </div>

      {/* ── Combi output slider ───────────────────────────────────────────────── */}
      {isCombi && (
        <div className="house-sim-canvas__slider-row" aria-label="Appliance output controls">
          <span className="house-sim-canvas__slider-label">Appliance output</span>
          <input
            type="range"
            className="house-sim-canvas__slider"
            min={MIN_BOILER_OUTPUT_KW}
            max={MAX_BOILER_OUTPUT_KW}
            step={1}
            value={boilerOutputKw}
            onChange={e => setBoilerOutputKw(Number(e.target.value))}
            aria-label="Appliance output (kW)"
            aria-valuenow={boilerOutputKw}
            aria-valuemin={MIN_BOILER_OUTPUT_KW}
            aria-valuemax={MAX_BOILER_OUTPUT_KW}
          />
          <span className="house-sim-canvas__slider-value">{boilerOutputKw} kW</span>
        </div>
      )}

      {/* ── House schematic ───────────────────────────────────────────────────── */}
      <div className="house-sim-canvas__schematic" aria-label="House cross-section view">

        {/* ── Header row inside the schematic ─── */}
        <div className="house-sim-canvas__schematic-header">
          {/* Heat source label — top-left */}
          <div className="house-sim-canvas__source-badge">
            <span className="house-sim-canvas__source-icon" aria-hidden="true">🔥</span>
            <span className="house-sim-canvas__source-label">{REGIME_SYSTEM_LABEL[regime]}</span>
          </div>

          {/* Cylinder badge — top-right */}
          <CylinderBadge
            cylinder={cylinder}
            onClick={() => setFocusTarget({ kind: 'cylinder' })}
          />
        </div>

        {/* ── SVG Roof ─── */}
        <div className="house-sim-canvas__roof" aria-hidden="true">
          <svg
            viewBox="0 0 300 40"
            preserveAspectRatio="none"
            className="house-sim-canvas__roof-svg"
            aria-hidden="true"
            focusable="false"
          >
            {/* Main roof triangle */}
            <polygon points="150,3 3,40 297,40" fill="#4a5568" />
            {/* Chimney stack */}
            <rect x="202" y="14" width="18" height="27" fill="#4a5568" />
            {/* Chimney cap */}
            <rect x="198" y="10" width="26" height="7" fill="#718096" rx="2" ry="2" />
          </svg>
        </div>

        {/* ── House body (floors) ─── */}
        <div className="house-sim-canvas__body">

          {/* First floor */}
          <div className="house-sim-canvas__floor house-sim-canvas__floor--first">
            <div className="house-sim-canvas__floor-label">
              <span aria-hidden="true">🛌</span> First floor
            </div>
            <div className="house-sim-canvas__rooms">
              <div className="house-sim-canvas__room house-sim-canvas__room--plain">
                <span className="house-sim-canvas__room-name">Bedroom 1</span>
                <span className="house-sim-canvas__room-decor" aria-hidden="true">🛌</span>
              </div>
              <div className="house-sim-canvas__room house-sim-canvas__room--plain">
                <span className="house-sim-canvas__room-name">Bedroom 2</span>
                <span className="house-sim-canvas__room-decor" aria-hidden="true">🛌</span>
              </div>
              <div className="house-sim-canvas__room house-sim-canvas__room--wet">
                <span className="house-sim-canvas__room-name">Bathroom</span>
                <div className="house-sim-canvas__outlets">
                  <OutletChip
                    outlet={outletById('shower')}
                    onClick={() => setFocusTarget({ kind: 'outlet', outletId: 'shower' })}
                  />
                  <OutletChip
                    outlet={outletById('bath')}
                    onClick={() => setFocusTarget({ kind: 'outlet', outletId: 'bath' })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ground floor */}
          <div className="house-sim-canvas__floor house-sim-canvas__floor--ground">
            <div className="house-sim-canvas__floor-label">
              <span aria-hidden="true">🛋️</span> Ground floor
            </div>
            <div className="house-sim-canvas__rooms">
              <div className="house-sim-canvas__room house-sim-canvas__room--wet">
                <span className="house-sim-canvas__room-name">Kitchen</span>
                <div className="house-sim-canvas__outlets">
                  <OutletChip
                    outlet={outletById('kitchen')}
                    onClick={() => setFocusTarget({ kind: 'outlet', outletId: 'kitchen' })}
                  />
                </div>
              </div>
              <div className="house-sim-canvas__room house-sim-canvas__room--plain">
                <span className="house-sim-canvas__room-name">Lounge</span>
                <span className="house-sim-canvas__room-decor" aria-hidden="true">🛋️</span>
              </div>
              <div className="house-sim-canvas__room house-sim-canvas__room--wet">
                <span className="house-sim-canvas__room-name">WC</span>
                <div className="house-sim-canvas__outlets">
                  <OutletChip
                    outlet={outletById('basin')}
                    onClick={() => setFocusTarget({ kind: 'outlet', outletId: 'basin' })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Foundation slab ─── */}
        <div className="house-sim-canvas__foundation" aria-hidden="true" />
      </div>

      {/* ── Hint text ────────────────────────────────────────────────────────── */}
      <p className="house-sim-canvas__hint">
        Tap any outlet chip to inspect temperature, flow, and limiting factors.
        Tap the cylinder badge to inspect source status.
      </p>

      {/* ── Focus overlay ────────────────────────────────────────────────────── */}
      {focusTarget && (
        <div
          className="house-sim-canvas__focus-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Outlet inspection"
          data-testid="house-sim-focus-overlay"
        >
          <div
            className="house-sim-canvas__focus-backdrop"
            onClick={closeFocus}
            aria-hidden="true"
          />
          <div className="house-sim-canvas__focus-panel">
            <div className="house-sim-canvas__focus-header">
              <span className="house-sim-canvas__focus-title">
                {focusedOutlet
                  ? `${focusedOutlet.icon} ${focusedOutlet.label}`
                  : '💧 Cylinder / source'}
              </span>
              <button
                className="house-sim-canvas__focus-close"
                onClick={closeFocus}
                aria-label="Close inspection view"
              >
                ✕
              </button>
            </div>
            {focusedOutlet && <DrawOffFocusPanel data={focusedOutlet} />}
            {focusCylinder && <CylinderFocusPanel data={cylinder} />}
          </div>
        </div>
      )}

    </div>
  )
}
