/**
 * CustomerPortalPage.tsx
 *
 * Customer portal — phone-first portal shell for customer follow-up.
 * Accessible via a signed portal link sent after the survey visit.
 *
 * Production route behavior:
 *   - Renders the curated customer journey shell directly.
 *   - Never renders the in-room CanonicalPresentationPage.
 *   - Keeps simulator access through portal-native CTA/panels.
 *
 * Dev fixture behavior:
 *   - Optional presentation/insight preview modes remain available for QA.
 */

import { useEffect, useMemo, useState } from 'react';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport } from '../../lib/reports/reportApi';
import { validatePortalToken } from '../../lib/portal/portalToken';
import { BrandProvider, BrandedHeader, BrandedFooter, getBrandCtaCopy, useBrandProfile } from '../../features/branding';
import HouseSimulatorPage from '../../features/houseSimulator/HouseSimulatorPage';
import { readCanonicalReportPayload } from '../../features/reports/adapters/readCanonicalReportPayload';
import { runEngine } from '../../engine/Engine';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import CanonicalPresentationPage from '../presentation/CanonicalPresentationPage';
import { buildPortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { buildVisualBlocks } from '../../engine/modules/buildVisualBlocks';
import { buildDecisionFromScenarios } from '../../engine/modules/buildDecisionFromScenarios';
import { buildScenariosFromEngineOutput } from '../../engine/modules/buildScenariosFromEngineOutput';
import { buildCustomerSummary } from '../../engine/modules/buildCustomerSummary';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';
import { resolvePortalHomeLabel } from '../../lib/portal/portalVisitContext';
import { ReadingPreferencesLauncher } from '../../accessibility/readingPreferences/ReadingPreferencesLauncher';
import { ReadingAssistOverlay } from '../../accessibility/readingAssist/ReadingAssistOverlay';
import { PersistentJourneyHeader } from './PersistentJourneyHeader';
import { buildCustomerSafeAiFallback } from '../../ai/buildCustomerSafeAiFallback';
import { CustomerSceneDeck, buildCustomerPresentationScenes } from '../../library/customerPresentation';
import {
  buildCustomerJourneyPack,
  inferCustomerJourneyTypeFromSystemContext,
  type CustomerJourneyPackV1,
} from '../../library/portal/pdf/buildPortalJourneyPrintModel';
import './CustomerPortalPage.css';

interface Props {
  reference: string;
  token?: string;
  brandId?: string;
  /** Override for tests to force-hide/show development route labels. */
  showDevTraceLabelsOverride?: boolean;
  /**
   * Dev-only: when provided, bypasses the API/token fetch and runs the engine
   * directly with this input. Used exclusively by DevPortalFixturePage.
   * Must never be set on customer-facing portal routes.
   */
  devFixtureInput?: EngineInputV2_3;
  /**
   * Dev-only: production-like preview input.
   * Runs the canonical portal shell without fixture-mode renderer toggles.
   */
  productionPreviewInput?: EngineInputV2_3;
  /**
   * Optional packaged CustomerJourneyPackV1 to use in the portal journey.
   * When provided with productionPreviewInput, passes the pack to
   * CustomerPortalJourneyComposer so portal content matches the exported package.
   */
  productionPreviewCustomerJourneyPack?: CustomerJourneyPackV1;
  /**
   * Dev-only: when set, skips the choice screen and opens the portal directly
   * in the given view mode. Only respected when devFixtureInput is also set.
   */
  devInitialViewMode?: 'insight' | 'presentation';
  /** Optional personal-data-light visit context for tests/dev preview. */
  portalVisitContextOverride?: Partial<PortalVisitContextV1>;
}

type PortalViewMode = null | 'insight' | 'presentation' | 'portal';
export const CUSTOMER_PORTAL_PHONE_MEDIA_QUERY = '(max-width: 768px)';
export const LEGACY_PORTAL_RENDERER_LEAK_BANNER = 'LEGACY PORTAL RENDERER LEAK DETECTED';

function isPhoneViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(CUSTOMER_PORTAL_PHONE_MEDIA_QUERY).matches;
}

export function assertNoLegacyPresentationRenderer({
  isProductionPortalSurface,
  selectedPortalMode,
  activeRendererComponent,
}: {
  isProductionPortalSurface: boolean;
  selectedPortalMode: string;
  activeRendererComponent: string;
}): { leakDetected: boolean; message: string } {
  const leakDetected = isProductionPortalSurface
    && (selectedPortalMode !== 'portal' || activeRendererComponent !== 'CustomerSceneDeck');
  return {
    leakDetected,
    message: LEGACY_PORTAL_RENDERER_LEAK_BANNER,
  };
}

