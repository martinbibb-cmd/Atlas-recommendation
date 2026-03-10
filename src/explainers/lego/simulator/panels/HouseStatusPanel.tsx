/**
 * HouseStatusPanel — live home cutaway with heating-state playback.
 *
 * PR3: driven by HouseDisplayState (useHousePlayback) derived from the same
 * SystemDiagramDisplayState used by the System Diagram panel.
 *
 * Displays:
 *   - per-room heat state (heating_active / warming / stable / cooling)
 *   - emitter activity (radiator icon animates when energised)
 *   - combi CH-pause indicator
 *   - indoor temperature estimate and building status
 */

import type { HouseDisplayState, RoomHeatState } from '../useHousePlayback';

function roomStateClass(state: RoomHeatState): string {
  switch (state) {
    case 'heating_active': return 'house-room--heating-active';
    case 'warming':        return 'house-room--warming';
    case 'stable':         return 'house-room--stable';
    case 'cooling':        return 'house-room--cooling';
  }
}

type Props = {
  state?: HouseDisplayState;
};

export default function HouseStatusPanel({ state }: Props) {
  if (!state) {
    // Graceful fallback while state initialises (should be instant).
    return (
      <div className="house-cutaway house-cutaway--loading" role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  const { floors, indoorTempC, statusLabel, chPaused } = state;

  return (
    <div className="house-cutaway">
      {/* ── Status bar ───────────────────────────────────────── */}
      <div className={`house-status-bar${chPaused ? ' house-status-bar--paused' : ''}`}>
        <span className="house-status-bar__temp">
          {indoorTempC.toFixed(1)} °C
        </span>
        <span className="house-status-bar__label">{statusLabel}</span>
      </div>

      {/* ── Floors & rooms ───────────────────────────────────── */}
      {floors.map(floor => (
        <div key={floor.key} className={`house-floor ${floor.className}`}>
          <div className="house-floor__label">{floor.label}</div>
          <div className="house-rooms">
            {floor.rooms.map(room => (
              <span
                key={room.name}
                className={`house-room ${roomStateClass(room.state)}`}
              >
                {room.hasEmitter && (
                  <span
                    className={`house-emitter${room.emitterActive ? ' house-emitter--active' : ''}`}
                    aria-label={room.emitterActive ? 'Emitter active' : 'Emitter off'}
                  >
                    🔥
                  </span>
                )}
                {room.name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
