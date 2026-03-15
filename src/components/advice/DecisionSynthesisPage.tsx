/**
 * DecisionSynthesisPage
 *
 * PR11 — Advice page / decision synthesis.
 * PR6  — Extended to consume compare/simulator truth when a CompareSeed is
 *         provided. When available, cards are enriched with compareWins,
 *         efficiencyScore, and confidencePct derived from the compare session.
 *
 * Turns simulator output into a clear, objective-ranked advice sheet.
 * Sits after the Simulator Dashboard and answers the actual customer questions.
 *
 * Layout:
 *  1. Best all-round fit (hero card)
 *  2. Best by objective (6 short cards)
 *  3. Installation recipe
 *  4. Trade-off strip (legacy mode) / compare wins (compare mode)
 *  5. Phased plan (Now / Next / Later)
 *
 * Rules:
 *  - No long report paragraphs.
 *  - No repeated comparison prose.
 *  - Source of truth: EngineOutputV1 (+ CompareSeed when available).
 *  - Carbon wording: "at point of use" — never implies full lifecycle or grid-mix
 *    unless that data has been explicitly added.
 *  - Never Math.random() — all outputs are deterministic.
 */

import { useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { CompareSeed } from '../../lib/simulator/buildCompareSeedFromSurvey';
import { buildAdviceCards } from './buildAdviceCards';
import type { ObjectiveCard, PhasedStep } from './buildAdviceCards';
import {
  buildAdviceFromCompare,
  type AdviceCard,
  type AdviceFromCompareResult,
  type UnifiedConfidence,
} from '../../lib/advice/buildAdviceFromCompare';
import PrintableRecommendationPage from './PrintableRecommendationPage';
import './DecisionSynthesisPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  engineOutput: EngineOutputV1;
  onBack?: () => void;
  /**
   * When provided, the page uses buildAdviceFromCompare to enrich cards with
   * compareWins, efficiencyScore, and confidencePct derived from compare truth.
   * When absent, the page falls back to buildAdviceCards (EngineOutputV1 only).
   */
  compareSeed?: CompareSeed;
  /** Required alongside compareSeed — passed through to buildAdviceFromCompare. */
  surveyData?: FullSurveyModelV1;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

const PHASE_LABEL: Record<PhasedStep['phase'], string> = {
  now:   'Now',
  next:  'Next',
  later: 'Later',
};

const PHASE_CLASS: Record<PhasedStep['phase'], string> = {
  now:   'advice-phase--now',
  next:  'advice-phase--next',
  later: 'advice-phase--later',
};

/** Renders a compare-enriched objective card (from buildAdviceFromCompare). */
function EnrichedObjectiveCardUI({ card }: { card: AdviceCard }) {
  return (
    <div className="advice-obj-card" role="region" aria-label={card.title}>
      <div className="advice-obj-card__header">
        <span className="advice-obj-card__icon" aria-hidden="true">{card.icon}</span>
        <h3 className="advice-obj-card__title">{card.title}</h3>
      </div>

      <div className="advice-obj-card__system" aria-label="Recommended system for this objective">
        {card.recommendedPathLabel}
      </div>

      {card.why.map((line, i) => (
        <p key={i} className="advice-obj-card__why">{line}</p>
      ))}

      {card.compareWins.length > 0 && (
        <ul
          className="advice-obj-card__wins"
          aria-label="Compare wins"
        >
          {card.compareWins.map((win, i) => (
            <li key={i} className="advice-obj-card__win">✓ {win}</li>
          ))}
        </ul>
      )}

      {card.efficiencyScore != null && (
        <div
          className="advice-obj-card__efficiency"
          aria-label={`Efficiency score: ${card.efficiencyScore}`}
        >
          Efficiency score: <strong>{card.efficiencyScore}</strong>
          <span className="advice-obj-card__efficiency-max">/99</span>
        </div>
      )}

      {card.keyTradeOff && (
        <div className="advice-obj-card__tradeoff" aria-label="Trade-off">
          <span className="advice-obj-card__tradeoff-label">Trade-off: </span>
          {card.keyTradeOff}
        </div>
      )}
    </div>
  );
}

/** Renders a legacy objective card (from buildAdviceCards). */
function ObjectiveCardUI({ card }: { card: ObjectiveCard }) {
  return (
    <div className="advice-obj-card" role="region" aria-label={card.title}>
      <div className="advice-obj-card__header">
        <span className="advice-obj-card__icon" aria-hidden="true">{card.icon}</span>
        <h3 className="advice-obj-card__title">{card.title}</h3>
      </div>

      <div className="advice-obj-card__system" aria-label="Recommended system for this objective">
        {card.systemPath}
      </div>

      <p className="advice-obj-card__why">{card.why}</p>

      {card.keyInclusions.length > 0 && (
        <ul className="advice-obj-card__inclusions" aria-label="Key inclusions">
          {card.keyInclusions.map((item, i) => (
            <li key={i} className="advice-obj-card__inclusion">{item}</li>
          ))}
        </ul>
      )}

      {card.tradeOff && (
        <div className="advice-obj-card__tradeoff" aria-label="Trade-off">
          <span className="advice-obj-card__tradeoff-label">Trade-off: </span>
          {card.tradeOff}
        </div>
      )}
    </div>
  );
}

function PhasedStepUI({ step }: { step: PhasedStep }) {
  return (
    <div className={`advice-phase ${PHASE_CLASS[step.phase]}`} role="listitem">
      <div className="advice-phase__badge" aria-label={`Phase: ${PHASE_LABEL[step.phase]}`}>
        {PHASE_LABEL[step.phase]}
      </div>
      <div className="advice-phase__body">
        <div className="advice-phase__label">{step.label}</div>
        {step.actions.length > 0 && (
          <ul className="advice-phase__actions" aria-label={`Actions for ${PHASE_LABEL[step.phase]}`}>
            {step.actions.map((action, i) => (
              <li key={i} className="advice-phase__action">{action}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the unified confidence breakdown panel.
 *
 * Shows overall score, three contributor bars (data / physics / decision),
 * measured / inferred / missing field lists, and the top "next best checks".
 */
function UnifiedConfidencePanel({ unified }: { unified: UnifiedConfidence }) {
  return (
    <div
      className={`advice-confidence advice-confidence--${unified.level}`}
      aria-label="Recommendation confidence"
    >
      <div className="advice-confidence__header">
        <span className="advice-confidence__headline">
          Recommendation confidence
        </span>
        <span
          className={`advice-confidence__badge advice-confidence__badge--${unified.level}`}
          aria-label={`Overall confidence: ${unified.overallPct}%`}
        >
          {unified.overallPct}% — {CONFIDENCE_LABEL[unified.level]}
        </span>
      </div>

      <div className="advice-confidence__contributors" aria-label="Confidence contributors">
        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Data</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.dataPct}%` }}
              aria-label={`Data confidence: ${unified.dataPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.dataPct}%</span>
        </div>

        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Physics</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.physicsPct}%` }}
              aria-label={`Physics confidence: ${unified.physicsPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.physicsPct}%</span>
        </div>

        <div className="advice-confidence__contributor">
          <span className="advice-confidence__contrib-label">Decision</span>
          <div className="advice-confidence__bar-track" role="presentation">
            <div
              className="advice-confidence__bar-fill"
              style={{ width: `${unified.decisionPct}%` }}
              aria-label={`Decision confidence: ${unified.decisionPct}%`}
            />
          </div>
          <span className="advice-confidence__contrib-pct">{unified.decisionPct}%</span>
        </div>
      </div>

      <div className="advice-confidence__lists">
        {unified.measured.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--measured">
              Measured
            </span>
            <span className="advice-confidence__list-items">
              {unified.measured.join(' · ')}
            </span>
          </div>
        )}

        {unified.inferred.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--inferred">
              Inferred
            </span>
            <span className="advice-confidence__list-items">
              {unified.inferred.join(' · ')}
            </span>
          </div>
        )}

        {unified.missing.length > 0 && (
          <div className="advice-confidence__list-group">
            <span className="advice-confidence__list-label advice-confidence__list-label--missing">
              Not yet confirmed
            </span>
            <span className="advice-confidence__list-items">
              {unified.missing.join(' · ')}
            </span>
          </div>
        )}
      </div>

      {unified.nextBestChecks.length > 0 && (
        <div className="advice-confidence__next-checks">
          <span className="advice-confidence__next-checks-label">
            To raise confidence further:
          </span>
          <ul className="advice-confidence__next-checks-list" aria-label="Next best checks">
            {unified.nextBestChecks.map((check, i) => (
              <li key={i} className="advice-confidence__next-check">{check}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DecisionSynthesisPage({
  engineOutput,
  onBack,
  compareSeed,
  surveyData,
}: Props) {
  const [showPrint, setShowPrint] = useState(false);

  // When a compareSeed is provided (survey-backed compare flow), use the richer
  // compare-truth builder.  Otherwise fall back to the EngineOutputV1-only builder.
  const compareAdvice: AdviceFromCompareResult | null =
    compareSeed != null && surveyData != null
      ? buildAdviceFromCompare({
          surveyData,
          engineOutput,
          compareSeed,
        })
      : null;

  const legacyAdvice = compareAdvice == null ? buildAdviceCards(engineOutput) : null;

  // Resolve display values from whichever advice mode is active.
  const heroSystemPath = compareAdvice
    ? compareAdvice.bestOverall.recommendedPathLabel
    : legacyAdvice!.bestAllRound.systemPath;

  const heroWhy = compareAdvice
    ? compareAdvice.bestOverall.why[0] ?? ''
    : legacyAdvice!.bestAllRound.why;

  const heroConfidenceLevel = compareAdvice
    ? compareAdvice.confidenceSummary.level
    : legacyAdvice!.bestAllRound.confidence;

  const heroEfficiencyScore = compareAdvice?.bestOverall.efficiencyScore ?? null;
  const heroConfidencePct = compareAdvice?.bestOverall.confidencePct ?? null;
  const heroCompareWins = compareAdvice?.bestOverall.compareWins ?? [];

  // Objective cards — either enriched (compare mode) or legacy.
  const enrichedObjectiveCards = compareAdvice
    ? [
        compareAdvice.byObjective.lowestRunningCost,
        compareAdvice.byObjective.lowestInstallationCost,
        compareAdvice.byObjective.greatestLongevity,
        compareAdvice.byObjective.lowestCarbonPointOfUse,
        compareAdvice.byObjective.greatestComfortAndDelivery,
        compareAdvice.byObjective.measuredForwardThinkingPlan,
      ]
    : null;
  const legacyObjectiveCards = legacyAdvice?.objectiveCards ?? null;

  // Installation recipe.
  const recipe = compareAdvice
    ? {
        heatSource: compareAdvice.installationRecipe.heatSource,
        dhwArrangement: compareAdvice.installationRecipe.hotWaterArrangement,
        controls: compareAdvice.installationRecipe.controls,
        emitterAction: compareAdvice.installationRecipe.emitters,
        primaryAction: compareAdvice.installationRecipe.primaryPipework[0] ?? null,
        protection: compareAdvice.installationRecipe.protectionAndAncillaries,
      }
    : legacyAdvice!.installationRecipe;

  // Phased plan.
  const phasedPlan: PhasedStep[] = compareAdvice
    ? [
        {
          phase: 'now' as const,
          label: 'Immediate installation',
          actions: compareAdvice.phasedPlan.now,
        },
        {
          phase: 'next' as const,
          label: 'First improvement round',
          actions: compareAdvice.phasedPlan.next,
        },
        {
          phase: 'later' as const,
          label: 'Future upgrade path',
          actions: compareAdvice.phasedPlan.later,
        },
      ]
    : legacyAdvice!.phasedPlan;

  // Trade-off warnings (legacy only — compare mode uses compareWins instead).
  const tradeOffWarnings = legacyAdvice?.tradeOffWarnings ?? [];

  // Print view — render the dedicated print component.
  if (showPrint) {
    return (
      <PrintableRecommendationPage
        advice={compareAdvice}
        compareSeed={compareSeed}
        onBack={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="advice-page" aria-label="Decision synthesis">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="advice-page__header">
        {onBack && (
          <button
            className="advice-page__back-btn"
            onClick={onBack}
            aria-label="Back to simulator"
          >
            ← Back to Simulator
          </button>
        )}
        {/* Print button — only shown when advice truth is available */}
        {compareAdvice != null && (
          <button
            className="advice-page__print-btn"
            onClick={() => setShowPrint(true)}
            aria-label="Print Atlas recommendation"
          >
            🖨 Print Recommendation
          </button>
        )}
        <div className="advice-page__title-block">
          <h1 className="advice-page__title">🎯 Advice</h1>
          <p className="advice-page__subtitle">
            Given what matters most to you, this is the route.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Best all-round fit                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Best all-round fit">
        <h2 className="advice-page__section-title">Best all-round fit</h2>

        <div className="advice-hero" role="region" aria-label="Primary recommendation">
          <div className="advice-hero__eyebrow">ATLAS RECOMMENDS</div>
          <div className="advice-hero__system" aria-label="Recommended system">
            {heroSystemPath}
          </div>
          <p className="advice-hero__why">{heroWhy}</p>

          {/* Compare wins on the hero card (compare mode only) */}
          {heroCompareWins.length > 0 && (
            <ul
              className="advice-hero__wins"
              aria-label="Compare wins for recommended system"
            >
              {heroCompareWins.map((win, i) => (
                <li key={i} className="advice-hero__win">✓ {win}</li>
              ))}
            </ul>
          )}

          {/* Efficiency score (compare mode only) */}
          {heroEfficiencyScore != null && (
            <div
              className="advice-hero__efficiency"
              aria-label={`Efficiency score: ${heroEfficiencyScore}`}
            >
              Efficiency score: <strong>{heroEfficiencyScore}</strong>
              <span className="advice-hero__efficiency-max">/99</span>
            </div>
          )}

          {/* Confidence — show pct in compare mode, label in legacy mode */}
          {heroConfidencePct != null ? (
            <div
              className={`advice-hero__confidence advice-hero__confidence--${heroConfidenceLevel ?? 'medium'}`}
              aria-label={`Confidence: ${heroConfidencePct}%`}
            >
              {CONFIDENCE_LABEL[heroConfidenceLevel ?? 'medium']} — {heroConfidencePct}%
            </div>
          ) : heroConfidenceLevel != null ? (
            <div
              className={`advice-hero__confidence advice-hero__confidence--${heroConfidenceLevel}`}
              aria-label={`Confidence: ${heroConfidenceLevel}`}
            >
              {CONFIDENCE_LABEL[heroConfidenceLevel]}
            </div>
          ) : null}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1b — Unified confidence breakdown (compare mode only)     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {compareAdvice?.confidenceSummary.unified != null && (
        <div className="advice-page__section" aria-label="Confidence breakdown">
          <h2 className="advice-page__section-title">Recommendation confidence</h2>
          <UnifiedConfidencePanel unified={compareAdvice.confidenceSummary.unified} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Best by objective (6 cards)                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Best by objective">
        <h2 className="advice-page__section-title">Best by objective</h2>
        <p className="advice-page__section-intro">
          Different objectives lead to different answers. Here is each one clearly.
        </p>
        <div
          className="advice-obj-grid"
          role="list"
          aria-label="Objective cards"
        >
          {enrichedObjectiveCards != null
            ? enrichedObjectiveCards.map(card => (
                <div key={card.id} role="listitem">
                  <EnrichedObjectiveCardUI card={card} />
                </div>
              ))
            : (legacyObjectiveCards ?? []).map(card => (
                <div key={card.id} role="listitem">
                  <ObjectiveCardUI card={card} />
                </div>
              ))
          }
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Installation recipe                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Installation recipe">
        <h2 className="advice-page__section-title">Your installation should include…</h2>

        <div className="advice-recipe" role="list" aria-label="Installation recipe items">

          <div className="advice-recipe__row" role="listitem">
            <div className="advice-recipe__label">Heat source</div>
            <div className="advice-recipe__value">{recipe.heatSource}</div>
          </div>

          <div className="advice-recipe__row" role="listitem">
            <div className="advice-recipe__label">Hot water arrangement</div>
            <div className="advice-recipe__value">{recipe.dhwArrangement}</div>
          </div>

          {recipe.controls.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Controls</div>
              <ul className="advice-recipe__list" aria-label="Controls">
                {recipe.controls.map((c, i) => (
                  <li key={i} className="advice-recipe__item">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.emitterAction.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Emitter action</div>
              <ul className="advice-recipe__list" aria-label="Emitter actions">
                {recipe.emitterAction.map((e, i) => (
                  <li key={i} className="advice-recipe__item">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.primaryAction && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Primary pipework</div>
              <div className="advice-recipe__value">{recipe.primaryAction}</div>
            </div>
          )}

          {recipe.protection.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Protection & treatment</div>
              <ul className="advice-recipe__list" aria-label="Protection items">
                {recipe.protection.map((p, i) => (
                  <li key={i} className="advice-recipe__item">{p}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Trade-off strip (legacy) or compare context note      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tradeOffWarnings.length > 0 && (
        <div className="advice-page__section" aria-label="Trade-off warnings">
          <h2 className="advice-page__section-title">Key trade-offs</h2>
          <div
            className="advice-tradeoffs"
            role="list"
            aria-label="Trade-off warnings"
          >
            {tradeOffWarnings.map(w => (
              <div key={w.id} className="advice-tradeoff" role="listitem">
                <span className="advice-tradeoff__icon" aria-hidden="true">⚠️</span>
                <span className="advice-tradeoff__text">{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Phased plan (Now / Next / Later)                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="advice-page__section" aria-label="Phased plan">
        <h2 className="advice-page__section-title">Phased plan</h2>
        <p className="advice-page__section-intro">
          Low-hanging fruit first. Future upgrades preserved.
        </p>
        <div
          className="advice-phases"
          role="list"
          aria-label="Phased plan steps"
        >
          {phasedPlan.map(step => (
            <PhasedStepUI key={step.phase} step={step} />
          ))}
        </div>
      </div>

    </div>
  );
}
