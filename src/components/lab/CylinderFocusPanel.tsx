/**
 * CylinderFocusPanel — instrument-view content for a focused cylinder tile.
 *
 * Rendered inside the Focus overlay when the cylinder/source status card is
 * tapped.  Shows a larger animated cylinder graphic, key thermal metrics,
 * depletion state, and a standard-vs-Mixergy behaviour note.
 */

import type { CylinderStatusViewModel, StorageRegime, CylinderState } from './drawOffTypes'
import CylinderBehaviourGraphic from '../behaviour/CylinderBehaviourGraphic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGIME_LABEL: Record<StorageRegime, string> = {
  boiler_cylinder:    'Boiler cylinder',
  heat_pump_cylinder: 'Heat pump cylinder',
  mixergy_cylinder:   'Mixergy cylinder',
  on_demand_combi:    'On-demand (combi)',
}

const STATE_LABELS: Record<CylinderState, string> = {
  idle:       'Idle',
  charging:   'Charging',
  recovering: 'Recovering',
  depleted:   'Depleted',
}

const STATE_MOD: Record<CylinderState, string> = {
  idle:       'cylinder-status-card__state-chip--idle',
  charging:   'cylinder-status-card__state-chip--charging',
  recovering: 'cylinder-status-card__state-chip--recovering',
  depleted:   'cylinder-status-card__state-chip--depleted',
}

/**
 * Returns a short behaviour note comparing this regime against a standard
 * boiler cylinder.  Used in the Focus view explanation section.
 */
