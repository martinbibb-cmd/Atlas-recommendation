/**
 * CustomerPortalPage.tsx
 *
 * Premium customer portal — the digital version of the recommendation sheet,
 * accessible via a signed portal link sent after the survey visit.
 *
 * Design intent:
 *   1. Reassure  — "This recommendation makes sense for my home."
 *   2. Explain   — "Now I understand why."
 *   3. Explore   — "What changes if I choose differently?"
 *
 * Page structure (single scroll, anchored sections):
 *   § 1  Hero / Recommendation
 *   § 2  Why this suits your home   (3 signal cards)
 *   § 3  What this improves         (4 outcome tiles)
 *   § 4  Other options considered   (comparison cards)
 *   § 5  See how it works           (guided simulator entry)
 *   § 6  Evidence behind the advice (expandable accordions)
 *   § 7  Your installation plan     (required + recommended work)
 *
 * UX rules:
 *   - Recommendation-first — no dashboard chaos above the fold.
 *   - One core idea per section — no mixed-purpose panels.
 *   - Comparison is secondary — never visually overpowers recommendation.
 *   - Simulator is guided before raw interaction.
 *   - Sticky mini-bar on scroll for quick navigation.
 *   - No raw engine jargon surfaced to the customer.
 */

import { useEffect, useRef, useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { buildPortalContentModel } from './buildPortalContentModel';
import type { PortalContentModel, PortalComparisonCard, PortalEvidenceSection } from './buildPortalContentModel';
import './CustomerPortalPage.css';

interface Props { reference: string; token?: string; }

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ComparisonCardProps {
  card: PortalComparisonCard;
  defaultOpen: boolean;
}

function ComparisonCard({ card, defaultOpen }: ComparisonCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`portal-comparison-card${card.isRecommended ? ' portal-comparison-card--recommended' : ''}${open ? ' portal-comparison-card--open' : ''}`}
      data-testid={`comparison-card-${card.id}`}
    >
      <button
        className="portal-comparison-card__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="portal-comparison-card__label">{card.label}</span>
        <span className={`portal-comparison-card__badge portal-comparison-card__badge--${card.isRecommended ? 'recommended' : card.verdictBadge === 'Viable option' ? 'viable' : 'other'}`}>
          {card.verdictBadge}
        </span>
        <span className="portal-comparison-card__chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="portal-comparison-card__body">
          <p className="portal-comparison-card__suitability">{card.suitabilityLine}</p>
          {card.strengths.length > 0 && (
            <ul className="portal-comparison-card__list portal-comparison-card__list--strengths">
              {card.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          {card.caveats.length > 0 && (
            <ul className="portal-comparison-card__list portal-comparison-card__list--caveats">
              {card.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  section: PortalEvidenceSection;
}

function EvidenceAccordion({ section }: AccordionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="portal-accordion" data-testid={`evidence-accordion-${section.id}`}>
      <button
        className="portal-accordion__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="portal-accordion__heading">{section.heading}</span>
        <span className="portal-accordion__chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      <div className="portal-accordion__summary">{section.summary}</div>
      {open && section.details.length > 0 && (
        <ul className="portal-accordion__details">
          {section.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  const [showSimulator, setShowSimulator] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPortal() {
      if (!token) {
        if (!cancelled) { setTokenDenied('missing'); setLoading(false); }
        return;
      }
      const tokenResult = await validatePortalToken(reference, token);
      if (tokenResult !== 'valid') {
        if (!cancelled) { setTokenDenied(tokenResult); setLoading(false); }
        return;
      }
      try {
        const report = await getReport(reference);
        if (cancelled) return;
        if (!report.payload?.engineOutput) throw new Error('This report does not contain recommendation data.');
        setEngineOutput(report.payload.engineOutput);
        setSurveyData((report.payload.surveyData ?? report.payload.engineInput ?? null) as FullSurveyModelV1 | null);
        setEngineInput(report.payload.engineInput ?? null);
        setFloorplanOutput(report.payload.floorplanOutput ?? undefined);
        setPostcode(report.postcode ?? null);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPortal();
    return () => { cancelled = true; };
  }, [reference, token]);

  // Sticky mini-bar: show after the hero scrolls out of view.
  useEffect(() => {
    const hero = heroRef.current;
    // IntersectionObserver may be undefined in test environments (JSDOM).
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { setStickyVisible(!entry.isIntersecting); },
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => { observer.disconnect(); };
  }, [loading]);

  if (loading) {
    return <div className="portal-page__loading" role="status" aria-live="polite">Loading your recommendation…</div>;
  }

  if (tokenDenied) {
    const headline = tokenDenied === 'expired' ? 'This link has expired' : 'This link is not valid';
    const detail = tokenDenied === 'expired'
      ? 'Your portal link has expired. Please ask the engineer who carried out your survey to send you a new link.'
      : 'The link you followed is not valid or has been revoked. Please check the link you were given and try again.';
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-token-error">
        <p className="portal-page__error-headline">{headline}</p>
        <p className="portal-page__error-detail">{detail}</p>
      </div>
    );
  }

  if (error || !engineOutput || !surveyData) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-error">
        <p className="portal-page__error-headline">{isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}</p>
        <p className="portal-page__error-detail">{error ?? 'The recommendation data is missing or incomplete.'}</p>
      </div>
    );
  }

  // Build portal content model — pure, deterministic, customer-safe.
  const inputForModel: EngineInputV2_3 = (engineInput ?? surveyData) as EngineInputV2_3;
  const model: PortalContentModel = buildPortalContentModel(engineOutput, inputForModel);

  return (
    <div className="portal-page" data-testid="customer-portal">

      {/* ── Sticky mini summary bar ──────────────────────────────────────── */}
      <div
        className={`portal-sticky-bar${stickyVisible ? ' portal-sticky-bar--visible' : ''}`}
        aria-hidden={!stickyVisible}
        data-testid="portal-sticky-bar"
      >
        <span className="portal-sticky-bar__title">{model.recommendationTitle}</span>
        <nav className="portal-sticky-bar__nav" aria-label="Quick navigation">
          <a href="#portal-why"       className="portal-sticky-bar__link">Why this</a>
          <a href="#portal-compare"   className="portal-sticky-bar__link">Compare</a>
          <a href="#portal-simulator" className="portal-sticky-bar__link">Simulator</a>
          <a href="#portal-plan"      className="portal-sticky-bar__link">Your plan</a>
        </nav>
      </div>

      {/* ── § 1  Hero / Recommendation ───────────────────────────────────── */}
      <header className="portal-page__hero" data-testid="portal-hero" ref={heroRef}>
        <div className="portal-hero__brand-row">
          <span className="portal-page__brand" aria-label="Atlas">ATLAS</span>
          {postcode && <span className="portal-page__postcode">{postcode}</span>}
        </div>

        <p className="portal-hero__eyebrow">Recommended for your home</p>
        <h1 className="portal-hero__title">{model.recommendationTitle}</h1>

        {model.primaryReason && (
          <p className="portal-hero__primary-reason">{model.primaryReason}</p>
        )}

        <p className="portal-hero__trust">{model.trustStatement}</p>

        {/* Summary chips */}
        {model.summaryChips.length > 0 && (
          <dl className="portal-hero__chips" aria-label="At a glance">
            {model.summaryChips.map((chip) => (
              <div key={chip.label} className="portal-hero__chip">
                <dt className="portal-hero__chip-label">{chip.label}</dt>
                <dd className="portal-hero__chip-value">{chip.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {model.portalConfidenceLabel && (
          <p className="portal-hero__confidence">{model.portalConfidenceLabel}</p>
        )}
      </header>

      {/* ── § 2  Why this suits your home ───────────────────────────────── */}
      <section className="portal-section" id="portal-why" aria-labelledby="portal-why-heading">
        <h2 className="portal-section__heading" id="portal-why-heading">Why this suits your home</h2>

        <div className="portal-signal-cards">

          {/* Card 1 — Your home */}
          <div className="portal-signal-card" data-testid="portal-signal-card-home">
            <h3 className="portal-signal-card__title">Your home</h3>
            {model.homeSignals.length > 0 ? (
              <dl className="portal-signal-card__signals">
                {model.homeSignals.map((s) => (
                  <div key={s.label} className="portal-signal-card__signal-row">
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="portal-signal-card__empty">Home fabric signals from your survey</p>
            )}
          </div>

          {/* Card 2 — Your hot water use */}
          <div className="portal-signal-card" data-testid="portal-signal-card-hot-water">
            <h3 className="portal-signal-card__title">Your hot water use</h3>
            {model.hotWaterSignals.length > 0 ? (
              <dl className="portal-signal-card__signals">
                {model.hotWaterSignals.map((s) => (
                  <div key={s.label} className="portal-signal-card__signal-row">
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="portal-signal-card__empty">Demand signals from your survey</p>
            )}
          </div>

          {/* Card 3 — Your current system */}
          <div className="portal-signal-card" data-testid="portal-signal-card-current-system">
            <h3 className="portal-signal-card__title">Your current system</h3>
            {model.currentSystemSignals.length > 0 ? (
              <dl className="portal-signal-card__signals">
                {model.currentSystemSignals.map((s) => (
                  <div key={s.label} className="portal-signal-card__signal-row">
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="portal-signal-card__empty">Current installation details from your survey</p>
            )}
          </div>

        </div>

        {/* Why the recommendation fits */}
        {model.whyRecommended.length > 0 && (
          <div className="portal-why-fit" aria-labelledby="portal-why-fit-heading">
            <h3 className="portal-why-fit__heading" id="portal-why-fit-heading">Why the recommendation fits</h3>
            <ul className="portal-why-fit__list">
              {model.whyRecommended.map((reason, i) => (
                <li key={i} className="portal-why-fit__item">{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── § 3  What this improves ──────────────────────────────────────── */}
      <section className="portal-section portal-section--alt" aria-labelledby="portal-improvements-heading">
        <h2 className="portal-section__heading" id="portal-improvements-heading">What this improves</h2>
        <div className="portal-improvement-tiles">
          {model.improvements.map((tile) => (
            <div key={tile.label} className="portal-improvement-tile" data-testid={`improvement-tile-${tile.label.replace(/\s+/g, '-').toLowerCase()}`}>
              <strong className="portal-improvement-tile__label">{tile.label}</strong>
              <p className="portal-improvement-tile__outcome">{tile.outcome}</p>
              <p className="portal-improvement-tile__detail">{tile.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── § 4  Other options considered ───────────────────────────────── */}
      <section className="portal-section" id="portal-compare" aria-labelledby="portal-compare-heading">
        <h2 className="portal-section__heading" id="portal-compare-heading">Other options considered</h2>
        <p className="portal-section__intro">
          Atlas assessed all viable options for your home. The recommended option is shown first.
        </p>
        {model.comparisonCards.length > 0 ? (
          <div className="portal-comparison-cards" data-testid="portal-comparison-cards">
            {model.comparisonCards.map((card) => (
              <ComparisonCard key={card.id} card={card} defaultOpen={card.isRecommended} />
            ))}
          </div>
        ) : (
          <p className="portal-section__empty">Option comparison not available for this report.</p>
        )}
      </section>

      {/* ── § 5  See how it works (guided simulator entry) ──────────────── */}
      <section className="portal-section portal-section--alt" id="portal-simulator" aria-labelledby="portal-simulator-heading">
        <h2 className="portal-section__heading" id="portal-simulator-heading">See how it works</h2>

        {!showSimulator ? (
          /* Guided intro layer — shown before raw simulator */
          <div className="portal-simulator-intro" data-testid="portal-simulator-intro">
            <p className="portal-simulator-intro__lead">{model.simulatorIntro}</p>

            <div className="portal-simulator-intro__tabs">
              <div className="portal-simulator-intro__tab">
                <strong>Hot water</strong>
                <p>How the system meets your household's daily hot water draw.</p>
              </div>
              <div className="portal-simulator-intro__tab">
                <strong>Heating response</strong>
                <p>How the boiler modulates to track your home's heat demand through the day.</p>
              </div>
              <div className="portal-simulator-intro__tab">
                <strong>Recovery</strong>
                <p>How quickly the system recovers after a peak demand event.</p>
              </div>
              <div className="portal-simulator-intro__tab">
                <strong>Trade-offs</strong>
                <p>What changes if you switch system type or increase hot water demand.</p>
              </div>
            </div>

            <button
              className="portal-simulator-intro__cta"
              onClick={() => setShowSimulator(true)}
              data-testid="open-simulator-btn"
            >
              Open live simulator
            </button>
          </div>
        ) : (
          /* Full simulator — expert inputs hidden in portal mode */
          <section className="portal-unified-simulator" data-testid="portal-unified-simulator">
            <UnifiedSimulatorView
              engineOutput={engineOutput}
              surveyData={surveyData}
              floorplanOutput={floorplanOutput}
              portalMode
            />
          </section>
        )}
      </section>

      {/* ── § 6  Evidence behind the advice ─────────────────────────────── */}
      <section className="portal-section" aria-labelledby="portal-evidence-heading">
        <h2 className="portal-section__heading" id="portal-evidence-heading">Evidence behind the advice</h2>
        <div className="portal-evidence-accordions" data-testid="portal-evidence-accordions">
          {model.evidenceSections.map((section) => (
            <EvidenceAccordion key={section.id} section={section} />
          ))}
        </div>
      </section>

      {/* ── § 7  Your installation plan ─────────────────────────────────── */}
      <section className="portal-section portal-section--alt" id="portal-plan" aria-labelledby="portal-plan-heading">
        <h2 className="portal-section__heading" id="portal-plan-heading">Your installation plan</h2>

        {model.requiredWork.length > 0 && (
          <div className="portal-plan-block" data-testid="portal-required-work">
            <h3 className="portal-plan-block__title">Required work</h3>
            <ul className="portal-plan-block__list">
              {model.requiredWork.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {model.recommendedWork.length > 0 && (
          <div className="portal-plan-block" data-testid="portal-recommended-work">
            <h3 className="portal-plan-block__title">Recommended upgrades</h3>
            <ul className="portal-plan-block__list portal-plan-block__list--upgrades">
              {model.recommendedWork.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* Next step CTAs */}
        <div className="portal-plan-ctas" data-testid="portal-plan-ctas">
          <button className="portal-plan-cta portal-plan-cta--primary">Review with your installer</button>
          <button className="portal-plan-cta">Save or print summary</button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="portal-page__footer">
        <p className="portal-page__footer-text">
          Atlas — the evidence is always visible. Setup, proof, outcomes, and advice in one place.
        </p>
      </footer>
    </div>
  );
}
