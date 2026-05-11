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
 *   - Deck CTA button launches the five-tab PortalPage (PR6).
 */

import { useEffect, useMemo, useState } from 'react';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import { BrandProvider, BrandedHeader, BrandedFooter, getBrandCtaCopy, useBrandProfile } from '../../features/branding';
import UnifiedSimulatorView from '../simulator/UnifiedSimulatorView';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { readCanonicalReportPayload } from '../../features/reports/adapters/readCanonicalReportPayload';
import { runEngine } from '../../engine/Engine';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import CanonicalPresentationPage from '../presentation/CanonicalPresentationPage';
import InsightPackDeck from '../../features/insightPack/InsightPackDeck';
import { buildInsightPackFromEngine } from '../../features/insightPack/buildInsightPackFromEngine';
import type { InsightPackSurveyContext } from '../../features/insightPack/buildInsightPackFromEngine';
import { PortalPage } from './PortalPage';
import { buildPortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { buildVisualBlocks } from '../../engine/modules/buildVisualBlocks';
import { buildDecisionFromScenarios } from '../../engine/modules/buildDecisionFromScenarios';
import { buildScenariosFromEngineOutput } from '../../engine/modules/buildScenariosFromEngineOutput';
import { buildLockedAiHandoffText } from '../../engine/modules/buildAiHandoffPayload';
import { buildCustomerSummary } from '../../engine/modules/buildCustomerSummary';
import type { PortalLaunchContext } from '../../contracts/PortalLaunchContext';
import type { WelcomePackAccessibilityPreferencesV1 } from '../../library/packComposer/WelcomePackComposerV1';
import './CustomerPortalPage.css';

interface Props {
  reference: string;
  token?: string;
  brandId?: string;
  /** Override for tests to force-hide/show development route labels. */
  showDevTraceLabelsOverride?: boolean;
}

type PortalViewMode = null | 'insight' | 'presentation' | 'portal';
const MIN_DYNAMIC_MAINS_PRESSURE_BAR = 1.5;
const MIN_MAINS_DYNAMIC_FLOW_LPM = 10;
const MIN_PRIMARY_PIPE_DIAMETER_MM = 22;

function buildPortalAccessibilityPreferences(): WelcomePackAccessibilityPreferencesV1 {
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    prefersReducedMotion,
    prefersPrint: false,
    includeTechnicalAppendix: false,
    profiles: [],
  };
}

function buildPortalConcernTags(input: EngineInputV2_3, scenarioId?: string): string[] {
  const tags = new Set<string>();
  if ((input.occupancyCount ?? 0) >= 3 || (input.peakConcurrentOutlets ?? 0) >= 2) {
    tags.add('simultaneous_use');
  }
  if (input.bathroomCount >= 2) {
    tags.add('hot_water_storage');
  }
  if (input.dynamicMainsPressure != null && input.dynamicMainsPressure < MIN_DYNAMIC_MAINS_PRESSURE_BAR) {
    tags.add('pressure');
  }
  if ((input.mainsDynamicFlowLpm ?? Number.POSITIVE_INFINITY) < MIN_MAINS_DYNAMIC_FLOW_LPM) {
    tags.add('flow');
  }
  if (scenarioId?.includes('ashp')) {
    tags.add('heat_pump');
    tags.add('low_flow_temperature');
  }
  if (input.pvStatus === 'existing' || input.pvStatus === 'planned') {
    tags.add('solar');
  }
  return [...tags];
}

function buildPortalPropertyConstraintTags(input: EngineInputV2_3): string[] {
  const tags = new Set<string>();
  if (input.dynamicMainsPressure != null && input.dynamicMainsPressure < MIN_DYNAMIC_MAINS_PRESSURE_BAR) {
    tags.add('pressure');
  }
  if ((input.mainsDynamicFlowLpm ?? Number.POSITIVE_INFINITY) < MIN_MAINS_DYNAMIC_FLOW_LPM) {
    tags.add('flow');
  }
  if (input.primaryPipeDiameter <= MIN_PRIMARY_PIPE_DIAMETER_MM) {
    tags.add('hydraulic');
  }
  return [...tags];
}

