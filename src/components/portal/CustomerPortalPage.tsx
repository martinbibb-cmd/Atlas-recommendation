/**
 * CustomerPortalPage.tsx
 *
 * Customer-facing recommendation portal — loaded by report reference.
 *
 * Sections:
 *   1. Recommendation hero — recommended system + short summary
 *   1a. Why Atlas suggested this — top reasons (PR6)
 *   1b. Your chosen option — when divergent (PR6)
 *   1c. How they compare — behaviour card comparison when divergent (PR6)
 *   2. Everyday behaviour cards — top 3–5 real-world scenarios (PR7)
 *   3. Why this suits your home — comfort, hot water, space, disruption
 *   4. Trade-off summary — current vs recommended at a glance
 *   5. Required changes — cylinder, emitters, works if relevant
 *   6. Explore your options — constrained exploration panel
 *   7. Global menu — via GlobalMenuShell wrapper
 *
 * Route: /portal/:reference?token=...
 * Access requires a signed portal token.
 * Missing or invalid tokens are rejected with a customer-safe error state.
 *
 * Rules:
 *   - No expert-only controls are exposed.
 *   - All data from EngineOutputV1 + survey snapshot.
 *   - No Math.random().
 *   - Terminology per docs/atlas-terminology.md.
 */

import { useEffect, useState } from 'react';
import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import TradeOffSummary from '../advice/TradeOffSummary';
import { buildTradeOffSummary } from '../../lib/advice/buildTradeOffSummary';
import RealWorldBehaviourCards from '../advice/RealWorldBehaviourCards';
import ChosenOptionComparisonSummary from '../advice/ChosenOptionComparisonSummary';
import { buildRealWorldBehaviourCards } from '../../lib/behaviour/buildRealWorldBehaviourCards';
import { buildRecommendationReasonSummary } from '../../lib/advice/buildRecommendationReasonSummary';
import ExploreOptionsPanel from './ExploreOptionsPanel';
import GlobalMenuShell from '../shell/GlobalMenuShell';
import {
  type RecommendationPresentationState,
  hasCustomerDivergence,
} from '../../lib/selection/optionSelection';
import {
  CHOSEN_OPTION_FRAMING,
  RECOMMENDATION_HERO_HEADING,
  WHY_ATLAS_HEADING,
  CHOSEN_SECTION_HEADING,
  COMPARISON_SECTION_HEADING,
} from '../../lib/copy/customerCopy';
import './CustomerPortalPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Report reference (ID) to load. */
  reference: string;
  /**
   * Signed portal token from the URL query string (?token=...).
   * Missing or invalid tokens are rejected before loading any report data.
   */
  token?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the best option card from engine output for the recommended system. */
function resolveRecommended(output: EngineOutputV1): OptionCardV1 | undefined {
  const primary = output.recommendation.primary;
  if (!primary || !output.options) return undefined;

  // Try exact label match first
  const byLabel = output.options.find(
    (o) => o.label.toLowerCase() === primary.toLowerCase(),
  );
  if (byLabel) return byLabel;

  // Fall back to first viable option
  return output.options.find((o) => o.status === 'viable');
}

/** Build the "why this suits your home" bullets from engine output. */
function buildWhyBullets(output: EngineOutputV1, option?: OptionCardV1): string[] {
  const bullets: string[] = [];

  // From verdict reasons
  if (output.verdict?.reasons) {
    bullets.push(...output.verdict.reasons);
  }

  // From the recommended option's why array
  if (option?.why) {
    for (const w of option.why) {
      if (!bullets.includes(w)) bullets.push(w);
    }
  }

  return bullets;
}

