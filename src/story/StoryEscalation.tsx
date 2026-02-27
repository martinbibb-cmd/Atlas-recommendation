/**
 * StoryEscalation.tsx
 *
 * "Explore Full Detail" button shown at the bottom of a story scenario shell.
 * Only rendered when scenario.escalationAllowed === true.
 *
 * On click it calls onEscalate with the current partial engine input so that
 * FullSurveyStepper can prefill from Story Mode state.
 */
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';

interface Props {
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  prefill: Partial<EngineInputV2_3>;
}

export default function StoryEscalation({ onEscalate, prefill }: Props) {
  return (
    <div className="story-escalation">
      <p className="story-escalation__hint">
        Want to dig deeper? The Full Survey covers fabric, geochemistry, timeline modelling, and more.
      </p>
      <button
        className="cta-btn story-escalation__btn"
        onClick={() => onEscalate(prefill)}
      >
        Explore Full Detail →
      </button>
    </div>
  );
}
