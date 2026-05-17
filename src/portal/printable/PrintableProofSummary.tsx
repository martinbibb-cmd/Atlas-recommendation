import './printable.css';

export interface PrintableProofSummaryProps {
  heading: string;
  summary: string;
  takeaway: string;
  reassurance: string;
}

export function PrintableProofSummary({ heading, summary, takeaway, reassurance }: PrintableProofSummaryProps) {
  return (
    <section className="printable-card" data-testid="printable-proof-summary" data-reading-region="true">
      <p className="printable-card__eyebrow">Proof summary</p>
      <p className="printable-card__heading">{heading}</p>
      <p className="printable-card__summary">{summary}</p>
      <p className="printable-card__body"><strong>Key takeaway:</strong> {takeaway}</p>
      <p className="printable-card__note">{reassurance}</p>
    </section>
  );
}
