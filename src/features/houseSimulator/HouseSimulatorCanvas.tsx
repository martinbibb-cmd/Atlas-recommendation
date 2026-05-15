/**
 * HouseSimulatorCanvas — central house grid for the House Simulator.
 *
 * Renders a stylised house floor-plan with named rooms arranged in a CSS grid.
 * Rooms from the `HouseDisplayState` are displayed with their current heat state.
 * Active outlet nodes (shower, bath, kitchen tap, cold tap) are embedded in the
 * relevant room cells with live telemetry chips from the view model.
 *
 * Layout:
 *   Loft row:    Loft space | Airing cupboard
 *   First floor: Bedroom 1  | Bedroom 2  | Bathroom
 *   Ground floor: Kitchen   | Lounge     | Bathroom / WC
 *   Outside row:  Garden / external
 *
 * Heat state colouring is driven by HouseDisplayState (useHousePlayback) which
 * uses the exponential decay formula, not Math.random().
 */

import type { HouseDisplayState, RoomDisplayState, RoomHeatState } from '../../explainers/lego/simulator/useHousePlayback';
import HouseSimulatorOutletNode from './HouseSimulatorOutletNode';
import type { ActiveOutletChipViewModel } from './buildHouseSimulatorViewModel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HouseSimulatorCanvasProps {
  /** Live house display state from useHousePlayback. */
  houseState: HouseDisplayState;
  /** Active outlet chip view models from buildHouseSimulatorViewModel. */
  activeOutlets: ActiveOutletChipViewModel[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roomHeatClass(state: RoomHeatState): string {
  switch (state) {
    case 'heating_active': return 'hs-room--heating-active';
    case 'warming':        return 'hs-room--warming';
    case 'stable':         return 'hs-room--stable';
    case 'cooling':        return 'hs-room--cooling';
  }
}

/** Floor label icons. */
const FLOOR_ICON: Record<string, string> = {
  loft:    '🏗️',
  first:   '🛌',
  ground:  '🛋️',
  outside: '🌳',
};

// ─── Room cell ────────────────────────────────────────────────────────────────

interface RoomCellProps {
  room: RoomDisplayState;
  activeOutlets: ActiveOutletChipViewModel[];
}

function RoomCell({ room, activeOutlets }: RoomCellProps) {
  // Find active outlets whose roomName matches this room's name.
  const roomOutlets = activeOutlets.filter(o => o.roomName === room.name);

  return (
    <div className={`hs-room ${roomHeatClass(room.state)}`}>
      {room.hasEmitter && (
        <span
          className={`hs-emitter${room.emitterActive ? ' hs-emitter--active' : ''}`}
          aria-label={room.emitterActive ? 'Emitter active' : 'Emitter off'}
        >
          🌡
        </span>
      )}
      <span className="hs-room__name">{room.name}</span>
      {roomOutlets.map(outlet => (
        <HouseSimulatorOutletNode
          key={outlet.outletId}
          outletId={outlet.outletId}
          label={outlet.label}
          icon={outlet.icon}
          active
          constrained={outlet.constrained}
          metrics={outlet.metrics}
        />
      ))}
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function HouseSimulatorCanvas({
  houseState,
  activeOutlets,
}: HouseSimulatorCanvasProps) {
  const { floors, indoorTempC, statusLabel, chPaused } = houseState;

  const insideFloors = floors.filter(f => f.key !== 'outside');
  const outsideFloor = floors.find(f => f.key === 'outside');

  return (
    <div className="hs-canvas">
      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div className={`hs-canvas__status${chPaused ? ' hs-canvas__status--paused' : ''}`}>
        <span className="hs-canvas__temp">{indoorTempC.toFixed(1)} °C</span>
        <span className="hs-canvas__status-label">{statusLabel}</span>
        {chPaused && (
          <span className="hs-canvas__paused-flag" aria-label="Space heating paused for hot water draw">
            CH paused
          </span>
        )}
      </div>

      {/* ── House schematic ───────────────────────────────────────────────── */}
      <div className="hs-house" aria-label="House floor plan">

        {/* SVG roof silhouette */}
        <div className="hs-house__roof" aria-hidden="true">
          <svg
            className="hs-house__roof-svg"
            viewBox="0 0 240 36"
            preserveAspectRatio="none"
            focusable="false"
            aria-hidden="true"
          >
            <polygon points="120,3 3,36 237,36" fill="#4a5568" />
            <rect x="164" y="12" width="16" height="24" fill="#4a5568" />
            <rect x="161" y="8" width="22" height="6" fill="#718096" rx="1" ry="1" />
          </svg>
        </div>

        {/* Floors */}
        <div className="hs-house__body">
          {insideFloors.map((floor, idx) => (
            <div
              key={floor.key}
              className={`hs-floor${idx < insideFloors.length - 1 ? ' hs-floor--has-divider' : ''}`}
            >
              <div className="hs-floor__label">
                <span aria-hidden="true">{FLOOR_ICON[floor.key] ?? ''}</span>
                {floor.label}
              </div>
              <div className="hs-floor__rooms">
                {floor.rooms.map(room => (
                  <RoomCell key={room.name} room={room} activeOutlets={activeOutlets} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Foundation */}
        <div className="hs-house__foundation" aria-hidden="true" />
      </div>

      {/* ── Outside band ─────────────────────────────────────────────────── */}
      {outsideFloor && (
        <div className="hs-floor hs-floor--outside">
          <div className="hs-floor__label">
            <span aria-hidden="true">{FLOOR_ICON['outside']}</span>
            {outsideFloor.label}
          </div>
          <div className="hs-floor__rooms">
            {outsideFloor.rooms.map(room => (
              <RoomCell key={room.name} room={room} activeOutlets={activeOutlets} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
