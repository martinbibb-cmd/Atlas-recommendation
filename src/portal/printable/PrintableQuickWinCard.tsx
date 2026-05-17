import './printable.css';

export interface PrintableQuickWinCardProps {
  heading: string;
  body: string;
}

export function PrintableQuickWinCard({ heading, body }: PrintableQuickWinCardProps) {
  return (
    <article className="printable-card" data-testid="printable-quick-win-card" data-reading-region="true">
      <h3 className="printable-card__heading">{heading}</h3>
      <p className="printable-card__body">{body}</p>
    </article>
  );
}