// ─── Main component ───────────────────────────────────────────────────────────

function CustomerPortalContent({
  reference,
  token,
  showDevTraceLabelsOverride,
}: Omit<Props, 'brandId'>) {
  const brand = useBrandProfile();
  const ctaCopy = getBrandCtaCopy(brand);
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
  // Welcome page: null = show welcome, 'insight' = insight pack, 'presentation' = deck, 'portal' = five-tab portal
  const [viewMode, setViewMode] = useState<PortalViewMode>(null);
  // Launch context received from the deck CTA — drives the initial tab of the portal.
  const [portalLaunchContext, setPortalLaunchContext] = useState<PortalLaunchContext | null>(null);
  const showDevTraceLabels = showDevTraceLabelsOverride ?? !import.meta.env.PROD;

  // ── Portal data: decision + scenarios (memoised — built once) ────────────
  // Computed before portalViewModel and aiSummaryText to avoid duplicating
  // the engine output parsing. Both memos below depend on this.
  const portalData = useMemo(() => {
    if (!engineResult || !engineInput) return null;
    const scenarios = buildScenariosFromEngineOutput(engineResult.engineOutput);
    if (scenarios.length === 0) return null;
    try {
      const rawType = engineInput.currentHeatSourceType;
      const boilerType: 'combi' | 'system' | 'regular' =
        rawType === 'system' || rawType === 'regular' ? rawType : 'combi';
      const decision = buildDecisionFromScenarios({
        scenarios,
        boilerType,
        ageYears: engineInput.currentSystem?.boiler?.ageYears ?? 0,
        occupancyCount: engineInput.occupancyCount,
        bathroomCount:  engineInput.bathroomCount,
        showerCompatibilityNote: engineResult.engineOutput.showerCompatibilityNote,
      });
      return { decision, scenarios, engineInput };
    } catch {
      return null;
    }
  }, [engineResult, engineInput]);

  // ── Portal view model (memoised — built once when portal data is ready) ──
  // useMemo is declared here (before conditional returns) to satisfy the Rules
  // of Hooks. It is a no-op until portalData is set.
  const portalViewModel = useMemo(() => {
    if (!portalData) return null;
    try {
      const blocks = buildVisualBlocks(portalData.decision, portalData.scenarios, undefined, portalData.engineInput);
      return buildPortalViewModel(portalData.decision, portalData.scenarios, blocks);
    } catch {
      return null;
    }
  }, [portalData]);

  // ── Locked CustomerSummaryV1 projection (memoised — built once) ──────────
  // GeminiAISummary receives only this projection — no ranked options, no raw
  // survey context. Built from the same portalData decision + scenarios.
  const lockedSummary = useMemo(() => {
    if (!portalData) return undefined;
    try {
      return buildCustomerSummary(portalData.decision, portalData.scenarios);
    } catch {
      return undefined;
    }
  }, [portalData]);

  const libraryPortalIntegration = useMemo(() => {
    if (!lockedSummary || !portalData) return null;
    return {
      customerSummary: lockedSummary,
      atlasDecision: portalData.decision,
      scenarios: portalData.scenarios,
      bathroomCount: portalData.engineInput.bathroomCount,
      accessibilityPreferences: buildPortalAccessibilityPreferences(),
      userConcernTags: buildPortalConcernTags(portalData.engineInput, lockedSummary.recommendedScenarioId),
      propertyConstraintTags: buildPortalPropertyConstraintTags(portalData.engineInput),
    };
  }, [lockedSummary, portalData]);

  // ── AI summary text (memoised — derived from locked summary) ─────────────
  // Must use buildLockedAiHandoffText(lockedSummary) — never buildAiHandoffText
  // directly — so customer-facing AI text is gated through CustomerSummaryV1.
  const aiSummaryText = useMemo(() => {
    if (!lockedSummary) return undefined;
    try {
      return buildLockedAiHandoffText(lockedSummary);
    } catch {
      return undefined;
    }
  }, [lockedSummary]);

  // ── AI summary filename — computed once, not on every render ─────────────
  const aiSummaryFilename = useMemo(
    () => `atlas-ai-summary-${new Date().toISOString().slice(0, 10)}.txt`,
    [],
  );

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

  // ── Callback: deck CTA opens the five-tab portal surface ─────────────────
  function handleOpenPortal() {
    const recommendedScenarioId = portalViewModel?.verdictData.comparisonCards[0]?.scenarioId;
    if (!recommendedScenarioId) return; // guard: no valid scenario — do not open a degenerate portal
    setPortalLaunchContext({ recommendedScenarioId });
    setViewMode('portal');
  }

  const currentPortalRoute =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/portal/${reference}`;
  const selectedPortalMode = viewMode ?? 'choice';
  const activeRendererComponent =
    viewMode === null
      ? 'PortalChoiceScreen'
      : viewMode === 'insight'
        ? 'InsightPackDeck'
        : viewMode === 'portal'
          ? 'PortalPage'
          : showSimulator
            ? 'UnifiedSimulatorView'
            : 'CanonicalPresentationPage';

  // ── Welcome page — choose a view ──────────────────────────────────────────
  if (viewMode === null) {
    return (
      <div className="portal-page" data-testid="customer-portal">
        {showDevTraceLabels ? (
          <aside data-testid="portal-route-trace-labels">
            <p>currentPortalRoute: {currentPortalRoute}</p>
            <p>selectedPortalMode: {selectedPortalMode}</p>
            <p>activeRendererComponent: {activeRendererComponent}</p>
          </aside>
        ) : null}
        <header className="portal-page__hero" data-testid="portal-hero">
          <BrandedHeader />
          <div className="portal-hero__brand-row">
            <span className="portal-page__brand" aria-hidden="true"></span>
            {postcode && <span className="portal-page__postcode">{postcode}</span>}
          </div>
        </header>

        <div className="portal-welcome" data-testid="portal-welcome">
          <h1 className="portal-welcome__heading">Your Home Heating Recommendation</h1>
          <p className="portal-welcome__intro">
            Choose how you would like to explore your results:
          </p>
          <div className="portal-welcome__cards">
            <button
              type="button"
              className="portal-welcome__card"
              onClick={() => setViewMode('insight')}
              data-testid="portal-welcome-insight"
            >
              <span className="portal-welcome__card-icon" aria-hidden="true">📋</span>
              <span className="portal-welcome__card-title">Insight Overview</span>
              <span className="portal-welcome__card-desc">
                A clear, structured summary of your home, the options considered, and
                the evidence behind the recommendation — ideal for reviewing at your
                own pace.
              </span>
            </button>

            <button
              type="button"
              className="portal-welcome__card portal-welcome__card--primary"
              onClick={() => setViewMode('presentation')}
              data-testid="portal-welcome-presentation"
            >
              <span className="portal-welcome__card-icon" aria-hidden="true">🎯</span>
              <span className="portal-welcome__card-title">In-Room Presentation</span>
              <span className="portal-welcome__card-desc">
                The same slide-by-slide view shown during your survey visit — swipe
                through each page and explore the interactive simulator.
              </span>
            </button>
          </div>
        </div>

        <BrandedFooter footerNote={ctaCopy.portalCta} />
      </div>
    );
  }

  // ── Insight Pack view ─────────────────────────────────────────────────────
  if (viewMode === 'insight') {
    const surveyContext: InsightPackSurveyContext = {
      currentBoiler: engineInput.currentSystem?.boiler,
      occupancyCount: engineInput.occupancyCount,
      bathroomCount: engineInput.bathroomCount,
      peakConcurrentOutlets: engineInput.peakConcurrentOutlets,
      mainsDynamicFlowLpm: engineInput.mainsDynamicFlowLpm,
      heatLossWatts: engineInput.heatLossWatts,
    };
    // Include quotes entered during the survey so the customer pack reflects the
    // real contractor options and the recommendation is tied to a specific quote.
    const surveyQuotes = surveyData?.fullSurvey?.quotes ?? [];
    const pack = buildInsightPackFromEngine(
      engineResult.engineOutput,
      surveyQuotes,
      surveyContext,
      portalData?.decision ?? undefined,
      portalData?.scenarios ?? undefined,
    );

    return (
      <div className="portal-page portal-page--full-width" data-testid="customer-portal">
        {showDevTraceLabels ? (
          <aside data-testid="portal-route-trace-labels">
            <p>currentPortalRoute: {currentPortalRoute}</p>
            <p>selectedPortalMode: {selectedPortalMode}</p>
            <p>activeRendererComponent: {activeRendererComponent}</p>
          </aside>
        ) : null}
        <div className="portal-back-row">
          <button
            type="button"
            className="back-btn"
            onClick={() => setViewMode(null)}
          >
            ← Back to choices
          </button>
        </div>
        <InsightPackDeck
          pack={pack}
          propertyTitle={postcode ?? undefined}
          onClose={() => setViewMode(null)}
          librarySectionData={libraryPortalIntegration ?? undefined}
          showDevTraceLabels={showDevTraceLabels}
        />
        <BrandedFooter footerNote={ctaCopy.printFooterNote} />
      </div>
    );
  }

  // ── Five-tab portal view — opened via deck CTA ────────────────────────────
  if (viewMode === 'portal') {
    return (
      <div className="portal-page portal-page--full-width" data-testid="customer-portal">
        {showDevTraceLabels ? (
          <aside data-testid="portal-route-trace-labels">
            <p>currentPortalRoute: {currentPortalRoute}</p>
            <p>selectedPortalMode: {selectedPortalMode}</p>
            <p>activeRendererComponent: {activeRendererComponent}</p>
          </aside>
        ) : null}
        <div className="portal-back-row">
          <button
            type="button"
            className="back-btn"
            onClick={() => { setViewMode('presentation'); setShowSimulator(false); }}
          >
            ← Back to presentation
          </button>
        </div>
        {portalViewModel ? (
          <PortalPage
            viewModel={portalViewModel}
            propertyTitle={postcode ?? undefined}
            initialTab={portalLaunchContext?.initialTab}
            portalUrl={typeof window !== 'undefined' ? window.location.href : undefined}
            aiSummaryText={aiSummaryText}
            aiSummaryFilename={aiSummaryFilename}
          />
        ) : (
          <div className="portal-page__error" role="alert" data-testid="portal-view-error">
            <p className="portal-page__error-headline">Portal not available</p>
            <p className="portal-page__error-detail">Your portal could not be assembled from the available data.</p>
          </div>
        )}
        <BrandedFooter footerNote={ctaCopy.printFooterNote} />
      </div>
    );
  }

  // ── Presentation view (deck) ──────────────────────────────────────────────
  return (
    <div className="portal-page" data-testid="customer-portal">
      {showDevTraceLabels ? (
        <aside data-testid="portal-route-trace-labels">
          <p>currentPortalRoute: {currentPortalRoute}</p>
          <p>selectedPortalMode: {selectedPortalMode}</p>
          <p>activeRendererComponent: {activeRendererComponent}</p>
        </aside>
      ) : null}

      {/* ── Minimal portal header (brand + postcode only) ─────────────────── */}
      <header className="portal-page__hero" data-testid="portal-hero">
        <BrandedHeader />
        <div className="portal-hero__brand-row">
          <span className="portal-page__brand" aria-hidden="true"></span>
          {postcode && <span className="portal-page__postcode">{postcode}</span>}
        </div>
        <div className="portal-back-row">
          <button
            type="button"
            className="back-btn"
            onClick={() => setViewMode(null)}
          >
            ← Back to choices
          </button>
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
          onOpenPortal={portalViewModel?.verdictData.comparisonCards[0]?.scenarioId ? handleOpenPortal : undefined}
          deckMode
          lockedSummary={lockedSummary}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <BrandedFooter footerNote={ctaCopy.printFooterNote} />
    </div>
  );
}

// ─── Public default export ────────────────────────────────────────────────────

/**
 * CustomerPortalPage
 *
 * Wraps the portal content with the resolved brand profile so all descendant
 * components (BrandedHeader, BrandedFooter, etc.) can consume it via
 * useBrandProfile().
 */
export default function CustomerPortalPage({ brandId, ...rest }: Props) {
  return (
    <BrandProvider brandId={brandId}>
      <CustomerPortalContent {...rest} />
    </BrandProvider>
  );
}
