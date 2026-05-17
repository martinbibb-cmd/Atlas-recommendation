export interface PersistentJourneyHeaderProps {
  propertyTitle?: string;
  recommendationTitle: string;
  summary?: string;
  surfaceLabel: string;
}

export function PersistentJourneyHeader({ propertyTitle, recommendationTitle, summary, surfaceLabel }: PersistentJourneyHeaderProps) {
  return (
    <section className="journey-identity" data-testid="journey-identity-header" data-reading-region="true">
      <div className="journey-identity__eyebrow-row">
        <span className="journey-identity__eyebrow">Recommendation journey</span>
        <span className="journey-identity__surface">{surfaceLabel}</span>
      </div>
      <h2 className="journey-identity__title">{recommendationTitle}</h2>
      {propertyTitle ? <p className="journey-identity__property">{propertyTitle}</p> : null}
      {summary ? <p className="journey-identity__summary">{summary}</p> : null}
    </section>
  );
}
