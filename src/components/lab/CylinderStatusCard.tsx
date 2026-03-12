/**
 * CylinderStatusCard — right-hand source/state panel for the Draw-Off
 * Workbench.
 *
 * For cylinder-based systems (boiler or heat pump) it renders the
 * CylinderBehaviourGraphic physics-style schematic.
 * For combi (instantaneous on-demand) it adapts to an "Appliance status"
 * layout with no cylinder graphic.
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

function isCylinderRegime(regime: StorageRegime): boolean {
  return regime === 'boiler_cylinder' || regime === 'heat_pump_cylinder' || regime === 'mixergy_cylinder'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: CylinderStatusViewModel
}

export default function CylinderStatusCard({ data }: Props) {
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

  const isCylinder = isCylinderRegime(storageRegime)
  const isMixergy  = storageRegime === 'mixergy_cylinder'

  const panelTitle = isCylinder ? 'Cylinder status' : 'Hot water source status'

  return (
    <div
      className="cylinder-status-card"
      data-testid="cylinder-status-card"
      aria-label={panelTitle}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="cylinder-status-card__header">
        <span className="cylinder-status-card__title">{panelTitle}</span>
        <span
          className={`cylinder-status-card__state-chip ${STATE_MOD[state]}`}
          aria-label={`State: ${STATE_LABELS[state]}`}
        >
          {STATE_LABELS[state]}
        </span>
      </div>

      {/* ── Cylinder graphic (cylinder systems only) ───────────────────────── */}
      {isCylinder && topTempC !== undefined && (isMixergy || bulkTempC !== undefined) && (
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
        />
      )}

      {/* ── Data rows ──────────────────────────────────────────────────────── */}
      <dl className="cylinder-status-card__rows">
        <div className="cylinder-status-card__row">
          <dt className="cylinder-status-card__dt">Storage regime</dt>
          <dd className="cylinder-status-card__dd">{REGIME_LABEL[storageRegime]}</dd>
        </div>

        {isCylinder && topTempC !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Top temp</dt>
            <dd className="cylinder-status-card__dd">{topTempC}°C</dd>
          </div>
        )}

        {/* Bulk temp — standard cylinders only; Mixergy uses heated-volume model */}
        {isCylinder && !isMixergy && bulkTempC !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Bulk temp</dt>
            <dd className="cylinder-status-card__dd">{bulkTempC}°C</dd>
          </div>
        )}

        {/* Heated volume — Mixergy only */}
        {isMixergy && heatedVolumeL !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Heated volume</dt>
            <dd className="cylinder-status-card__dd">{heatedVolumeL} L</dd>
          </div>
        )}

        {isCylinder && nominalVolumeL !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Nominal volume</dt>
            <dd className="cylinder-status-card__dd">{nominalVolumeL} L</dd>
          </div>
        )}

        {/* Heated fraction — Mixergy only; replaces usable volume % */}
        {isMixergy && heatedFractionPct !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Heated fraction</dt>
            <dd className="cylinder-status-card__dd">{heatedFractionPct}%</dd>
          </div>
        )}

        {/* Usable volume — standard cylinders only */}
        {isCylinder && !isMixergy && usableVolumeFactor !== undefined && (
          <div className="cylinder-status-card__row">
            <dt className="cylinder-status-card__dt">Usable volume</dt>
            <dd className="cylinder-status-card__dd">{Math.round(usableVolumeFactor * 100)}%</dd>
          </div>
        )}

        <div className="cylinder-status-card__row">
          <dt className="cylinder-status-card__dt">Recovery source</dt>
          <dd className="cylinder-status-card__dd">{recoverySource}</dd>
        </div>

        <div className="cylinder-status-card__row">
          <dt className="cylinder-status-card__dt">Recovery tendency</dt>
          <dd className="cylinder-status-card__dd">{recoveryPowerTendency}</dd>
        </div>
      </dl>

      {/* ── Behavioural notes ──────────────────────────────────────────────── */}
      <div className="cylinder-status-card__notes">
        <p className="cylinder-status-card__note cylinder-status-card__note--recovery">
          {recoveryNote}
        </p>
        <p className="cylinder-status-card__note cylinder-status-card__note--store">
          {storeNote}
        </p>
      </div>
    </div>
  )
}
