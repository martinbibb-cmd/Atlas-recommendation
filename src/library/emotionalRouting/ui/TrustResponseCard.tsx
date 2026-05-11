export interface TrustResponseCardProps {
  title: string;
  response: string;
}

export function TrustResponseCard({ title, response }: TrustResponseCardProps) {
  return (
    <article className="atlas-trust-response-card" data-testid="storyboard-trust-response-card">
      <p className="atlas-trust-response-card__eyebrow">Atlas response</p>
      <h3 className="atlas-trust-response-card__title">{title}</h3>
      <p className="atlas-trust-response-card__body">{response}</p>
    </article>
  );
}
