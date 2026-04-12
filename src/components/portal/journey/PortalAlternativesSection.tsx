/**
 * PortalAlternativesSection.tsx
 *
 * Section E — "Compare other options."
 *
 * Alternatives are available but clearly subordinate to the recommendation.
 * Shows other plausible options with a short explanation and why they were
 * not the top choice. Should feel like "you have options, but here is why
 * this is the best one."
 */

import { useState } from 'react';
import type { JourneyAlternative } from '../types/portalJourney.types';

interface AlternativeCardProps {
  alternative: JourneyAlternative;
}

function AlternativeCard({ alternative }: AlternativeCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`portal-alternative-card${open ? ' portal-alternative-card--open' : ''}`}
      data-testid={`portal-alternative-${alternative.optionId}`}
    >
      <button
        className="portal-alternative-card__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="portal-alternative-card__title">{alternative.title}</span>
        <span className="portal-alternative-card__chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="portal-alternative-card__body">
          <p className="portal-alternative-card__summary">{alternative.summary}</p>
          {alternative.whyNotTopChoice && (
            <p className="portal-alternative-card__why-not">
              <strong>Why not the top choice:</strong> {alternative.whyNotTopChoice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  alternatives: JourneyAlternative[];
}

export default function PortalAlternativesSection({ alternatives }: Props) {
  if (alternatives.length === 0) return null;

  return (
    <section
      className="portal-section portal-section--alt portal-journey-alternatives"
      aria-labelledby="portal-alternatives-heading"
      data-testid="portal-alternatives-section"
    >
      <h2 className="portal-section__heading" id="portal-alternatives-heading">
        Other options considered
      </h2>

      <p className="portal-section__intro">
        We assessed every viable option for your home. These alternatives are available,
        but the recommendation above is the best fit based on your survey.
      </p>

      <div className="portal-alternative-cards" data-testid="portal-alternative-cards">
        {alternatives.map((alt) => (
          <AlternativeCard key={alt.optionId} alternative={alt} />
        ))}
      </div>
    </section>
  );
}
