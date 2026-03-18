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
 *
 * PR7: floor icons, improved domestic feel.
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

/** Icon for each floor type — keeps the cutaway looking like a home. */
function floorIcon(key: string): string {
  switch (key) {
    case 'loft':    return '🏗️';
    case 'first':   return '🛌';
    case 'ground':  return '🛋️';
    case 'outside': return '🌳';
    default:        return '';
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

  // Separate inside floors from outside so the house structure is clear.
  const insideFloors = floors.filter(f => f.key !== 'outside');
  const outsideFloor = floors.find(f => f.key === 'outside');

  return (
    <div className="house-cutaway">
      {/* ── Status bar ───────────────────────────────────────── */}
      <div className={`house-status-bar${chPaused ? ' house-status-bar--paused' : ''}`}>
        <span className="house-status-bar__temp">
          {indoorTempC.toFixed(1)} °C
        </span>
        <span className="house-status-bar__label">{statusLabel}</span>
      </div>

      {/* ── House schematic: roof peak + inside floors ─────── */}
      <div className="house-schematic" role="img" aria-label="House section view">
        {/* Roof peak — visual affordance above the loft */}
        <div className="house-schematic__roof" aria-hidden="true">
          <div className="house-schematic__roof-peak" />
        </div>

        {/* Inside floors stacked within the house body */}
        <div className="house-schematic__body">
          {insideFloors.map((floor, idx) => (
            <div
              key={floor.key}
              className={`house-floor ${floor.className}${idx < insideFloors.length - 1 ? ' house-floor--has-divider' : ''}`}
            >
              <div className="house-floor__label">
                <span aria-hidden="true">{floorIcon(floor.key)}</span>
                {floor.label}
              </div>
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
                        🌡
                      </span>
                    )}
                    {room.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Outside / external band below the house ──────────── */}
      {outsideFloor && (
        <div className={`house-floor ${outsideFloor.className}`}>
          <div className="house-floor__label">
            <span aria-hidden="true">{floorIcon(outsideFloor.key)}</span>
            {outsideFloor.label}
          </div>
          <div className="house-rooms">
            {outsideFloor.rooms.map(room => (
              <span
                key={room.name}
                className={`house-room ${roomStateClass(room.state)}`}
              >
                {room.hasEmitter && (
                  <span
                    className={`house-emitter${room.emitterActive ? ' house-emitter--active' : ''}`}
                    aria-label={room.emitterActive ? 'Emitter active' : 'Emitter off'}
                  >
                    🌡
                  </span>
                )}
                {room.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
