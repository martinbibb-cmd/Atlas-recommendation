/**
 * RecommendationCard.tsx — Presentation Layer v1.
 *
 * Shows the best-overall recommendation with:
 *   - Title: "Best for your home"
 *   - System name + suitability badge
 *   - Top 3 reasons why (family-aware + context-tailored)
 *   - One trade-off line
 *   - Upgrade interventions
 *
 * Data source: RecommendationResult.bestOverall and interventions (PR11).
 * Context: SurveyorContext flags shift emphasis toward what the customer cares about.
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
import type { SurveyorContext } from './presentationTypes';
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

// ─── Family-aware strength copy ───────────────────────────────────────────────

/**
 * Per-family strength statements keyed by objective.
 * These replace generic copy with specific claims the family actually delivers.
 */
const FAMILY_STRENGTH_COPY: Record<string, Partial<Record<string, string>>> = {
  stored_water: {
    performance:     'Hot water for everyone, even in a busy morning',
    reliability:     'Heating runs uninterrupted — no switching between heating and hot water',
    longevity:       'Fewer high-demand moments means less wear on the boiler',
    ease_of_control: 'Set once and the cylinder maintains its own schedule',
    eco:             'Lower peak demand makes it easier to add renewables later',
    disruption:      'Works with your existing pipework in most cases',
    space:           'Cylinder can often replace an existing unit in the same location',
  },
  heat_pump: {
    performance:     'Consistent hot water with lower running temperatures',
    reliability:     'No combustion — fewer components that can wear or fail',
    longevity:       'Heat pump compressors typically last 15–20 years',
    ease_of_control: 'Smart controls keep efficiency high automatically',
    eco:             'Runs on electricity — compatible with solar panels and green tariffs',
    disruption:      'External unit is the main installation work; indoor disruption is minimal',
    space:           'Outdoor space for the unit is the main space consideration',
  },
  combi: {
    performance:     'Hot water on demand — no waiting for a cylinder to heat',
    reliability:     'No stored hot water to lose overnight',
    longevity:       'Fewer components than a full system boiler setup',
    ease_of_control: 'No cylinder timer to manage — simpler to run',
    eco:             'Modern condensing combis recover heat from flue gases',
    disruption:      'Straightforward swap-out in most homes',
    space:           'Compact — no cylinder needed',
  },
  open_vented: {
    performance:     'Proven in older homes with existing tank infrastructure',
    reliability:     'Works at low mains pressure — suitable for most properties',
    longevity:       'Simple open system is well understood and straightforward to service',
    ease_of_control: 'Standard timer controls — familiar to most occupants',
    eco:             'Compatible with solar thermal diverter systems',
    disruption:      'Keeps the existing loft-tank arrangement in place',
    space:           'Uses existing loft space already allocated to the tank',
  },
};

/** Default strength copy used when no family-specific version exists. */
const DEFAULT_STRENGTH_COPY: Record<string, string> = {
  performance:     'Handles busy mornings without running short',
  reliability:     'Heating stays on while hot water runs',
  longevity:       'Built to last with fewer high-wear moments',
  ease_of_control: 'Simple to set and forget',
  eco:             'Lower carbon output for your home',
  disruption:      'Straightforward installation for your home',
  space:           'Compact — fits your available space',
};

/** Derives the top 3 human-readable strengths, family-aware, context-weighted. */
function topStrengths(
  decision: RecommendationDecision,
  surveyorContext: SurveyorContext,
): string[] {
  const familyCopy =
    FAMILY_STRENGTH_COPY[decision.family] ?? {};

  const objectives: Array<{ key: string; score: number; contextBoost: number }> = [
    {
      key: 'performance',
      score: decision.objectiveScores.performance,
      contextBoost: surveyorContext.highHotWaterUse ? 20 : 0,
    },
    {
      key: 'reliability',
      score: decision.objectiveScores.reliability,
      contextBoost: surveyorContext.wantsReliability ? 20 : 0,
    },
    {
      key: 'longevity',
      score: decision.objectiveScores.longevity,
      contextBoost: surveyorContext.wantsReliability ? 10 : 0,
    },
    {
      key: 'ease_of_control',
      score: decision.objectiveScores.ease_of_control,
      contextBoost: 0,
    },
    {
      key: 'eco',
      score: decision.objectiveScores.eco,
      contextBoost: surveyorContext.futureProofingImportant ? 20 : 0,
    },
    {
      key: 'disruption',
      score: decision.objectiveScores.disruption,
      contextBoost: surveyorContext.costSensitive ? 10 : 0,
    },
    {
      key: 'space',
      score: decision.objectiveScores.space,
      contextBoost: surveyorContext.spaceIsLimited ? 20 : 0,
    },
  ];

  return objectives
    .filter((o) => o.score >= 60)
    .sort((a, b) => (b.score + b.contextBoost) - (a.score + a.contextBoost))
    .slice(0, 3)
    .map((o) => familyCopy[o.key] ?? DEFAULT_STRENGTH_COPY[o.key] ?? o.key);
}

/** Derives the primary trade-off, with context-aware framing. */
function primaryTradeOff(
  decision: RecommendationDecision,
  surveyorContext: SurveyorContext,
): string | null {
  // Soft limiters are surfaced as trade-offs, not blocking reasons
  const hardStopSet = new Set(decision.evidenceTrace.hardStopLimiters);
  const softLimiters = decision.evidenceTrace.limitersConsidered.filter(
    (id) => !hardStopSet.has(id),
  );
  if (softLimiters.length > 0) {
    const copy = getLimiterHumanCopy(softLimiters[0]);
    return copy.headline;
  }

  // Fall back to objective-derived framing
  if (decision.objectiveScores.space < 50) {
    return surveyorContext.spaceIsLimited
      ? "Needs space for a cylinder — we'll help you find the best location"
      : "Needs space for a cylinder — worth planning in early";
  }
  if (decision.objectiveScores.disruption < 50) {
    return surveyorContext.costSensitive
      ? "Installation involves some work, but it's a one-time cost"
      : 'Some installation work will be needed — one-time effort';
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  bestOverall: RecommendationDecision;
  interventions: readonly RecommendationIntervention[];
  /** Surveyor context flags — adjust copy emphasis to match household priorities. */
  surveyorContext?: SurveyorContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecommendationCard({
  bestOverall,
  interventions,
  surveyorContext = { highHotWaterUse: false, futureProofingImportant: false, spaceIsLimited: false, wantsReliability: false, costSensitive: false },
}: Props) {
  const display = FAMILY_DISPLAY[bestOverall.family] ?? {
    label: bestOverall.family,
    icon: '🏠',
  };
  const badge = SUITABILITY_BADGE[bestOverall.suitability] ?? SUITABILITY_BADGE.suitable;
  const strengths = topStrengths(bestOverall, surveyorContext);
  const tradeOff = primaryTradeOff(bestOverall, surveyorContext);

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
          <p className="rec-card__anchor">Designed for how your home is used</p>
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
