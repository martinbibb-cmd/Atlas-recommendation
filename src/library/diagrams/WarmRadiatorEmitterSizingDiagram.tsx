import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { RadiatorHeatMap } from './primitives/RadiatorHeatMap';

const SCREEN_READER_SUMMARY =
  'Comparison diagram: correctly sized emitter with warm flow temperature delivers stable room comfort; undersized emitter at the same flow temperature struggles to match room heat loss.';

const WHAT_THIS_MEANS =
  'Warm radiators can deliver comfort when emitter sizing matches room heat loss. If emitters are undersized, comfort may require emitter upgrades or flow-temperature changes.';

export interface WarmRadiatorEmitterSizingDiagramProps {
  printSafe?: boolean;
}

export function WarmRadiatorEmitterSizingDiagram({
  printSafe = false,
}: WarmRadiatorEmitterSizingDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Warm radiator and emitter sizing comparison diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <p className="atlas-edu-diagram__label">Emitter sized for lower flow temperature</p>
          <RadiatorHeatMap
            label="Sized emitter"
            surfaceTempLabel="Warm surface, stable comfort"
            comfortLabel="Matches heat loss at lower flow temperature"
          />
        </div>
        <div>
          <p className="atlas-edu-diagram__label">Emitter undersized for lower flow temperature</p>
          <RadiatorHeatMap
            label="Undersized emitter"
            surfaceTempLabel="Warm surface, comfort can drift"
            comfortLabel="May need emitter upgrade or flow-temperature adjustment"
          />
        </div>
      </div>

      <ExplanationCallout
        label="Sizing rule"
        body="Emitter sizing and flow temperature must be considered together. Warm radiators do not indicate failure when emitter output is correctly matched."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