/** Build the required changes list from the recommended option. */
function buildRequiredChanges(option?: OptionCardV1): string[] {
  if (!option) return [];
  const changes: string[] = [];

  // From structured requirements
  if (option.requirements) {
    // Use the new structured format if available
    const reqs = option.requirements as unknown as {
      mustHave?: string[];
      likelyUpgrades?: string[];
      niceToHave?: string[];
    };
    if (Array.isArray(reqs)) {
      changes.push(...reqs);
    } else {
      if (reqs.mustHave) changes.push(...reqs.mustHave);
      if (reqs.likelyUpgrades) changes.push(...reqs.likelyUpgrades);
    }
  }

  return changes;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);
  // PR3 — presentation state loaded from the saved report.
  const [presentationState, setPresentationState] = useState<RecommendationPresentationState | null>(null);

  // Validate token, then load report data
  useEffect(() => {
    let cancelled = false;

    async function loadPortal() {
      // Token gate — reject before any report data is fetched
      if (!token) {
        if (!cancelled) {
          setTokenDenied('missing');
          setLoading(false);
        }
        return;
      }

      const tokenResult = await validatePortalToken(reference, token);
      if (tokenResult !== 'valid') {
        if (!cancelled) {
          setTokenDenied(tokenResult);
          setLoading(false);
        }
        return;
      }

      try {
        const report = await getReport(reference);
        if (cancelled) return;
        if (!report.payload?.engineOutput) {
          throw new Error('This report does not contain recommendation data.');
        }
        setEngineOutput(report.payload.engineOutput);
        setEngineInput(report.payload.engineInput ?? null);
        setSurveyData(report.payload.surveyData ?? null);
        setPostcode(report.postcode ?? null);
        // PR3 — load presentation state if available (absent in pre-PR3 reports).
        setPresentationState(report.payload.presentationState ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPortal();

    return () => {
      cancelled = true;
    };
  }, [reference, token]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="portal-page__loading" role="status" aria-live="polite">
        Loading your recommendation…
      </div>
    );
  }

  // ── Token denied ─────────────────────────────────────────────────────────────
  if (tokenDenied) {
    const headline =
      tokenDenied === 'expired'
        ? 'This link has expired'
        : 'This link is not valid';
    const detail =
      tokenDenied === 'expired'
        ? 'Your portal link has expired. Please ask the engineer who carried out your survey to send you a new link.'
        : 'The link you followed is not valid or has been revoked. Please check the link you were given and try again.';
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-token-error">
        <p className="portal-page__error-headline">{headline}</p>
        <p className="portal-page__error-detail">{detail}</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !engineOutput) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-error">
        <p className="portal-page__error-headline">
          {isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}
        </p>
        <p className="portal-page__error-detail">
          {error ?? 'The recommendation data is missing or incomplete.'}
        </p>
        {isNotFound && (
          <p className="portal-page__error-hint">
            Please check the link you were given, or contact the engineer who
            carried out your survey.
          </p>
        )}
      </div>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const recommended = resolveRecommended(engineOutput);
  const whyBullets = buildWhyBullets(engineOutput, recommended);
  const requiredChanges = buildRequiredChanges(recommended);
  const tradeOffSummary = buildTradeOffSummary(
    engineOutput,
    surveyData?.currentHeatSourceType ?? undefined,
  );

  const verdictTitle =
    engineOutput.verdict?.title ?? engineOutput.recommendation.primary;
  const verdictStatus = engineOutput.verdict?.status ?? 'good';
  const confidenceLabel =
    engineOutput.verdict?.confidence?.level
    ?? engineOutput.meta?.confidence?.level
    ?? '—';

  // Resolve the recommended option ID for behaviour-card and reason-summary builders.
  const recommendedOptionId = recommended?.id ?? '';

  // Build a canonical presentation state for helpers that require it.
  // When presentationState is absent (pre-PR3 reports), fall back to a
  // no-divergence default so behaviour cards still render correctly.
  const resolvedPresentationState: RecommendationPresentationState =
    presentationState ?? {
      recommendedOptionId,
      chosenOptionId: recommendedOptionId,
      chosenByCustomer: false,
    };

  // PR3 — Resolve chosen option for framing display.
  const showChosenOptionHero =
    presentationState != null && hasCustomerDivergence(presentationState);
  const chosenOptionCard =
    showChosenOptionHero && engineOutput.options && presentationState?.chosenOptionId
      ? engineOutput.options.find(o => o.id === presentationState.chosenOptionId) ?? null
      : null;
  const recommendedOptionCard =
    engineOutput.options?.find(o => o.id === recommendedOptionId) ?? null;

  // PR7 — Behaviour cards (top 3–5) and "Why Atlas suggested this" reasons.
  const behaviourCards = buildRealWorldBehaviourCards(
    engineOutput,
    resolvedPresentationState,
  );
  const topBehaviourCards = behaviourCards.slice(0, 5);
  const reasonSummary = buildRecommendationReasonSummary(engineOutput, recommendedOptionId);
  const showWhyAtlas =
    (engineOutput.verdict?.primaryReason != null ||
      (engineOutput.verdict?.reasons?.length ?? 0) > 0) &&
    reasonSummary.reasons.length > 0;

  return (
    <GlobalMenuShell>
      <div className="portal-page" data-testid="customer-portal">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="portal-page__header">
          <div className="portal-page__brand" aria-label="Atlas">ATLAS</div>
          <div className="portal-page__header-text">
            <h1 className="portal-page__heading">Your heating recommendation</h1>
            {postcode && (
              <span className="portal-page__postcode">{postcode}</span>
            )}
          </div>
        </header>

        {/* ── Section 1: Recommendation hero ───────────────────────────────── */}
        <section
          className="portal-section portal-section--hero"
          aria-label="Recommended system"
          data-testid="portal-hero"
        >
          <h2 className="portal-section__title portal-hero__heading">
            {RECOMMENDATION_HERO_HEADING}
          </h2>
          <div className={`portal-hero__status portal-hero__status--${verdictStatus}`}>
            {verdictStatus === 'good' ? '✓' : verdictStatus === 'caution' ? '⚠' : '✗'}
          </div>
          <div className="portal-hero__title">{verdictTitle}</div>
          {engineOutput.recommendation.secondary && (
            <p className="portal-hero__secondary">
              {engineOutput.recommendation.secondary}
            </p>
          )}
          <div className="portal-hero__confidence">
            Confidence: <strong>{confidenceLabel}</strong>
          </div>
          {engineOutput.verdict?.primaryReason && (
            <p className="portal-hero__explanation">
              {engineOutput.verdict.primaryReason}
            </p>
          )}
        </section>

        {/* ── Section 1a: Why Atlas suggested this (PR6/PR7) ───────────────── */}
        {showWhyAtlas && (
          <section
            className="portal-section portal-why-atlas"
            aria-label="Why Atlas suggested this"
            data-testid="portal-why-atlas"
          >
            <h2 className="portal-section__title">{WHY_ATLAS_HEADING}</h2>
            <ul className="portal-why-atlas__list" aria-label="Reasons for this recommendation">
              {reasonSummary.reasons.map((reason, i) => (
                <li key={i} className="portal-why-atlas__item">{reason}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Section 1b: Your chosen option (PR6/PR7) ─────────────────────── */}
        {showChosenOptionHero && chosenOptionCard != null && (
          <section
            className="portal-section portal-chosen-hero"
            aria-label={CHOSEN_SECTION_HEADING}
            data-testid="portal-chosen-option-hero"
            role="region"
          >
            <h2 className="portal-section__title portal-chosen-hero__heading">
              {CHOSEN_SECTION_HEADING}: {chosenOptionCard.label}
            </h2>
            <p className="portal-chosen-hero__affirm">
              {CHOSEN_OPTION_FRAMING.affirm}
            </p>
            {chosenOptionCard.why.length > 0 && (
              <p className="portal-chosen-hero__align">
                {CHOSEN_OPTION_FRAMING.align} {chosenOptionCard.why[0]}
              </p>
            )}
            <p className="portal-chosen-hero__headline">
              {chosenOptionCard.headline}
            </p>
            <p className="portal-chosen-hero__guide">
              {CHOSEN_OPTION_FRAMING.guide}
            </p>
          </section>
        )}

        {/* ── Section 1c: How they compare (PR6/PR7) ───────────────────────── */}
        {showChosenOptionHero && behaviourCards.length > 0 && (
          <section
            className="portal-section"
            aria-label={COMPARISON_SECTION_HEADING}
            data-testid="portal-comparison-summary"
          >
            <ChosenOptionComparisonSummary
              behaviourCards={behaviourCards}
              recommendedOptionLabel={recommendedOptionCard?.label ?? 'Recommended option'}
              chosenOptionLabel={chosenOptionCard?.label ?? 'Your chosen option'}
            />
          </section>
        )}

        {/* ── Section 2: Everyday behaviour cards (PR7) ────────────────────── */}
        {topBehaviourCards.length > 0 && (
          <section
            className="portal-section"
            aria-label={showChosenOptionHero ? COMPARISON_SECTION_HEADING : 'In daily use'}
            data-testid="portal-behaviour-cards"
          >
            <h2 className="portal-section__title">
              {showChosenOptionHero ? COMPARISON_SECTION_HEADING : 'In daily use'}
            </h2>
            <RealWorldBehaviourCards
              cards={topBehaviourCards}
              isDivergent={showChosenOptionHero}
            />
          </section>
        )}

        {/* ── Section 3: Why this suits your home ──────────────────────────── */}
        {whyBullets.length > 0 && (
          <section
            className="portal-section"
            aria-label="Why this works well for your home"
            data-testid="portal-why"
          >
            <h2 className="portal-section__title">Why this works well for your home</h2>
            <ul className="portal-why__list">
              {whyBullets.map((bullet, i) => (
                <li key={i} className="portal-why__item">{bullet}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Section 4: Current vs recommended — at a glance ──────────────── */}
        {tradeOffSummary != null && (
          <section
            className="portal-section"
            aria-label="Current vs recommended"
            data-testid="portal-tradeoff"
          >
            <h2 className="portal-section__title">
              Current vs recommended — at a glance
            </h2>
            <TradeOffSummary summary={tradeOffSummary} />
          </section>
        )}

        {/* ── Section 5: Required changes ──────────────────────────────────── */}
        {requiredChanges.length > 0 && (
          <section
            className="portal-section"
            aria-label="What the installation would involve"
            data-testid="portal-changes"
          >
            <h2 className="portal-section__title">What the installation would involve</h2>
            <ul className="portal-changes__list">
              {requiredChanges.map((change, i) => (
                <li key={i} className="portal-changes__item">{change}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Section 6: Explore your options ──────────────────────────────── */}
        {engineInput != null && (
          <section
            className="portal-section"
            aria-label="Explore your options"
            data-testid="portal-explore"
          >
            <ExploreOptionsPanel
              baseInput={engineInput}
              originalOutput={engineOutput}
            />
          </section>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="portal-page__footer">
          <p className="portal-page__footer-text">
            This recommendation was generated by Atlas — a physics-based
            heating system assessment tool. For questions about your
            recommendation, contact the engineer who carried out your survey.
          </p>
        </footer>
      </div>
    </GlobalMenuShell>
  );
}
