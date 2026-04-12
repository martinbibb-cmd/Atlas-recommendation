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
 * Page structure — guided closing journey (PR10):
 *   A  What we found in your home   (PortalFindingsSection)
 *   B  What Atlas recommends        (PortalRecommendationSection)
 *   C  Why this fits your home      (PortalWhyFitsSection)
 *   D  What to expect               (PortalWhatToExpectSection)
 *   E  Other options considered     (PortalAlternativesSection)
 *   F  See how it behaves           (PortalScenarioSection → simulator)
 *
 * UX rules:
 *   - Recommendation-first — no dashboard chaos above the fold.
 *   - One core idea per section — no mixed-purpose panels.
 *   - Comparison is secondary — never visually overpowers recommendation.
 *   - Simulator is exploration, not doubt — comes after the proof.
 *   - No raw engine jargon surfaced to the customer.
 */

import { useEffect, useRef, useState } from 'react';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { readCanonicalReportPayload } from '../../features/reports/adapters/readCanonicalReportPayload';
import { buildPortalDisplayModel } from './selectors/buildPortalDisplayModel';
import { buildPortalJourneyModel } from './selectors/buildPortalJourneyModel';
import type { PortalDisplayModel } from './types/portalDisplay.types';
import type { PortalJourneyModel } from './types/portalJourney.types';
import PortalFindingsSection from './journey/PortalFindingsSection';
import PortalRecommendationSection from './journey/PortalRecommendationSection';
import PortalWhyFitsSection from './journey/PortalWhyFitsSection';
import PortalWhatToExpectSection from './journey/PortalWhatToExpectSection';
import PortalAlternativesSection from './journey/PortalAlternativesSection';
import PortalScenarioSection from './journey/PortalScenarioSection';
import './CustomerPortalPage.css';

interface Props { reference: string; token?: string; }

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [displayModel, setDisplayModel] = useState<PortalDisplayModel | null>(null);
  // Legacy fields kept for simulator launch compat during the migration window.
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
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
      try {
        const tokenResult = await validatePortalToken(reference, token);
        if (tokenResult !== 'valid') {
          if (!cancelled) { setTokenDenied(tokenResult); }
          return;
        }
        const report = await getReport(reference);
        if (cancelled) return;

        // Canonical-first: build the portal display model from the payload.
        const dm = buildPortalDisplayModel(report.payload, report.postcode);
        if (!dm) throw new Error('This report does not contain recommendation data.');
        setDisplayModel(dm);

        // Legacy compat: keep surveyData/floorplanOutput for
        // simulator launch until that consumer migrates to engineRun directly.
        const payloadInfo = readCanonicalReportPayload(report.payload);
        setSurveyData((payloadInfo.legacy?.surveyData ?? payloadInfo.legacy?.engineInput ?? null) as FullSurveyModelV1 | null);
        setFloorplanOutput(payloadInfo.legacy?.floorplanOutput ?? undefined);
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

  if (error || !displayModel || !surveyData) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-error">
        <p className="portal-page__error-headline">{isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}</p>
        <p className="portal-page__error-detail">{error ?? 'The recommendation data is missing or incomplete.'}</p>
      </div>
    );
  }

  // Build the portal journey model — two-stage derivation:
  //   report payload
  //   → buildPortalDisplayModel()   (PR9 — schema interpretation)
  //   → buildPortalJourneyModel()   (PR10 — customer narrative)
  const journeyModel: PortalJourneyModel = buildPortalJourneyModel(displayModel);
  const engineOutput = displayModel.engineOutput;

  // Simulator launch handler — called by PortalScenarioSection or directly.
  function handleLaunchScenario(_scenarioId: string) {
    setShowSimulator(true);
  }

  return (
    <div className="portal-page" data-testid="customer-portal">

      {/* ── Sticky mini summary bar ──────────────────────────────────────── */}
      <div
        className={`portal-sticky-bar${stickyVisible ? ' portal-sticky-bar--visible' : ''}`}
        aria-hidden={!stickyVisible}
        data-testid="portal-sticky-bar"
      >
        <span className="portal-sticky-bar__title">{journeyModel.recommendation.title}</span>
        <nav className="portal-sticky-bar__nav" aria-label="Quick navigation">
          <a href="#portal-findings"       className="portal-sticky-bar__link">What we found</a>
          <a href="#portal-recommendation" className="portal-sticky-bar__link">Recommendation</a>
          <a href="#portal-why-fits"       className="portal-sticky-bar__link">Why this fits</a>
          <a href="#portal-alternatives"   className="portal-sticky-bar__link">Other options</a>
        </nav>
      </div>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="portal-page__hero" data-testid="portal-hero" ref={heroRef}>
        <div className="portal-hero__brand-row">
          <span className="portal-page__brand" aria-hidden="true"></span>
          {postcode && <span className="portal-page__postcode">{postcode}</span>}
        </div>
        <h1 className="portal-hero__title">{journeyModel.title}</h1>
      </header>

      {/* ── A  What we found in your home ───────────────────────────────── */}
      <div id="portal-findings">
        <PortalFindingsSection findings={journeyModel.findings} />
      </div>

      {/* ── B  What Atlas recommends ─────────────────────────────────────── */}
      <div id="portal-recommendation">
        <PortalRecommendationSection recommendation={journeyModel.recommendation} />
      </div>

      {/* ── C  Why this fits your home ───────────────────────────────────── */}
      <div id="portal-why-fits">
        <PortalWhyFitsSection whyFits={journeyModel.whyFits} />
      </div>

      {/* ── D  What to expect ────────────────────────────────────────────── */}
      <PortalWhatToExpectSection whatToExpect={journeyModel.whatToExpect} />

      {/* ── E  Other options considered ──────────────────────────────────── */}
      <div id="portal-alternatives">
        <PortalAlternativesSection alternatives={journeyModel.alternatives} />
      </div>

      {/* ── F  See how it behaves / Simulator ───────────────────────────── */}
      {!showSimulator ? (
        <PortalScenarioSection
          scenarios={journeyModel.scenarios}
          onLaunchScenario={handleLaunchScenario}
        />
      ) : (
        <section
          className="portal-section portal-unified-simulator"
          id="portal-simulator"
          aria-labelledby="portal-simulator-heading"
          data-testid="portal-unified-simulator"
        >
          <h2 className="portal-section__heading" id="portal-simulator-heading">
            Live simulator
          </h2>
          <UnifiedSimulatorView
            engineOutput={engineOutput}
            surveyData={surveyData}
            floorplanOutput={floorplanOutput}
            portalMode
          />
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="portal-page__footer">
        <p className="portal-page__footer-text">
          The evidence is always visible. Setup, proof, outcomes, and advice in one place.
        </p>
      </footer>
    </div>
  );
}
