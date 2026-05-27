/**
 * StoredHotWaterReservePanel — compact stored hot water reserve indicator.
 *
 * PR15: surfaces stored hot water state (available litres, delivery temp, reheat)
 * in the Draw-Off panel for cylinder systems (unvented, open vented, Mixergy).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ 🔥 Stored hot water              [Reheat ↻]  │
 *   │  ┌──┐  132 L available            55°C top   │
 *   │  │██│  Delivery temperature        23°C btm  │
 *   │  │██│  54°C                                  │
 *   │  │░░│  Reserve buffered: 88%                 │
 *   │  └──┘                                        │
 *   └──────────────────────────────────────────────┘
 *
 * The tank fill bar uses the raw cylinderFillPct colour gradient:
 *   - top section teal (hot zone)
 *   - bottom section cold-blue (cold inlet)
 *
 * Mixergy distinction:
 *   - Badge "Mixergy stratified" shown when cylinderType === 'mixergy'
 *   - topTempC label emphasises that the top stays near setpoint
 */

import type { StoredHotWaterDisplayState } from '../useStoredHotWaterPlayback'

interface StoredHotWaterReservePanelProps {
  state: StoredHotWaterDisplayState
}

export default function StoredHotWaterReservePanel({ state }: StoredHotWaterReservePanelProps) {
  const {
    availableHotWaterL,
    deliveryTempC,
    topTempC,
    bottomTempC,
    usableReserveFraction,
    isReheatActive,
    cylinderSizeLitres,
    cylinderType,
  } = state

  const reservePct = Math.round(usableReserveFraction * 100)
  const isMixergy = cylinderType === 'mixergy'

  // Delivery temperature colour: cool blue → warm orange → hot red
  function deliveryTempColour(tempC: number): string {
    if (tempC >= 50) return '#c05621'  // hot orange — matches draw-off panel convention
    if (tempC >= 42) return '#b7791f'  // warm amber
    return '#718096'                   // grey — lukewarm / barely usable
  }

  // Fill bar: hot zone height as percentage of bar
  // Use usableReserveFraction (not raw fill) so Mixergy shows a taller hot column
  const hotZoneHeightPct = Math.round(usableReserveFraction * 100)

  return (
    <div className="shw-reserve" aria-label="Stored hot water reserve" role="region">
      {/* Header row */}
      <div className="shw-reserve__header">
        <span className="shw-reserve__title">
          🔥 Stored hot water
          {isMixergy && (
            <span className="shw-reserve__badge shw-reserve__badge--mixergy">
              Mixergy stratified
            </span>
          )}
        </span>
        {isReheatActive && (
          <span className="shw-reserve__badge shw-reserve__badge--reheat" aria-label="Reheat active">
            ↻ Reheat active
          </span>
        )}
      </div>

      {/* Body: tank visual + metrics */}
      <div className="shw-reserve__body">
        {/* Vertical tank fill bar */}
        <div className="shw-tank" aria-label={`Tank ${reservePct}% full`} role="img">
          <div className="shw-tank__inner">
            {/* Hot zone fill — grows from bottom */}
            <div
              className="shw-tank__hot-zone"
              style={{ height: `${hotZoneHeightPct}%` }}
            />
          </div>
          {/* Temperature labels alongside the bar */}
          <div className="shw-tank__temps">
            <span className="shw-tank__temp shw-tank__temp--top" aria-label={`Top temperature ${topTempC} degrees Celsius`}>
              {topTempC}°
            </span>
            <span className="shw-tank__temp shw-tank__temp--bottom" aria-label={`Bottom temperature ${bottomTempC} degrees Celsius`}>
              {bottomTempC}°
            </span>
          </div>
        </div>

        {/* Metrics column */}
        <div className="shw-metrics">
          {/* Available litres */}
          <div className="shw-metric">
            <span className="shw-metric__label">Stored hot water available</span>
            <span className="shw-metric__value" aria-label={`${availableHotWaterL} litres available`}>
              {availableHotWaterL} L
            </span>
            <span className="shw-metric__sub">of {cylinderSizeLitres} L nominal</span>
          </div>

          {/* Delivery temperature */}
          <div className="shw-metric shw-metric--temp">
            <span className="shw-metric__label">Delivery temperature</span>
            <span
              className="shw-metric__value"
              style={{ color: deliveryTempColour(deliveryTempC) }}
              aria-label={`Delivery temperature ${deliveryTempC} degrees Celsius`}
            >
              {deliveryTempC}°C
            </span>
          </div>

          {/* Reserve fraction */}
          <div className="shw-metric">
            <span className="shw-metric__label">
              {isReheatActive ? 'Reheat active' : 'Reserve buffered'}
            </span>
            <div className="shw-reserve-bar" aria-label={`Reserve ${reservePct} percent`}>
              <div
                className="shw-reserve-bar__fill"
                style={{ width: `${reservePct}%` }}
                role="progressbar"
                aria-valuenow={reservePct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="shw-metric__sub">{reservePct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
