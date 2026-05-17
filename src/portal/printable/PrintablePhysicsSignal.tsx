import './printable.css';

export interface PrintablePhysicsSignalProps {
  label: string;
  value: string;
}

export function PrintablePhysicsSignal({ label, value }: PrintablePhysicsSignalProps) {
  return (
    <div className="printable-card__signal" data-testid="printable-physics-signal" data-reading-region="true">
      <span className="printable-card__signal-label">{label}</span>
      <span className="printable-card__signal-value">{value}</span>
    </div>
  );
}
