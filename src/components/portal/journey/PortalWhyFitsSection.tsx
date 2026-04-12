/**
 * PortalWhyFitsSection.tsx
 *
 * Section C — "Why this fits your home."
 *
 * The proof section. Shows home-specific fit reasons derived from
 * engine-backed signals. Only surfaces reasons genuinely supported by data.
 */

import type { JourneyWhyFitsItem } from '../types/portalJourney.types';

interface Props {
  whyFits: JourneyWhyFitsItem[];
}

export default function PortalWhyFitsSection({ whyFits }: Props) {
  if (whyFits.length === 0) return null;

  return (
    <section
      className="portal-section portal-section--alt portal-journey-why-fits"
      aria-labelledby="portal-why-fits-heading"
      data-testid="portal-why-fits-section"
    >
      <h2 className="portal-section__heading" id="portal-why-fits-heading">
        Why this fits your home
      </h2>

      <div className="portal-why-fits__cards">
        {whyFits.map((item) => (
          <div
            key={item.title}
            className={`portal-why-fits__card portal-why-fits__card--${item.status}`}
            data-testid={`portal-why-fits-item-${item.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
          >
            <h3 className="portal-why-fits__card-title">
              <span
                className={`portal-why-fits__status-icon portal-why-fits__status-icon--${item.status}`}
                aria-hidden="true"
              >
                {item.status === 'positive' ? '✓' : '!'}
              </span>
              {item.title}
            </h3>
            <p className="portal-why-fits__explanation">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
