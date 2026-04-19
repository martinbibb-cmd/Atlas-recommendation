/**
 * WhatWeKnowGrid.tsx — Screen 2: What we looked at.
 *
 * 2×N grid of visual tiles showing the surveyed home facts.
 * Grounds the rest of the deck in evidence.
 * Pure presentation — data from InsightPack.homeProfile.
 */

import type { HomeProfileTile } from './insightPack.types';
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
