import '../diagrams.css';

export interface PressureIndicatorProps {
  label: string;
  level: 'high' | 'medium' | 'low';
  levelLabel: string;
}

export function PressureIndicator({ label, level, levelLabel }: PressureIndicatorProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper"
      aria-label={`${label}: ${levelLabel}`}
    >
      <p className="atlas-edu-diagram__label">{label}</p>
      <div className="atlas-edu-diagram__pressure-bar-track" aria-hidden="true">
        <div className={`atlas-edu-diagram__pressure-bar-fill atlas-edu-diagram__pressure-bar-fill--${level}`} />
      </div>
      <p className="atlas-edu-diagram__label">{levelLabel}</p>
    </div>
  );
}
