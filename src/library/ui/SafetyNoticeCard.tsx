import { EducationalCard } from './EducationalCard';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface SafetyNoticeCardProps {
  title: string;
  message: string;
  whatToDoNext?: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function SafetyNoticeCard({
  title,
  message,
  whatToDoNext,
  ariaLabel,
  headingLevel = 3,
}: SafetyNoticeCardProps) {
  return (
    <EducationalCard
      title={title}
      summary={message}
      ariaLabel={ariaLabel}
      eyebrow="Safety note"
      headingLevel={headingLevel}
      tone="safety"
      footer={whatToDoNext ? (
        <section className="atlas-edu-note-block" aria-label="What to do next">
          <p className="atlas-edu-detail-block__label">What to do next</p>
          <p className="atlas-edu-card__body">{whatToDoNext}</p>
        </section>
      ) : undefined}
    />
  );
}
