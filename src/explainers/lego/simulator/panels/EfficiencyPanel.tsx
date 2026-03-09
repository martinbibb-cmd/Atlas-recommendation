/**
 * EfficiencyPanel — shell for return temperature, condensing state, and COP.
 *
 * PR1: static placeholder values. Live engine wiring comes later.
 * Establishes the visual home for condensing / efficiency / penalty data.
 */

export default function EfficiencyPanel() {
  return (
    <div className="efficiency-panel">
      {/* Return temperature */}
      <div className="efficiency-metric">
        <span className="efficiency-metric__label">Return temp</span>
        <span className="efficiency-metric__value">— °C</span>
      </div>

      {/* Condensing state */}
      <div className="efficiency-metric">
        <span className="efficiency-metric__label">Condensing state</span>
        <span className="efficiency-badge efficiency-badge--idle">Awaiting data</span>
      </div>

      {/* Boiler efficiency */}
      <div className="efficiency-metric">
        <span className="efficiency-metric__label">Boiler efficiency</span>
        <span className="efficiency-metric__value">— %</span>
      </div>

      {/* COP / efficiency bar */}
      <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f7fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="efficiency-metric__label">Efficiency score</span>
          <span className="efficiency-metric__value">—</span>
        </div>
        <div className="efficiency-cop-bar">
          <div className="efficiency-cop-bar__track">
            <div className="efficiency-cop-bar__fill" style={{ width: '0%' }} />
          </div>
        </div>
      </div>

      {/* Penalty summary */}
      <div className="efficiency-metric" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className="efficiency-metric__label">Penalties</span>
        <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
          Condensing · sludge · scale · short-cycling
        </span>
        <span style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>
          Live data arrives with engine wiring
        </span>
      </div>
    </div>
  );
}
