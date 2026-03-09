/**
 * DrawOffStatusPanel — static outlet monitor shell.
 *
 * Shows per-outlet rows with flow / temperature / status placeholders.
 * PR1: static idle state. Live draw-off animation wiring comes later.
 */

interface OutletRow {
  icon: string;
  name: string;
}

const OUTLETS: OutletRow[] = [
  { icon: '🚿', name: 'Shower' },
  { icon: '🛁', name: 'Bath' },
  { icon: '🚰', name: 'Kitchen tap' },
];

export default function DrawOffStatusPanel() {
  return (
    <div className="draw-off-status">
      {OUTLETS.map(outlet => (
        <div key={outlet.name} className="draw-off-outlet">
          <div className="draw-off-outlet__name">
            <span className="draw-off-outlet__icon">{outlet.icon}</span>
            {outlet.name}
          </div>
          <div className="draw-off-outlet__rows">
            <div className="draw-off-metric">
              <span className="draw-off-metric__label">Flow</span>
              <span className="draw-off-metric__value draw-off-metric__value--idle">— L/min</span>
            </div>
            <div className="draw-off-metric">
              <span className="draw-off-metric__label">Temp</span>
              <span className="draw-off-metric__value draw-off-metric__value--idle">— °C</span>
            </div>
            <div className="draw-off-metric">
              <span className="draw-off-metric__label">Status</span>
              <span className="draw-off-metric__value draw-off-metric__value--idle">Idle</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
