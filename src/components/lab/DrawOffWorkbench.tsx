/**
 * DrawOffWorkbench — Visual tab content for System Lab.
 *
 * Left side:  2×2 grid of four draw-off cards (kitchen sink, bathroom basin,
 *             shower, bath fill), each showing cold/hot/delivered values and
 *             a one-line behavioural note.
 * Right side: one tall cylinder / hot-water source status card.
 *
 * All values are regime-aware placeholders that illustrate the physics
 * differences between combi, boiler cylinder, and heat pump cylinder systems.
 *
 * Placement: System Lab → Visual tab.
 */

import { useState } from 'react'
import DrawOffCard from './DrawOffCard'
import CylinderStatusCard from './CylinderStatusCard'
import type { DrawOffViewModel, CylinderStatusViewModel } from './drawOffTypes'

// ─── Regime selector ──────────────────────────────────────────────────────────

type Regime = 'combi' | 'boiler_cylinder' | 'heat_pump_cylinder'

const REGIME_LABELS: Record<Regime, string> = {
  combi:              'Combi',
  boiler_cylinder:    'Boiler cylinder',
  heat_pump_cylinder: 'Heat pump cylinder',
}

// ─── Regime-aware data ────────────────────────────────────────────────────────

function getDrawOffData(regime: Regime): DrawOffViewModel[] {
  if (regime === 'combi') {
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: 48,
        hotSupplyAvailableFlowLpm: 10,
        deliveredTempC: 42,
        deliveredFlowLpm: 8,
        note: 'On-demand supply stable at low draw rate. Temperature delivered within seconds.',
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: 47,
        hotSupplyAvailableFlowLpm: 10,
        deliveredTempC: 40,
        deliveredFlowLpm: 6,
        note: 'Low-flow draw; appliance not yet approaching throughput limit.',
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: 'flow_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: 45,
        hotSupplyAvailableFlowLpm: 10,
        deliveredTempC: 38,
        deliveredFlowLpm: 10,
        note: 'Flow capped at appliance throughput limit. Temperature held by adjusting blend ratio.',
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: 'starved',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 12,
        hotSupplyTempC: 38,
        hotSupplyAvailableFlowLpm: 4,
        deliveredTempC: 32,
        deliveredFlowLpm: 6,
        note: 'Concurrent demand has exhausted appliance capacity. Delivered temperature and flow both degraded.',
      },
    ]
  }

  if (regime === 'boiler_cylinder') {
    return [
      {
        id: 'kitchen',
        label: 'Kitchen sink',
        icon: '🚰',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 60,
        hotSupplyAvailableFlowLpm: 15,
        deliveredTempC: 42,
        deliveredFlowLpm: 9,
        note: 'Mains-pressure supply from stored cylinder. Ample hot fraction available.',
      },
      {
        id: 'basin',
        label: 'Bathroom basin',
        icon: '🪥',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 60,
        hotSupplyAvailableFlowLpm: 15,
        deliveredTempC: 40,
        deliveredFlowLpm: 7,
        note: 'Stored supply stable. Cylinder temperature holding at set point.',
      },
      {
        id: 'shower',
        label: 'Shower',
        icon: '🚿',
        status: 'stable',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 58,
        hotSupplyAvailableFlowLpm: 14,
        deliveredTempC: 38,
        deliveredFlowLpm: 11,
        note: 'High-temperature store allows small hot fraction. Concurrent draw well within cylinder capacity.',
      },
      {
        id: 'bath',
        label: 'Bath fill',
        icon: '🛁',
        status: 'temp_limited',
        coldSupplyTempC: 10,
        coldSupplyFlowLpm: 15,
        hotSupplyTempC: 52,
        hotSupplyAvailableFlowLpm: 12,
        deliveredTempC: 40,
        deliveredFlowLpm: 14,
        note: 'Store temperature dropping under sustained large-volume draw. Recovery active; thermocline falling.',
      },
    ]
  }

  // heat_pump_cylinder
  return [
    {
      id: 'kitchen',
      label: 'Kitchen sink',
      icon: '🚰',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 52,
      hotSupplyAvailableFlowLpm: 14,
      deliveredTempC: 42,
      deliveredFlowLpm: 9,
      note: 'Stored supply from heat pump cylinder. Higher hot fraction needed due to lower storage temperature.',
    },
    {
      id: 'basin',
      label: 'Bathroom basin',
      icon: '🪥',
      status: 'stable',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 51,
      hotSupplyAvailableFlowLpm: 13,
      deliveredTempC: 40,
      deliveredFlowLpm: 7,
      note: 'Stored supply stable at moderate draw. Usable volume depleting more quickly than a boiler cylinder.',
    },
    {
      id: 'shower',
      label: 'Shower',
      icon: '🚿',
      status: 'temp_limited',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 48,
      hotSupplyAvailableFlowLpm: 11,
      deliveredTempC: 37,
      deliveredFlowLpm: 10,
      note: 'Store temperature lower than optimal. Delivered temperature held by increased hot fraction, reducing available flow.',
    },
    {
      id: 'bath',
      label: 'Bath fill',
      icon: '🛁',
      status: 'starved',
      coldSupplyTempC: 10,
      coldSupplyFlowLpm: 15,
      hotSupplyTempC: 42,
      hotSupplyAvailableFlowLpm: 7,
      deliveredTempC: 34,
      deliveredFlowLpm: 9,
      note: 'Usable volume depleted. Recovery lagging — heat pump cannot match boiler reheat rate under simultaneous demand.',
    },
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

  // heat_pump_cylinder
  return {
    storageRegime: 'heat_pump_cylinder',
    topTempC: 52,
    bulkTempC: 46,
    nominalVolumeL: 200,
    usableVolumeFactor: 0.45,
    recoverySource: 'Heat pump',
    recoveryPowerTendency: 'Moderate — slower reheat than boiler under peak demand',
    state: 'recovering',
    recoveryNote: 'Heat pump operating at rated COP to recover cylinder. Reheat rate lower than peak simultaneous demand.',
    storeNote: 'Usable volume depleting faster than recovery rate. Thermocline falling — draw-off impact visible on bulk temperature.',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawOffWorkbench() {
  const [regime, setRegime] = useState<Regime>('boiler_cylinder')

  const outlets   = getDrawOffData(regime)
  const cylinder  = getCylinderData(regime)

  return (
    <div className="draw-off-workbench" data-testid="draw-off-workbench">

      {/* ── Regime selector ────────────────────────────────────────────────── */}
      <div className="draw-off-workbench__regime-bar" role="group" aria-label="System regime">
        <span className="draw-off-workbench__regime-label">System:</span>
        {(Object.keys(REGIME_LABELS) as Regime[]).map(r => (
          <button
            key={r}
            className={`draw-off-workbench__regime-btn${regime === r ? ' draw-off-workbench__regime-btn--active' : ''}`}
            onClick={() => setRegime(r)}
            aria-pressed={regime === r}
          >
            {REGIME_LABELS[r]}
          </button>
        ))}
      </div>

      {/* ── Main panel: outlets + cylinder ─────────────────────────────────── */}
      <div className="draw-off-workbench__panel">

        {/* Left: 2×2 outlet grid */}
        <div className="draw-off-workbench__outlets" aria-label="Draw-off outlets">
          {outlets.map(outlet => (
            <DrawOffCard key={outlet.id} data={outlet} />
          ))}
        </div>

        {/* Right: cylinder / source status */}
        <div className="draw-off-workbench__source">
          <CylinderStatusCard data={cylinder} />
        </div>

      </div>
    </div>
  )
}
