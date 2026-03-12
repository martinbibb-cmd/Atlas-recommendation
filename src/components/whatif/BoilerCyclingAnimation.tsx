/**
 * BoilerCyclingAnimation.tsx
 *
 * Animated diagram showing the cause-and-effect of an oversized boiler.
 *
 * When an oversized boiler fires it reaches setpoint too quickly, producing
 * a short burst of heat followed by a rest period — a pattern that degrades
 * efficiency and reduces component lifespan.
 *
 * The animation runs a continuous CSS loop to make the cycling behaviour
 * viscerally clear.  No engine calculations are performed here.
 */

import './whatif-animations.css';

/** Single on/off bar in the cycling pattern. */
function Bar({ state }: { state: 'on' | 'off' }) {
  return (
    <div
      className={`wia-cycling__bar wia-cycling__bar--${state}`}
      role="presentation"
    />
  );
}

/** Animated boiler cycling diagram. */
export default function BoilerCyclingAnimation() {
  const pattern: Array<'on' | 'off'> = [
    'on', 'off', 'on', 'off', 'on', 'off', 'on', 'off',
  ];

  return (
    <div className="wia-cycling" aria-label="Oversized boiler cycling pattern animation">
      <div className="wia-cycling__label">Oversized boiler — short cycles</div>
      <div className="wia-cycling__track">
        {pattern.map((state, i) => (
          <Bar key={i} state={state} />
        ))}
      </div>
      <div className="wia-cycling__cursor" aria-hidden="true" />
      <div className="wia-cycling__legend">
        <span className="wia-cycling__legend-item wia-cycling__legend-item--on">Firing</span>
        <span className="wia-cycling__legend-item wia-cycling__legend-item--off">Idle</span>
      </div>
      <p className="wia-cycling__caption">
        Heat output exceeds demand → boiler overshoots setpoint → short rest → restart.
        Each start-stop cycle stresses the heat exchanger and burner.
      </p>
    </div>
  );
}
