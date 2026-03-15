/**
 * PrintableRecommendationPage
 *
 * PR7 — Printable Atlas recommendation output.
 *
 * Print-optimised equivalent of DecisionSynthesisPage.
 * Consumes AdviceFromCompareResult directly — does NOT rebuild or recompute
 * the recommendation.  Falls back gracefully to legacy advice card shape when
 * compare-backed advice is unavailable.
 *
 * Logical print page structure (may compress into fewer physical pages):
 *   Page 1 — Recommendation summary (hero + compare summary + badges)
 *   Page 2 — Best by objective (6 cards)
 *   Page 3 — Installation recipe
 *   Page 4 — Phased plan
 *
 * Rules:
 *   - Reuses AdviceFromCompareResult directly.  No separate advice engine.
 *   - No interactive-only UI (tabs, toggles, sliders) is rendered here.
 *   - All text is deterministic — no Math.random().
 *   - Carbon wording: "at point of use".
 *   - Printing triggered by window.print() from the on-screen toolbar.
 */

import type { AdviceCard, AdviceFromCompareResult } from '../../lib/advice/buildAdviceFromCompare';
import type { CompareSeed } from '../../lib/simulator/buildCompareSeedFromSurvey';
import './advice-print.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * The compare-backed advice truth produced by buildAdviceFromCompare.
   * Primary print path.  When null, the component falls back to fallbackAdvice.
   */
  advice: AdviceFromCompareResult | null;
  /**
   * Optional compare seed for current-vs-proposed summary block.
   * Only used to derive human-readable system labels — not for recomputation.
   */
  compareSeed?: CompareSeed;
  /**
   * Called when the user clicks "Back" in the on-screen toolbar.
   * Not rendered in print output.
   */
  onBack?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

