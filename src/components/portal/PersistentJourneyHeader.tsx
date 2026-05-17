export interface PersistentJourneyHeaderProps {
  propertyTitle?: string;
  recommendationTitle: string;
  summary?: string;
  surfaceLabel: string;
  headingLevel?: 1 | 2;
}

export function PersistentJourneyHeader({ propertyTitle, recommendationTitle, summary, surfaceLabel, headingLevel = 2 }: PersistentJourneyHeaderProps) {
  return (
    <section className="journey-identity" data-testid="journey-identity-header" data-reading-region="true">
      <div className="journey-identity__eyebrow-row">
        <span className="journey-identity__eyebrow">Recommendation journey</span>
        <span className="journey-identity__surface">{surfaceLabel}</span>
      </div>
      {headingLevel === 1 ? (
        <h1 className="journey-identity__title">{recommendationTitle}</h1>
      ) : (
        <h2 className="journey-identity__title">{recommendationTitle}</h2>
      )}
      {propertyTitle ? <p className="journey-identity__property">{propertyTitle}</p> : null}
      {summary ? <p className="journey-identity__summary">{summary}</p> : null}
    </section>
  );
}
