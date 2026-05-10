import '../diagrams.css';

export interface ExplanationCalloutProps {
  label: string;
  body: string;
}

export function ExplanationCallout({ label, body }: ExplanationCalloutProps) {
  return (
    <div className="atlas-edu-diagram__callout" aria-label={label}>
      <p className="atlas-edu-diagram__callout-label">{label}</p>
      <p className="atlas-edu-diagram__callout-body">{body}</p>
    </div>
  );
}
