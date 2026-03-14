/**
 * RoomPanel.tsx
 *
 * Layer 2 slide-in panel — shows room details, emitter specs, and margins
 * when a room is selected in the HouseExplorer.
 */

import type { Room, Emitter, PhysicsRoomData } from './explorerTypes';

interface Props {
  room: Room;
  emitter: Emitter;
  physics: PhysicsRoomData;
  onEmitterClick: () => void;
  onClose: () => void;
}

function StatRow({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="room-panel__stat">
      <span className="room-panel__stat-label">{label}</span>
      <span className={`room-panel__stat-value ${accent ? 'room-panel__stat-value--accent' : ''}`}>
        {value}
        {sub && <span className="room-panel__stat-sub">{sub}</span>}
      </span>
    </div>
  );
}

function MarginBadge({ marginPct }: { marginPct: number }) {
  const tone = marginPct >= 30 ? 'success' : marginPct >= 15 ? 'warning' : 'danger';
  const label = marginPct >= 30 ? 'Good margin' : marginPct >= 15 ? 'Tight margin' : 'Undersized';
  return (
    <div className={`room-panel__margin room-panel__margin--${tone}`}>
      <span className="room-panel__margin-pct">+{marginPct}%</span>
      <span className="room-panel__margin-label">{label}</span>
    </div>
  );
}

export default function RoomPanel({ room, emitter, physics, onEmitterClick, onClose }: Props) {
  const emitterIcon = emitter.type === 'radiator' ? '♨' : '▦';

  return (
    <div className="room-panel" role="dialog" aria-label={`${room.label} detail`}>
      {/* Header */}
      <div className="room-panel__header">
        <div className="room-panel__title-block">
          <h2 className="room-panel__title">{room.label}</h2>
          <span className="room-panel__temp-badge">{room.designTemp}°C design</span>
        </div>
        <button
          className="room-panel__close"
          onClick={onClose}
          aria-label="Close room panel"
        >
          ×
        </button>
      </div>

      {/* Heat balance */}
      <div className="room-panel__section">
        <h3 className="room-panel__section-title">Heat balance</h3>
        <StatRow label="Room demand" value={`${physics.heatLossKw.toFixed(2)} kW`} />
        <StatRow label="Radiator output" value={`${physics.radiatorOutputKw.toFixed(2)} kW`} />
        <StatRow
          label="Net margin"
          value={`+${physics.deltaKw.toFixed(2)} kW`}
          accent
        />
        <MarginBadge marginPct={physics.marginPct} />
      </div>

      {/* Flow temperatures */}
      <div className="room-panel__section">
        <h3 className="room-panel__section-title">Flow temperatures</h3>
        <StatRow label="Flow temp" value={`${physics.flowTempC}°C`} />
        <StatRow label="Return temp" value={`${physics.returnTempC}°C`} />
        <StatRow label="ΔT" value={`${physics.flowTempC - physics.returnTempC}°C`} />
      </div>

      {/* Warm-up */}
      <div className="room-panel__section">
        <h3 className="room-panel__section-title">Response</h3>
        <StatRow
          label="Warm-up time"
          value={`${room.warmUpMinutes} min`}
          sub=" from cold"
        />
      </div>

      {/* Emitter CTA */}
      <div className="room-panel__emitter">
        <button
          className="room-panel__emitter-btn"
          onClick={onEmitterClick}
          aria-label={`View ${emitter.label} detail`}
        >
          <span className="room-panel__emitter-icon">{emitterIcon}</span>
          <span className="room-panel__emitter-info">
            <span className="room-panel__emitter-name">{emitter.label}</span>
            <span className="room-panel__emitter-spec">{emitter.outputKw.toFixed(1)} kW rated</span>
          </span>
          <span className="room-panel__emitter-arrow">→ trace pipe</span>
        </button>
      </div>
    </div>
  );
}
