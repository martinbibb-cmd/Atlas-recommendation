import { EducationalCard } from './EducationalCard';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface TrustRecoveryCardProps {
  title: string;
  thisCanHappen: string;
  whatItMeans: string;
  whatToDoNext: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function TrustRecoveryCard({
  title,
  thisCanHappen,
  whatItMeans,
  whatToDoNext,
  ariaLabel,
  headingLevel = 3,
}: TrustRecoveryCardProps) {
  return (
    <EducationalCard
      title={title}
      summary="Recovery copy should protect trust by naming a normal wobble before it becomes a worry."
      ariaLabel={ariaLabel}
      eyebrow="Trust recovery"
      headingLevel={headingLevel}
      tone="trust"
      footer={(
        <div className="atlas-edu-detail-grid" aria-label="Trust recovery steps">
          <div className="atlas-edu-detail-block">
            <p className="atlas-edu-detail-block__label">This can happen</p>
            <p className="atlas-edu-detail-block__body">{thisCanHappen}</p>
          </div>
          <div className="atlas-edu-detail-block">
            <p className="atlas-edu-detail-block__label">What it means</p>
            <p className="atlas-edu-detail-block__body">{whatItMeans}</p>
          </div>
          <div className="atlas-edu-detail-block">
            <p className="atlas-edu-detail-block__label">What to do next</p>
            <p className="atlas-edu-detail-block__body">{whatToDoNext}</p>
          </div>
        </div>
      )}
    />
  );
}
