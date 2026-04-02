/**
 * CustomerPortalPage.tsx
 *
 * Customer-facing portal — a version of the in-room presentation accessible
 * via a signed portal link sent after the survey visit.
 *
 * Shows the full CanonicalPresentationPage deck (same in-room experience) with
 * access to the simulator. No navigation to the rest of the app.
 */

import { useEffect, useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import { runEngine } from '../../engine/Engine';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import CanonicalPresentationPage from '../presentation/CanonicalPresentationPage';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import './CustomerPortalPage.css';

interface Props { reference: string; token?: string; }

type PortalView = 'presentation' | 'simulator';

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  const [engineResult, setEngineResult] = useState<FullEngineResult | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  const [view, setView] = useState<PortalView>('presentation');

  useEffect(() => {
    let cancelled = false;
    async function loadPortal() {
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
        if (!report.payload?.engineOutput) throw new Error('This report does not contain recommendation data.');
        const input = (report.payload.engineInput ?? null) as EngineInputV2_3 | null;
        setEngineOutput(report.payload.engineOutput);
        setEngineInput(input);
        if (input) setEngineResult(runEngine(input));
        setSurveyData((report.payload.surveyData ?? report.payload.engineInput ?? null) as FullSurveyModelV1 | null);
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

  if (loading) return <div className="portal-page__loading" role="status" aria-live="polite">Loading your recommendation…</div>;

  if (tokenDenied) {
    const headline = tokenDenied === 'expired' ? 'This link has expired' : 'This link is not valid';
    const detail = tokenDenied === 'expired'
      ? 'Your portal link has expired. Please ask the engineer who carried out your survey to send you a new link.'
      : 'The link you followed is not valid or has been revoked. Please check the link you were given and try again.';
    return <div className="portal-page__error" role="alert" data-testid="portal-token-error"><p className="portal-page__error-headline">{headline}</p><p className="portal-page__error-detail">{detail}</p></div>;
  }

  if (error || !engineOutput || !surveyData) {
    const isNotFound = error?.toLowerCase().includes('not found');
    return <div className="portal-page__error" role="alert" data-testid="portal-error"><p className="portal-page__error-headline">{isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}</p><p className="portal-page__error-detail">{error ?? 'The recommendation data is missing or incomplete.'}</p></div>;
  }

  return (
    <div className="portal-page" data-testid="customer-portal">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="portal-page__header">
        <div className="portal-page__brand" aria-label="Atlas">ATLAS</div>
        <div className="portal-page__header-text">
          <h1 className="portal-page__heading">Your Heating Recommendation</h1>
          {postcode && <span className="portal-page__postcode">{postcode}</span>}
        </div>
        {/* View toggle — presentation vs simulator */}
        <div className="portal-view-toggle" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'presentation'}
            className={`portal-view-toggle__btn${view === 'presentation' ? ' portal-view-toggle__btn--active' : ''}`}
            onClick={() => setView('presentation')}
          >
            Recommendation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'simulator'}
            className={`portal-view-toggle__btn${view === 'simulator' ? ' portal-view-toggle__btn--active' : ''}`}
            onClick={() => setView('simulator')}
          >
            Simulator
          </button>
        </div>
      </header>

      {/* ── Presentation view ───────────────────────────────────────── */}
      {view === 'presentation' && engineResult && engineInput && (
        <div className="portal-presentation" role="tabpanel" aria-label="Recommendation presentation">
          <CanonicalPresentationPage
            result={engineResult}
            input={engineInput}
            deckMode={true}
            onOpenSimulator={() => setView('simulator')}
            heatLossState={surveyData.fullSurvey?.heatLoss}
            prioritiesState={surveyData.fullSurvey?.priorities}
          />
        </div>
      )}

      {/* ── Simulator view ──────────────────────────────────────────── */}
      {view === 'simulator' && (
        <div className="portal-simulator" role="tabpanel" aria-label="System simulator">
          <UnifiedSimulatorView
            engineOutput={engineOutput}
            surveyData={surveyData}
            floorplanOutput={floorplanOutput}
            portalMode
          />
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="portal-page__footer">
        <p className="portal-page__footer-text">
          Atlas keeps the evidence visible — setup, proof, outcomes, and advice in one place.
        </p>
      </footer>
    </div>
  );
}
