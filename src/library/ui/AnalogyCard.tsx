import type { EducationalCardProps } from './EducationalCard';
import { EducationalCard } from './EducationalCard';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface AnalogyCardProps {
  title: string;
  analogy: string;
  whereItWorks: string;
  whereItBreaks: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function AnalogyCard({
  title,
  analogy,
  whereItWorks,
  whereItBreaks,
  ariaLabel,
  headingLevel = 3,
}: AnalogyCardProps) {
  const footer: EducationalCardProps['footer'] = (
    <dl className="atlas-edu-detail-list" aria-label="Analogy boundaries">
      <div className="atlas-edu-detail-list__item">
        <dt className="atlas-edu-detail-list__term">Where it works</dt>
        <dd className="atlas-edu-detail-list__description">{whereItWorks}</dd>
      </div>
      <div className="atlas-edu-detail-list__item">
        <dt className="atlas-edu-detail-list__term">Where it breaks</dt>
        <dd className="atlas-edu-detail-list__description">{whereItBreaks}</dd>
      </div>
    </dl>
  );

  return (
    <EducationalCard
      title={title}
      summary={analogy}
      ariaLabel={ariaLabel}
      eyebrow="Analogy"
      headingLevel={headingLevel}
      footer={footer}
    />
  );
}
