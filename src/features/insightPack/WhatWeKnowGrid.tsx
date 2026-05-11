/**
 * WhatWeKnowGrid.tsx — Screen 2: What we looked at.
 *
 * 2×N grid of visual tiles showing the surveyed home facts.
 * Grounds the rest of the deck in evidence.
 * Pure presentation — data from InsightPack.homeProfile.
 */

import { useMemo } from 'react';
import type { HomeProfileTile } from './insightPack.types';
import { atlasMvpContentMapRegistry } from '../../library/content';
import { buildPortalEvidenceCards } from '../../library/portal/buildPortalEvidenceCards';
import './WhatWeKnowGrid.css';

interface Props {
  tiles: HomeProfileTile[];
}

function Tile({ tile }: { tile: HomeProfileTile }) {
  return (
    <div className="wk-tile" data-testid="wk-tile">
      <span className="wk-tile__icon" aria-hidden="true">{tile.icon}</span>
      <span className="wk-tile__title">{tile.title}</span>
      <span className="wk-tile__finding">{tile.finding}</span>
    </div>
  );
}

export default function WhatWeKnowGrid({ tiles }: Props) {
  const evidenceCards = useMemo(() => {
    try {
      return buildPortalEvidenceCards({
        tiles,
        atlasMvpContentMapRegistry,
      });
    } catch {
      return [];
    }
  }, [tiles]);

  if (evidenceCards.length === 0) {
    return (
      <div className="what-we-know" data-testid="what-we-know-grid">
        <h2 className="what-we-know__heading">What we looked at</h2>
        <p className="what-we-know__sub">
          The advice in this pack is based on the following surveyed facts about your home.
        </p>

        <div className="wk-grid">
          {tiles.map((tile, i) => (
            <Tile key={`${tile.icon}-${tile.title}-${i}`} tile={tile} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="what-we-know" data-testid="what-we-know-grid">
      <h2 className="what-we-know__heading">What we looked at</h2>
      <p className="what-we-know__sub">
        The advice in this pack is based on surveyed facts and why each one matters.
      </p>

      <div className="wk-grid wk-grid--evidence">
        {evidenceCards.map((card) => (
          <article key={card.id} className="wk-evidence-card" data-testid="wk-evidence-card">
            <h3 className="wk-evidence-card__title">{card.title}</h3>
            <p className="wk-evidence-card__fact">{card.plainEnglishFact}</p>
            <p className="wk-evidence-card__why">{card.whyItMatters}</p>
            {card.linkedConceptIds.length > 0 ? (
              <p className="wk-evidence-card__links" data-testid={`wk-evidence-concepts-${card.id}`}>
                Concepts: {card.linkedConceptIds.join(', ')}
              </p>
            ) : null}
            {card.suggestedDiagramIds.length > 0 ? (
              <p className="wk-evidence-card__meta">
                Diagrams: {card.suggestedDiagramIds.join(', ')}
              </p>
            ) : null}
            {card.suggestedPrintCardIds.length > 0 ? (
              <p className="wk-evidence-card__meta">
                Print cards: {card.suggestedPrintCardIds.join(', ')}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
