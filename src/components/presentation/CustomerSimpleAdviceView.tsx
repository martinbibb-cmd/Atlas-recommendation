/**
 * CustomerSimpleAdviceView.tsx
 *
 * High-contrast, minimal "Simple Advice" view for customers.
 *
 * Sections:
 *   1. Primary Recommendation — headline + system name
 *   2. Why — top 3 key reasons with large checkmarks
 *   3. What's Included — top 5 required works
 *   4. Open Simulator CTA — optional button
 *
 * Rules:
 *   - No recommendation logic — all content from AtlasDecisionV1 / ScenarioResult.
 *   - No Math.random().
 *   - Audience: customer.
 *   - Terminology: use "on-demand hot water", "mains-fed supply", "tank-fed hot water" only.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import './CustomerSimpleAdviceView.css';

// ─── Display limits ───────────────────────────────────────────────────────────

/** Maximum key reasons shown in the "Why" section. */
const MAX_DISPLAYED_REASONS = 3;

/** Maximum required works shown in the "What's included" section. */
const MAX_DISPLAYED_WORKS = 5;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomerSimpleAdviceViewProps {
  decision: AtlasDecisionV1;
  /** All evaluated scenarios — accepted for API consistency; not rendered directly. */
  scenarios: ScenarioResult[];
  /** The Atlas-recommended scenario — used to display the system name. */
  recommendedScenario: ScenarioResult | undefined;
  onOpenSimulator?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CustomerSimpleAdviceView
 *
 * Minimal, high-contrast customer advice view. No engineer-level detail.
 * All content flows from AtlasDecisionV1 and the recommended ScenarioResult.
 */
export function CustomerSimpleAdviceView({
  decision,
  recommendedScenario,
  onOpenSimulator,
}: CustomerSimpleAdviceViewProps) {
  const topReasons = decision.keyReasons.slice(0, MAX_DISPLAYED_REASONS);
  const topWorks   = decision.requiredWorks.slice(0, MAX_DISPLAYED_WORKS);

  return (
    <div className="csav" data-testid="customer-simple-advice-view">

      {/* ── Section 1: Primary Recommendation ── */}
      <section className="csav__section csav__section--hero" aria-label="Primary recommendation">
        <div className="csav__hero-inner">
          <span className="csav__hero-icon" aria-hidden="true">✦</span>
          <h1 className="csav__headline">{decision.headline}</h1>
          {recommendedScenario && (
            <p className="csav__system-name">{recommendedScenario.system.summary}</p>
          )}
        </div>
      </section>

      {/* ── Section 2: Why ── */}
      {topReasons.length > 0 && (
        <section className="csav__section" aria-label="Why this works for your home">
          <h2 className="csav__section-title">Why this works for your home</h2>
          <ul className="csav__reasons" aria-label="Key reasons">
            {topReasons.map((reason, i) => (
              <li key={i} className="csav__reason-item">
                <span className="csav__reason-check" aria-hidden="true">✓</span>
                <span className="csav__reason-text">{reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 3: What's Included ── */}
      {topWorks.length > 0 && (
        <section className="csav__section" aria-label="What is included">
          <h2 className="csav__section-title">What's included</h2>
          <ul className="csav__works" aria-label="Required works">
            {topWorks.map((work, i) => (
              <li key={i} className="csav__work-item">
                <span className="csav__work-marker" aria-hidden="true">✓</span>
                <span className="csav__work-text">{work}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Section 4: Open Simulator CTA ── */}
      {onOpenSimulator && (
        <section className="csav__section csav__section--cta" aria-label="Explore your options">
          <button
            className="csav__cta-button"
            type="button"
            onClick={onOpenSimulator}
            data-testid="csav-open-simulator"
          >
            Explore your options →
          </button>
        </section>
      )}

    </div>
  );
}
