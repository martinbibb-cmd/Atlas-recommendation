import './printable.css';

export interface PrintableJourneySummaryProps {
  propertyTitle?: string;
  recommendationTitle: string;
  summary: string;
}

export function PrintableJourneySummary({ propertyTitle, recommendationTitle, summary }: PrintableJourneySummaryProps) {
  return (
    <section className="printable-card" data-testid="printable-journey-summary" data-reading-region="true">
      <p className="printable-card__eyebrow">Journey summary</p>
      <h3 className="printable-card__heading">{recommendationTitle}</h3>
      {propertyTitle ? <p className="printable-card__note">{propertyTitle}</p> : null}
      <p className="printable-card__summary">{summary}</p>
    </section>
  );
}
