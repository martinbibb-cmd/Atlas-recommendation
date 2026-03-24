/**
 * RecommendationCard.tsx — Presentation Layer v1.
 *
 * Shows the best-overall recommendation with:
 *   - Title: "Best for your home"
 *   - System name + suitability badge
 *   - Top 3 reasons why
 *   - One trade-off line
 *   - Upgrade interventions
 *
 * Data source: RecommendationResult.bestOverall and interventions (PR11).
 *
 * Language rules:
 *   - Use "your home" and "how your home is used"
 *   - Never use "this system fails" or "not suitable"
 *   - Use "on-demand hot water" not "instantaneous hot water"
 *   - Use "tank-fed hot water" not "gravity system"
 */

import type {
  RecommendationDecision,
  RecommendationIntervention,
} from '../../engine/recommendation/RecommendationModel';
import { getLimiterHumanCopy } from './limiterHumanLanguage';
import './RecommendationCard.css';

// ─── Display helpers ──────────────────────────────────────────────────────────

const FAMILY_DISPLAY: Record<string, { label: string; icon: string }> = {
  combi:        { label: 'On-demand hot water system', icon: '🔥' },
  system:       { label: 'Stored hot water system', icon: '💧' },
  stored_water: { label: 'Stored hot water system', icon: '💧' },
  heat_pump:    { label: 'Air source heat pump', icon: '🌿' },
  regular:      { label: 'Tank-fed hot water system', icon: '🏠' },
  open_vented:  { label: 'Tank-fed hot water system', icon: '🏠' },
};

const SUITABILITY_BADGE: Record<string, { label: string; cls: string }> = {
  suitable:              { label: 'Suitable',                cls: 'suitable' },
  suitable_with_caveats: { label: 'Suitable with caveats',   cls: 'caveats' },
  not_recommended:       { label: 'Worth discussing further', cls: 'discuss' },
};

/** Derives the top 3 human-readable strengths from objective scores. */
function topStrengths(decision: RecommendationDecision): string[] {
  const strengths: { label: string; score: number }[] = [
    { label: 'Handles busy mornings without running short',   score: decision.objectiveScores.performance },
    { label: 'Heating stays on while hot water runs',        score: decision.objectiveScores.reliability },
    { label: 'Built to last with fewer high-wear moments',   score: decision.objectiveScores.longevity },
    { label: 'Simple to set and forget',                     score: decision.objectiveScores.ease_of_control },
    { label: 'Lower carbon output for your home',            score: decision.objectiveScores.eco },
    { label: 'Straightforward installation for your home',   score: decision.objectiveScores.disruption },
    { label: 'Compact — fits your available space',          score: decision.objectiveScores.space },
  ];

  return strengths
    .filter((s) => s.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.label);
}

/** Derives the primary trade-off using evidence trace limiters or space/disruption scores. */
function primaryTradeOff(decision: RecommendationDecision): string | null {
  // Find the first soft limiter (not a hard-stop) to surface as a trade-off
  const hardStopSet = new Set(decision.evidenceTrace.hardStopLimiters);
  const softLimiters = decision.evidenceTrace.limitersConsidered.filter(
    (id) => !hardStopSet.has(id),
  );
  if (softLimiters.length > 0) {
    const copy = getLimiterHumanCopy(softLimiters[0]);
    return copy.headline;
  }
  if (decision.objectiveScores.space < 50) return 'Needs space for a cylinder — worth planning in early';
  if (decision.objectiveScores.disruption < 50) return 'Some installation work will be needed — one-time effort';
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  bestOverall: RecommendationDecision;
  interventions: readonly RecommendationIntervention[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecommendationCard({ bestOverall, interventions }: Props) {
  const display = FAMILY_DISPLAY[bestOverall.family] ?? {
    label: bestOverall.family,
    icon: '🏠',
  };
  const badge = SUITABILITY_BADGE[bestOverall.suitability] ?? SUITABILITY_BADGE.suitable;
  const strengths = topStrengths(bestOverall);
  const tradeOff = primaryTradeOff(bestOverall);

  // Top 2 interventions most relevant to this family
  const relevantInterventions = interventions
    .filter((i) => i.sourceFamily === bestOverall.family)
    .slice(0, 2);

  return (
    <section className="rec-card" aria-label="Best recommendation for your home">
      <p className="rec-card__eyebrow">Best for your home</p>

      {/* System name + badge */}
      <div className="rec-card__system-row">
        <span className="rec-card__icon" aria-hidden="true">{display.icon}</span>
        <div className="rec-card__system-info">
          <h2 className="rec-card__system-name">{display.label}</h2>
          <span className={`rec-card__badge rec-card__badge--${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="rec-card__score" aria-label={`Overall score: ${bestOverall.overallScore}`}>
          <span className="rec-card__score-value">{bestOverall.overallScore}</span>
          <span className="rec-card__score-max">/100</span>
        </div>
      </div>

      {/* Top 3 reasons */}
      {strengths.length > 0 && (
        <div className="rec-card__strengths">
          <p className="rec-card__section-label">Why it fits your home</p>
          <ul className="rec-card__strength-list">
            {strengths.map((s) => (
              <li key={s} className="rec-card__strength-item">
                <span className="rec-card__strength-tick" aria-hidden="true">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trade-off */}
      {tradeOff && (
        <div className="rec-card__tradeoff">
          <p className="rec-card__section-label">Something to consider</p>
          <p className="rec-card__tradeoff-text">
            <span aria-hidden="true">↗ </span>{tradeOff}
          </p>
        </div>
      )}

      {/* Upgrade interventions */}
      {relevantInterventions.length > 0 && (
        <div className="rec-card__interventions">
          <p className="rec-card__section-label">With these improvements</p>
          <ul className="rec-card__intervention-list">
            {relevantInterventions.map((i) => (
              <li key={i.id} className="rec-card__intervention-item">
                {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
