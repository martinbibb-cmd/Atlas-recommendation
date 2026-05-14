import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';

const SCREEN_READER_SUMMARY =
  'Line chart showing weather compensation: as outdoor temperature falls, target flow temperature rises along a smooth curve; as outdoor temperature rises, target flow temperature falls.';

const WHAT_THIS_MEANS =
  'Weather compensation changes flow temperature automatically with outdoor conditions. Small day-to-day flow-temperature shifts are normal and help maintain stable comfort.';

const CURVE_POINTS = [
  { outdoor: '-2°C', flow: '50°C' },
  { outdoor: '4°C', flow: '45°C' },
  { outdoor: '10°C', flow: '38°C' },
  { outdoor: '16°C', flow: '32°C' },
];

export interface WeatherCompensationCurveDiagramProps {
  printSafe?: boolean;
}

export function WeatherCompensationCurveDiagram({
  printSafe = false,
}: WeatherCompensationCurveDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Weather compensation curve diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <p className="atlas-edu-diagram__label">Outdoor temperature versus target flow temperature</p>
      <svg width={260} height={160} viewBox="0 0 260 160" aria-hidden="true" focusable="false">
        <line x1="28" y1="12" x2="28" y2="136" stroke="currentColor" strokeWidth="2" />
        <line x1="28" y1="136" x2="246" y2="136" stroke="currentColor" strokeWidth="2" />
        <polyline
          points="40,32 95,52 150,80 215,108"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="32" r="3" fill="currentColor" />
        <circle cx="95" cy="52" r="3" fill="currentColor" />
        <circle cx="150" cy="80" r="3" fill="currentColor" />
        <circle cx="215" cy="108" r="3" fill="currentColor" />
        <text x="10" y="16" fontSize="10">Flow</text>
        <text x="220" y="152" fontSize="10">Outdoor</text>
      </svg>

      <ul className="atlas-edu-diagram__timeline-phases-descriptions">
        {CURVE_POINTS.map((point) => (
          <li key={point.outdoor} className="atlas-edu-diagram__timeline-phase-desc">
            <strong>{point.outdoor} outside:</strong> target flow around {point.flow}
          </li>
        ))}
      </ul>

      <ExplanationCallout
        label="Compensation rule"
        body="Let the compensation curve do small automatic adjustments. Frequent manual setpoint changes can reduce stability."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
