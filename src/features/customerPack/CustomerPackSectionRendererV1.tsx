import type { CustomerEvidenceSectionV1 } from '../legoTechnix/customerEvidence/CustomerEvidenceSectionV1';
import { CustomerEvidenceCardRendererV1 } from './CustomerEvidenceCardRendererV1';
import { CustomerTimelineRendererV1 } from './CustomerTimelineRendererV1';

export interface CustomerPackSectionRendererV1Props {
  readonly section: CustomerEvidenceSectionV1;
  readonly index: number;
}

export function CustomerPackSectionRendererV1({
  section,
  index,
}: CustomerPackSectionRendererV1Props) {
  const hasCardTimeline = section.cards.some((card) => (card.timelineEntries?.length ?? 0) > 0);
  const isEmpty =
    section.cards.length === 0 && section.warnings.length === 0 && section.timelineSummaries.length === 0;

  if (isEmpty) return null;

  return (
    <section
      className="cprv1-section"
      data-testid={`cprv1-section-${section.id}`}
      aria-labelledby={`cprv1-section-heading-${section.id}`}
    >
      <header className="cprv1-section__header">
        <p className="cprv1-section__eyebrow">Section {index + 1}</p>
        <h2 id={`cprv1-section-heading-${section.id}`} className="cprv1-section__heading">
          {section.heading}
        </h2>
        <p className="cprv1-section__summary">{section.summary}</p>
      </header>

      {section.warnings.length > 0 ? (
        <ul className="cprv1-warning-list" data-testid="cprv1-section-warnings">
          {section.warnings.map((warning, warningIndex) => (
            <li
              key={`${warning.message}-${warningIndex}`}
              className={`cprv1-warning-chip cprv1-warning-chip--${warning.severity}`}
              data-severity={warning.severity}
              data-category={warning.category}
            >
              <span className="cprv1-warning-chip__severity">{warning.severity}</span>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.cards.length > 0 ? (
        <div className="cprv1-card-grid" data-layout="responsive-metric-cards">
          {section.cards.map((card, cardIndex) => (
            <CustomerEvidenceCardRendererV1 key={`${card.type}-${card.heading}-${cardIndex}`} card={card} />
          ))}
        </div>
      ) : null}

      {!hasCardTimeline && section.timelineSummaries.length > 0 ? (
        <CustomerTimelineRendererV1 entries={section.timelineSummaries} />
      ) : null}
    </section>
  );
}
