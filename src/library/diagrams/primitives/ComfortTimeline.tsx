import '../diagrams.css';

export interface ComfortTimelineProps {
  label: string;
  phases: Array<{ label: string; description: string; widthPercent: number }>;
  screenReaderSummary: string;
}

export function ComfortTimeline({ label, phases, screenReaderSummary }: ComfortTimelineProps) {
  return (
    <div className="atlas-edu-diagram__wrapper" aria-label={label}>
      <p className="atlas-edu-diagram__screen-reader-summary" aria-label="Screen reader summary">
        {screenReaderSummary}
      </p>
      <p className="atlas-edu-diagram__label">{label}</p>
      <div className="atlas-edu-diagram__timeline-track" aria-hidden="true">
        {phases.map((phase) => (
          <div
            key={phase.label}
            className="atlas-edu-diagram__timeline-phase"
            style={{ width: `${phase.widthPercent}%` }}
          >
            <span className="atlas-edu-diagram__timeline-phase-label">{phase.label}</span>
          </div>
        ))}
      </div>
      <ul className="atlas-edu-diagram__timeline-phases-descriptions">
        {phases.map((phase) => (
          <li key={phase.label} className="atlas-edu-diagram__timeline-phase-desc">
            <strong>{phase.label}:</strong> {phase.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
