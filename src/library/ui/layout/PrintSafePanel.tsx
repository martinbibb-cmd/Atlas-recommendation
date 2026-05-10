import type { ReactNode } from 'react';
import '../educationalUi.css';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

function renderHeading(level: HeadingLevel, title: string) {
  switch (level) {
    case 2:
      return <h2 className="atlas-edu-print-safe__title">{title}</h2>;
    case 3:
      return <h3 className="atlas-edu-print-safe__title">{title}</h3>;
    case 4:
      return <h4 className="atlas-edu-print-safe__title">{title}</h4>;
    case 5:
      return <h5 className="atlas-edu-print-safe__title">{title}</h5>;
    default:
      return <h6 className="atlas-edu-print-safe__title">{title}</h6>;
  }
}

export interface PrintSafePanelProps {
  title: string;
  intro?: string;
  children: ReactNode;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function PrintSafePanel({
  title,
  intro,
  children,
  ariaLabel,
  headingLevel = 2,
}: PrintSafePanelProps) {
  return (
    <article
      className="atlas-edu-print-safe"
      aria-label={ariaLabel ?? title}
      data-print-safe="true"
    >
      <p className="atlas-edu-print-safe__eyebrow">Print-safe panel</p>
      {renderHeading(headingLevel, title)}
      {intro ? <p className="atlas-edu-print-safe__intro">{intro}</p> : null}
      <div className="atlas-edu-print-safe__content">{children}</div>
    </article>
  );
}
