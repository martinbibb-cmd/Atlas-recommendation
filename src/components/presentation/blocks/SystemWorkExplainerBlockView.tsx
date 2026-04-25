/**
 * SystemWorkExplainerBlockView.tsx — Renders a SystemWorkExplainerBlock.
 *
 * Shows up to 6 explainer cards, each answering:
 *   - What it is  (the work label)
 *   - What it does  (plain-English description)
 *   - Why it helps you  (customer benefit)
 *
 * Rules:
 *   - Content comes from block.cards only — no derivation here.
 *   - No more than 6 cards are rendered (enforced in builder).
 *   - Cards with empty whatItDoes or whyItHelps are shown with available fields only.
 */

import type { SystemWorkExplainerBlock } from '../../../contracts/VisualBlock';

interface Props {
  block: SystemWorkExplainerBlock;
}

export function SystemWorkExplainerBlockView({ block }: Props) {
  return (
    <article
      className="customer-deck__block customer-deck__block--work-explainer"
      aria-label={block.title}
    >
      <div className="customer-deck__block-body">
        <h2 className="customer-deck__title">{block.title}</h2>
        <p className="customer-deck__outcome">{block.outcome}</p>

        <div
          className="customer-deck__explainer-cards"
          data-testid="work-explainer-cards"
        >
          {block.cards.map((card, index) => (
            <div
              key={`${card.whatItIs}-${index}`}
              className="customer-deck__explainer-card"
              data-testid={`work-explainer-card-${index}`}
            >
              <p className="customer-deck__explainer-card__title">{card.whatItIs}</p>
              {card.whatItDoes && (
                <p className="customer-deck__explainer-card__does">{card.whatItDoes}</p>
              )}
              {card.whyItHelps && (
                <p className="customer-deck__explainer-card__helps">
                  <span className="customer-deck__explainer-card__helps-prefix" aria-hidden="true">✓ </span>
                  {card.whyItHelps}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
