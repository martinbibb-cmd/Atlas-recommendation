import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { FlowLine } from './primitives/FlowLine';
import { OutletNode } from './primitives/OutletNode';
import { PressureIndicator } from './primitives/PressureIndicator';
import { WaterStoreTank } from './primitives/WaterStoreTank';

const SCREEN_READER_SUMMARY =
  'Diagram showing how an unvented cylinder uses mains pressure to supply multiple outlets simultaneously. The cylinder stores hot water at mains pressure, so flow to showers and taps overlaps without a pump.';

const WHAT_THIS_MEANS =
  'An unvented cylinder stores water at mains pressure. Multiple outlets can run at the same time without a pump. The cylinder does not weaken pressure — it preserves it.';

export interface PressureVsStorageDiagramProps {
  printSafe?: boolean;
}

export function PressureVsStorageDiagram({ printSafe = false }: PressureVsStorageDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Pressure vs storage diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <PressureIndicator
          label="Mains pressure"
          level="high"
          levelLabel="High (2–4 bar)"
        />
        <FlowLine label="Mains water flow" direction="right" />
        <WaterStoreTank
          label="Unvented cylinder"
          capacityLabel="150–250 L"
          pressureLabel="Mains-fed"
        />
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <FlowLine label="Hot water to shower" direction="right" />
          <OutletNode label="Shower" active activeLabel="In use" />
          <FlowLine label="Hot water to tap" direction="right" />
          <OutletNode label="Tap" active activeLabel="In use" />
        </div>
      </div>

      <ExplanationCallout
        label="Why cylinders do not weaken pressure"
        body="The cylinder stores water already at mains pressure. Opening multiple outlets at once draws from that pressurised store — no pump needed."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
