import { EducationalCard } from './EducationalCard';
import { StepSequence } from './layout/StepSequence';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

function getNestedHeadingLevel(level: HeadingLevel): HeadingLevel {
  return Math.min(6, level + 1) as HeadingLevel;
}

export interface PrintActionCardProps {
  title: string;
  steps: readonly string[];
  note?: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function PrintActionCard({
  title,
  steps,
  note,
  ariaLabel,
  headingLevel = 3,
}: PrintActionCardProps) {
  return (
    <EducationalCard
      title={title}
      summary="Printable actions should stay calm, short, and useful on paper without needing motion or hover states."
      ariaLabel={ariaLabel}
      eyebrow="Print action"
      headingLevel={headingLevel}
      footer={(
        <>
          <StepSequence
            steps={steps}
            title="Follow these steps"
            label="Printable sequence"
            ariaLabel="Printable action sequence"
            headingLevel={getNestedHeadingLevel(headingLevel)}
          />
          {note ? <p className="atlas-edu-step-sequence__note">{note}</p> : null}
        </>
      )}
    />
  );
}
