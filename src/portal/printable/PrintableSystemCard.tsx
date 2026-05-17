import './printable.css';

export interface PrintableSystemCardProps {
  eyebrow?: string;
  heading: string;
  summary: string;
  facts?: string[];
}

export function PrintableSystemCard({ eyebrow = 'Your recommendation', heading, summary, facts = [] }: PrintableSystemCardProps) {
  return (
    <article className="printable-card" data-testid="printable-system-card" data-reading-region="true">
      <p className="printable-card__eyebrow">{eyebrow}</p>
      <h3 className="printable-card__heading">{heading}</h3>
      <p className="printable-card__summary">{summary}</p>
      {facts.length > 0 ? (
        <ul className="printable-card__list">
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