function PortalHeroShell({ portalHomeLabel }: { portalHomeLabel: string }) {
  return (
    <header className="portal-page__hero" data-testid="portal-hero">
      <BrandedHeader />
      <div className="portal-hero__brand-row">
        <span className="portal-page__brand" aria-hidden="true"></span>
        <span className="portal-page__postcode">{portalHomeLabel}</span>
      </div>
    </header>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function CustomerPortalContent({
  reference,
  token,
  showDevTraceLabelsOverride,
  devFixtureInput,
  productionPreviewInput,
  productionPreviewCustomerJourneyPack,
  devInitialViewMode,
  portalVisitContextOverride,
}: Omit<Props, 'brandId'>) {
  const brand = useBrandProfile();
  const ctaCopy = getBrandCtaCopy(brand);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenDenied, setTokenDenied] = useState<'missing' | 'invalid' | 'expired' | null>(null);
  const [engineResult, setEngineResult] = useState<FullEngineResult | null>(null);
  const [engineInput, setEngineInput] = useState<EngineInputV2_3 | null>(null);
  // surveyData is kept for the inline simulator.
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const isDevFixtureMode = Boolean(devFixtureInput);
  // Production and production-like preview surfaces must stay on canonical portal renderer.
  const isProductionPortalSurface = !isDevFixtureMode;
  function computeInitialPortalViewMode(): PortalViewMode {
    if (!isDevFixtureMode) return 'portal';
    if (devInitialViewMode) return devInitialViewMode;
    return isPhoneViewport() ? 'presentation' : null;
  }
  const defaultPortalViewMode: PortalViewMode = computeInitialPortalViewMode();
  // Welcome page: null = show welcome, 'insight' = insight pack, 'presentation' = deck, 'portal' = five-tab portal
  const [viewMode, setViewMode] = useState<PortalViewMode>(defaultPortalViewMode);
  // Launch context received from the deck CTA — drives the initial tab of the portal.
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

  const portalHomeLabel = useMemo(
    () => resolvePortalHomeLabel(portalVisitContextOverride),
    [portalVisitContextOverride],
  );
  const recommendationTitle = lockedSummary?.recommendedSystemLabel
    ?? portalViewModel?.verdictData.comparisonCards[0]?.title
    ?? 'Your recommendation';
  const recommendationSummary = lockedSummary?.headline
    ?? portalViewModel?.verdictData.comparisonCards[0]?.summary;
  const customerJourneyPack = useMemo(() => {
    if (productionPreviewCustomerJourneyPack != null) return productionPreviewCustomerJourneyPack;
    if (!portalData) return null;
    const recommendedScenario = portalData.scenarios.find(
      (scenario) => scenario.scenarioId === portalData.decision.recommendedScenarioId,
    );
    const journeyType = inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: portalData.engineInput.currentHeatSourceType,
      currentSystemHeatingType: portalData.engineInput.currentSystem?.heatingSystemType,
      dhwStorageType: portalData.engineInput.dhwStorageType,
      recommendedScenarioType: recommendedScenario?.system.type,
      recommendedScenarioId: recommendedScenario?.scenarioId,
    });
    return buildCustomerJourneyPack({
      journeyType,
      recommendationSummary: recommendationSummary ?? recommendationTitle,
      customerFacts: [
        `${portalData.engineInput.occupancyCount ?? 0} people in the home`,
        `${portalData.engineInput.bathroomCount} bathroom${portalData.engineInput.bathroomCount === 1 ? '' : 's'}`,
        `Property: ${portalHomeLabel}`,
      ],
    });
  }, [
    portalData,
    productionPreviewCustomerJourneyPack,
    recommendationSummary,
    recommendationTitle,
    portalHomeLabel,
  ]);
  const customerPresentationScenes = useMemo(
    () => buildCustomerPresentationScenes(customerJourneyPack?.staticPdf.sections ?? [], {
      recommendationReasons: customerJourneyPack?.staticPdf.recommendationReasons,
    }),
    [customerJourneyPack],
  );

  useEffect(() => {
    // Dev fixture bypass: skip API and token validation when devFixtureInput is provided.
    // This path is exclusive to DevPortalFixturePage and must never be triggered
    // on real customer portal routes.
    if (devFixtureInput) {
      try {
        const result = runEngine(devFixtureInput);
        setEngineInput(devFixtureInput);
        setEngineResult(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (productionPreviewInput) {
      try {
        const result = runEngine(productionPreviewInput);
        setEngineInput(productionPreviewInput);
        setEngineResult(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }

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
        }
      } catch (err: unknown) {
        console.error('CustomerPortalPage load failed', err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPortal();
    return () => { cancelled = true; };
  }, [reference, token, devFixtureInput, productionPreviewInput]);

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
    const aiFallback = buildCustomerSafeAiFallback();
    const safeDetail = isNotFound
      ? 'Please contact your installer if you expected a portal link for this visit.'
      : /gemini|api error|generation failed|models\/gemini/i.test(error ?? '')
        ? `${aiFallback.headline} ${aiFallback.supportingText}`
        : 'The recommendation is temporarily unavailable. Please try again later or contact your installer.';
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-error" data-reading-region="true">
        <p className="portal-page__error-headline">{isNotFound ? 'Recommendation not found' : 'Could not load your recommendation'}</p>
        <p className="portal-page__error-detail">{safeDetail}</p>
      </div>
    );
  }

  // ── Callback: deck CTA opens the five-tab portal surface ─────────────────
  function handleOpenPortal() {
    const recommendedScenarioId = portalViewModel?.verdictData.comparisonCards[0]?.scenarioId;
    if (!recommendedScenarioId) return; // guard: no valid scenario — do not open a degenerate portal
    setViewMode('portal');
  }

  const effectiveViewMode: PortalViewMode = isProductionPortalSurface ? 'portal' : viewMode;
  const currentPortalRoute =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/portal/${reference}`;
  const selectedPortalMode = effectiveViewMode ?? 'choice';
  const activeRendererComponent =
    effectiveViewMode === null
      ? 'PortalChoiceScreen'
      : effectiveViewMode === 'insight'
        ? 'CustomerSceneDeck'
        : effectiveViewMode === 'portal'
          ? 'CustomerSceneDeck'
          : showSimulator
            ? 'UnifiedSimulatorView'
            : 'CanonicalPresentationPage';
  const legacyRendererAssertion = assertNoLegacyPresentationRenderer({
    isProductionPortalSurface,
    selectedPortalMode,
    activeRendererComponent,
  });
  const showLegacyLeakBanner = showDevTraceLabels && legacyRendererAssertion.leakDetected;
  function renderPortalViewError() {
    return (
      <div className="portal-page__error" role="alert" data-testid="portal-view-error">
        <p className="portal-page__error-headline">Portal not available</p>
        <p className="portal-page__error-detail">Your portal could not be assembled from the available data. Please contact your installer if this keeps happening.</p>
      </div>
    );
  }

  function renderPortalJourney() {
    if (!portalViewModel || !portalData || !engineResult || customerPresentationScenes.length === 0) {
      return renderPortalViewError();
    }

    return (
      <CustomerSceneDeck scenes={customerPresentationScenes} />
    );
  }

  // ── Welcome page — choose a view ──────────────────────────────────────────
  if (effectiveViewMode === null && isDevFixtureMode) {
    return (
      <div className="portal-page atlas-reading-surface" data-testid="customer-portal">
        <ReadingAssistOverlay />
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
            <span className="portal-page__postcode">{portalHomeLabel}</span>
            <div className="portal-header-actions">
              <ReadingPreferencesLauncher />
            </div>
          </div>
        </header>

        <div className="portal-welcome" data-testid="portal-welcome" data-reading-region="true">
          <PersistentJourneyHeader
            propertyTitle={portalHomeLabel}
            recommendationTitle={recommendationTitle}
            summary={recommendationSummary}
            surfaceLabel="Welcome"
            headingLevel={1}
          />
          <h1 className="portal-welcome__heading">Your Home Heating Recommendation</h1>
          <p className="portal-welcome__intro">
            Choose how you would like to explore your results:
          </p>
          <div className="portal-welcome__cards">
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
  if (effectiveViewMode === 'insight' && isDevFixtureMode) {
    return (
      <div className="portal-page portal-page--full-width atlas-reading-surface" data-testid="customer-portal">
        <ReadingAssistOverlay />
        {showDevTraceLabels ? (
          <aside data-testid="portal-route-trace-labels">
            <p>currentPortalRoute: {currentPortalRoute}</p>
            <p>selectedPortalMode: {selectedPortalMode}</p>
            <p>activeRendererComponent: {activeRendererComponent}</p>
          </aside>
        ) : null}
        <PersistentJourneyHeader
          propertyTitle={portalHomeLabel}
          recommendationTitle={recommendationTitle}
          summary={recommendationSummary}
          surfaceLabel="Scenes"
        />
        <div className="portal-back-row">
          <button
            type="button"
            className="back-btn"
            onClick={() => setViewMode(null)}
          >
            ← Back to choices
          </button>
        </div>
        <CustomerSceneDeck scenes={customerPresentationScenes} />
        <BrandedFooter footerNote={ctaCopy.printFooterNote} />
      </div>
    );
  }

  // ── Five-tab portal view — opened via deck CTA ────────────────────────────
  if (effectiveViewMode === 'portal') {
    return (
      <div className="portal-page portal-page--full-width atlas-reading-surface" data-testid="portal-page">
        <ReadingAssistOverlay />
        {showDevTraceLabels ? (
          <aside data-testid="portal-route-trace-labels">
            <p>currentPortalRoute: {currentPortalRoute}</p>
            <p>selectedPortalMode: {selectedPortalMode}</p>
            <p>activeRendererComponent: {activeRendererComponent}</p>
          </aside>
        ) : null}
        {showLegacyLeakBanner ? (
          <aside className="portal-page__error" role="alert" data-testid="portal-legacy-renderer-leak-banner">
            <p className="portal-page__error-headline">{legacyRendererAssertion.message}</p>
          </aside>
        ) : null}
        <PortalHeroShell portalHomeLabel={portalHomeLabel} />
        <div className="portal-back-row portal-back-row--with-actions">
          {isDevFixtureMode ? (
            <button
              type="button"
              className="back-btn"
              onClick={() => { setViewMode('presentation'); setShowSimulator(false); }}
            >
              ← Back to presentation
            </button>
          ) : null}
          <div className="portal-header-actions">
            <ReadingPreferencesLauncher />
          </div>
        </div>
        {renderPortalJourney()}
        <BrandedFooter footerNote={ctaCopy.printFooterNote} />
      </div>
    );
  }

  // ── Presentation view (deck) ──────────────────────────────────────────────
  if (isDevFixtureMode) {
    return (
    <div className="portal-page atlas-reading-surface" data-testid="customer-portal">
      <ReadingAssistOverlay />
      {showDevTraceLabels ? (
        <aside data-testid="portal-route-trace-labels">
          <p>currentPortalRoute: {currentPortalRoute}</p>
          <p>selectedPortalMode: {selectedPortalMode}</p>
          <p>activeRendererComponent: {activeRendererComponent}</p>
        </aside>
      ) : null}

      {/* ── Minimal portal header (brand + safe visit label only) ─────────── */}
      <header className="portal-page__hero" data-testid="portal-hero">
        <BrandedHeader />
        <div className="portal-hero__brand-row">
          <span className="portal-page__brand" aria-hidden="true"></span>
          <span className="portal-page__postcode">{portalHomeLabel}</span>
          <div className="portal-header-actions">
            <ReadingPreferencesLauncher />
          </div>
        </div>
        <PersistentJourneyHeader
          propertyTitle={portalHomeLabel}
          recommendationTitle={recommendationTitle}
          summary={recommendationSummary}
          surfaceLabel="Presentation"
        />
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
          data-reading-region="true"
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
          <HouseSimulatorPage
            onBack={() => setShowSimulator(false)}
            surveyData={surveyData}
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

  return (
    <div className="portal-page portal-page--full-width atlas-reading-surface" data-testid="portal-page">
      <ReadingAssistOverlay />
      {showDevTraceLabels ? (
        <aside data-testid="portal-route-trace-labels">
          <p>currentPortalRoute: {currentPortalRoute}</p>
          <p>selectedPortalMode: {selectedPortalMode}</p>
          <p>activeRendererComponent: {activeRendererComponent}</p>
        </aside>
      ) : null}
      {showLegacyLeakBanner ? (
        <aside className="portal-page__error" role="alert" data-testid="portal-legacy-renderer-leak-banner">
          <p className="portal-page__error-headline">{legacyRendererAssertion.message}</p>
        </aside>
      ) : null}
      <PortalHeroShell portalHomeLabel={portalHomeLabel} />
      {renderPortalJourney()}
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
