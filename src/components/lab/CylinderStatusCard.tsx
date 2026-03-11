/**
 * CylinderStatusCard — right-hand source/state panel for the Draw-Off
 * Workbench.
 *
 * For cylinder-based systems (boiler or heat pump) it renders a simple
 * schematic cylinder with hot/usable/cold zones and a draw-off arrow.
 * For combi (instantaneous on-demand) it adapts to an "Appliance status"
 * layout with no cylinder graphic.
 */

import type { CylinderStatusViewModel, StorageRegime, CylinderState } from './drawOffTypes'

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

// ─── Simple cylinder schematic ────────────────────────────────────────────────

interface CylinderGraphicProps {
  usableVolumeFactor: number   // 0–1
  topTempC: number
  bulkTempC?: number
  isMixergy?: boolean
  /** Mixergy only: fraction of nominal volume currently heated (0–100). */
  heatedFractionPct?: number
}

function CylinderGraphic({ usableVolumeFactor, topTempC, bulkTempC, isMixergy, heatedFractionPct }: CylinderGraphicProps) {
  // For Mixergy: hot zone fills to the actual heated fraction (5%–95% of graphic).
  // For standard cylinders: hot zone height proportional to usable volume (15%–50%).
  const hotPct  = isMixergy && heatedFractionPct !== undefined
    ? Math.min(95, Math.max(5, heatedFractionPct))
    : Math.min(50, Math.max(15, Math.round(usableVolumeFactor * 60)))
  const coldPct = 100 - hotPct

  const ariaLabel = isMixergy
    ? `Cylinder schematic: heated layer ${topTempC}°C, ${heatedFractionPct ?? Math.round(usableVolumeFactor * 100)}% heated, cool reserve below`
    : `Cylinder schematic: top ${topTempC}°C, bulk ${bulkTempC}°C`

  return (
    <div
      className="cylinder-graphic"
      aria-label={ariaLabel}
      role="img"
    >
      {/* cap */}
      <div className="cylinder-graphic__cap cylinder-graphic__cap--top" aria-hidden="true" />

      {/* body */}
      <div className="cylinder-graphic__body" aria-hidden="true">
        {/* hot zone */}
        <div
          className="cylinder-graphic__zone cylinder-graphic__zone--hot"
          style={{ height: `${hotPct}%` }}
        >
          <span className="cylinder-graphic__zone-label">{topTempC}°C</span>
        </div>
        {/* thermocline marker — sharper for Mixergy to reflect defined depletion point */}
        <div className={`cylinder-graphic__thermocline${isMixergy ? ' cylinder-graphic__thermocline--sharp' : ''}`} />
        {/* lower / cooler zone */}
        <div
          className="cylinder-graphic__zone cylinder-graphic__zone--cold"
          style={{ height: `${coldPct - 2}%` }}
        >
          <span className="cylinder-graphic__zone-label">
            {isMixergy ? 'cool reserve' : `${bulkTempC}°C`}
          </span>
        </div>
        {/* draw-off arrow */}
        <div className="cylinder-graphic__draw-arrow" aria-hidden="true">
          <span>↓ draw</span>
        </div>
      </div>

      {/* source indicator */}
      <div className="cylinder-graphic__coil-indicator" aria-hidden="true">
        <span className="cylinder-graphic__coil-label">
          {isMixergy ? '↑ top-down' : '~ coil'}
        </span>
      </div>

      {/* heated-layer annotation for Mixergy */}
      {isMixergy && (
        <div className="cylinder-graphic__heated-label" aria-hidden="true">
          Heated layer
        </div>
      )}

      {/* cap */}
      <div className="cylinder-graphic__cap cylinder-graphic__cap--bottom" aria-hidden="true" />
    </div>
  )
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
        <CylinderGraphic
          usableVolumeFactor={usableVolumeFactor ?? 0.5}
          topTempC={topTempC}
          bulkTempC={isMixergy ? undefined : bulkTempC}
          isMixergy={isMixergy}
          heatedFractionPct={isMixergy ? heatedFractionPct : undefined}
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
