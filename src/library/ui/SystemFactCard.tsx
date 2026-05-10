import type { ReactNode } from 'react';
import { EducationalCard } from './EducationalCard';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface SystemFactCardProps {
  title: string;
  fact: string;
  diagram?: ReactNode;
  diagramLabel?: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function SystemFactCard({
  title,
  fact,
  diagram,
  diagramLabel,
  ariaLabel,
  headingLevel = 3,
}: SystemFactCardProps) {
  return (
    <EducationalCard
      title={title}
      summary={fact}
      ariaLabel={ariaLabel}
      eyebrow="System fact"
      headingLevel={headingLevel}
      tone="fact"
      diagramLabel={diagramLabel}
      diagram={diagram}
    />
  );
}
