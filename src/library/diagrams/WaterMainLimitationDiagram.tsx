import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { FlowLine } from './primitives/FlowLine';
import { OutletNode } from './primitives/OutletNode';
import { PressureIndicator } from './primitives/PressureIndicator';

const SCREEN_READER_SUMMARY =
  'Diagram showing the incoming water main as the fixed flow limit. The boiler or cylinder sits downstream and cannot increase the incoming flow rate. Multiple outlets drawing at once divide the available mains flow.';

const WHAT_THIS_MEANS =
  'The incoming water main sets the maximum flow. No boiler or cylinder can create more flow than the main supplies. Running multiple outlets at once divides the available flow between them.';

export interface WaterMainLimitationDiagramProps {
  printSafe?: boolean;
}

export function WaterMainLimitationDiagram({ printSafe = false }: WaterMainLimitationDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Water main limitation diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary" aria-label="Screen reader summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <PressureIndicator
          label="Incoming main — fixed limit"
          level="medium"
          levelLabel="Set by street supply"
        />
        <FlowLine label="Fixed incoming flow" direction="right" />
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <p className="atlas-edu-diagram__label">Boiler or cylinder (downstream)</p>
          <p className="atlas-edu-diagram__label">Cannot increase incoming flow</p>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <FlowLine label="Flow divided to outlet 1" direction="right" />
          <OutletNode label="Shower" active activeLabel="In use" />
          <FlowLine label="Flow divided to outlet 2" direction="right" />
          <OutletNode label="Tap" active activeLabel="In use" />
          <FlowLine label="Flow divided to outlet 3" direction="right" />
          <OutletNode label="Bath" />
        </div>
      </div>

      <ExplanationCallout
        label="The bigger boiler myth"
        body="A larger boiler heats water faster but cannot draw more water from the main. The supply limit is set at the street connection, not the appliance."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