function behaviourNote(regime: StorageRegime): string {
  switch (regime) {
    case 'mixergy_cylinder':
      return 'Stored hot water with top-down heating and active stratification. Heating cycles are demand-mirrored, keeping the hot layer at temperature and reducing reheat cycling compared to a standard cylinder.'
    case 'heat_pump_cylinder':
      return 'Stored hot water from a heat pump. Cylinder recharge at 55–60°C pushes COP down sharply — low-temperature space heating is where efficiency is protected. Lower storage temperature also means a higher hot fraction is required at each outlet, reducing usable volume.'
    case 'boiler_cylinder':
      return 'Stored hot water from a boiler-heated cylinder. High-temperature store allows a small hot fraction at most outlets. Thermocline falls under sustained simultaneous draw.'
    case 'on_demand_combi':
      return 'On-demand hot water. No stored volume — temperature and flow are produced within seconds of opening a tap. Concurrent demand degrades both flow and temperature simultaneously.'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: CylinderStatusViewModel
}

export default function CylinderFocusPanel({ data }: Props) {
  const {
    storageRegime,
    topTempC,
    bulkTempC,
    nominalVolumeL,
    usableVolumeFactor,
    heatedVolumeL,
    heatedFractionPct,
    recoverySource,
    recoveryPowerTendency,
    state,
    recoveryNote,
    storeNote,
  } = data

  const isCylinder = storageRegime !== 'on_demand_combi'
  const isMixergy  = storageRegime === 'mixergy_cylinder'
  const recoveryActive = state === 'charging' || state === 'recovering'

  const panelTitle = isCylinder ? 'Cylinder status' : 'Hot water source status'

  return (
    <div
      className="cylinder-focus"
      data-testid="cylinder-focus-panel"
      aria-label={`${panelTitle} — Focus`}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div className="cylinder-focus__title-bar">
        <span className="cylinder-focus__title">{panelTitle.toUpperCase()}</span>
        <span
          className={`cylinder-status-card__state-chip ${STATE_MOD[state]}`}
          aria-label={`State: ${STATE_LABELS[state]}`}
        >
          {STATE_LABELS[state]}
        </span>
      </div>

      {/* ── Cylinder graphic ───────────────────────────────────────────────── */}
      {isCylinder && topTempC !== undefined && (isMixergy || bulkTempC !== undefined) && (
        <div className="cylinder-focus__graphic">
          <CylinderBehaviourGraphic
            type={isMixergy ? 'mixergy' : 'standard'}
            hotFraction={isMixergy ? undefined : (usableVolumeFactor ?? 0.5)}
            heatedLayerFraction={
              isMixergy && heatedFractionPct !== undefined
                ? heatedFractionPct / 100
                : undefined
            }
            topTempC={topTempC}
            bottomTempC={isMixergy ? undefined : bulkTempC}
            drawActive={false}
            recoveryActive={recoveryActive}
            animate={true}
          />
        </div>
      )}

      {/* ── Metric rows ────────────────────────────────────────────────────── */}
      <dl className="cylinder-focus__rows">
        <div className="cylinder-focus__row">
          <dt className="cylinder-focus__dt">Storage regime</dt>
          <dd className="cylinder-focus__dd">{REGIME_LABEL[storageRegime]}</dd>
        </div>

        {isCylinder && topTempC !== undefined && (
          <div className="cylinder-focus__row">
            <dt className="cylinder-focus__dt">Delivery temperature</dt>
            <dd className="cylinder-focus__dd cylinder-focus__dd--large">{topTempC}°C</dd>
          </div>
        )}

        {isCylinder && !isMixergy && bulkTempC !== undefined && (
          <div className="cylinder-focus__row">
            <dt className="cylinder-focus__dt">Bulk temperature</dt>
            <dd className="cylinder-focus__dd">{bulkTempC}°C</dd>
          </div>
        )}

        {isMixergy && heatedVolumeL !== undefined && (
          <div className="cylinder-focus__row">
            <dt className="cylinder-focus__dt">Heated layer</dt>
            <dd className="cylinder-focus__dd cylinder-focus__dd--large">
              {heatedVolumeL} L
              {heatedFractionPct !== undefined && (
                <span className="cylinder-focus__sub"> ({heatedFractionPct}% of nominal)</span>
              )}
            </dd>
          </div>
        )}

        {isCylinder && nominalVolumeL !== undefined && (
          <div className="cylinder-focus__row">
            <dt className="cylinder-focus__dt">Nominal volume</dt>
            <dd className="cylinder-focus__dd">{nominalVolumeL} L</dd>
          </div>
        )}

        {isCylinder && !isMixergy && usableVolumeFactor !== undefined && (
          <div className="cylinder-focus__row">
            <dt className="cylinder-focus__dt">Usable hot water</dt>
            <dd className="cylinder-focus__dd cylinder-focus__dd--large">
              {Math.round(usableVolumeFactor * 100)}%
            </dd>
          </div>
        )}

        <div className="cylinder-focus__row">
          <dt className="cylinder-focus__dt">Recovery source</dt>
          <dd className="cylinder-focus__dd">{recoverySource}</dd>
        </div>

        <div className="cylinder-focus__row">
          <dt className="cylinder-focus__dt">Recovery tendency</dt>
          <dd className="cylinder-focus__dd">{recoveryPowerTendency}</dd>
        </div>
      </dl>

      {/* ── Depletion state note ───────────────────────────────────────────── */}
      {state === 'depleted' && (
        <div className="cylinder-focus__depletion-alert" role="alert" data-testid="depletion-alert">
          Cylinder depleted — usable stored volume below service threshold. Recovery in progress.
        </div>
      )}

      {/* ── Behavioural notes ──────────────────────────────────────────────── */}
      <div className="cylinder-focus__notes">
        <p className="cylinder-focus__note cylinder-focus__note--recovery">{recoveryNote}</p>
        <p className="cylinder-focus__note cylinder-focus__note--store">{storeNote}</p>
      </div>

      {/* ── Behaviour comparison note ──────────────────────────────────────── */}
      <div className="cylinder-focus__behaviour-note">
        <span className="cylinder-focus__behaviour-label">System behaviour</span>
        <p className="cylinder-focus__behaviour-text">{behaviourNote(storageRegime)}</p>
      </div>
    </div>
  )
}
