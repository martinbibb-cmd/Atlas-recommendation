/**
 * RatingsPanel.tsx — Section 4: Atlas Rating (band-based, physics-derived).
 *
 * Rules:
 *   - No numeric scores — RatingBand only.
 *   - Each dimension shows band + reason + expandable physics detail.
 *   - Colour bands convey quality; no "97/100" style values.
 *   - In simplified mode (customer-pack): shows only the suitability
 *     (overall fit) band per quote — no per-dimension detail.
 */

import { useState } from 'react';
import type { QuoteInsight, RatingBand, RatingExplanation } from './insightPack.types';
import './RatingsPanel.css';

interface Props {
  quotes: QuoteInsight[];
  /**
   * When true, renders only the overall suitability band per quote.
   * Used in customer-pack mode where full per-dimension detail would
   * overwhelm the customer.  Defaults to false.
   */
  simplified?: boolean;
}

const BAND_ICONS: Record<RatingBand, string> = {
  'Excellent':          '✅',
  'Very Good':          '👍',
  'Good':               '🆗',
  'Needs Right Setup':  '⚠️',
  'Less Suited':        '🚫',
};

function customerBandLabel(band: RatingBand): string {
  return band === 'Needs Right Setup' ? 'Installation-sensitive' : band;
}

const DIMENSION_LABELS: Array<{
  key: keyof QuoteInsight['rating'];
  label: string;
}> = [
  { key: 'hotWaterPerformance', label: 'Hot Water' },
  { key: 'heatingPerformance',  label: 'Heating' },
  { key: 'efficiency',          label: 'Efficiency' },
  { key: 'reliability',         label: 'Reliability' },
  { key: 'suitability',         label: 'Overall Fit' },
];

function bandCssClass(band: RatingBand): string {
  switch (band) {
    case 'Excellent':         return 'excellent';
    case 'Very Good':         return 'very-good';
    case 'Good':              return 'good';
    case 'Needs Right Setup': return 'needs-right-setup';
    case 'Less Suited':       return 'less-suited';
  }
}

function RatingChip({
  dimension,
  explanation,
}: {
  dimension: string;
  explanation: RatingExplanation;
}) {
  const [showPhysics, setShowPhysics] = useState(false);

  return (
    <div
      className={`rating-chip rating-chip--${bandCssClass(explanation.rating)}`}
      data-testid={`rating-chip-${dimension}`}
    >
      <div className="rating-chip__dimension">{dimension}</div>
      <div className="rating-chip__band">
        <span>{BAND_ICONS[explanation.rating]}</span>
        <span>{customerBandLabel(explanation.rating)}</span>
      </div>
      <div className="rating-chip__reason">{explanation.reason}</div>
      <button
        className="rating-chip__physics-toggle"
        onClick={() => setShowPhysics(v => !v)}
        aria-expanded={showPhysics}
      >
        {showPhysics ? '▲ Hide detail' : '▼ Why?'}
      </button>
      {showPhysics && (
        <div className="rating-chip__physics">{explanation.physics}</div>
      )}
    </div>
  );
}

export default function RatingsPanel({ quotes, simplified = false }: Props) {
  if (simplified) {
    return (
      <div className="ratings" data-testid="ratings-panel">
        <h2 className="ratings__heading">Overall Fit</h2>
        <p className="ratings__sub">
          How well each option suits this home, based on measured constraints.
        </p>
        {quotes.map(({ quote, rating }) => (
          <div key={quote.id} className="ratings__quote-block">
            <div className="ratings__quote-label">{quote.label}</div>
            <div className="ratings__grid ratings__grid--simplified">
              <RatingChip
                dimension="Overall Fit"
                explanation={rating.suitability}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="ratings" data-testid="ratings-panel">
      <h2 className="ratings__heading">Atlas Rating</h2>
      <p className="ratings__sub">
        Physics-derived performance bands — not scores, not opinions.
      </p>
      <p className="ratings__note">
        Ratings emerge from your home's measured constraints. Tap "Why?" on any card to see the physics reason.
      </p>

      {quotes.map(({ quote, rating }) => (
        <div key={quote.id} className="ratings__quote-block">
          <div className="ratings__quote-label">{quote.label}</div>
          <div className="ratings__grid">
            {DIMENSION_LABELS.map(({ key, label }) => (
              <RatingChip
                key={key}
                dimension={label}
                explanation={rating[key]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
