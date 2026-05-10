import type { ReactNode } from 'react';
import './educationalUi.css';

type EducationalCardTone = 'neutral' | 'fact' | 'safety' | 'trust';
type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface EducationalCardProps {
  title: string;
  summary: string;
  ariaLabel?: string;
  eyebrow?: string;
  headingLevel?: HeadingLevel;
  tone?: EducationalCardTone;
  analogy?: {
    title?: string;
    body: string;
  };
  whatYouMayNotice?: {
    notice: string;
    normalBecause: string;
  };
  misconceptionWarning?: {
    label?: string;
    misconception: string;
    reality: string;
  };
  diagram?: ReactNode;
  diagramLabel?: string;
  footer?: ReactNode;
}

function renderHeading(level: HeadingLevel, title: string) {
  switch (level) {
    case 2:
      return <h2 className="atlas-edu-card__title">{title}</h2>;
    case 3:
      return <h3 className="atlas-edu-card__title">{title}</h3>;
    case 4:
      return <h4 className="atlas-edu-card__title">{title}</h4>;
    case 5:
      return <h5 className="atlas-edu-card__title">{title}</h5>;
    default:
      return <h6 className="atlas-edu-card__title">{title}</h6>;
  }
}

export function EducationalCard({
  title,
  summary,
  ariaLabel,
  eyebrow = 'Educational note',
  headingLevel = 3,
  tone = 'neutral',
  analogy,
  whatYouMayNotice,
  misconceptionWarning,
  diagram,
  diagramLabel,
  footer,
}: EducationalCardProps) {
  return (
    <article
      className={`atlas-edu-card atlas-edu-card--${tone}`}
      aria-label={ariaLabel ?? title}
    >
      <header className="atlas-edu-card__header">
        <p className="atlas-edu-card__eyebrow">{eyebrow}</p>
        {renderHeading(headingLevel, title)}
      </header>

      <p className="atlas-edu-card__summary">{summary}</p>

      {(analogy || whatYouMayNotice || misconceptionWarning || diagram || footer) ? (
        <div className="atlas-edu-card__stack">
          {analogy ? (
            <section className="atlas-edu-note-block" aria-label={analogy.title ?? 'Analogy'}>
              <p className="atlas-edu-detail-block__label">{analogy.title ?? 'Analogy'}</p>
              <p className="atlas-edu-card__body">{analogy.body}</p>
            </section>
          ) : null}

          {whatYouMayNotice ? (
            <section className="atlas-edu-detail-grid" aria-label="What you may notice">
              <div className="atlas-edu-detail-block">
                <p className="atlas-edu-detail-block__label">You may notice</p>
                <p className="atlas-edu-detail-block__body">{whatYouMayNotice.notice}</p>
              </div>
              <div className="atlas-edu-detail-block">
                <p className="atlas-edu-detail-block__label">This is normal because</p>
                <p className="atlas-edu-detail-block__body">{whatYouMayNotice.normalBecause}</p>
              </div>
            </section>
          ) : null}

          {misconceptionWarning ? (
            <section
              className="atlas-edu-note-block"
              aria-label={misconceptionWarning.label ?? 'Common misconception'}
            >
              <p className="atlas-edu-detail-block__label">
                {misconceptionWarning.label ?? 'Common misconception'}
              </p>
              <p className="atlas-edu-card__body">{misconceptionWarning.misconception}</p>
              <p className="atlas-edu-card__body">{misconceptionWarning.reality}</p>
            </section>
          ) : null}

          {diagram ? (
            <div className="atlas-edu-diagram" aria-label={diagramLabel ?? 'Diagram'}>
              {diagram}
            </div>
          ) : null}

          {footer}
        </div>
      ) : null}
    </article>
  );
}
