import type { ReactNode } from 'react';
import '../educationalUi.css';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

function renderHeading(level: HeadingLevel, title: string) {
  switch (level) {
    case 2:
      return <h2 className="atlas-edu-section__heading">{title}</h2>;
    case 3:
      return <h3 className="atlas-edu-section__heading">{title}</h3>;
    case 4:
      return <h4 className="atlas-edu-section__heading">{title}</h4>;
    case 5:
      return <h5 className="atlas-edu-section__heading">{title}</h5>;
    default:
      return <h6 className="atlas-edu-section__heading">{title}</h6>;
  }
}

export interface CalmSectionProps {
  title: string;
  intro?: string;
  children: ReactNode;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function CalmSection({
  title,
  intro,
  children,
  ariaLabel,
  headingLevel = 2,
}: CalmSectionProps) {
  return (
    <section className="atlas-edu-section" aria-label={ariaLabel ?? title}>
      <header className="atlas-edu-section__header">
        {renderHeading(headingLevel, title)}
        {intro ? <p className="atlas-edu-section__intro">{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}
