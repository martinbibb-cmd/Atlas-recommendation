import '../diagrams.css';

export interface RadiatorHeatMapProps {
  label: string;
  surfaceTempLabel: string;
  comfortLabel: string;
}

export function RadiatorHeatMap({ label, surfaceTempLabel, comfortLabel }: RadiatorHeatMapProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper"
      aria-label={`${label}: ${surfaceTempLabel}. ${comfortLabel}`}
    >
      <p className="atlas-edu-diagram__label">{label}</p>
      <svg
        width={120}
        height={60}
        viewBox="0 0 120 60"
        aria-hidden="true"
        focusable="false"
      >
        <rect x={4} y={4} width={112} height={52} rx={6} fill="#eaf2fb" stroke="#234a7d" strokeWidth={2} />
        <line x1={24} y1={4} x2={24} y2={56} stroke="#234a7d" strokeWidth={1} opacity={0.3} />
        <line x1={44} y1={4} x2={44} y2={56} stroke="#234a7d" strokeWidth={1} opacity={0.3} />
        <line x1={64} y1={4} x2={64} y2={56} stroke="#234a7d" strokeWidth={1} opacity={0.3} />
        <line x1={84} y1={4} x2={84} y2={56} stroke="#234a7d" strokeWidth={1} opacity={0.3} />
        <line x1={104} y1={4} x2={104} y2={56} stroke="#234a7d" strokeWidth={1} opacity={0.3} />
      </svg>
      <p className="atlas-edu-diagram__label">{surfaceTempLabel}</p>
      <p className="atlas-edu-diagram__label">{comfortLabel}</p>
    </div>
  );
}
