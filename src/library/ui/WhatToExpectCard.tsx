import { EducationalCard } from './EducationalCard';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface WhatToExpectCardProps {
  title?: string;
  notice: string;
  normalBecause: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function WhatToExpectCard({
  title = 'What to expect',
  notice,
  normalBecause,
  ariaLabel,
  headingLevel = 3,
}: WhatToExpectCardProps) {
  return (
    <EducationalCard
      title={title}
      summary="Short expectation-setting copy that reduces surprise without increasing alarm."
      ariaLabel={ariaLabel}
      eyebrow="What you may notice"
      headingLevel={headingLevel}
      whatYouMayNotice={{ notice, normalBecause }}
    />
  );
}
