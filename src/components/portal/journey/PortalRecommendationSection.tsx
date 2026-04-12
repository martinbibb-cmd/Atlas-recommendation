/**
 * PortalRecommendationSection.tsx
 *
 * Section B — "What Atlas recommends."
 *
 * The close anchor. Recommendation must be unmistakable — no burying the lead.
 * Shows: recommended system name, one-line reason, up to 3 key benefits, and
 * optional confidence tone.
 *
 * When physicsReady is false the engine lacked enough evidence to produce a
 * causal recommendation.  We show an informational guard instead so the portal
 * never presents template-led output as physics truth.
 */

import type { JourneyRecommendation } from '../types/portalJourney.types';

interface Props {
  recommendation: JourneyRecommendation;
}

export default function PortalRecommendationSection({ recommendation }: Props) {
  const { title, summary, keyBenefits, confidenceLabel, physicsReady } = recommendation;

  // Physics guard — no recommendation without evidence
  if (!physicsReady) {
    return (
      <section
        className="portal-section portal-section--recommendation portal-journey-recommendation portal-journey-recommendation--incomplete"
        aria-labelledby="portal-recommendation-heading"
        data-testid="portal-recommendation-section"
      >
        <p className="portal-recommendation__eyebrow">Atlas recommends</p>
        <h2
          className="portal-recommendation__title"
          id="portal-recommendation-heading"
          data-testid="portal-recommendation-title"
        >
          {title}
        </h2>
        <p className="portal-recommendation__summary" data-testid="portal-recommendation-summary">
          {summary}
        </p>
      </section>
    );
  }

  return (
    <section
      className="portal-section portal-section--recommendation portal-journey-recommendation"
      aria-labelledby="portal-recommendation-heading"
      data-testid="portal-recommendation-section"
    >
      <p className="portal-recommendation__eyebrow">Atlas recommends</p>

      <h2
        className="portal-recommendation__title"
        id="portal-recommendation-heading"
        data-testid="portal-recommendation-title"
      >
        {title}
      </h2>

      <p className="portal-recommendation__summary" data-testid="portal-recommendation-summary">
        {summary}
      </p>

      {keyBenefits.length > 0 && (
        <ul className="portal-recommendation__benefits" data-testid="portal-recommendation-benefits">
          {keyBenefits.map((benefit) => (
            <li key={benefit} className="portal-recommendation__benefit">
              {benefit}
            </li>
          ))}
        </ul>
      )}

      {confidenceLabel && (
        <p className="portal-recommendation__confidence" data-testid="portal-recommendation-confidence">
          {confidenceLabel}
        </p>
      )}
    </section>
  );
}
