import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';
import { FlowLine } from './primitives/FlowLine';
import { OutletNode } from './primitives/OutletNode';
import { PressureIndicator } from './primitives/PressureIndicator';

const SCREEN_READER_SUMMARY =
  'Diagram showing a flow bottleneck: incoming supply reaches a restricted section of pipework, then available flow is divided across outlets. Restriction limits throughput regardless of downstream appliance size.';

const WHAT_THIS_MEANS =
  'Flow restriction is usually a pipework and supply issue. A larger appliance cannot push more water through a bottleneck than the restricted section allows.';

export interface FlowRestrictionBottleneckDiagramProps {
  printSafe?: boolean;
}

export function FlowRestrictionBottleneckDiagram({
  printSafe = false,
}: FlowRestrictionBottleneckDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="Flow restriction bottleneck diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <PressureIndicator
          label="Incoming supply"
          level="medium"
          levelLabel="Available flow set by supply"
        />
        <FlowLine label="Flow enters internal pipework" direction="right" />
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <p className="atlas-edu-diagram__label">Bottleneck section (restricted bore or legacy pipework)</p>
          <p className="atlas-edu-diagram__label">Throughput capped at restriction point</p>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <FlowLine label="Reduced flow to outlet 1" direction="right" />
          <OutletNode label="Shower" active activeLabel="In use" />
          <FlowLine label="Reduced flow to outlet 2" direction="right" />
          <OutletNode label="Tap" active activeLabel="In use" />
        </div>
      </div>

      <ExplanationCallout
        label="Bottleneck rule"
        body="When two outlets run together, both feel the restriction because total available flow is shared across them."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
