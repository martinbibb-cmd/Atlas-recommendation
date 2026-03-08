// src/explainers/lego/components/CompareModeShell.tsx
//
// Compare mode UI shell — runs the same shared play-state against multiple
// system topologies and shows a compact result card for each.
//
// Layout (tablet/desktop):
//   Left  — shared controls (scenario presets, outlet demand, heating, supply)
//   Right — grid of CompareResultCards (one per compared system)
//
// Design rule: one shared play-state drives all compared systems.
// Each system resolves its own topology and produces an independent result.

import { useState, useMemo, useCallback } from 'react'
import type { CompareSession, CompareResultCard } from '../compare/types'
import { runCompareSession } from '../compare/runCompareSession'
import { COMPARE_PRESETS } from '../compare/comparePresets'
import type { PlayState, OutletDemandPreset, HeatingDemandState, SupplyConditions } from '../state/playState'
import {
  PLAY_SCENARIOS,
  PRESETS_FOR_KIND,
  applyPresetToOutlet,
  applyScenario,
} from '../state/playState'

// ─── Demand-level labels ──────────────────────────────────────────────────────

const CH_DEMAND_LEVEL: Record<'off' | 'low' | 'normal' | 'high', number> = {
  off:    0,
  low:    0.4,
  normal: 0.7,
  high:   1.0,
}

const DEFAULT_TOGGLE_FLOW_LPM = 5
const DEFAULT_CH_FLOW_TEMP_C = 70

// ─── CompareResultCard component ──────────────────────────────────────────────

