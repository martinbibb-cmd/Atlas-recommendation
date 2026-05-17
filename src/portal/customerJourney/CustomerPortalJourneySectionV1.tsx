import type { ReactNode } from 'react';

interface CustomerPortalJourneySectionV1Props {
  sectionId: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

export function CustomerPortalJourneySectionV1({
  sectionId,
  eyebrow,
  title,
  intro,
  children,
}: CustomerPortalJourneySectionV1Props) {
  return (
    <section
      id={sectionId}
      className="customer-portal-journey__section"
      data-testid={`customer-portal-journey-section-${sectionId}`}
      data-reading-region="true"
    >
      <div className="customer-portal-journey__section-header">
        <p className="customer-portal-journey__eyebrow">{eyebrow}</p>
        <h2 className="customer-portal-journey__section-title">{title}</h2>
        {intro ? <p className="customer-portal-journey__section-intro">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}
