import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';

const SCREEN_READER_SUMMARY =
  'Decision map showing how your recommendation is matched to your home: demand pattern, supply limits, distribution constraints, and comfort goals. Different homes can need different system routes for practical day-to-day results.';

const WHAT_THIS_MEANS =
  'Your recommendation is tailored to your home and routines, so comfort and hot-water performance stay reliable when daily demand rises.';

export interface SystemFitDecisionMapDiagramProps {
  printSafe?: boolean;
}

export function SystemFitDecisionMapDiagram({ printSafe = false }: SystemFitDecisionMapDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives"
      aria-label="System fit decision map diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {SCREEN_READER_SUMMARY}
      </p>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p className="atlas-edu-diagram__label">Step 1: Confirm demand pattern</p>
        <p className="atlas-edu-diagram__label">Single-outlet preference → on-demand hot water can be suitable</p>
        <p className="atlas-edu-diagram__label">Frequent overlap demand → stored hot water is often more suitable</p>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p className="atlas-edu-diagram__label">Step 2: Confirm supply and pipework limits</p>
        <p className="atlas-edu-diagram__label">Supply-limited or flow-limited site → do not promise overlap beyond measured limits</p>
        <p className="atlas-edu-diagram__label">Adequate mains-fed supply → mains-fed stored hot water can support overlap use</p>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p className="atlas-edu-diagram__label">Step 3: Confirm heat-delivery path</p>
        <p className="atlas-edu-diagram__label">Lower flow temperature path → emitter sizing and weather compensation become critical</p>
        <p className="atlas-edu-diagram__label">Higher flow temperature path → validate efficiency and cycling trade-offs</p>
      </div>

      <ExplanationCallout
        label="Decision-map rule"
        body="Each branch checks measured home limits first, then selects the route that gives the most dependable everyday comfort."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
