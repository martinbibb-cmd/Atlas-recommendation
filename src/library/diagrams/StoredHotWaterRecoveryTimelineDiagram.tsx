import './diagrams.css';
import { ComfortTimeline } from './primitives/ComfortTimeline';
import { ExplanationCallout } from './primitives/ExplanationCallout';

const SCREEN_READER_SUMMARY =
  'Timeline showing stored hot water use and recovery: morning draw, recovery period, daytime top-up, evening draw, and overnight recovery. Available hot water changes with use pattern and recharge time.';

const WHAT_THIS_MEANS =
  'Stored hot water performance is about thermal capacity and recovery time. Heavy draws are followed by recovery, and this is normal system behaviour.';

const RECOVERY_PHASES = [
  { label: 'Morning draw', description: 'High use window reduces stored temperature.', widthPercent: 20 },
  { label: 'Recovery', description: 'Cylinder reheats toward target temperature.', widthPercent: 20 },
  { label: 'Daytime top-up', description: 'Light use with short recovery cycles.', widthPercent: 20 },
  { label: 'Evening draw', description: 'Second high use window.', widthPercent: 20 },
  { label: 'Overnight recovery', description: 'Full recharge for next day.', widthPercent: 20 },
];

export interface StoredHotWaterRecoveryTimelineDiagramProps {
  printSafe?: boolean;
}

export function StoredHotWaterRecoveryTimelineDiagram({
  printSafe = false,
}: StoredHotWaterRecoveryTimelineDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Stored hot water recovery timeline diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <ComfortTimeline
        label="Stored hot water over 24 hours"
        phases={RECOVERY_PHASES}
        screenReaderSummary="Stored hot water follows draw-and-recovery cycles through the day."
      />

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <p className="atlas-edu-diagram__label">Peak-window planning: avoid back-to-back long draws in one short window</p>
        <p className="atlas-edu-diagram__label">Normal behaviour: recovery begins automatically after demand drops</p>
      </div>

      <ExplanationCallout
        label="Recovery expectation"
        body="If demand is concentrated into short peak windows, recovery time matters more than headline pressure."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
