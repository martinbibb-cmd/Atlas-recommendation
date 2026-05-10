import './diagrams.css';
import { ComfortTimeline } from './primitives/ComfortTimeline';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { RadiatorHeatMap } from './primitives/RadiatorHeatMap';

const SCREEN_READER_SUMMARY =
  'Diagram comparing a heat pump running warm radiators at 45°C continuously against a conventional boiler running hotter radiators in shorter bursts. Both achieve the same room temperature. The heat pump approach uses lower peak temperatures for longer periods.';

const WHAT_THIS_MEANS =
  'Heat pumps deliver comfort at lower radiator temperatures over longer run times. Radiators that feel warm rather than hot are working correctly, not failing.';

const HEAT_PUMP_PHASES = [
  { label: 'Morning', description: 'Continuous low-temperature output', widthPercent: 33 },
  { label: 'Daytime', description: 'Steady warm radiators, no cycling', widthPercent: 34 },
  { label: 'Evening', description: 'Maintained comfort, 45°C surface', widthPercent: 33 },
];

const BOILER_PHASES = [
  { label: 'Burst on (1)', description: 'High-temperature short burst', widthPercent: 25 },
  { label: 'Off (1)', description: 'Cooling between cycles', widthPercent: 25 },
  { label: 'Burst on (2)', description: 'High-temperature short burst', widthPercent: 25 },
  { label: 'Off (2)', description: 'Cooling between cycles', widthPercent: 25 },
];

export interface WarmVsHotRadiatorsDiagramProps {
  printSafe?: boolean;
}

export function WarmVsHotRadiatorsDiagram({ printSafe = false }: WarmVsHotRadiatorsDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Warm vs hot radiators diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <p className="atlas-edu-diagram__label">Heat pump: warm radiators (continuous)</p>
          <RadiatorHeatMap
            label="Radiator — heat pump"
            surfaceTempLabel="Surface: 35–50°C"
            comfortLabel="Continuous gentle warmth"
          />
          <ComfortTimeline
            label="Heat pump comfort over 24 hours"
            phases={HEAT_PUMP_PHASES}
            screenReaderSummary="Heat pump runs continuously at low temperature, maintaining steady comfort throughout the day."
          />
        </div>

        <div>
          <p className="atlas-edu-diagram__label">Conventional boiler: hot radiators (short bursts)</p>
          <RadiatorHeatMap
            label="Radiator — boiler"
            surfaceTempLabel="Surface: 65–80°C"
            comfortLabel="Intermittent high-temperature bursts"
          />
          <ComfortTimeline
            label="Boiler comfort over 24 hours"
            phases={BOILER_PHASES}
            screenReaderSummary="Boiler fires in short high-temperature bursts with cooling gaps between cycles."
          />
        </div>
      </div>

      <ExplanationCallout
        label="Same room temperature, different approach"
        body="Both methods reach the same room temperature. The heat pump spreads heat delivery over more hours at a lower temperature. Warm radiators indicate correct operation."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
