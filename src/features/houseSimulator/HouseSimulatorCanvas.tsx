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
import type { OutletNodeViewModel } from './buildHouseSimulatorViewModel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HouseSimulatorCanvasProps {
  /** Live house display state from useHousePlayback. */
  houseState: HouseDisplayState;
  /** All outlet nodes from buildHouseSimulatorViewModel. */
  outletNodes: OutletNodeViewModel[];
  /** True when simulator is in manual interaction mode. */
  isManualMode: boolean;
  /** Currently selected outlet id (used in auto mode popover). */
  selectedOutletId: string | null;
  /** Called when an outlet node is tapped/clicked. */
  onOutletPress: (outletId: string) => void;
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
  outletNodes: OutletNodeViewModel[];
  selectedOutletId: string | null;
  onOutletPress: (outletId: string) => void;
}

function outletPositionClass(outletId: string): string {
  switch (outletId) {
    case 'shower': return 'hs-outlet-node--pos-shower';
    case 'bath': return 'hs-outlet-node--pos-bath';
    case 'kitchen': return 'hs-outlet-node--pos-kitchen';
    case 'cold_tap': return 'hs-outlet-node--pos-cold-tap';
    case 'washing_machine': return 'hs-outlet-node--pos-washing-machine';
    default: return 'hs-outlet-node--pos-default';
  }
}

function RoomCell({
  room,
  outletNodes,
  selectedOutletId,
  onOutletPress,
}: RoomCellProps) {
  const roomOutlets = outletNodes.filter(o => o.roomName === room.name);

  return (
    <div
      className={`hs-room ${roomHeatClass(room.state)}`}
    >
      {room.hasEmitter && (
        <span
          className={`hs-emitter${room.emitterActive ? ' hs-emitter--active' : ''}`}
          aria-label={room.emitterActive ? 'Radiator active' : 'Radiator off'}
        >
          <span aria-hidden="true">🌡</span>
        </span>
      )}
      <span className="hs-room__name">{room.name}</span>
      <div className="hs-room__outlet-layer">
        {roomOutlets.map(outlet => (
          <HouseSimulatorOutletNode
            key={outlet.outletId}
            outletId={outlet.outletId}
            label={outlet.label}
            icon={outlet.icon}
            active={outlet.active}
            constrained={outlet.constrained}
            metrics={outlet.metrics}
            selected={selectedOutletId === outlet.outletId}
            supported={outlet.supported}
            synthetic={outlet.isSynthetic}
            onPress={() => onOutletPress(outlet.outletId)}
            positionClassName={outletPositionClass(outlet.outletId)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function HouseSimulatorCanvas({
  houseState,
  outletNodes,
  isManualMode,
  selectedOutletId,
  onOutletPress,
}: HouseSimulatorCanvasProps) {
  const { floors, indoorTempC, statusLabel, chPaused } = houseState;
  const selectedOutletNode = selectedOutletId != null
    ? outletNodes.find(outlet => outlet.outletId === selectedOutletId)
    : undefined;

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

        <div className="hs-house__roof" aria-hidden="true">
          <svg className="hs-house__roof-svg" viewBox="0 0 240 36" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
            <defs>
              <linearGradient id="hsRoofGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5a667a" />
                <stop offset="100%" stopColor="#3f4a5d" />
              </linearGradient>
            </defs>
            <polygon points="120,3 3,36 237,36" fill="url(#hsRoofGradient)" />
            <rect x="164" y="12" width="16" height="24" fill="#3f4a5d" />
            <rect x="161" y="8" width="22" height="6" fill="#6d7c95" rx="1" ry="1" />
          </svg>
        </div>

        <div className="hs-house__stage">
          {/* 1) House artwork layer (static, fixed stage) */}
          <svg className="hs-house__artwork" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <linearGradient id="hsHouseBackdrop" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef2f7" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="620" fill="url(#hsHouseBackdrop)" />
            <line x1="0" y1="205" x2="1000" y2="205" stroke="#9aa6bd" strokeWidth="2" />
            <line x1="0" y1="410" x2="1000" y2="410" stroke="#9aa6bd" strokeWidth="2" />
          </svg>

          {/* 2) Room/grid layer + 3) outlet interaction layer + 4) chip layer */}
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
                    <RoomCell
                      key={room.name}
                      room={room}
                      outletNodes={outletNodes}
                      selectedOutletId={selectedOutletId}
                      onOutletPress={onOutletPress}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
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
              <RoomCell
                key={room.name}
                room={room}
                outletNodes={outletNodes}
                selectedOutletId={selectedOutletId}
                onOutletPress={onOutletPress}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5) Canvas-local outlet detail layer */}
      {selectedOutletNode != null && (
        <aside className="hs-outlet-popover" aria-label={`${selectedOutletNode.label} details`}>
          <strong>{selectedOutletNode.label}</strong>
          <p>
            {!selectedOutletNode.supported
              ? 'This outlet is unavailable in the current simulator profile'
              : selectedOutletNode.active
              ? 'Active outlet'
              : isManualMode
                ? 'Tap to open this outlet in manual mode'
                : 'Auto mode controls this outlet from scenario playback'}
          </p>
          {selectedOutletNode.detailText && (
            <p className="hs-outlet-popover__warning">{selectedOutletNode.detailText}</p>
          )}
        </aside>
      )}
    </div>
  );
}
