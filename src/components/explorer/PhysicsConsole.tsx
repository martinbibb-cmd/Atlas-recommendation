/**
 * PhysicsConsole.tsx
 *
 * Layer 6 — glass box physics trace.
 * Shows raw heat-loss and emitter sizing calculations for every room,
 * plus system-wide totals and condensing eligibility.
 */

import type { PhysicsRoomData, Room } from './explorerTypes';
import type { BoilerData } from './explorerTypes';

interface Props {
  rooms: Room[];
  physics: PhysicsRoomData[];
  boiler: BoilerData;
  selectedRoomId?: string;
}

function MarginBar({ marginPct }: { marginPct: number }) {
  const tone = marginPct >= 30 ? '#28c76f' : marginPct >= 15 ? '#ffb020' : '#ea5455';
  return (
    <div className="pc__margin-bar">
      <div className="pc__margin-fill" style={{ width: `${Math.min(marginPct, 60)}%`, background: tone }} />
      <span className="pc__margin-label" style={{ color: tone }}>+{marginPct}%</span>
    </div>
  );
}

function RoomRow({ room, data, highlighted }: {
  room: Room;
  data: PhysicsRoomData;
  highlighted: boolean;
}) {
  return (
    <tr className={`pc__row ${highlighted ? 'pc__row--highlight' : ''}`}>
      <td className="pc__cell pc__cell--name">{room.label}</td>
      <td className="pc__cell pc__cell--num">{data.heatLossKw.toFixed(2)}</td>
      <td className="pc__cell pc__cell--num">{data.radiatorOutputKw.toFixed(2)}</td>
      <td className="pc__cell pc__cell--num pc__cell--delta">+{data.deltaKw.toFixed(2)}</td>
      <td className="pc__cell">
        <MarginBar marginPct={data.marginPct} />
      </td>
      <td className="pc__cell pc__cell--num">{data.flowTempC}°C</td>
    </tr>
  );
}

export default function PhysicsConsole({ rooms, physics, boiler, selectedRoomId }: Props) {
  const totalLossKw   = physics.reduce((s, p) => s + p.heatLossKw,        0);
  const totalOutputKw = physics.reduce((s, p) => s + p.radiatorOutputKw,   0);
  const totalDeltaKw  = totalOutputKw - totalLossKw;

  // Condensing is possible if average flow temp could drop below 75°C
  const avgFlowTemp = physics[0]?.flowTempC ?? 75;
  const condensingPossible = avgFlowTemp < 68;

  return (
    <div className="pc">
      <div className="pc__header">
        <h3 className="pc__title">Physics Console</h3>
        <span className="pc__badge">glass box</span>
      </div>

      {/* Per-room table */}
      <div className="pc__table-wrap">
        <table className="pc__table">
          <thead>
            <tr>
              <th className="pc__th">Room</th>
              <th className="pc__th pc__th--num">Loss (kW)</th>
              <th className="pc__th pc__th--num">Radiator (kW)</th>
              <th className="pc__th pc__th--num">Margin</th>
              <th className="pc__th">Headroom</th>
              <th className="pc__th pc__th--num">Flow T</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(room => {
              const data = physics.find(p => p.roomId === room.id);
              if (!data) return null;
              return (
                <RoomRow
                  key={room.id}
                  room={room}
                  data={data}
                  highlighted={selectedRoomId === room.id}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="pc__total-row">
              <td className="pc__cell pc__cell--name">System total</td>
              <td className="pc__cell pc__cell--num">{totalLossKw.toFixed(2)}</td>
              <td className="pc__cell pc__cell--num">{totalOutputKw.toFixed(2)}</td>
              <td className="pc__cell pc__cell--num pc__cell--delta">+{totalDeltaKw.toFixed(2)}</td>
              <td className="pc__cell" />
              <td className="pc__cell pc__cell--num">{avgFlowTemp}°C</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* System insights */}
      <div className="pc__insights">
        <div className="pc__insight">
          <span className="pc__insight-label">Boiler rated vs system demand</span>
          <span className="pc__insight-value">
            {boiler.outputKw} kW rated / {totalLossKw.toFixed(1)} kW peak demand
            = <strong>{Math.round((boiler.outputKw / totalLossKw) * 10) / 10}× oversized</strong>
          </span>
        </div>
        <div className={`pc__insight ${condensingPossible ? 'pc__insight--success' : 'pc__insight--warning'}`}>
          <span className="pc__insight-label">Condensing potential</span>
          <span className="pc__insight-value">
            {condensingPossible
              ? `Flow temp ${avgFlowTemp}°C — condensing achievable`
              : `Flow temp ${avgFlowTemp}°C — reduce to <68°C to condense`}
          </span>
        </div>
        <div className="pc__insight">
          <span className="pc__insight-label">Return water</span>
          <span className="pc__insight-value">
            {boiler.returnTempC}°C — {boiler.returnTempC < 55 ? 'condensing range' : 'above condensing threshold'}
          </span>
        </div>
      </div>

      {/* Raw JSON trace */}
      <details className="pc__raw-details">
        <summary className="pc__raw-summary">Raw physics trace (JSON)</summary>
        <pre className="pc__raw">{JSON.stringify(
          { rooms: physics, boiler: { outputKw: boiler.outputKw, returnTempC: boiler.returnTempC, condensing: boiler.condensing } },
          null, 2
        )}</pre>
      </details>
    </div>
  );
}
