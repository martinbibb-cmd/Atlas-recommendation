/**
 * CustomerPortalPage.tsx
 *
 * Customer-facing recommendation portal — loaded by report reference.
 *
 * Sections:
 *   1. Recommendation hero — recommended system + short summary
 *   2. Why this suits your home — comfort, hot water, space, disruption
 *   3. Trade-off summary — current vs recommended at a glance
 *   4. Required changes — cylinder, emitters, works if relevant
 *   5. Explore your options — constrained exploration panel
 *   6. Global menu — via GlobalMenuShell wrapper
 *
 * Route: /portal/:reference
 * Phase 1 uses raw report reference gating.
 * Structured so signed-token access can replace this later.
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
import TradeOffSummary from '../advice/TradeOffSummary';
import { buildTradeOffSummary } from '../../lib/advice/buildTradeOffSummary';
import ExploreOptionsPanel from './ExploreOptionsPanel';
import GlobalMenuShell from '../shell/GlobalMenuShell';
import './CustomerPortalPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Report reference (ID) to load. */
  reference: string;
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

export default function CustomerPortalPage({ reference }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);

  // Load report data
  useEffect(() => {
    let cancelled = false;

    getReport(reference)
      .then((report) => {
        if (cancelled) return;
        if (!report.payload?.engineOutput) {
          throw new Error('This report does not contain recommendation data.');
        }
        setEngineOutput(report.payload.engineOutput);
        setEngineInput(report.payload.engineInput ?? null);
        setSurveyData(report.payload.surveyData ?? null);
        setPostcode(report.postcode ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reference]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="portal-page__loading" role="status" aria-live="polite">
        Loading your recommendation…
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
    engineOutput.meta?.confidence?.level ?? '—';

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
          <div className={`portal-hero__status portal-hero__status--${verdictStatus}`}>
            {verdictStatus === 'good' ? '✓' : verdictStatus === 'caution' ? '⚠' : '✗'}
          </div>
          <h2 className="portal-hero__title">{verdictTitle}</h2>
          {engineOutput.recommendation.secondary && (
            <p className="portal-hero__secondary">
              {engineOutput.recommendation.secondary}
            </p>
          )}
          <div className="portal-hero__confidence">
            Confidence: <strong>{confidenceLabel}</strong>
          </div>
          {engineOutput.verdict?.comparisonExplanation && (
            <p className="portal-hero__explanation">
              {engineOutput.verdict.comparisonExplanation}
            </p>
          )}
        </section>

        {/* ── Section 2: Why this suits your home ──────────────────────────── */}
        {whyBullets.length > 0 && (
          <section
            className="portal-section"
            aria-label="Why this suits your home"
            data-testid="portal-why"
          >
            <h2 className="portal-section__title">Why this suits your home</h2>
            <ul className="portal-why__list">
              {whyBullets.map((bullet, i) => (
                <li key={i} className="portal-why__item">{bullet}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Section 3: Current vs recommended — at a glance ──────────────── */}
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

        {/* ── Section 4: Required changes ──────────────────────────────────── */}
        {requiredChanges.length > 0 && (
          <section
            className="portal-section"
            aria-label="Required changes"
            data-testid="portal-changes"
          >
            <h2 className="portal-section__title">Required changes</h2>
            <ul className="portal-changes__list">
              {requiredChanges.map((change, i) => (
                <li key={i} className="portal-changes__item">{change}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Section 5: Explore your options ──────────────────────────────── */}
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
