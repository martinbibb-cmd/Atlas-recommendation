import '../educationalUi.css';

export interface ConceptDividerProps {
  label: string;
}

export function ConceptDivider({ label }: ConceptDividerProps) {
  return (
    <div className="atlas-edu-divider" role="separator" aria-label={label}>
      <span className="atlas-edu-divider__label">{label}</span>
    </div>
  );
}
