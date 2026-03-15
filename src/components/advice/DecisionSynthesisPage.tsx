/**
 * DecisionSynthesisPage
 *
 * PR11 — Advice page / decision synthesis.
 *
 * Turns simulator output into a clear, objective-ranked advice sheet.
 * Sits after the Simulator Dashboard and answers the actual customer questions.
 *
 * Layout:
 *  1. Best all-round fit (hero card)
 *  2. Best by objective (6 short cards)
 *  3. Installation recipe
 *  4. Trade-off strip
 *  5. Phased plan (Now / Next / Later)
 *
 * Rules:
 *  - No long report paragraphs.
 *  - No repeated comparison prose.
 *  - Source of truth: EngineOutputV1 only — never Math.random() or hardcoded paths.
 *  - Carbon wording: "at point of use" — never implies full lifecycle or grid-mix
 *    unless that data has been explicitly added.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import { buildAdviceCards } from './buildAdviceCards';
import type { ObjectiveCard, PhasedStep } from './buildAdviceCards';
import './DecisionSynthesisPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  engineOutput: EngineOutputV1;
  onBack?: () => void;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DecisionSynthesisPage({ engineOutput, onBack }: Props) {
  const advice = buildAdviceCards(engineOutput);
  const { bestAllRound, objectiveCards, installationRecipe, phasedPlan, tradeOffWarnings } = advice;

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
        <div className="advice-page__title-block">
          <h1 className="advice-page__title">🎯 Decision Advice</h1>
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
            {bestAllRound.systemPath}
          </div>
          <p className="advice-hero__why">{bestAllRound.why}</p>
          {bestAllRound.confidence && (
            <div
              className={`advice-hero__confidence advice-hero__confidence--${bestAllRound.confidence}`}
              aria-label={`Confidence: ${bestAllRound.confidence}`}
            >
              {CONFIDENCE_LABEL[bestAllRound.confidence]}
            </div>
          )}
        </div>
      </div>

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
          {objectiveCards.map(card => (
            <div key={card.id} role="listitem">
              <ObjectiveCardUI card={card} />
            </div>
          ))}
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
            <div className="advice-recipe__value">{installationRecipe.heatSource}</div>
          </div>

          <div className="advice-recipe__row" role="listitem">
            <div className="advice-recipe__label">Hot water arrangement</div>
            <div className="advice-recipe__value">{installationRecipe.dhwArrangement}</div>
          </div>

          {installationRecipe.controls.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Controls</div>
              <ul className="advice-recipe__list" aria-label="Controls">
                {installationRecipe.controls.map((c, i) => (
                  <li key={i} className="advice-recipe__item">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {installationRecipe.emitterAction.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Emitter action</div>
              <ul className="advice-recipe__list" aria-label="Emitter actions">
                {installationRecipe.emitterAction.map((e, i) => (
                  <li key={i} className="advice-recipe__item">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {installationRecipe.primaryAction && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Primary pipework</div>
              <div className="advice-recipe__value">{installationRecipe.primaryAction}</div>
            </div>
          )}

          {installationRecipe.protection.length > 0 && (
            <div className="advice-recipe__row" role="listitem">
              <div className="advice-recipe__label">Protection & treatment</div>
              <ul className="advice-recipe__list" aria-label="Protection items">
                {installationRecipe.protection.map((p, i) => (
                  <li key={i} className="advice-recipe__item">{p}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Trade-off strip                                       */}
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
