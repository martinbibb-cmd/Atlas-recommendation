/**
 * PhysicsConsole.tsx
 *
 * Layer 6 — glass box physics trace.
 * System-aware: shows COP/SPF for ASHP, G3 flags for unvented,
 * condensing potential for boilers, and per-room heat balance.
 */

import type { PhysicsRoomData, Room } from './explorerTypes';
import type { SystemConfig } from './explorerTypes';

interface Props {
  rooms: Room[];
  systemConfig: SystemConfig;
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
  room: Room; data: PhysicsRoomData; highlighted: boolean;
}) {
  return (
    <tr className={`pc__row ${highlighted ? 'pc__row--highlight' : ''}`}>
      <td className="pc__cell pc__cell--name">{room.label}</td>
      <td className="pc__cell pc__cell--num">{data.heatLossKw.toFixed(2)}</td>
      <td className="pc__cell pc__cell--num">{data.radiatorOutputKw.toFixed(2)}</td>
      <td className="pc__cell pc__cell--num pc__cell--delta">+{data.deltaKw.toFixed(2)}</td>
      <td className="pc__cell"><MarginBar marginPct={data.marginPct} /></td>
      <td className="pc__cell pc__cell--num">{data.flowTempC}°C</td>
    </tr>
  );
}

export default function PhysicsConsole({ rooms, systemConfig, selectedRoomId }: Props) {
  const { physics, heatSource, cylinder, designFlowTempC, id } = systemConfig;
  const isHP = heatSource.isHeatPump;

  const totalLoss   = physics.reduce((s, p) => s + p.heatLossKw, 0);
  const totalOutput = physics.reduce((s, p) => s + p.radiatorOutputKw, 0);
  const totalDelta  = totalOutput - totalLoss;

  const outputKw       = isHP ? (heatSource.ratedOutputKw ?? 7) : (heatSource.outputKw ?? 24);
  const oversizeFactor = outputKw / totalLoss;

  const condensingPossible = !isHP && designFlowTempC < 68;
  const condensingActual   = !isHP && (heatSource.condensing ?? false);

  return (
    <div className="pc">
      <div className="pc__header">
        <h3 className="pc__title">Physics Console</h3>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span className="pc__badge">{isHP ? 'heat pump' : 'gas boiler'}</span>
          <span className="pc__badge" style={{ background: 'rgba(181,138,58,0.08)', color: '#b58a3a', borderColor: 'rgba(181,138,58,0.2)' }}>
            glass box
          </span>
        </div>
      </div>

      {/* Per-room table */}
      <div className="pc__table-wrap">
        <table className="pc__table">
          <thead>
            <tr>
              <th className="pc__th">Room</th>
              <th className="pc__th pc__th--num">Loss (kW)</th>
              <th className="pc__th pc__th--num">Emitter (kW)</th>
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
                <RoomRow key={room.id} room={room} data={data}
                  highlighted={selectedRoomId === room.id} />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="pc__total-row">
              <td className="pc__cell pc__cell--name">System total</td>
              <td className="pc__cell pc__cell--num">{totalLoss.toFixed(2)}</td>
              <td className="pc__cell pc__cell--num">{totalOutput.toFixed(2)}</td>
              <td className="pc__cell pc__cell--num pc__cell--delta">+{totalDelta.toFixed(2)}</td>
              <td className="pc__cell" />
              <td className="pc__cell pc__cell--num">{designFlowTempC}°C</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* System-specific insights */}
      <div className="pc__insights">

        {/* Sizing insight */}
        <div className="pc__insight">
          <span className="pc__insight-label">
            {isHP ? 'Heat pump sizing' : 'Boiler sizing'} vs system demand
          </span>
          <span className="pc__insight-value">
            {outputKw} kW rated / {totalLoss.toFixed(1)} kW peak
            = <strong>{oversizeFactor.toFixed(1)}× oversized</strong>
            {isHP && oversizeFactor > 1.8 && (
              <span style={{ color: '#ffb020', marginLeft: '0.3rem' }}>
                — consider 5 kW model
              </span>
            )}
          </span>
        </div>

        {/* Boiler: condensing potential */}
        {!isHP && (
          <div className={`pc__insight ${condensingActual ? 'pc__insight--success' : condensingPossible ? 'pc__insight--warning' : 'pc__insight--danger'}`}>
            <span className="pc__insight-label">Condensing potential</span>
            <span className="pc__insight-value">
              {condensingActual
                ? `Condensing at ${heatSource.returnTempC ?? '?'}°C return — recovering latent heat`
                : condensingPossible
                ? `Flow temp ${designFlowTempC}°C — potential to condense if return <55°C`
                : `Flow temp ${designFlowTempC}°C — reduce to <68°C to enable condensing`}
            </span>
          </div>
        )}

        {/* ASHP: SPF and flow regime */}
        {isHP && (
          <>
            <div className={`pc__insight ${(heatSource.spf ?? 0) >= 3.0 ? 'pc__insight--success' : 'pc__insight--warning'}`}>
              <span className="pc__insight-label">Seasonal performance factor (SPF)</span>
              <span className="pc__insight-value">
                SPF {heatSource.spf ?? '?'} at {heatSource.flowTempRegime} regime
                {(heatSource.spf ?? 0) < 3.0 && ' — lower emitter flow temp to improve'}
              </span>
            </div>
            <div className="pc__insight">
              <span className="pc__insight-label">COP at design conditions (7°C outdoor, {designFlowTempC}°C flow)</span>
              <span className="pc__insight-value">
                COP = {heatSource.cop ?? '?'}
                {' '}— for every 1 kW electric input, {heatSource.cop ?? '?'} kW heat delivered
              </span>
            </div>
          </>
        )}

        {/* Cylinder insights */}
        {cylinder && (
          <div className="pc__insight">
            <span className="pc__insight-label">DHW cylinder</span>
            <span className="pc__insight-value">
              {cylinder.volumeLitres}L — recovery {cylinder.recoveryTimeMinutes} min —
              standing loss {cylinder.standingLossKwhPerDay} kWh/day
              {cylinder.g3Required && <strong style={{ color: '#ea5455', marginLeft: '0.3rem' }}>· G3 required</strong>}
            </span>
          </div>
        )}

        {/* Vented: loft tank note */}
        {(id === 'stored_vented' || id === 'regular_vented') && (
          <div className="pc__insight pc__insight--warning">
            <span className="pc__insight-label">Loft dependency</span>
            <span className="pc__insight-value">
              CWS + F&E header tanks required in loft. Not compatible with loft conversion plans.
            </span>
          </div>
        )}

        {/* Regular vented: efficiency warning */}
        {id === 'regular_vented' && (
          <div className="pc__insight pc__insight--danger">
            <span className="pc__insight-label">Boiler efficiency</span>
            <span className="pc__insight-value">
              Open-vented non-condensing boiler — {heatSource.efficiencyPct ?? 81}% seasonal efficiency.
              Upgrade to condensing system boiler could save ~12% on gas bills.
            </span>
          </div>
        )}
      </div>

      {/* Raw JSON */}
      <details className="pc__raw-details">
        <summary className="pc__raw-summary">Raw physics trace (JSON)</summary>
        <pre className="pc__raw">{JSON.stringify({
          systemType: id,
          rooms: physics,
          heatSource: {
            isHeatPump: isHP,
            outputKw: isHP ? heatSource.ratedOutputKw : heatSource.outputKw,
            ...(isHP ? { cop: heatSource.cop, spf: heatSource.spf, flowTempC: designFlowTempC }
                      : { returnTempC: heatSource.returnTempC, condensing: heatSource.condensing }),
          },
          ...(cylinder ? { cylinder: { volumeLitres: cylinder.volumeLitres, g3Required: cylinder.g3Required } } : {}),
        }, null, 2)}</pre>
      </details>
    </div>
  );
}
