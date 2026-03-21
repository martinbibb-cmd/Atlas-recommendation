import { useEffect, useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import GlobalMenuShell from '../shell/GlobalMenuShell';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import './CustomerPortalPage.css';

interface Props { reference: string; token?: string; }

export default function CustomerPortalPage({ reference, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [postcode, setPostcode] = useState<string | null>(null);
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();

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
        setEngineOutput(report.payload.engineOutput);
        setSurveyData((report.payload.surveyData ?? report.payload.engineInput ?? null) as FullSurveyModelV1 | null);
        setFloorplanOutput(report.payload.floorplanOutput as DerivedFloorplanOutput | undefined);
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
    <GlobalMenuShell>
      <div className="portal-page" data-testid="customer-portal">
        <header className="portal-page__header">
          <div className="portal-page__brand" aria-label="Atlas">ATLAS</div>
          <div className="portal-page__header-text">
            <h1 className="portal-page__heading">Glass Box Portal</h1>
            <p className="portal-page__subheading">The simulator is now the portal. Advice stays beside the proof, not on a separate page.</p>
            {postcode && <span className="portal-page__postcode">{postcode}</span>}
          </div>
        </header>

        <section className="portal-section portal-section--hero" data-testid="portal-hero">
          <h2 className="portal-section__title">Your heating recommendation</h2>
          <p className="portal-hero__explanation">Explore the current system, test the proposed upgrade, and see the outcomes and advice update from the same simulation model.</p>
        </section>

        <section className="portal-section" data-testid="portal-unified-simulator">
          <UnifiedSimulatorView
            engineOutput={engineOutput}
            surveyData={surveyData}
            floorplanOutput={floorplanOutput}
          />
        </section>

        <footer className="portal-page__footer">
          <p className="portal-page__footer-text">Atlas keeps the evidence visible: setup, simulation, outcomes, and advice in one place.</p>
        </footer>
      </div>
    </GlobalMenuShell>
  );
}
