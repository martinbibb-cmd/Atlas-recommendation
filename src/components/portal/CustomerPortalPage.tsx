/**
 * CustomerPortalPage.tsx
 *
 * Customer portal — mirrors the in-room recommendation presentation exactly.
 * Accessible via a signed portal link sent after the survey visit.
 *
 * The portal renders the same CanonicalPresentationPage (deck mode) that is
 * shown to the customer in-room, so every slide is identical.
 *
 * Restrictions vs the in-room view:
 *   - No "Back" button — customers cannot navigate to other reports or surveys.
 *   - No survey editing — portal is read-only.
 *   - Simulator is available inline via the final deck slide CTA.
 */

import { useEffect, useState } from 'react';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { readCanonicalReportPayload } from '../../features/reports/adapters/readCanonicalReportPayload';
import { runEngine } from '../../engine/Engine';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import CanonicalPresentationPage from '../presentation/CanonicalPresentationPage';
import './CustomerPortalPage.css';

interface Props { reference: string; token?: string; }

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineResult, setEngineResult] = useState<FullEngineResult | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  // surveyData and floorplanOutput are kept for the inline simulator.
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  const [showSimulator, setShowSimulator] = useState(false);

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
          if (!cancelled) { setTokenDenied(tokenResult); setLoading(false); }
          return;
        }
        const report = await getReport(reference);
        if (cancelled) return;

        const payloadInfo = readCanonicalReportPayload(report.payload);
        const engineInputRaw =
          payloadInfo.engineRun?.engineInput ?? payloadInfo.legacy?.engineInput;
        if (!engineInputRaw) {
          throw new Error('This report does not contain the engine input needed to render the presentation.');
        }

        const input = engineInputRaw as EngineInputV2_3;
        const result = runEngine(input);

        if (!cancelled) {
          setEngineInput(input);
          setEngineResult(result);
          setSurveyData((payloadInfo.legacy?.surveyData ?? payloadInfo.legacy?.engineInput ?? null) as FullSurveyModelV1 | null);
          setFloorplanOutput(payloadInfo.legacy?.floorplanOutput ?? undefined);
          setPostcode(report.postcode ?? null);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPortal();
    return () => { cancelled = true; };
  }, [reference, token]);

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

  if (error || !engineResult || !engineInput) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-error">
        <p className="portal-page__error-headline">{isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}</p>
        <p className="portal-page__error-detail">{error ?? 'The recommendation data is missing or incomplete.'}</p>
      </div>
    );
  }

  return (
    <div className="portal-page" data-testid="customer-portal">

      {/* ── Minimal portal header (brand + postcode only) ─────────────────── */}
      <header className="portal-page__hero" data-testid="portal-hero">
        <div className="portal-hero__brand-row">
          <span className="portal-page__brand" aria-hidden="true"></span>
          {postcode && <span className="portal-page__postcode">{postcode}</span>}
        </div>
      </header>

      {/* ── Inline simulator (shown when launched from the deck CTA) ─────── */}
      {showSimulator && surveyData ? (
        <section
          className="portal-section portal-unified-simulator"
          id="portal-simulator"
          aria-labelledby="portal-simulator-heading"
          data-testid="portal-unified-simulator"
        >
          <div className="portal-simulator__back-row">
            <button
              type="button"
              className="back-btn"
              onClick={() => setShowSimulator(false)}
            >
              ← Back to presentation
            </button>
          </div>
          <h2 className="portal-section__heading" id="portal-simulator-heading">
            Live simulator
          </h2>
          <UnifiedSimulatorView
            engineOutput={engineResult.engineOutput}
            surveyData={surveyData}
            floorplanOutput={floorplanOutput}
            portalMode
          />
        </section>
      ) : (
        /* ── Canonical presentation deck — identical to the in-room view ─── */
        <CanonicalPresentationPage
          result={engineResult}
          input={engineInput}
          recommendationResult={engineResult.recommendationResult}
          onOpenSimulator={surveyData ? () => setShowSimulator(true) : undefined}
          deckMode
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="portal-page__footer">
        <p className="portal-page__footer-text">
          The evidence is always visible. Setup, proof, outcomes, and advice in one place.
        </p>
      </footer>
    </div>
  );
}
