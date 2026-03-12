/**
 * FlowRestrictionAnimation.tsx
 *
 * Animated diagram showing the effect of low mains flow rate on a combi boiler.
 *
 * When mains dynamic pressure or flow rate is insufficient a combi cannot
 * sustain the minimum ignition threshold.  The animation shows supply lagging
 * behind demand as a pulsing flow indicator.
 *
 * No engine calculations — display-model only.
 */

import './whatif-animations.css';

interface FlowBarProps {
  label:   string;
  level:   number;   // 0–100
  variant: 'demand' | 'supply';
}

function FlowBar({ label, level, variant }: FlowBarProps) {
  return (
    <div className="wia-flow__row">
      <span className="wia-flow__label">{label}</span>
      <div className="wia-flow__track">
        <div
          className={`wia-flow__fill wia-flow__fill--${variant}`}
          style={{ width: `${level}%` }}
        />
      </div>
      <span className="wia-flow__pct">{level}%</span>
    </div>
  );
}

/** Animated flow restriction diagram for combi hot water. */
export default function FlowRestrictionAnimation() {
  return (
    <div className="wia-flow" aria-label="Flow restriction effect animation">
      <div className="wia-flow__title">Mains flow vs. demand</div>
      <FlowBar label="Demand"  level={85} variant="demand"  />
      <FlowBar label="Supply"  level={45} variant="supply"  />
      <div className="wia-flow__gap-indicator" aria-hidden="true">
        Gap ↑ → hot water temperature becomes unstable
      </div>
      <p className="wia-flow__caption">
        When the supply flow rate falls below ~7 L/min, a combi boiler cannot
        maintain stable output.  A stored cylinder system can absorb this gap.
      </p>
    </div>
  );
}