const SYSTEM_CHOICE_LABEL: Record<string, string> = {
  combi:       'Combi boiler',
  unvented:    'Unvented cylinder system',
  open_vented: 'Open-vented cylinder system',
  heat_pump:   'Air source heat pump',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadgeClass(level: string | null): string {
  switch (level) {
    case 'high':   return 'prp__badge prp__badge--confidence-high';
    case 'low':    return 'prp__badge prp__badge--confidence-low';
    default:       return 'prp__badge prp__badge--confidence-medium';
  }
}

function resolveSystemLabel(choice: string): string {
  return SYSTEM_CHOICE_LABEL[choice] ?? choice;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ObjectiveCardPrint({ card }: { card: AdviceCard }) {
  return (
    <div className="prp__obj-card" role="region" aria-label={card.title}>
      <div className="prp__obj-card__header">
        <span className="prp__obj-card__icon" aria-hidden="true">{card.icon}</span>
        <h3 className="prp__obj-card__title">{card.title}</h3>
      </div>

      <div className="prp__obj-card__system" aria-label="Recommended system for this objective">
        {card.recommendedPathLabel}
      </div>

      {card.why.map((line, i) => (
        <p key={i} className="prp__obj-card__why">{line}</p>
      ))}

      {card.compareWins.length > 0 && (
        <ul className="prp__obj-card__wins" aria-label="Compare wins">
          {card.compareWins.map((win, i) => (
            <li key={i} className="prp__obj-card__win">✓ {win}</li>
          ))}
        </ul>
      )}

      {card.keyTradeOff && (
        <div className="prp__obj-card__tradeoff" aria-label="Trade-off">
          <span className="prp__obj-card__tradeoff-label">Trade-off: </span>
          {card.keyTradeOff}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PrintableRecommendationPage({
  advice,
  compareSeed,
  onBack,
}: Props) {
  // Detect whether this is a genuine survey-backed print or fallback.
  const isSurveyBacked = advice != null;

  // Today's date for the print header.
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Derive current and proposed system labels from compareSeed when available.
  const currentLabel = compareSeed
    ? resolveSystemLabel(compareSeed.left.systemChoice)
    : 'Current system';
  const proposedLabel = compareSeed
    ? resolveSystemLabel(compareSeed.right.systemChoice)
    : (advice?.bestOverall.recommendedPathLabel ?? 'Proposed system');

  // Confidence display values.
  const confidenceLevel = advice?.confidenceSummary.level ?? null;
  const confidencePct   = advice?.bestOverall.confidencePct ?? null;
  const confidenceText  = confidenceLevel
    ? `${CONFIDENCE_LABEL[confidenceLevel]}${confidencePct != null ? ` — ${confidencePct}%` : ''}`
    : null;

  // Efficiency score from the primary recommendation card.
  const efficiencyScore = advice?.bestOverall.efficiencyScore ?? null;

  // Objective cards in fixed order.
  const objectiveCards: AdviceCard[] = advice
    ? [
        advice.byObjective.lowestRunningCost,
        advice.byObjective.lowestInstallationCost,
        advice.byObjective.greatestLongevity,
        advice.byObjective.lowestCarbonPointOfUse,
        advice.byObjective.greatestComfortAndDelivery,
        advice.byObjective.measuredForwardThinkingPlan,
      ]
    : [];

  // Installation recipe.
  const recipe = advice?.installationRecipe ?? null;

  // Phased plan.
  const phasedPlan = advice?.phasedPlan ?? null;

  // Top compare wins from the primary card.
  const heroCompareWins = advice?.bestOverall.compareWins ?? [];

  // Key trade-off from the primary card.
  const keyTradeOff = advice?.bestOverall.keyTradeOff ?? null;

  return (
    <div className="prp" aria-label="Printable Atlas recommendation">

      {/* ── Toolbar — screen only, hidden in print ─────────────────────── */}
      <div className="prp__toolbar" aria-hidden="false">
        {onBack && (
          <button
            className="prp__toolbar-btn prp__toolbar-btn--secondary"
            onClick={onBack}
            aria-label="Back to advice page"
          >
            ← Back
          </button>
        )}
        <button
          className="prp__toolbar-btn"
          onClick={() => window.print()}
          aria-label="Print Atlas recommendation"
        >
          🖨 Print recommendation
        </button>
      </div>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <header className="prp__header" aria-label="Atlas recommendation header">
        <div className="prp__header-eyebrow">Atlas Recommendation</div>
        <h1 className="prp__header-title">Heating System Recommendation</h1>
        <p className="prp__header-date">Prepared {today}</p>
      </header>

      {/* ── Fallback notice — only when not survey-backed ──────────────── */}
      {!isSurveyBacked && (
        <div className="prp__fallback-notice" role="note" aria-label="Fallback notice">
          This summary is based on a general assessment. Complete a full survey for a
          compare-backed recommendation with confidence scoring.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — Recommendation summary                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* ── Current vs proposed summary ───────────────────────────────────── */}
      {compareSeed && (
        <section className="prp__section" aria-label="Current vs proposed summary">
          <h2 className="prp__section-title">Current vs proposed system</h2>
          <div className="prp__compare-summary">
            <div className="prp__compare-col" aria-label="Current system">
              <div className="prp__compare-col-label">Current system</div>
              <p className="prp__compare-col-system">{currentLabel}</p>
            </div>
            <div className="prp__compare-col prp__compare-col--proposed" aria-label="Proposed system">
              <div className="prp__compare-col-label">Proposed system</div>
              <p className="prp__compare-col-system">{proposedLabel}</p>
            </div>
          </div>

          {heroCompareWins.length > 0 && (
            <div className="prp__compare-changes" aria-label="Top changes">
              <div className="prp__compare-changes-title">Top changes</div>
              <ul className="prp__compare-changes-list" aria-label="List of top changes">
                {heroCompareWins.map((win, i) => (
                  <li key={i} className="prp__compare-changes-item">{win}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Best overall card + badges ──────────────────────────────────── */}
      {advice && (
        <section className="prp__section" aria-label="Best all-round recommendation">
          <h2 className="prp__section-title">Best all-round fit</h2>

          {/* Confidence + efficiency badges */}
          <div className="prp__badges" aria-label="Recommendation badges">
            {confidenceText && (
              <span
                className={confidenceBadgeClass(confidenceLevel)}
                aria-label={`Confidence: ${confidenceText}`}
              >
                ✓ {confidenceText}
              </span>
            )}
            {efficiencyScore != null && (
              <span
                className="prp__badge prp__badge--efficiency"
                aria-label={`Efficiency score: ${efficiencyScore}`}
              >
                Efficiency score: {efficiencyScore}/99
              </span>
            )}
          </div>

          {/* Hero card */}
          <div className="prp__hero" role="region" aria-label="Primary recommendation">
            <div className="prp__hero-label">Atlas recommends</div>
            <div className="prp__hero-system" aria-label="Recommended system">
              {advice.bestOverall.recommendedPathLabel}
            </div>
            {advice.bestOverall.why.length > 0 && (
              <p className="prp__hero-why">{advice.bestOverall.why[0]}</p>
            )}

            {heroCompareWins.length > 0 && (
              <ul className="prp__wins" aria-label="Compare wins">
                {heroCompareWins.map((win, i) => (
                  <li key={i} className="prp__win">✓ {win}</li>
                ))}
              </ul>
            )}

            {keyTradeOff && (
              <div className="prp__hero-tradeoff" aria-label="Key trade-off">
                <span className="prp__hero-tradeoff-label">Trade-off: </span>
                {keyTradeOff}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — Best by objective                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {objectiveCards.length > 0 && (
        <section
          className="prp__section prp__page-break-before"
          aria-label="Best by objective"
        >
          <h2 className="prp__section-title">Best by objective</h2>
          <div
            className="prp__obj-grid"
            role="list"
            aria-label="Objective cards"
          >
            {objectiveCards.map(card => (
              <div key={card.id} role="listitem">
                <ObjectiveCardPrint card={card} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3 — Installation recipe                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {recipe && (
        <section
          className="prp__section prp__page-break-before"
          aria-label="Installation recipe"
        >
          <h2 className="prp__section-title">Installation recipe</h2>
          <div className="prp__recipe" role="list" aria-label="Installation recipe items">

            <div className="prp__recipe-row" role="listitem">
              <div className="prp__recipe-label">Heat source</div>
              <div className="prp__recipe-value">{recipe.heatSource}</div>
            </div>

            <div className="prp__recipe-row" role="listitem">
              <div className="prp__recipe-label">Hot water arrangement</div>
              <div className="prp__recipe-value">{recipe.hotWaterArrangement}</div>
            </div>

            {recipe.controls.length > 0 && (
              <div className="prp__recipe-row" role="listitem">
                <div className="prp__recipe-label">Controls</div>
                <ul className="prp__recipe-list" aria-label="Controls">
                  {recipe.controls.map((c, i) => (
                    <li key={i} className="prp__recipe-item">{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.emitters.length > 0 && (
              <div className="prp__recipe-row" role="listitem">
                <div className="prp__recipe-label">Emitters</div>
                <ul className="prp__recipe-list" aria-label="Emitters">
                  {recipe.emitters.map((e, i) => (
                    <li key={i} className="prp__recipe-item">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.primaryPipework.length > 0 && (
              <div className="prp__recipe-row" role="listitem">
                <div className="prp__recipe-label">Primary pipework</div>
                <ul className="prp__recipe-list" aria-label="Primary pipework">
                  {recipe.primaryPipework.map((p, i) => (
                    <li key={i} className="prp__recipe-item">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.protectionAndAncillaries.length > 0 && (
              <div className="prp__recipe-row" role="listitem">
                <div className="prp__recipe-label">Protection & ancillaries</div>
                <ul className="prp__recipe-list" aria-label="Protection and ancillaries">
                  {recipe.protectionAndAncillaries.map((p, i) => (
                    <li key={i} className="prp__recipe-item">{p}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PAGE 4 — Phased plan                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phasedPlan && (
        <section
          className="prp__section prp__page-break-before"
          aria-label="Phased plan"
        >
          <h2 className="prp__section-title">Phased plan and key trade-offs</h2>
          <div
            className="prp__phases"
            role="list"
            aria-label="Phased plan steps"
          >
            <div className="prp__phase prp__phase--now" role="listitem">
              <div className="prp__phase__badge">Now</div>
              <ul className="prp__phase__actions" aria-label="Now phase actions">
                {phasedPlan.now.map((action, i) => (
                  <li key={i} className="prp__phase__action">{action}</li>
                ))}
              </ul>
            </div>

            <div className="prp__phase prp__phase--next" role="listitem">
              <div className="prp__phase__badge">Next</div>
              <ul className="prp__phase__actions" aria-label="Next phase actions">
                {phasedPlan.next.map((action, i) => (
                  <li key={i} className="prp__phase__action">{action}</li>
                ))}
              </ul>
            </div>

            <div className="prp__phase prp__phase--later" role="listitem">
              <div className="prp__phase__badge">Later</div>
              <ul className="prp__phase__actions" aria-label="Later phase actions">
                {phasedPlan.later.map((action, i) => (
                  <li key={i} className="prp__phase__action">{action}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Key trade-offs from confidence summary */}
          {advice && advice.confidenceSummary.reasons.length > 0 && (
            <div className="prp__section prp__section--nested">
              <h3 className="prp__section-title prp__section-title--small">
                Key cautions
              </h3>
              <ul className="prp__phase__actions" aria-label="Key cautions">
                {advice.confidenceSummary.reasons.map((r, i) => (
                  <li key={i} className="prp__phase__action">{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
