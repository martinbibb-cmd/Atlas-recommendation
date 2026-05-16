import '../diagrams.css';

export interface WaterStoreTankProps {
  label: string;
  /** Optional capacity label. Omit entirely for tanks where the volume was not surveyed. */
  capacityLabel?: string;
  pressureLabel?: string;
}

export function WaterStoreTank({ label, capacityLabel, pressureLabel }: WaterStoreTankProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper"
      aria-label={[label, capacityLabel, pressureLabel].filter(Boolean).join(', ')}
    >
      <p className="atlas-edu-diagram__label">{label}</p>
      <svg
        width={64}
        height={80}
        viewBox="0 0 64 80"
        aria-hidden="true"
        focusable="false"
      >
        <rect x={8} y={8} width={48} height={64} rx={6} fill="#eaf2fb" stroke="#234a7d" strokeWidth={2} />
        <rect x={8} y={44} width={48} height={28} rx={0} fill="#aac4e0" opacity={0.5} />
        <line x1={8} y1={44} x2={56} y2={44} stroke="#234a7d" strokeWidth={1} strokeDasharray="4 2" />
        <rect x={27} y={72} width={10} height={8} fill="#234a7d" />
      </svg>
      {capacityLabel ? <p className="atlas-edu-diagram__label">{capacityLabel}</p> : null}
      {pressureLabel ? <p className="atlas-edu-diagram__label">{pressureLabel}</p> : null}
    </div>
  );
}
