export interface AnxietyPatternBadgeProps {
  label: string;
}

export function AnxietyPatternBadge({ label }: AnxietyPatternBadgeProps) {
  return (
    <span className="atlas-anxiety-badge" data-testid="anxiety-pattern-badge">
      {label}
    </span>
  );
}