function ResultCard({ card }: { card: CompareResultCard }) {
  return (
    <div className="compare-card">
      <div className="compare-card-header">
        <div className="compare-card-label">{card.label}</div>
        <div className="compare-card-mode">{card.operatingMode}</div>
      </div>
      <div className="compare-card-topology">{card.topologyLabel}</div>
      <div className="compare-card-headline">{card.headline}</div>
      <div className="compare-card-details">
        <div className="compare-card-row">
          <span className="compare-card-key">Hot water</span>
          <span className="compare-card-val">{card.dhwSummary}</span>
        </div>
        <div className="compare-card-row">
          <span className="compare-card-key">Heating</span>
          <span className="compare-card-val">{card.heatingSummary}</span>
        </div>
        {card.bottleneck && (
          <div className="compare-card-row">
            <span className="compare-card-key">Bottleneck</span>
            <span className="compare-card-val compare-card-val--warn">{card.bottleneck}</span>
          </div>
        )}
      </div>
      {card.warnings.length > 0 && (
        <ul className="compare-card-warnings">
          {card.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Shared controls component ────────────────────────────────────────────────

function SharedControls({
  playState,
  onScenario,
  onOutletPreset,
  onOutletToggle,
  onHeatingDemand,
  onSupplyConditions,
}: {
  playState: PlayState
  onScenario: (id: string) => void
  onOutletPreset: (outletId: string, preset: OutletDemandPreset) => void
  onOutletToggle: (outletId: string, enabled: boolean) => void
  onHeatingDemand: (patch: Partial<HeatingDemandState>) => void
  onSupplyConditions: (patch: Partial<SupplyConditions>) => void
}) {
  const supply = playState.supplyConditions
  const hasMains = supply.mainsDynamicFlowLpm !== undefined
  const hasVented = supply.cwsHeadPreset !== undefined

  return (
    <div className="compare-controls">

      {/* Scenario presets */}
      <div className="compare-controls-section">
        <div className="compare-controls-title">Quick scenarios</div>
        <div className="compare-scenario-grid">
          {PLAY_SCENARIOS.map(s => (
            <button
              key={s.id}
              className={`play-scenario-btn${playState.selectedPresetId === s.id ? ' play-scenario-btn--active' : ''}`}
              onClick={() => onScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heating demand */}
      <div className="compare-controls-section">
        <div className="compare-controls-title">Heating demand</div>
        <div className="play-heating-row">
          {(['off', 'low', 'normal', 'high'] as const).map(level => {
            const isOff = level === 'off'
            const active = isOff
              ? !playState.heating.enabled
              : playState.heating.enabled && playState.heating.demandLevel === CH_DEMAND_LEVEL[level]
            return (
              <button
                key={level}
                className={`play-preset-btn${active ? ' play-preset-btn--active' : ''}`}
                onClick={() => onHeatingDemand(
                  isOff
                    ? { enabled: false }
                    : { enabled: true, demandLevel: CH_DEMAND_LEVEL[level] },
                )}
              >
                {level}
              </button>
            )
          })}
        </div>
        {playState.heating.enabled && (
          <div className="play-outlet-flow">
            Flow temp: {playState.heating.targetFlowTempC ?? DEFAULT_CH_FLOW_TEMP_C} °C
          </div>
        )}
      </div>

      {/* Outlets */}
      <div className="compare-controls-section">
        <div className="compare-controls-title">Outlets</div>
        <div className="play-outlet-list">
          {playState.demands.map(demand => {
            const presets = PRESETS_FOR_KIND[demand.kind]
            return (
              <div
                key={demand.outletId}
                className={`play-outlet-card${demand.enabled ? ' play-outlet-card--active' : ''}`}
              >
                <div className="play-outlet-header">
                  <span className="play-outlet-label">{demand.label}</span>
                  <button
                    className={`play-outlet-toggle${demand.enabled ? ' play-outlet-toggle--on' : ''}`}
                    onClick={() => onOutletToggle(
                      demand.outletId,
                      !demand.enabled,
                    )}
                    aria-pressed={demand.enabled}
                  >
                    {demand.enabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="play-outlet-presets">
                  {presets.map(preset => (
                    <button
                      key={preset}
                      className={`play-preset-btn${demand.preset === preset ? ' play-preset-btn--active' : ''}`}
                      onClick={() => onOutletPreset(demand.outletId, preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {demand.enabled && (
                  <div className="play-outlet-flow">
                    {demand.targetFlowLpm} L/min
                    {demand.targetTempC !== undefined ? ` · ${demand.targetTempC} °C` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Supply conditions */}
      <div className="compare-controls-section">
        <div className="compare-controls-title">Supply conditions</div>
        {hasMains && (
          <div className="play-outlet-card">
            <div className="play-outlet-label">Mains flow</div>
            <input
              type="range"
              min={6} max={25} step={1}
              value={supply.mainsDynamicFlowLpm ?? 14}
              onChange={e => onSupplyConditions({ mainsDynamicFlowLpm: Number(e.target.value) })}
              className="compare-slider"
            />
            <div className="play-outlet-flow">{supply.mainsDynamicFlowLpm ?? 14} L/min</div>
          </div>
        )}
        {hasVented && (
          <div className="play-outlet-card">
            <div className="play-outlet-label">Tank-fed supply</div>
            <div className="play-outlet-presets">
              {(['poor', 'typical', 'good'] as const).map(p => (
                <button
                  key={p}
                  className={`play-preset-btn${supply.cwsHeadPreset === p ? ' play-preset-btn--active' : ''}`}
                  onClick={() => onSupplyConditions({ cwsHeadPreset: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="play-outlet-card">
          <div className="play-outlet-label">Inlet temp</div>
          <div className="play-outlet-presets">
            {([5, 10, 15] as const).map(t => (
              <button
                key={t}
                className={`play-preset-btn${supply.inletTempC === t ? ' play-preset-btn--active' : ''}`}
                onClick={() => onSupplyConditions({ inletTempC: t })}
              >
                {t} °C
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CompareModeShell — the top-level compare mode UI.
 *
 * Renders a shared-controls panel on the left and a grid of compact result
 * cards on the right.  The shared play-state drives all compared systems
 * equally — each system resolves its own topology independently.
 *
 * Usage:
 *   <CompareModeShell />                    — starts with the first preset
 *   <CompareModeShell initialPresetId="current_vs_combi" />
 */
export default function CompareModeShell({
  initialPresetId,
}: {
  initialPresetId?: string
}) {
  // ── Session state ──────────────────────────────────────────────────────────
  // Guard: always resolve a start preset — COMPARE_PRESETS is compile-time
  // constant so this will always resolve, but the null-coalesce is required
  // to keep TypeScript happy in case the array is modified in the future.
  const startPreset =
    COMPARE_PRESETS.find(p => p.id === (initialPresetId ?? COMPARE_PRESETS[0]?.id))
    ?? COMPARE_PRESETS[0] ?? null

  const [session, setSession] = useState<CompareSession | null>(
    () => startPreset ? startPreset.build() : null,
  )
  const [activePresetId, setActivePresetId] = useState<string>(startPreset?.id ?? '')

  // ── Play-state mutations ───────────────────────────────────────────────────

  const updatePlayState = useCallback((updater: (prev: PlayState) => PlayState) => {
    setSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sharedPlayState: updater(prev.sharedPlayState),
      }
    })
  }, [])

  const handleScenario = useCallback((scenarioId: string) => {
    updatePlayState(prev => applyScenario(prev, scenarioId))
  }, [updatePlayState])

  const handleOutletPreset = useCallback(
    (outletId: string, preset: OutletDemandPreset) => {
      updatePlayState(prev => ({
        ...prev,
        demands: prev.demands.map(d =>
          d.outletId === outletId ? applyPresetToOutlet(d, preset) : d,
        ),
        selectedPresetId: null,
      }))
    },
    [updatePlayState],
  )

  const handleOutletToggle = useCallback(
    (outletId: string, enabled: boolean) => {
      updatePlayState(prev => ({
        ...prev,
        demands: prev.demands.map(d => {
          if (d.outletId !== outletId) return d
          return {
            ...d,
            enabled,
            targetFlowLpm: enabled ? (d.targetFlowLpm || DEFAULT_TOGGLE_FLOW_LPM) : 0,
            preset: enabled ? d.preset : 'off',
          }
        }),
        selectedPresetId: null,
      }))
    },
    [updatePlayState],
  )

  const handleHeatingDemand = useCallback(
    (patch: Partial<HeatingDemandState>) => {
      updatePlayState(prev => ({
        ...prev,
        heating: { ...prev.heating, ...patch },
        selectedPresetId: null,
      }))
    },
    [updatePlayState],
  )

  const handleSupplyConditions = useCallback(
    (patch: Partial<SupplyConditions>) => {
      updatePlayState(prev => ({
        ...prev,
        supplyConditions: { ...prev.supplyConditions, ...patch },
        inletTempC: patch.inletTempC ?? prev.inletTempC,
        selectedPresetId: null,
      }))
    },
    [updatePlayState],
  )

  // ── Preset switching ───────────────────────────────────────────────────────

  const handlePresetSwitch = useCallback((presetId: string) => {
    const preset = COMPARE_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setSession(preset.build())
    setActivePresetId(presetId)
  }, [])

  // ── Run the session ────────────────────────────────────────────────────────

  const cards: CompareResultCard[] = useMemo(
    () => session ? runCompareSession(session) : [],
    [session],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!session) {
    return <div className="compare-shell">No compare presets available.</div>
  }

  return (
    <div className="compare-shell">

      {/* Scenario picker */}
      <div className="compare-topbar">
        <span className="compare-topbar-title">Compare systems</span>
        <div className="compare-preset-tabs">
          {COMPARE_PRESETS.map(preset => (
            <button
              key={preset.id}
              className={`compare-preset-tab${activePresetId === preset.id ? ' compare-preset-tab--active' : ''}`}
              onClick={() => handlePresetSwitch(preset.id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {session.scenarioName && (
          <span className="compare-scenario-name">{session.scenarioName}</span>
        )}
      </div>

      <div className="compare-body">

        {/* Shared controls */}
        <div className="compare-controls-col">
          <SharedControls
            playState={session.sharedPlayState}
            onScenario={handleScenario}
            onOutletPreset={handleOutletPreset}
            onOutletToggle={handleOutletToggle}
            onHeatingDemand={handleHeatingDemand}
            onSupplyConditions={handleSupplyConditions}
          />
        </div>

        {/* Result cards */}
        <div className="compare-cards-col">
          <div className={`compare-cards-grid compare-cards-grid--${cards.length}`}>
            {cards.map(card => (
              <ResultCard key={card.systemId} card={card} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
