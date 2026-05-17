import './printable.css';

export interface PrintableComparisonCardProps {
  heading: string;
  summary: string;
  items: string[];
  recommended?: boolean;
  listTestId?: string;
}

export function PrintableComparisonCard({ heading, summary, items, recommended = false, listTestId }: PrintableComparisonCardProps) {
  return (
    <article
      className={`printable-card printable-card__comparison${recommended ? ' printable-card__comparison--recommended' : ''}`}
      data-testid="printable-comparison-card"
      data-reading-region="true"
    >
      <p className="printable-card__heading">{heading}</p>
      <p className="printable-card__summary">{summary}</p>
      {items.length > 0 ? (
        <ul className="printable-card__list" data-testid={listTestId}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
