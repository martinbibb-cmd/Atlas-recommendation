/**
 * RecommendationCard
 *
 * Decision-first hero card for the Live Output Hub.
 *
 * Shows the four key answers customers need:
 *   1. What system is recommended
 *   2. Why it suits this home
 *   3. What needs changing
 *   4. Confidence level
 *
 * Replaces the previous small chip in the verdict strip with a large,
 * visually prominent card that is the centrepiece of the hub page.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

const CONFIDENCE_CLASS: Record<string, string> = {
  high:   'rec-card__confidence--high',
  medium: 'rec-card__confidence--medium',
  low:    'rec-card__confidence--low',
};

interface Props {
  engineOutput: EngineOutputV1;
}

export default function RecommendationCard({ engineOutput }: Props) {
  const primary   = engineOutput.recommendation.primary;
  const secondary = engineOutput.recommendation.secondary ?? null;
  const verdict   = engineOutput.verdict ?? null;
  const options   = engineOutput.options ?? [];

  // Primary viable option for "why it suits" and "key upgrades"
  const primaryOption = options.find(o => o.status === 'viable') ?? options[0];

  const confidenceLevel = verdict?.confidence?.level ?? null;
  const reasons         = verdict?.reasons           ?? primaryOption?.why ?? [];
  const mustHave        = primaryOption?.typedRequirements?.mustHave ?? primaryOption?.requirements ?? [];

  const isWithheld = primary.startsWith('Recommendation withheld');

  return (
    <div className={`rec-card ${isWithheld ? 'rec-card--withheld' : 'rec-card--recommended'}`}
         role="region"
         aria-label="Atlas recommendation">

      {/* Header */}
      <div className="rec-card__header">
        <div className="rec-card__brand">ATLAS RESULT</div>
        <div className="rec-card__eyebrow">RECOMMENDED SYSTEM</div>
      </div>

      {/* Primary recommendation */}
      <div className="rec-card__system" aria-label="Recommended system">
        {primary}
      </div>

      {secondary && !isWithheld && (
        <p className="rec-card__note">{secondary}</p>
      )}

      {/* Confidence badge */}
      {confidenceLevel && (
        <div className={`rec-card__confidence ${CONFIDENCE_CLASS[confidenceLevel] ?? ''}`}
             aria-label={`Confidence: ${confidenceLevel}`}>
          Confidence: <strong>{confidenceLevel.toUpperCase()}</strong>
        </div>
      )}

      {/* Why it suits */}
      {reasons.length > 0 && (
        <div className="rec-card__section">
          <div className="rec-card__section-title">Why it suits</div>
          <ul className="rec-card__bullets" aria-label="Why this system suits the home">
            {reasons.slice(0, 4).map((r, i) => (
              <li key={i} className="rec-card__bullet">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Key upgrades */}
      {mustHave.length > 0 && (
        <div className="rec-card__section">
          <div className="rec-card__section-title">Key upgrades</div>
          <ul className="rec-card__bullets rec-card__bullets--upgrades" aria-label="Key installation upgrades">
            {mustHave.slice(0, 4).map((u, i) => (
              <li key={i} className="rec-card__bullet">{u}</li>
            ))}
          </ul>
        </div>
      )}

      {isWithheld && secondary && (
        <div className="rec-card__withheld-reason" role="alert">
          <strong>More information needed:</strong> {secondary}
        </div>
      )}
    </div>
  );
}
