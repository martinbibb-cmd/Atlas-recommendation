/**
 * WhyAtlasSuggestedThis.tsx — Screen 10: Why Atlas suggested this.
 *
 * A "because ladder" showing the reasoning chain behind the recommendation.
 * Makes the recommendation feel inevitable, not opinionated.
 * Pure presentation — data from InsightPack.reasonChain.
 */

import type { ReasonChainStep } from './insightPack.types';
import './WhyAtlasSuggestedThis.css';

interface Props {
  reasonChain: ReasonChainStep[];
}

export default function WhyAtlasSuggestedThis({ reasonChain }: Props) {
  return (
    <div className="why-atlas" data-testid="why-atlas-suggested">
      <h2 className="why-atlas__heading">Why Atlas suggested this</h2>
      <p className="why-atlas__sub">
        The recommendation follows directly from your home's facts — not a preference.
      </p>

      <ol className="why-atlas__chain" aria-label="Reasoning steps">
        {reasonChain.map((step, i) => {
          const isLast = i === reasonChain.length - 1;
          return (
            <li
              key={i}
              className={`why-chain__step${isLast ? ' why-chain__step--conclusion' : ''}`}
            >
              <div className="why-chain__connector" aria-hidden="true">
                <span className="why-chain__dot" />
                {!isLast && <span className="why-chain__line" />}
              </div>
              <div className="why-chain__content">
                <p className="why-chain__label">{step.label}</p>
                {step.detail && (
                  <p className="why-chain__detail">{step.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
