import './diagrams.css';
import { ExplanationCallout } from './primitives/ExplanationCallout';

const SCREEN_READER_SUMMARY =
  'Decision map showing how system fit is chosen from measured site constraints: demand pattern, supply limits, distribution constraints, and control goals. Different homes reach different system outcomes for evidence-based reasons.';

const WHAT_THIS_MEANS =
  'System fit is selected from measured evidence, not a one-size-fits-all preference. The chosen path reflects your demand pattern, supply limits, and home constraints.';

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
        body="Each branch is evidence-led. Atlas uses measured constraints first, then recommends the lowest-risk path for comfort and trust."
      />

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
