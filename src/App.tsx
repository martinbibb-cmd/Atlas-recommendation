import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import FastChoiceStepper from './components/stepper/FastChoiceStepper';
import FullSurveyStepper from './components/stepper/FullSurveyStepper';
import Footer from './components/Footer';
import ScopePage from './components/governance/ScopePage';
import MethodologyPage from './components/governance/MethodologyPage';
import NeutralityPage from './components/governance/NeutralityPage';
import PrivacyPage from './components/governance/PrivacyPage';
import ReportView from './components/report/ReportView';
import ExplainersHubPage from './explainers/ExplainersHubPage';
import LabShell from './components/lab/LabShell';
import LabQuickInputsPanel from './components/lab/LabQuickInputsPanel';
import LabPrintCustomer from './components/lab/LabPrintCustomer';
import LabPrintTechnical from './components/lab/LabPrintTechnical';
import LabPrintComparison from './components/lab/LabPrintComparison';
import CustomerRecommendationPrint from './components/print/CustomerRecommendationPrint';
import { CustomerAdvicePrintPack } from './components/print/CustomerAdvicePrintPack';
import { buildScenariosFromEngineOutput } from './engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from './engine/modules/buildDecisionFromScenarios';
import { buildVisualBlocks } from './engine/modules/buildVisualBlocks';
import { buildCustomerSummary } from './engine/modules/buildCustomerSummary';

import FloorPlanBuilder from './components/floorplan/FloorPlanBuilder';
import LegoBuildingSetPage from './explainers/lego/LegoBuildingSetPage';
import HeatLossCalculator from './components/heatloss/HeatLossCalculator';
import BuildingHeightCheck from './components/measurements/BuildingHeightCheck';
import AtlasExplorerPage from './components/explorer/AtlasExplorerPage';
import VisitPage from './components/visit/VisitPage';
import VisitHubPage from './components/visit/VisitHubPage';
import RecentVisitsList from './components/visit/RecentVisitsList';
import EngineerPreinstallPage from './components/engineer/EngineerPreinstallPage';
import { SpatialTwinPage } from './features/spatialTwin/routes/SpatialTwinPage';
import ReportPage from './components/reportpage/ReportPage';
import CustomerPortalPage from './components/portal/CustomerPortalPage';
import GlobalMenuShell from './components/shell/GlobalMenuShell';

import { getVisit } from './lib/visits/visitApi';
import { VisitProvider } from './features/visits/VisitProvider';
import { createAtlasVisit } from './features/visits/createAtlasVisit';
import type { AtlasVisit } from './features/visits/createAtlasVisit';
import { retrieveActiveVisit, storeActiveVisit } from './features/visits/visitStore';
import { BrandProvider } from './features/branding/BrandProvider';
import { StartVisitPanel } from './features/visits/StartVisitPanel';
import { DEFAULT_BRAND_ID } from './features/branding/brandProfiles';
import { TenantSettingsPage } from './features/tenants/TenantSettingsPage';
import { TenantOnboardingPage } from './features/tenants/TenantOnboardingPage';
import { useWorkspaceFromHost } from './features/tenants/useWorkspaceFromHost';
import { listReportsForVisit, saveReport } from './lib/reports/reportApi';
import { generateReportTitle } from './lib/reports/generateReportTitle';
import { generatePortalToken } from './lib/portal/portalToken';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from './ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from './ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from './ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from './engine/Engine';
import { buildCanonicalReportPayload } from './features/reports/adapters/buildCanonicalReportPayload';
import { getMissingLabFields } from './lib/lab/getMissingLabFields';
import { mergeLabQuickInputs } from './lib/lab/mergeLabQuickInputs';
import { parsePortalPath } from './lib/portal/portalUrl';
import type { DerivedFloorplanOutput } from './components/floorplan/floorplanDerivations';
import CanonicalPresentationPage from './components/presentation/CanonicalPresentationPage';
import type { HeatLossState } from './features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState } from './features/survey/priorities/prioritiesTypes';
import type { RecommendationState } from './features/survey/recommendation/recommendationTypes';
import type { ApplianceFamily } from './engine/topology/SystemTopology';
import { buildPortalUrl } from './lib/portal/portalUrl';
import PhysicsVisualGallery from './components/physics-visuals/preview/PhysicsVisualGallery';
import PresentationAuditPage from './components/audit/PresentationAuditPage';
import DevMenuPage from './components/dev/DevMenuPage';
import ScanImportHarness from './features/scanImport/dev/ScanImportHarness';
import ScanPackageImportFlow from './features/scanImport/ui/ScanPackageImportFlow';
import ReceiveScanPage from './features/scanImport/ui/ReceiveScanPage';
import ScanSessionListPage from './features/scanImport/ui/ScanSessionListPage';
import { ScanHandoffReceivePage } from './features/scanHandoff';
import { resetDemoData, DEMO_VISIT_IDS } from './dev/demoSeed';
import WorkspaceHomePage from './features/workspace/WorkspaceHomePage';
import WorkspaceDetailPage from './features/workspace/WorkspaceDetailPage';
import WorkspaceDashboard from './features/workspace/WorkspaceDashboard';
import HandoffArrivalPage from './components/handoff/HandoffArrivalPage';
import VisitHandoffReviewPage from './features/visitHandoff/components/VisitHandoffReviewPage';
import CustomerSummaryPrintPage from './features/visitHandoff/components/CustomerSummaryPrintPage';
import EngineerSummaryPrintPage from './features/visitHandoff/components/EngineerSummaryPrintPage';
import { SAMPLE_VISIT_HANDOFF_PACK } from './features/visitHandoff/fixtures/sampleVisitHandoffPack';
import { buildHandoffPackFromSurvey } from './features/visitHandoff/parser/buildHandoffPackFromSurvey';
import InsightPackDeck from './features/insightPack/InsightPackDeck';
import VisitDetailView from './features/scanImport/ui/VisitDetailView';
import { buildInsightPackFromEngine } from './features/insightPack/buildInsightPackFromEngine';
import type { InsightPackSurveyContext } from './features/insightPack/buildInsightPackFromEngine';
import type { QuoteInput } from './features/insightPack/insightPack.types';
import type { LifecycleBoilerType } from './contracts/LifecycleAssessment';
import {
  writeVersionedCache,
  readVersionedCache,
} from './lib/storage/versionedCache';
import {
  clearAtlasCache,
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_SCHEMA_VERSION,
} from './lib/storage/atlasCacheKeys';
import { trackVisitCompleted } from './features/analytics/analyticsTracker';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import { ExternalVisitManifestPanel } from './features/externalFiles/ExternalVisitManifestPanel';
import { ActiveUserProvider } from './features/userProfiles/ActiveUserProvider';
import { useActiveUser } from './features/userProfiles/useActiveUser';
import { useRolePermissions } from './features/userProfiles/useRolePermissions';
import { UserProfilePanel } from './features/userProfiles/UserProfilePanel';
import { SpecificationErrorBoundary } from './features/installationSpecification/ui/SpecificationErrorBoundary';
import { buildCurrentInstallationSummaryFromCanonicalSurvey } from './features/installationSpecification/model/buildCurrentInstallationSummaryFromCanonicalSurvey';
import type { CanonicalCurrentSystemSummary } from './features/installationSpecification/ui/installationSpecificationUiTypes';
import type { InstallationSpecificationOptionV1 } from './features/installationSpecification/model/QuoteInstallationPlanV1';

// Lazy-load InstallationSpecificationPage so that any runtime crash during import
// or render is caught by SpecificationErrorBoundary rather than blanking the app.
const InstallationSpecificationPage = lazy(() =>
  import('./features/installationSpecification/ui/InstallationSpecificationPage').then(
    (m) => ({ default: m.InstallationSpecificationPage }),
  ),
);

// Visible fallback shown while InstallationSpecificationPage is loading.
const specificationLoadingFallback = (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
    Loading specification…
  </div>
);
import './App.css';

/**
 * Maps a broad heat-source family (including 'ashp' / 'other' which are not
 * valid LifecycleBoilerType values) to the nearest lifecycle-compatible type.
 * Falls back to 'regular' for anything that isn't a gas boiler variant.
 */
function toLifecycleBoilerType(
  value: 'combi' | 'system' | 'regular' | 'ashp' | 'other' | undefined,
): LifecycleBoilerType {
  if (value === 'combi' || value === 'system' || value === 'regular') {
    return value;
  }
  return 'regular';
}

/** Detect ?devmenu=1 — renders the developer component browser on the landing page. */
const DEV_MENU_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('devmenu') === '1';

/** Detect ?lab=1 feature flag — renders Demo Lab directly for previewing. */
const LAB_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('lab') === '1';

/**
 * Detect ?print=<view> — renders a dedicated print layout directly.
 * Supported values: 'customer' | 'technical' | 'comparison'
 */
const PRINT_VIEW =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('print')
    : null;

/**
 * Detect ?report=1 — renders the unified ReportView with demo engine output.
 * This is the single entry point for the print pipeline.
 */
const REPORT_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('report') === '1';

/**
 * Detect ?presentation=1 — renders CanonicalPresentationPage directly with demo data.
 * Useful for in-room demo and development.
 */
const PRESENTATION_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('presentation') === '1';

/**
 * Detect ?deck=1 — renders the swipeable PresentationDeck directly with demo data.
 * Use alongside ?presentation=1 or standalone to preview the deck experience.
 */
const DECK_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('deck') === '1';

/**
 * Detect ?gallery=1 — renders the Physics Visual Library gallery directly.
 * Developer/review surface for previewing animation components.
 */
const GALLERY_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('gallery') === '1';

/**
 * Detect ?audit=1 — renders the Presentation Audit Page directly.
 * Developer/review surface for inspecting all golden scenarios and rule violations.
 */
const AUDIT_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('audit') === '1';

/**
 * Detect ?atlas-capture=1 — renders the on-device capture view (VisitDetailView)
 * for building a SessionCaptureV2 capture session directly in the browser.
 * This is the primary entry point for the SessionCaptureV2 visit flow.
 */
const ATLAS_CAPTURE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('atlas-capture') === '1';

/**
 * Detect ?scan-import=1 — renders the Scan Import Dev Harness directly.
 * Developer/review surface for testing scan bundle ingestion.
 * Not visible in production UX.
 */
const SCAN_IMPORT_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('scan-import') === '1';

/**
 * Detect ?scan-package=1 — renders the Atlas Scan package import flow.
 * Production import UI for ingesting Atlas Scan export packages.
 */
const SCAN_PACKAGE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('scan-package') === '1';

/**
 * Detect ?receive-scan=1 — renders the Web Share Target receive page.
 * Set by the service worker after it stores a shared scan file in IndexedDB.
 */
const RECEIVE_SCAN_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('receive-scan') === '1';

/**
 * Detect ?my-scans=1 — renders the My Scans management page.
 * Lists all scan sessions (local IDB + server) for the engineer.
 */
const MY_SCANS_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('my-scans') === '1';

/**
 * Detect ?handoff=1 — renders the canonical AtlasPropertyV1 handoff arrival page.
 * Entry point for post-handoff arrival flow from Atlas Scan.
 * Not visible in production UX.
 */
const HANDOFF_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('handoff') === '1';

/**
 * Detect ?visitId=<id> — opens the visit-hub for the given visit ID on load.
 *
 * Used by Atlas Scan iOS (and other handoff sources) to open a specific visit
 * directly when launching Atlas Mind.  Takes precedence over cached session
 * state but yields to URL-mode routes (ENGINEER_VISIT_ID, INITIAL_REPORT_ID,
 * SCAN_PACKAGE_ENABLED, RECEIVE_SCAN_ENABLED, etc.) which render before the
 * main App state machine is reached.
 *
 * Examples:
 *   /?visitId=visit_abc123          — open visit-hub for that visit
 *   /?scan-package=1&visitId=xyz    — import scan, then return to that visit
 */
const INITIAL_VISIT_ID_PARAM =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('visitId')
    : null;

/**
 * Detect ?visit-handoff=1 — renders the completed-visit handoff review page.
 * Shows customer and engineer read-only review surfaces from a VisitHandoffPack.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const VISIT_HANDOFF_REVIEW_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('visit-handoff') === '1';

/**
 * Detect ?customer-share=1 — renders the customer-safe printable summary from a
 * VisitHandoffPack.  This is the shareable, print-first customer output.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const CUSTOMER_SHARE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('customer-share') === '1';

/**
 * Detect ?engineer-share=1 — renders the engineer-facing compact install-prep
 * handoff page from a VisitHandoffPack.  Dense, print-first, read-only.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const ENGINEER_SHARE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('engineer-share') === '1';

/**
 * Detect ?insight-pack=1 — renders the Atlas Insight Pack deck with demo data.
 * Developer/review surface for previewing the 11-screen customer recommendation deck.
 */
const INSIGHT_PACK_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('insight-pack') === '1';

/**
 * Detect ?internal=1 — renders the internal/diagnostic CustomerRecommendationPrint
 * instead of the new CustomerAdvicePrintPack.  This is a dev-only route; it must
 * not be reachable as the default customer print output.
 */
const INTERNAL_PRINT_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('internal') === '1';

/**
 * Detect ?brand-settings=1 — renders the Workspace Branding settings page.
 * Allows an installer/workspace admin to edit their Atlas brand locally.
 */
const BRAND_SETTINGS_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('brand-settings') === '1';

/**
 * Detect ?create-workspace=1 — renders the Workspace Onboarding page.
 * Allows a product customer to create a new Atlas workspace from the UI.
 */
const CREATE_WORKSPACE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('create-workspace') === '1';

/**
 * Detect ?cacheBust=1 — clears all Atlas-owned localStorage keys and reloads
 * the app cleanly.  Useful for support / debugging when local state becomes stale.
 * The reload removes the query param from the URL so it does not loop.
 */
if (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('cacheBust') === '1'
) {
  clearAtlasCache();
  console.info('[Atlas] Cache busted — all Atlas local state cleared.');
  // Remove ?cacheBust=1 so the page does not loop.
  const cleanUrl = window.location.pathname + window.location.hash;
  window.location.replace(cleanUrl);
}

/** Demo quotes used by ?insight-pack=1 mode. */
const DEMO_QUOTES: QuoteInput[] = [
  {
    id: 'quote_a',
    label: 'Quote A — ABC Heating',
    systemType: 'system',
    heatSourceKw: 30,
    cylinder: { type: 'mixergy', volumeL: 210 },
    includedUpgrades: ['powerflush', 'filter', 'controls'],
  },
  {
    id: 'quote_b',
    label: 'Quote B — XYZ Plumbing',
    systemType: 'combi',
    heatSourceKw: 35,
    includedUpgrades: ['filter'],
  },
];

/**
 * Demo engine input used by the report mode (?report=1) and presentation demo (?presentation=1).
 * Produces a realistic UK combi scenario for demonstration:
 *   - 3-bed semi, 3 occupants, 1 bathroom, standard mains pressure
 *   - Combi boiler (current) with high heat loss — the "struggling combi" scenario
 */
const CONSOLE_DEMO_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
};

type Journey = 'landing' | 'workspace-dashboard' | 'visit-hub' | 'visit' | 'visit-handoff' | 'fast' | 'remote-survey' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab' | 'lab-quick-inputs' | 'simulator' | 'floor-plan' | 'heat-loss' | 'building-height' | 'explorer' | 'report' | 'presentation' | 'gallery' | 'dev-menu' | 'lego-set' | 'printout' | 'framework-print' | 'engineer' | 'insight-pack' | 'receive-scan' | 'external-files' | 'user-profile' | 'installation-specification';

const FLOOR_PLAN_TOOL_MODE =
  typeof window !== 'undefined' && window.location.pathname === '/floor-plan-tool';

/** Detect /report/:id path — renders a saved report by ID. */
const REPORT_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/report\/([^/]+)$/)
    : null;
const INITIAL_REPORT_ID = REPORT_PATH_MATCH ? REPORT_PATH_MATCH[1] : null;

/** Detect /visit/:visitId/engineer path — renders the pre-install engineer route. */
const ENGINEER_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/visit\/([^/]+)\/engineer$/)
    : null;
const ENGINEER_VISIT_ID = ENGINEER_PATH_MATCH ? ENGINEER_PATH_MATCH[1] : null;

/** Detect /visit/:visitId/twin path — renders the Spatial Twin feature. */
const TWIN_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/visit\/([^/]+)\/twin$/)
    : null;
const TWIN_VISIT_ID = TWIN_PATH_MATCH ? TWIN_PATH_MATCH[1] : null;

/** Detect /portal/:reference path — renders the customer portal. */
const PORTAL_REFERENCE =
  typeof window !== 'undefined'
    ? parsePortalPath(window.location.pathname)
    : null;

/** Extract the signed portal token from ?token=... when on a portal path. */
const PORTAL_TOKEN =
  typeof window !== 'undefined' && PORTAL_REFERENCE != null
    ? new URLSearchParams(window.location.search).get('token') ?? undefined
    : undefined;

/** Detect ?explorer=1 — allows access to the System Explorer via hidden route. */
const EXPLORER_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('explorer') === '1';

/** Detect /workspace — renders the Visit Workspace home page. */
const WORKSPACE_HOME =
  typeof window !== 'undefined' && window.location.pathname === '/workspace';

/** Detect /analytics — renders the tenant-level KPI dashboard. */
const ANALYTICS_HOME =
  typeof window !== 'undefined' && window.location.pathname === '/analytics';

/** Detect /workspace/:id — renders a single workspace detail page. */
const WORKSPACE_DETAIL_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/workspace\/([^/]+)$/)
    : null;
const WORKSPACE_DETAIL_ID = WORKSPACE_DETAIL_MATCH ? WORKSPACE_DETAIL_MATCH[1] : null;

/**
 * Detect ?review=1 — auto-opens the evidence review screen on
 * /workspace/:id pages reached immediately after a package import.
 */
const WORKSPACE_AUTO_REVIEW =
  typeof window !== 'undefined' &&
  WORKSPACE_DETAIL_ID != null &&
  new URLSearchParams(window.location.search).get('review') === '1';

/**
 * Detect /receive-scan path — renders the typed ScanToMindHandoffV1 receive page.
 * Atlas Scan iOS navigates here after constructing a typed handoff payload, passing
 * the serialised JSON as ?payload=<URL-encoded JSON>.
 * Distinct from ?receive-scan=1 (Web Share Target file reception).
 */
const RECEIVE_SCAN_HANDOFF_PATH =
  typeof window !== 'undefined' && window.location.pathname === '/receive-scan';

/**
 * Detect /installation-specification path or ?installation-specification=1 — renders the Atlas
 * Installation Specification visual stepper shell.
 *
 * This is a lab/dev route for the initial PR; it establishes the stepper flow
 * only and does not alter the existing recommendation engine.
 *
 * Examples:
 *   /installation-specification               — path-based entry (e.g. from VisitHubPage)
 *   /?installation-specification=1            — query-param flag for quick dev access
 */
const INSTALLATION_SPECIFICATION_ENABLED =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/installation-specification' ||
    new URLSearchParams(window.location.search).get('installation-specification') === '1'
  );

function CanonicalPresentationRoute({
  engineInput,
  onBack,
  onOpenSimulator,
  onPrint,
  heatLossState,
  prioritiesState,
  onOptionsChange,
}: {
  engineInput: EngineInputV2_3;
  onBack: () => void;
  onOpenSimulator?: () => void;
  onPrint?: () => void;
  heatLossState?: HeatLossState;
  prioritiesState?: PrioritiesState;
  onOptionsChange?: (opt1Family: ApplianceFamily | null, opt2Family: ApplianceFamily | null) => void;
}) {
  const result = runEngine(engineInput);

  // Build the locked CustomerSummaryV1 projection so GeminiAISummary only
  // sees lockedSummary fields — no ranked options, no raw survey context.
  const lockedSummary = (() => {
    try {
      const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
      if (scenarios.length === 0) return undefined;
      const decision = buildDecisionFromScenarios({
        scenarios,
        boilerType:     toLifecycleBoilerType(engineInput.currentHeatSourceType),
        ageYears:       engineInput.currentSystem?.boiler?.ageYears ?? 0,
        occupancyCount: engineInput.occupancyCount,
        bathroomCount:  engineInput.bathroomCount,
        showerCompatibilityNote: result.engineOutput.showerCompatibilityNote,
      });
      return buildCustomerSummary(decision, scenarios);
    } catch {
      return undefined;
    }
  })();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 10,
    }}>
      <div style={{ padding: '0.5rem 1rem', flexShrink: 0 }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CanonicalPresentationPage
          result={result}
          input={engineInput}
          recommendationResult={result.recommendationResult}
          onOpenSimulator={onOpenSimulator}
          onPrint={onPrint}
          heatLossState={heatLossState}
          prioritiesState={prioritiesState}
          onOptionsChange={onOptionsChange}
          lockedSummary={lockedSummary}
        />
      </div>
    </div>
  );
}

function AppInner() {
  // ── Mobile-state persistence: restore session cache on load ───────────────
  // Read once at component initialisation (before first render) so restored
  // values can be used as useState initialisers without a re-render flash.
  const _restoredSession = (() => {
    if (
      FLOOR_PLAN_TOOL_MODE ||
      ENGINEER_VISIT_ID != null ||
      INITIAL_REPORT_ID != null
    ) {
      // URL-driven routes take precedence over cached state.
      return null;
    }
    return readVersionedCache<{ journey: string }>(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
    );
  })();
  const _restoredVisit = (() => {
    if (ENGINEER_VISIT_ID != null) return null;
    return readVersionedCache<{ visitId: string }>(
      ATLAS_CACHE_KEY_VISIT,
      ATLAS_CACHE_SCHEMA_VERSION,
    );
  })();

  // Small notice shown when cache is restored or found to be stale.
  const [cacheNotice, setCacheNotice] = useState<'restored' | 'stale' | null>(
    () => (_restoredSession !== null || _restoredVisit !== null ? 'restored' : null),
  );

  const [journey, setJourney] = useState<Journey>(() => {
    if (FLOOR_PLAN_TOOL_MODE)            return 'floor-plan';
    if (ENGINEER_VISIT_ID != null)       return 'engineer';
    if (INITIAL_REPORT_ID != null)       return 'report';
    // ?visitId= deep-link: open visit-hub directly without restoring cached state.
    if (INITIAL_VISIT_ID_PARAM != null)  return 'visit-hub';
    const restored = (_restoredSession?.value?.journey as Journey | undefined) ?? 'workspace-dashboard';
    // 'presentation' and 'printout' require labEngineInput which is not persisted.
    // 'framework-print' is a transient print destination and should not be restored as an entry point.
    // Restoring any of these without the necessary data would result in a white screen — fall back to 'workspace-dashboard'.
    if (restored === 'presentation' || restored === 'printout' || restored === 'framework-print') {
      return 'workspace-dashboard';
    }
    // 'visit-hub' and 'visit' require an active visit ID.
    // If the visit cache is absent, fall back to 'workspace-dashboard' to avoid a white screen.
    if ((restored === 'visit-hub' || restored === 'visit') && !_restoredVisit?.value?.visitId) {
      return 'workspace-dashboard';
    }
    return restored;
  });
  /** Active report ID for the /report/:id route. */
  const [activeReportId, setActiveReportId] = useState<string | null>(INITIAL_REPORT_ID);
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();
  /** Controls whether the visits search panel is open on the home screen. */
  const [showVisitsPanel, setShowVisitsPanel] = useState(false);
  /**
   * Partial engine input accumulated before opening the Simulator.
   * Populated by Fast Choice / home entry; merged with quick-input values
   * before the simulator opens.
   */
  const [labPartialInput, setLabPartialInput] = useState<Partial<EngineInputV2_3>>({});
  /** Completed engine input passed to the Simulator Dashboard and LabShell. */
  const [labEngineInput, setLabEngineInput] = useState<EngineInputV2_3 | undefined>();
  /**
   * Full survey model captured from the most recent survey draft.
   * Used to derive the canonical current-system summary for the
   * Installation Specification stepper via buildCurrentInstallationSummaryFromCanonicalSurvey.
   */
  const [labFullSurveyModel, setLabFullSurveyModel] = useState<FullSurveyModelV1 | undefined>();
  /**
   * Specification options accumulated across the active visit.
   * Passed to InstallationSpecificationPage as existingOptions and updated
   * each time the surveyor taps Finish inside the stepper.
   */
  const [labInstallationSpecifications, setLabInstallationSpecifications] = useState<InstallationSpecificationOptionV1[]>([]);
  /**
   * Heat-loss survey state captured from the most recent full survey draft.
   * Passed to the presentation layer so the Your House quadrant can show the
   * perimeter snapshot and roof orientation (PR8a/PR8b/PR8c).
   */
  const [labHeatLossState, setLabHeatLossState] = useState<HeatLossState | undefined>();
  /**
   * Priorities state captured from the most recent full survey draft.
   * Passed to the presentation layer so the Your Priorities quadrant shows
   * the selected chips (PR8a).
   */
  const [labPrioritiesState, setLabPrioritiesState] = useState<PrioritiesState | undefined>();
  /**
   * Recommendation state from the final survey step.
   * Retained for future TechnicalSummaryPrint; the customer-facing print now
   * derives its content entirely from the canonical presentation model.
   */
  const [, setLabRecommendationState] = useState<RecommendationState | undefined>();
  /**
   * Contractor quotes collected in the Quotes survey step.
   * Fed into buildInsightPackFromEngine() to generate the Atlas Insight Pack.
   */
  const [labQuotes, setLabQuotes] = useState<QuoteInput[]>([]);
  /**
   * Journey that last opened the Insight Pack, used for the Back button.
   */
  const [insightPackFromJourney, setInsightPackFromJourney] = useState<Journey>('simulator');
  /**
   * The journey that last opened the simulator, used to navigate Back correctly.
   * When the simulator is opened from the recommendation/survey pages, Back
   * should return there instead of going to the landing page.
   */
  const [simulatorFromJourney, setSimulatorFromJourney] = useState<Journey>('landing');
  /**
   * The journey that last opened the presentation, used to navigate Back correctly.
   * When opened from the visit hub the Back button should return to 'visit-hub'.
   */
  const [presentationFromJourney, setPresentationFromJourney] = useState<Journey>('simulator');
  const [floorPlanSystemType, setFloorPlanSystemType] = useState<'combi' | 'system' | 'regular' | 'heat_pump' | undefined>();
  /**
   * Latest floor-plan derived output captured from FloorPlanBuilder.
   * Passed to ExplainersHubPage so the simulator and advice surfaces can show
   * which physics assumptions are informed by the floor plan.
   */
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  /** Active visit ID — set when the user starts or opens a visit. */
  const [activeVisitId, setActiveVisitId] = useState<string | undefined>(
    ENGINEER_VISIT_ID ?? INITIAL_VISIT_ID_PARAM ?? _restoredVisit?.value?.visitId ?? undefined,
  );
  /**
   * Active AtlasVisit — carries the visitId and attached brandId for the
   * current visit session.  Initialized from sessionStorage so that a
   * page reload after a branded visit (e.g. receive-scan) restores the brand.
   */
  const [activeAtlasVisit, setActiveAtlasVisit] = useState<AtlasVisit | null>(() => {
    if (ENGINEER_VISIT_ID !== null) return null;
    return retrieveActiveVisit();
  });
  /** Controls whether the new-visit panel is open. */
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  /**
   * Handoff pack for the 'visit-handoff' journey.
   * Set to null so the VisitHandoffReviewPage shows its built-in loader
   * until the user pastes/uploads a pack (or one is supplied programmatically).
   */
  const [activeHandoffPack, setActiveHandoffPack] = useState<import('./features/visitHandoff/types/visitHandoffPack').VisitHandoffPack | null>(null);
  /**
   * Signed portal URL for the printout journey — generated from the latest
   * report for the active visit.  Uses report ID + HMAC token so the customer
   * portal can validate the link.
   */
  const [labPortalUrl, setLabPortalUrl] = useState<string | undefined>();

  /**
   * Resolves the active workspace from the browser host once on mount.
   * Drives the host-brand fallback for BrandProvider and the default workspace
   * selection in StartVisitPanel when accessed via a branded subdomain.
   * Priority: active visit brandId > host workspace brandId > atlas-default.
   */
  const hostResolution = useWorkspaceFromHost();

  /** Active user profile — used for workspace defaults and visit attribution. */
  const { activeUser } = useActiveUser();

  /** Role-based UI permission flags derived from the active user's role. */
  const {
    canCreateVisit,
    canManageWorkspace,
    canViewAnalytics,
    canEditBranding,
  } = useRolePermissions();

  // ── Session persistence: write journey + visitId to versioned cache ────────
  // These effects run whenever journey or activeVisitId changes, keeping the
  // cache up-to-date so a mobile reload can restore the user's last position.
  // Print/lab/dev-only routes are excluded to avoid polluting the cache with
  // transient states that are not meaningful to restore.
  const PERSISTED_JOURNEYS: Journey[] = [
    'visit', 'visit-hub', 'remote-survey', 'simulator', 'presentation',
  ];

  useEffect(() => {
    if (PERSISTED_JOURNEYS.includes(journey)) {
      writeVersionedCache(
        ATLAS_CACHE_KEY_SESSION,
        ATLAS_CACHE_SCHEMA_VERSION,
        { journey },
        activeVisitId != null ? { visitId: activeVisitId } : undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey, activeVisitId]);

  useEffect(() => {
    if (activeVisitId != null) {
      // Store visitId only in metadata (envelope header); value is kept minimal.
      writeVersionedCache(
        ATLAS_CACHE_KEY_VISIT,
        ATLAS_CACHE_SCHEMA_VERSION,
        { visitId: activeVisitId },
        { visitId: activeVisitId },
      );
    }
  }, [activeVisitId]);

  // Auto-dismiss the cache-restore notice after 4 s.
  useEffect(() => {
    if (cacheNotice === null) return;
    const timer = setTimeout(() => setCacheNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [cacheNotice]);

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('remote-survey');
  }

  /**
   * Start a new visit — opens the StartVisitPanel overlay.
   * Brand selection and visit creation are handled by StartVisitPanel.
   */
  function handleStartNewVisit() {
    setShowNewVisitDialog(true);
  }

  /** Open an existing visit by ID — routes to the Visit Hub page. */
  function handleOpenVisit(visitId: string) {
    setActiveVisitId(visitId);
    setJourney('visit-hub');
  }

  /**
   * View recommendation for a completed visit.
   *
   * Loads the visit's working payload, converts it to engine input, and routes
   * directly to the Simulator Dashboard.  Falls back to the survey if the
   * working payload is missing or cannot be converted.
   */
  async function handleOpenPresentation(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const workingPayload = visitDetail.working_payload;
      if (workingPayload && Object.keys(workingPayload).length > 0) {
        // Basic structural check — working_payload must look like a survey model.
        // If conversion fails, the surrounding try/catch falls through to the survey.
        const survey = workingPayload as unknown as FullSurveyModelV1;
        const engineInput = toEngineInput(sanitiseModelForEngine(survey));
        setActiveVisitId(visitId);
        setLabEngineInput(engineInput);
        // Populate presentation quadrants (house snapshot, priority chips).
        if (survey.fullSurvey?.heatLoss) setLabHeatLossState(survey.fullSurvey.heatLoss);
        if (survey.fullSurvey?.priorities) setLabPrioritiesState(survey.fullSurvey.priorities);
        // Ensure a report is linked to this visit so the portal URL is available
        // when the user returns to the Visit Hub after the presentation.
        void listReportsForVisit(visitId).then((reports) => {
          if (reports.length > 0) return;
          const { engineOutput } = runEngine(engineInput);
          return saveReport({
            title: generateReportTitle({
              postcode: engineInput.postcode ?? null,
              recommendedSystem: engineOutput.recommendation?.primary ?? null,
            }),
            postcode: engineInput.postcode ?? null,
            visit_id: visitId,
            status: 'complete',
            payload: buildCanonicalReportPayload({
              surveyData: survey,
              engineInput,
              engineOutput,
              decisionSynthesis: null,
              runMeta: { source: 'portal_bootstrap' },
            }),
          });
        }).catch(() => {/* best effort */});
        setPresentationFromJourney('visit-hub');
        setJourney('presentation');
        return;
      }
    } catch (err) {
      // Log the failure so it is visible in dev tools, then fall back to survey.
      console.error('[Atlas] Could not load visit for presentation', visitId, err);
    }
    // Fallback: no working payload — send back to survey so the user can
    // complete and save it.
    setJourney('visit');
  }

  /**
   * Print summary for a completed visit.
   *
   * Loads the visit's working payload, converts it to engine input, generates a
   * signed portal URL from the latest report, and routes to the printout journey.
   * Falls back to the survey if the working payload is missing.
   */
  async function handlePrintSummary(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const workingPayload = visitDetail.working_payload;
      if (workingPayload && Object.keys(workingPayload).length > 0) {
        const survey = workingPayload as unknown as FullSurveyModelV1;
        const engineInput = toEngineInput(sanitiseModelForEngine(survey));
        setActiveVisitId(visitId);
        setLabEngineInput(engineInput);
        if (survey.fullSurvey?.heatLoss) setLabHeatLossState(survey.fullSurvey.heatLoss);
        if (survey.fullSurvey?.priorities) setLabPrioritiesState(survey.fullSurvey.priorities);
        // Clear any stale portal URL; generate a fresh signed URL from the
        // latest report (creating one if needed) so the QR code on the
        // printout is always valid.
        setLabPortalUrl(undefined);
        listReportsForVisit(visitId)
          .then(async (reports) => {
            let reportId: string;
            if (reports.length > 0) {
              reportId = reports[0].id;
            } else {
              const { engineOutput } = runEngine(engineInput);
              const saved = await saveReport({
                title: generateReportTitle({
                  postcode: engineInput.postcode ?? null,
                  recommendedSystem: engineOutput.recommendation?.primary ?? null,
                }),
                postcode: engineInput.postcode ?? null,
                visit_id: visitId,
                status: 'complete',
                payload: buildCanonicalReportPayload({
                  surveyData: survey,
                  engineInput,
                  engineOutput,
                  decisionSynthesis: null,
                  runMeta: { source: 'portal_bootstrap' },
                }),
              });
              reportId = saved.id;
            }
            const token = await generatePortalToken(reportId);
            setLabPortalUrl(buildPortalUrl(reportId, window.location.origin, token));
          })
          .catch((err) => { console.warn('[Atlas] Portal URL generation failed for printout:', err); });
        setJourney('framework-print');
        return;
      }
    } catch (err) {
      console.error('[Atlas] Could not load visit for print summary', visitId, err);
    }
    setJourney('visit');
  }

  /**
   * Build a VisitHandoffPack from the current visit's working payload and open
   * the handoff review page.  When the working payload is available the pack is
   * built locally — no JSON upload/paste required.  Falls back gracefully to
   * the review page with an empty pack when the payload is missing.
   */
  async function handleOpenHandoffReview(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const { working_payload, ...metaFields } = visitDetail;
      const survey = working_payload as unknown as import('./ui/fullSurvey/FullSurveyModelV1').FullSurveyModelV1;
      if (working_payload && (survey.fullSurvey != null || survey.bedrooms != null)) {
        // Extract the cached engine top option from the working payload so the
        // handoff builder can flag any mismatch with the manual recommendation.
        const engineMeta = (working_payload as Record<string, unknown>)?.['_atlasEngineRunMeta'];
        const engineOutput = engineMeta && typeof engineMeta === 'object'
          ? (engineMeta as Record<string, unknown>).output as import('./contracts/EngineOutputV1').EngineOutputV1 | undefined
          : undefined;
        const engineTopOptionId = engineOutput?.recommendation?.primary ?? undefined;
        const pack = buildHandoffPackFromSurvey(
          metaFields,
          survey,
          engineTopOptionId,
        );
        setActiveHandoffPack(pack);
      } else {
        setActiveHandoffPack(null);
      }
    } catch (err) {
      console.warn('[Atlas] Could not build handoff pack for visit', visitId, err);
      setActiveHandoffPack(null);
    }
    setJourney('visit-handoff');
  }

  /**
   * Open the Simulator Dashboard, optionally with a partial engine input already
   * known from Fast Choice.  If simulation-critical fields are missing, route
   * through the quick-input gate first; otherwise open the simulator directly.
   */
  function handleOpenLab(partial: Partial<EngineInputV2_3> = {}) {
    setLabPartialInput(partial);
    const missing = getMissingLabFields(partial);
    if (missing.length > 0) {
      setJourney('lab-quick-inputs');
    } else {
      // All quick-form fields are present.  Merge with safe defaults to fill
      // any remaining required EngineInputV2_3 fields, then route through the
      // fit-map page before opening the simulator.
      const engineInput = mergeLabQuickInputs(partial, {});
      setLabEngineInput(engineInput);
      setJourney('simulator');
    }
  }

  /**
   * Open the Atlas Insight Pack for a completed visit.
   *
   * Loads the visit's working payload, converts it to engine input, and
   * routes to the Insight Pack journey with the collected quotes.
   * Falls back to the survey if the working payload is missing or has no quotes.
   */
  async function handleOpenInsightPackForVisit(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const workingPayload = visitDetail.working_payload;
      if (workingPayload && Object.keys(workingPayload).length > 0) {
        const survey = workingPayload as unknown as FullSurveyModelV1;
        const quotes = survey.fullSurvey?.quotes;
        if (Array.isArray(quotes) && quotes.length > 0) {
          const engineInput = toEngineInput(sanitiseModelForEngine(survey));
          setActiveVisitId(visitId);
          setLabEngineInput(engineInput);
          setLabQuotes(quotes);
          if (survey.fullSurvey?.heatLoss) setLabHeatLossState(survey.fullSurvey.heatLoss);
          if (survey.fullSurvey?.priorities) setLabPrioritiesState(survey.fullSurvey.priorities);
          setInsightPackFromJourney('visit-hub');
          setJourney('insight-pack');
          return;
        }
      }
    } catch (err) {
      console.error('[Atlas] Could not load visit for Insight Pack', visitId, err);
    }
    // Fallback: resume survey so the user can complete the quotes step.
    setJourney('visit');
  }

  // Derive the canonical current-system summary once, before all early returns.
  // Used by both the INSTALLATION_SPECIFICATION_ENABLED route and the
  // journey === 'installation-specification' branch.
  const canonicalCurrentSystem: CanonicalCurrentSystemSummary | null = useMemo(
    () => labFullSurveyModel
      ? buildCurrentInstallationSummaryFromCanonicalSurvey(labFullSurveyModel)
      : null,
    [labFullSurveyModel],
  );

  // /workspace/:id — render a single workspace detail page.
  if (WORKSPACE_DETAIL_ID != null) {
    return (
      <WorkspaceDetailPage
        workspaceId={WORKSPACE_DETAIL_ID}
        autoOpenReview={WORKSPACE_AUTO_REVIEW}
        onBack={() => { window.location.href = '/workspace'; }}
      />
    );
  }

  // /analytics — render the tenant-level KPI analytics dashboard.
  if (ANALYTICS_HOME) {
    return (
      <AnalyticsDashboard
        onBack={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /workspace — render the Visit Workspace home page.
  if (WORKSPACE_HOME) {
    return (
      <WorkspaceHomePage
        onOpenWorkspace={(id, openReview) => {
          window.location.href = openReview
            ? `/workspace/${id}?review=1`
            : `/workspace/${id}`;
        }}
        onBack={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /portal/:reference — render the customer-facing recommendation portal.
  if (PORTAL_REFERENCE != null) {
    return <CustomerPortalPage reference={PORTAL_REFERENCE} token={PORTAL_TOKEN} />;
  }

  // /receive-scan — render the typed ScanToMindHandoffV1 receive page.
  // Atlas Scan iOS navigates here with ?payload=<URL-encoded JSON>.
  // After a successful receive, open the visit-hub for the received visit.
  if (RECEIVE_SCAN_HANDOFF_PATH) {
    return (
      <ScanHandoffReceivePage
        onVisitReady={(visit) => {
          // Persist the AtlasVisit (including brandId) so the App restores
          // the correct brand when navigating to the visit hub.
          const atlasVisit = createAtlasVisit(visit.visitId, visit.brandId ?? DEFAULT_BRAND_ID);
          storeActiveVisit(atlasVisit);
          window.location.href = `/?visitId=${encodeURIComponent(visit.visitId)}`;
        }}
        onOpenEngineerEvidence={(visit) => {
          const atlasVisit = createAtlasVisit(visit.visitId, visit.brandId ?? DEFAULT_BRAND_ID);
          storeActiveVisit(atlasVisit);
          window.location.href = `/visit/${encodeURIComponent(visit.visitId)}/engineer`;
        }}
        onCancel={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /installation-specification or ?installation-specification=1 — render the Atlas Installation Specification stepper shell.
  if (INSTALLATION_SPECIFICATION_ENABLED) {
    const handleBack = () => { window.history.back(); };
    return (
      <SpecificationErrorBoundary onBack={handleBack}>
        <Suspense fallback={specificationLoadingFallback}>
          <InstallationSpecificationPage
            onBack={handleBack}
            canonicalCurrentSystem={canonicalCurrentSystem}
            origin="direct"
            existingOptions={labInstallationSpecifications.length > 0 ? labInstallationSpecifications : undefined}
            onSave={(option) => {
              setLabInstallationSpecifications((prev) => {
                const idx = prev.findIndex((o) => o.id === option.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = option;
                  return updated;
                }
                return [...prev, option];
              });
            }}
            onFinish={() => { handleBack(); }}
          />
        </Suspense>
      </SpecificationErrorBoundary>
    );
  }

  // /visit/:visitId/engineer — render the dedicated pre-install engineer route.
  if (ENGINEER_VISIT_ID != null && journey === 'engineer') {
    return (
      <EngineerPreinstallPage
        visitId={ENGINEER_VISIT_ID}
        onBack={() => { window.history.back(); }}
      />
    );
  }

  // /visit/:visitId/twin — render the Spatial Twin feature.
  if (TWIN_VISIT_ID != null) {
    return (
      <SpatialTwinPage
        visitId={TWIN_VISIT_ID}
        onBack={() => { window.history.back(); }}
      />
    );
  }

  // ?report=1 feature flag — render the unified ReportView with demo engine output.
  if (REPORT_MODE_ENABLED) {
    const { engineOutput } = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <ReportView
        output={engineOutput}
        engineInput={CONSOLE_DEMO_INPUT}
        onBack={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  // ?deck=1 feature flag — render swipeable PresentationDeck directly with demo data.
  // NOTE: No heatLossState or prioritiesState available — demo input only.
  // Dev provenance badges on each slide indicate which canonical fields are active.
  if (DECK_MODE_ENABLED) {
    const result = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh' }}>
        <button className="back-btn" onClick={() => { window.location.href = window.location.pathname; }}>
          ← Back
        </button>
        {import.meta.env.DEV && (
          <p className="atlas-dev-notice">
            🔬 Dev deck — CONSOLE_DEMO_INPUT (no survey heatLossState / prioritiesState)
          </p>
        )}
        <CanonicalPresentationPage
          result={result}
          input={CONSOLE_DEMO_INPUT}
          recommendationResult={result.recommendationResult}
          deckMode={true}
        />
      </div>
    );
  }

  // ?presentation=1 feature flag — render CanonicalPresentationPage directly with demo data.
  // NOTE: No heatLossState or prioritiesState available — demo input only.
  // data-canonical-source attributes on each section trace the canonical fields.
  if (PRESENTATION_MODE_ENABLED) {
    const result = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh' }}>
        <button className="back-btn" onClick={() => { window.location.href = window.location.pathname; }}>
          ← Back
        </button>
        {import.meta.env.DEV && (
          <p className="atlas-dev-notice">
            🔬 Dev presentation — CONSOLE_DEMO_INPUT (no survey heatLossState / prioritiesState)
          </p>
        )}
        <CanonicalPresentationPage
          result={result}
          input={CONSOLE_DEMO_INPUT}
          recommendationResult={result.recommendationResult}
        />
      </div>
    );
  }

  // ?gallery=1 feature flag — render Physics Visual Library gallery for review.
  if (GALLERY_MODE_ENABLED) {
    return (
      <div style={{ background: 'var(--surface-page, #f8fafc)', minHeight: '100vh' }}>
        <PhysicsVisualGallery onBack={() => { window.location.href = window.location.pathname; }} />
      </div>
    );
  }

  // ?audit=1 — render Presentation Audit Page for developer scenario review.
  if (AUDIT_MODE_ENABLED) {
    return <PresentationAuditPage />;
  }

  // ?scan-import=1 — render Scan Import Dev Harness for testing scan bundle ingestion.
  if (SCAN_IMPORT_ENABLED) {
    return <ScanImportHarness onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?handoff=1 — render canonical AtlasPropertyV1 handoff arrival page.
  if (HANDOFF_ENABLED) {
    return <HandoffArrivalPage onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?visit-handoff=1 — render completed-visit handoff review (customer + engineer surfaces).
  if (VISIT_HANDOFF_REVIEW_ENABLED) {
    return (
      <VisitHandoffReviewPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?customer-share=1 — render customer-safe printable summary from imported handoff pack.
  if (CUSTOMER_SHARE_ENABLED) {
    return (
      <CustomerSummaryPrintPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?engineer-share=1 — render engineer compact install-prep handoff from imported handoff pack.
  if (ENGINEER_SHARE_ENABLED) {
    return (
      <EngineerSummaryPrintPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?insight-pack=1 — render Atlas Insight Pack deck with demo data for review.
  if (INSIGHT_PACK_ENABLED) {
    const { engineOutput } = runEngine(CONSOLE_DEMO_INPUT);
    const rawType = CONSOLE_DEMO_INPUT.currentHeatSourceType;
    const demoBoilerType: InsightPackSurveyContext['currentBoiler'] = rawType === 'combi' ||
      rawType === 'system' || rawType === 'regular'
      ? { type: rawType }
      : undefined;
    const demoSurveyContext: InsightPackSurveyContext = {
      currentBoiler: demoBoilerType,
      occupancyCount: CONSOLE_DEMO_INPUT.occupancyCount,
      bathroomCount: CONSOLE_DEMO_INPUT.bathroomCount,
      mainsDynamicFlowLpm: CONSOLE_DEMO_INPUT.mainsDynamicFlowLpm,
      heatLossWatts: CONSOLE_DEMO_INPUT.heatLossWatts,
    };
    const demoScenarios = buildScenariosFromEngineOutput(engineOutput);
    const demoDecision = demoScenarios.length > 0
      ? buildDecisionFromScenarios({
          scenarios: demoScenarios,
          boilerType: toLifecycleBoilerType(CONSOLE_DEMO_INPUT.currentHeatSourceType),
          ageYears: 10,
          occupancyCount: CONSOLE_DEMO_INPUT.occupancyCount,
          bathroomCount: CONSOLE_DEMO_INPUT.bathroomCount,
          showerCompatibilityNote: engineOutput.showerCompatibilityNote,
        })
      : undefined;
    const pack = buildInsightPackFromEngine(
      engineOutput,
      DEMO_QUOTES,
      demoSurveyContext,
      demoDecision,
      demoScenarios.length > 0 ? demoScenarios : undefined,
    );
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = window.location.pathname; }}>
            ← Back
          </button>
          {import.meta.env.DEV && (
            <p className="atlas-dev-notice">
              🔬 Dev insight pack — CONSOLE_DEMO_INPUT + DEMO_QUOTES
            </p>
          )}
        </div>
        <InsightPackDeck pack={pack} propertyTitle="Demo — SW1A 1AA" />
      </div>
    );
  }

  // ?atlas-capture=1 — render the on-device capture view for building a
  // SessionCaptureV2 session directly in the browser.
  if (ATLAS_CAPTURE_ENABLED) {
    return (
      <VisitDetailView
        onBack={() => { window.location.href = window.location.pathname; }}
        onExported={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?receive-scan=1 — render the Web Share Target receive page.
  // The service worker sets this param after storing shared file(s) in IDB.
  // After a successful import:
  //   - If ?visitId=X is also present, navigate back to that visit's hub.
  //   - Otherwise, navigate to /workspace where the stored scan session can be reviewed.
  if (RECEIVE_SCAN_ENABLED) {
    const afterReceiveScan = INITIAL_VISIT_ID_PARAM
      ? `${window.location.pathname}?visitId=${encodeURIComponent(INITIAL_VISIT_ID_PARAM)}`
      : '/workspace';
    return (
      <ReceiveScanPage
        onImported={() => { window.location.href = afterReceiveScan; }}
        onCancel={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?my-scans=1 — render the My Scans management page.
  if (MY_SCANS_ENABLED) {
    return (
      <ScanSessionListPage
        onBack={() => { window.location.href = window.location.pathname; }}
        onOpenSession={(sessionId) => {
          // Navigate to the scan session viewer — reuse receive-scan route with
          // the session ID passed as a query param for future deep-linking.
          window.location.href = `${window.location.pathname}?receive-scan=1&session=${encodeURIComponent(sessionId)}`;
        }}
      />
    );
  }

  // ?scan-package=1 — render Atlas Scan package import flow.
  // After a successful import:
  //   - If ?visitId=X is also present, navigate back to that visit's hub so the
  //     captured evidence is available in context.
  //   - Otherwise, navigate to /workspace where the stored scan session can be reviewed.
  if (SCAN_PACKAGE_ENABLED) {
    const afterScanImport = INITIAL_VISIT_ID_PARAM
      ? `${window.location.pathname}?visitId=${encodeURIComponent(INITIAL_VISIT_ID_PARAM)}`
      : '/workspace';
    return (
      <ScanPackageImportFlow
        onImported={() => { window.location.href = afterScanImport; }}
        onCancel={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?devmenu=1 feature flag — render Developer Component Browser directly.
  if (DEV_MENU_ENABLED) {
    return (
      <DevMenuPage
        onBack={() => { window.location.href = window.location.pathname; }}
        onLoadDemoWorkspace={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?brand-settings=1 — render Workspace Branding settings page.
  if (BRAND_SETTINGS_ENABLED) {
    return (
      <TenantSettingsPage
        onBack={() => { window.location.href = window.location.pathname; }}
        onCreateWorkspace={() => {
          window.location.href = `${window.location.pathname}?create-workspace=1`;
        }}
      />
    );
  }

  // ?create-workspace=1 — render Workspace Onboarding page.
  if (CREATE_WORKSPACE_ENABLED) {
    return (
      <TenantOnboardingPage
        onCancel={() => { window.location.href = window.location.pathname; }}
        onCreated={() => { /* stay on success panel */ }}
        onStartVisit={(slug) => {
          window.location.href = `${window.location.pathname}?start-visit=1&workspace=${encodeURIComponent(slug)}`;
        }}
        onEditBranding={(slug) => {
          window.location.href = `${window.location.pathname}?brand-settings=1&workspace=${encodeURIComponent(slug)}`;
        }}
      />
    );
  }

  // ?lab=1 feature flag — render Demo Lab directly.
  if (LAB_MODE_ENABLED) {
    return <ExplainersHubPage onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?print=<view> — render dedicated print layout.
  if (PRINT_VIEW === 'customer')   return <LabPrintCustomer />;
  if (PRINT_VIEW === 'technical')  return <LabPrintTechnical />;
  if (PRINT_VIEW === 'comparison') return <LabPrintComparison />;
  if (PRINT_VIEW === 'survey') {
    const surveyPrintInput = labEngineInput ?? CONSOLE_DEMO_INPUT;
    const surveyPrintResult  = runEngine(surveyPrintInput);
    const surveyPrintScenarios = buildScenariosFromEngineOutput(surveyPrintResult.engineOutput);

    // ?print=survey&internal=1 — old diagnostic report for dev/internal use only.
    // Not reachable as the default customer output.
    if (INTERNAL_PRINT_ENABLED) {
      return (
        <CustomerRecommendationPrint
          result={surveyPrintResult}
          input={surveyPrintInput}
          recommendationResult={surveyPrintResult.recommendationResult}
          portalUrl={buildPortalUrl('demo', window.location.origin)}
          visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        />
      );
    }

    // Default: customer-facing advice pack from VisualBlock[] truth.
    if (surveyPrintScenarios.length > 0) {
      const surveyPrintDecision = buildDecisionFromScenarios({
        scenarios:   surveyPrintScenarios,
        boilerType:  toLifecycleBoilerType(surveyPrintInput.currentHeatSourceType),
        ageYears:    surveyPrintInput.currentSystem?.boiler?.ageYears ?? 0,
        occupancyCount: surveyPrintInput.occupancyCount,
        bathroomCount:  surveyPrintInput.bathroomCount,
        showerCompatibilityNote: surveyPrintResult.engineOutput.showerCompatibilityNote,
      });
      const surveyPrintBlocks = buildVisualBlocks(surveyPrintDecision, surveyPrintScenarios, undefined, surveyPrintInput);
      return (
        <CustomerAdvicePrintPack
          decision={surveyPrintDecision}
          scenarios={surveyPrintScenarios}
          visualBlocks={surveyPrintBlocks}
          portalUrl={buildPortalUrl('demo', window.location.origin)}
          visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          onBack={() => { window.location.href = window.location.pathname; }}
        />
      );
    }
  }

  return (
    <>
      {/* Cache-restore / stale-cache notice — shown briefly after a mobile reload */}
      {cacheNotice !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: cacheNotice === 'stale' ? '#d97706' : '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          {cacheNotice === 'restored'
            ? 'Session restored'
            : 'Cache version changed — started fresh'}
        </div>
      )}
      {/* /report/:id — render a saved report by ID */}
      {journey === 'report' && activeReportId != null && (
        <ReportPage
          reportId={activeReportId}
          onBack={() => {
            setActiveReportId(null);
            // Return to the Visit Hub if the report was opened from one; otherwise
            // return to the landing page.
            if (activeVisitId != null) {
              setJourney('visit-hub');
            } else {
              setJourney('landing');
            }
          }}
          onDuplicated={(newId) => {
            setActiveReportId(newId);
          }}
        />
      )}
      {journey === 'fast' && <FastChoiceStepper onBack={() => setJourney('landing')} onEscalate={handleEscalate} onOpenLab={handleOpenLab} />}
      {/* Visit journey area — wrapped with BrandProvider driven by:
           1. activeAtlasVisit.brandId (highest priority — active visit brand)
           2. hostResolution.brandId   (host workspace brand — e.g. branded subdomain)
           3. atlas-default            (BrandProvider's built-in fallback)
           And VisitProvider to carry visit identity through the journey. */}
      <BrandProvider brandId={activeAtlasVisit?.brandId ?? hostResolution.brandId}>
      <VisitProvider initialVisit={activeAtlasVisit}>
        {/* Visit Hub — shown when opening an existing visit */}
        {journey === 'visit-hub' && activeVisitId != null && (
          <VisitHubPage
            visitId={activeVisitId}
            onBack={() => setJourney('workspace-dashboard')}
            onResumeSurvey={() => setJourney('visit')}
            onOpenPresentation={() => { void handleOpenPresentation(activeVisitId); }}
            onPrintSummary={() => { void handlePrintSummary(activeVisitId); }}
            onOpenReport={(reportId) => {
              const reportUrl = `${window.location.origin}/report/${reportId}`;
              window.open(reportUrl, '_blank', 'noopener,noreferrer');
            }}
            onOpenEngineerRoute={() => setJourney('engineer')}
            onOpenInsightPack={() => { void handleOpenInsightPackForVisit(activeVisitId); }}
            onOpenHandoffReview={() => { void handleOpenHandoffReview(activeVisitId); }}
            onImportScan={() => setJourney('receive-scan')}
            onOpenExternalFiles={() => setJourney('external-files')}
            onOpenInstallationSpecification={() => setJourney('installation-specification')}
            installationSpecOptionCount={labInstallationSpecifications.length > 0 ? labInstallationSpecifications.length : undefined}
          />
        )}
        {/* Atlas Scan receive — opened from Visit Hub to import a scan from the iOS app.
             After a successful import, navigate to /workspace so the engineer can review
             the captured evidence.  The scan session is already persisted to IDB at this
             point; /workspace lists all local sessions and opens the evidence review. */}
        {journey === 'receive-scan' && (
          <ReceiveScanPage
            onImported={() => { window.location.href = '/workspace'; }}
            onCancel={() => setJourney('visit-hub')}
          />
        )}
        {/* External visit file manifest — opened from Visit Hub to attach file references. */}
        {journey === 'external-files' && activeVisitId != null && (
          <ExternalVisitManifestPanel
            visitId={activeVisitId}
            tenantId={hostResolution.workspaceSlug ?? 'default'}
            onClose={() => setJourney('visit-hub')}
          />
        )}
        {/* Installation Specification — opened from Visit Hub or QuoteCollectionStep */}
        {journey === 'installation-specification' && (
          <SpecificationErrorBoundary onBack={() => setJourney(activeVisitId != null ? 'visit-hub' : 'landing')}>
            <Suspense fallback={specificationLoadingFallback}>
              <InstallationSpecificationPage
                onBack={() => setJourney(activeVisitId != null ? 'visit-hub' : 'landing')}
                canonicalCurrentSystem={canonicalCurrentSystem}
                visitId={activeVisitId ?? undefined}
                origin="visit-hub"
                existingOptions={labInstallationSpecifications.length > 0 ? labInstallationSpecifications : undefined}
                onSave={(option) => {
                  setLabInstallationSpecifications((prev) => {
                    const idx = prev.findIndex((o) => o.id === option.id);
                    if (idx >= 0) {
                      const updated = [...prev];
                      updated[idx] = option;
                      return updated;
                    }
                    return [...prev, option];
                  });
                }}
                onFinish={() => { setJourney(activeVisitId != null ? 'visit-hub' : 'landing'); }}
              />
            </Suspense>
          </SpecificationErrorBoundary>
        )}
        {/* Completed-visit handoff review — reachable from Visit Hub after completion */}
        {journey === 'visit-handoff' && (
          <VisitHandoffReviewPage
            initialPack={activeHandoffPack ?? undefined}
            visitCompleted={true}
            onBack={() => setJourney('visit-hub')}
          />
        )}
        {/* Engineer pre-install route — /visit/:visitId/engineer */}
        {journey === 'engineer' && activeVisitId != null && (
          <EngineerPreinstallPage
            visitId={activeVisitId}
            onBack={() => setJourney('visit-hub')}
          />
        )}
        {journey === 'visit' && activeVisitId != null && (
        <GlobalMenuShell>
          <VisitPage
            visitId={activeVisitId}
            onBack={() => setJourney('visit-hub')}
            onDraft={(draft) => {
              // Capture heatLoss and priorities from the visit survey draft so
              // the presentation deck can show the house snapshot and selected
              // priority chips — mirrors the same pattern used by the 'remote-survey' journey.
              if (draft.fullSurvey?.heatLoss) setLabHeatLossState(draft.fullSurvey.heatLoss);
              if (draft.fullSurvey?.priorities) setLabPrioritiesState(draft.fullSurvey.priorities);
              if (draft.fullSurvey?.quotes) setLabQuotes(draft.fullSurvey.quotes);
              // Capture the full survey model so the Installation Specification
              // stepper can display the canonical current-system summary.
              setLabFullSurveyModel(draft);
            }}
            onComplete={(engineInput) => {
              // Survey is complete — store engine input for presentation/simulator use,
              // then route to the Visit Hub so the engineer can formally complete the visit
              // by clicking "Complete visit" and accessing handoff tools.
              setLabEngineInput(engineInput);
              if (activeAtlasVisit) {
                trackVisitCompleted(activeAtlasVisit);
              }
              setJourney('visit-hub');
            }}
            onOpenSimulator={(engineInput) => {
              // Direct shortcut from InsightLayerPage — skip fit-map.
              setLabEngineInput(engineInput);
              setSimulatorFromJourney('visit');
              setJourney('simulator');
            }}
            onOpenInsightPack={(engineInput, quotes) => {
              setLabEngineInput(engineInput);
              setLabQuotes(quotes);
              setInsightPackFromJourney('visit-hub');
              setJourney('insight-pack');
            }}
            onOpenFloorPlan={(surveyResults) => {
              const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
              setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
              setJourney('floor-plan');
            }}
            onOpenHandoffReview={() => { void handleOpenHandoffReview(activeVisitId!); }}
            onOpenInstallationSpecification={() => setJourney('installation-specification')}
            floorplanOutput={floorplanOutput}
          />
        </GlobalMenuShell>
      )}
      </VisitProvider>
      </BrandProvider>
      {journey === 'remote-survey' && (
        <GlobalMenuShell>
          <FullSurveyStepper
            onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }}
            prefill={fullSurveyPrefill}
            onDraft={(draft) => {
              // Capture heatLoss, priorities and recommendation as they are
              // updated during the survey so they are available for the
              // presentation and printout layers.
              if (draft.fullSurvey?.heatLoss) setLabHeatLossState(draft.fullSurvey.heatLoss);
              if (draft.fullSurvey?.priorities) setLabPrioritiesState(draft.fullSurvey.priorities);
              if (draft.fullSurvey?.recommendation) setLabRecommendationState(draft.fullSurvey.recommendation);
              if (draft.fullSurvey?.quotes) setLabQuotes(draft.fullSurvey.quotes);
              // Capture the full survey model so the Installation Specification
              // stepper can display the canonical current-system summary.
              setLabFullSurveyModel(draft);
            }}
            onComplete={(engineInput) => {
              // Route directly to simulator — fit-map step removed.
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setSimulatorFromJourney('remote-survey');
              setJourney('simulator');
            }}
            onOpenSimulator={(engineInput) => {
              // Direct shortcut from InsightLayerPage — skip fit-map.
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setSimulatorFromJourney('remote-survey');
              setJourney('simulator');
            }}
            onOpenInsightPack={(engineInput, quotes) => {
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setLabQuotes(quotes);
              setInsightPackFromJourney('simulator');
              setJourney('insight-pack');
            }}
            onOpenFloorPlan={(surveyResults) => {
              const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
              setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
              setJourney('floor-plan');
            }}
          />
        </GlobalMenuShell>
      )}
      {journey === 'scope' && <ScopePage onBack={() => setJourney('landing')} />}
      {journey === 'methodology' && <MethodologyPage onBack={() => setJourney('landing')} />}
      {journey === 'neutrality' && <NeutralityPage onBack={() => setJourney('landing')} />}
      {journey === 'privacy' && <PrivacyPage onBack={() => setJourney('landing')} />}
      {journey === 'lab-quick-inputs' && (
        <LabQuickInputsPanel
          initialInput={labPartialInput}
          missingFields={getMissingLabFields(labPartialInput)}
          onComplete={(completed) => {
            setLabEngineInput(completed);
            setJourney('simulator');
          }}
          onCancel={() => setJourney('landing')}
        />
      )}
      {journey === 'simulator' && (
        <GlobalMenuShell>
          <ExplainersHubPage
            onBack={() => setJourney(simulatorFromJourney)}
            onEditSetup={() => setJourney(simulatorFromJourney)}
            onOpenSystemLab={() => setJourney('lab')}
            onOpenPresentation={labEngineInput != null ? () => { setPresentationFromJourney('simulator'); setJourney('presentation'); } : undefined}
            surveyData={labEngineInput}
            floorplanOutput={floorplanOutput}
          />
        </GlobalMenuShell>
      )}
      {journey === 'lab' && <LabShell onHome={() => setJourney('landing')} engineInput={labEngineInput} />}
      {journey === 'presentation' && labEngineInput != null && (
        <CanonicalPresentationRoute
          engineInput={labEngineInput}
          onBack={() => setJourney(presentationFromJourney)}
          onOpenSimulator={() => setJourney('simulator')}
          onPrint={() => setJourney('framework-print')}
          heatLossState={labHeatLossState}
          prioritiesState={labPrioritiesState}
        />
      )}
      {journey === 'printout' && labEngineInput != null && (() => {
        const result   = runEngine(labEngineInput);
        const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
        if (scenarios.length === 0) return null;
        const decision = buildDecisionFromScenarios({
          scenarios,
          boilerType:     toLifecycleBoilerType(labEngineInput.currentHeatSourceType),
          ageYears:       labEngineInput.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: labEngineInput.occupancyCount,
          bathroomCount:  labEngineInput.bathroomCount,
          showerCompatibilityNote: result.engineOutput.showerCompatibilityNote,
        });
        const visualBlocks = buildVisualBlocks(decision, scenarios, undefined, labEngineInput);
        return (
          <CustomerAdvicePrintPack
            decision={decision}
            scenarios={scenarios}
            visualBlocks={visualBlocks}
            portalUrl={labPortalUrl}
            visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            onBack={() => setJourney('presentation')}
          />
        );
      })()}
      {journey === 'framework-print' && labEngineInput != null && (() => {
        const result    = runEngine(labEngineInput);
        const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
        if (scenarios.length === 0) return null;
        const decision = buildDecisionFromScenarios({
          scenarios,
          boilerType:     toLifecycleBoilerType(labEngineInput.currentHeatSourceType),
          ageYears:       labEngineInput.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: labEngineInput.occupancyCount,
          bathroomCount:  labEngineInput.bathroomCount,
          showerCompatibilityNote: result.engineOutput.showerCompatibilityNote,
        });
        const visualBlocks = buildVisualBlocks(decision, scenarios, undefined, labEngineInput);
        return (
          <CustomerAdvicePrintPack
            decision={decision}
            scenarios={scenarios}
            visualBlocks={visualBlocks}
            portalUrl={labPortalUrl}
            visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            onBack={() => {
              // Return to the visit hub if we came from there, otherwise go to the presentation.
              if (activeVisitId != null) {
                setJourney('visit-hub');
              } else {
                setJourney('presentation');
              }
            }}
          />
        );
      })()}
      {journey === 'insight-pack' && labEngineInput != null && labQuotes.length > 0 && (() => {
        const { engineOutput } = runEngine(labEngineInput);
        const surveyContext: InsightPackSurveyContext = {
          currentBoiler: labEngineInput.currentSystem?.boiler,
          occupancyCount: labEngineInput.occupancyCount,
          bathroomCount: labEngineInput.bathroomCount,
          peakConcurrentOutlets: labEngineInput.peakConcurrentOutlets,
          mainsDynamicFlowLpm: labEngineInput.mainsDynamicFlowLpm,
          heatLossWatts: labEngineInput.heatLossWatts,
        };
        const ipScenarios = buildScenariosFromEngineOutput(engineOutput);
        const ipDecision = ipScenarios.length > 0
          ? buildDecisionFromScenarios({
              scenarios: ipScenarios,
              boilerType: toLifecycleBoilerType(labEngineInput.currentHeatSourceType),
              ageYears: labEngineInput.currentSystem?.boiler?.ageYears ?? 10,
              occupancyCount: labEngineInput.occupancyCount,
              bathroomCount: labEngineInput.bathroomCount,
              showerCompatibilityNote: engineOutput.showerCompatibilityNote,
            })
          : undefined;
        const pack = buildInsightPackFromEngine(
          engineOutput,
          labQuotes,
          surveyContext,
          ipDecision,
          ipScenarios.length > 0 ? ipScenarios : undefined,
        );
        return (
          <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ padding: '0.5rem 1rem' }}>
              <button className="back-btn" onClick={() => setJourney(insightPackFromJourney)}>
                ← Back
              </button>
            </div>
            <InsightPackDeck
              pack={pack}
              propertyTitle={labEngineInput.postcode ?? undefined}
              onClose={() => setJourney(insightPackFromJourney)}
            />
          </div>
        );
      })()}
      {journey === 'gallery' && (
        <div style={{ background: 'var(--surface-page, #f8fafc)', minHeight: '100vh' }}>
          <PhysicsVisualGallery onBack={() => setJourney('landing')} />
        </div>
      )}
      {journey === 'dev-menu' && (
        <DevMenuPage
          onBack={() => setJourney('landing')}
          onLoadDemoWorkspace={() => setJourney('workspace-dashboard')}
        />
      )}
      {journey === 'explorer' && EXPLORER_ENABLED && <AtlasExplorerPage onBack={() => setJourney('landing')} />}
      {journey === 'floor-plan' && (
        <div className="floor-plan-page">
          <div className="floor-plan-page__header">
            <button
              className="floor-plan-page__back"
              onClick={() => setJourney('landing')}
              aria-label="Back to home"
            >
              ← Back
            </button>
          </div>
          <FloorPlanBuilder
            surveyResults={{
              systemType: floorPlanSystemType,
            }}
            onChange={(output) => setFloorplanOutput(output.derivedOutputs)}
          />
        </div>
      )}
      {journey === 'heat-loss' && (
        <HeatLossCalculator
          onBack={() => setJourney('landing')}
          onComplete={(totalHL) => {
            const heatLossWatts = Math.round(totalHL * 1000);
            setLabEngineInput(prev => ({ ...(prev ?? CONSOLE_DEMO_INPUT), heatLossWatts }));
            setJourney('simulator');
          }}
        />
      )}
      {journey === 'building-height' && (
        <BuildingHeightCheck onBack={() => setJourney('landing')} />
      )}
      {journey === 'lego-set' && (
        <LegoBuildingSetPage onBack={() => setJourney('landing')} />
      )}
      {/* User Profile — local engineer profile panel */}
      {journey === 'user-profile' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setJourney('workspace-dashboard');
          }}
        >
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxWidth: 520, width: '100%', margin: '0 1rem' }}>
            <UserProfilePanel onClose={() => setJourney('workspace-dashboard')} />
          </div>
        </div>
      )}
      {/* Workspace Dashboard — the primary landing page for each workspace.
           Shows active tenant/user/role, visit buckets, analytics snapshot,
           branding card, and role-aware quick actions. */}
      {journey === 'workspace-dashboard' && (
        <WorkspaceDashboard
          onStartNewVisit={handleStartNewVisit}
          onOpenVisit={handleOpenVisit}
          onOpenAllVisits={() => { setJourney('landing'); setShowVisitsPanel(true); }}
          onOpenAnalytics={() => { window.location.href = '/analytics'; }}
          onOpenBranding={() => { window.location.href = `${window.location.pathname}?brand-settings=1`; }}
          onOpenWorkspaceSettings={() => { window.location.href = `${window.location.pathname}?create-workspace=1`; }}
          onOpenUserProfile={() => setJourney('user-profile')}
          onOpenAllTools={() => setJourney('landing')}
          onOpenDemoExternalFiles={() => {
            setActiveVisitId(DEMO_VISIT_IDS.completed_won);
            setJourney('external-files');
          }}
          onOpenDemoPresentation={() => { void handleOpenPresentation(DEMO_VISIT_IDS.completed_won); }}
          onLoadDemoWorkspace={() => {
            resetDemoData();
            console.info('[Atlas] Demo workspace reloaded from dashboard.');
            setTimeout(() => window.location.reload(), 600);
          }}
        />
      )}
      {journey === 'landing' && (
        <div className="landing">
          {/* Workspace host indicator — visible when the app is accessed via a
               branded subdomain (e.g. demo-heating.atlas-phm.uk).  Confirms to
               the engineer which workspace context is active before any visit
               is created.  Dev mode also shows the raw host for diagnostics. */}
          {hostResolution.source === 'host' && hostResolution.workspaceSlug !== undefined && (
            <div
              data-testid="workspace-host-indicator"
              style={{
                padding: '0.375rem 0.75rem',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 6,
                fontSize: '0.8125rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <span
                data-testid="workspace-host-slug"
                style={{ fontWeight: 600, color: '#166534', fontFamily: 'monospace' }}
              >
                {hostResolution.workspaceSlug}
              </span>
              <span style={{ color: '#64748b' }}>workspace</span>
              {import.meta.env.DEV && (
                <span
                  data-testid="workspace-host-dev-info"
                  style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.6875rem', color: '#94a3b8' }}
                >
                  host:{hostResolution.host} · src:{hostResolution.source}
                </span>
              )}
            </div>
          )}
          <div className="hero">
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => setJourney('workspace-dashboard')}
                style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#4f46e5' }}
              >
                ← Dashboard
              </button>
            </div>
            <h1>
              Atlas Field Visits
            </h1>
            <p className="tagline">
              Create a visit, complete the survey, and generate a recommendation — all in one place.
            </p>
          </div>

          {/* Primary CTAs — new visit + search visits */}
          <div className="visit-cta-row">
            {canCreateVisit && (
              <button
                className="cta-btn cta-btn--visit"
                onClick={handleStartNewVisit}
                aria-haspopup="dialog"
              >
                ＋ New Visit
              </button>
            )}
            <button
              className="cta-btn cta-btn--search-visits"
              onClick={() => setShowVisitsPanel(v => !v)}
              aria-expanded={showVisitsPanel}
              aria-controls="visits-panel"
              aria-label="Search Visits"
            >
              🔍 Open Visit
            </button>
          </div>

          {/* Visits panel — revealed when "Open Visit" is toggled */}
          {showVisitsPanel && (
            <div id="visits-panel">
              <RecentVisitsList onOpenVisit={handleOpenVisit} />
            </div>
          )}

          <div className="journey-cards">
            {/* Quick start — physics-first shortcut, no visit required */}
            <h3 className="journey-section-label">Quick start</h3>
            {labEngineInput != null && (
              <div
                className="journey-card journey-card--featured"
                onClick={() => setJourney('presentation')}
              >
                <div className="card-icon">🎯</div>
                <h2>In-Room Presentation</h2>
                <p>Guided story screen — show the customer what happens, why, and what fixes it.</p>
                <button className="cta-btn">Open Presentation →</button>
              </div>
            )}
            <div
              id="fast-choice-card"
              data-tour="mode-choice"
              className="journey-card fast"
              onClick={() => setJourney('fast')}
            >
              <div className="card-icon">⚡</div>
              <h2>Fast Choice</h2>
              <p>Quick recommendation from key inputs — no visit required.</p>
              <button className="cta-btn">Start Fast Choice →</button>
            </div>

            {/* Alternative workflows — fallback when a visit is not possible */}
            <h3 className="journey-section-label">Alternative workflows</h3>
            <div
              id="survey-panel"
              data-tour="survey-panel"
              className="journey-card journey-card--remote"
              onClick={() => setJourney('remote-survey')}
            >
              <div className="card-icon">📋</div>
              <h2>Remote / Manual Survey</h2>
              <p>Use when surveying off-site by phone, video, or existing customer information.</p>
              <button className="cta-btn">Start Remote Survey →</button>
            </div>

            {/* Visit Workspaces — local / drive import workspace */}
            {canManageWorkspace && (
            <div
              id="visit-workspaces-card"
              className="journey-card"
              onClick={() => { window.location.href = '/workspace'; }}
            >
              <div className="card-icon">📂</div>
              <h2>Visit Workspaces</h2>
              <p>Import, review, and export scan captures — stored locally or on Drive. No DB write until you publish.</p>
              <button className="cta-btn">Open Workspaces →</button>
            </div>
            )}

            {/* Workspace Analytics — tenant KPI dashboard */}
            {canViewAnalytics && (
            <div
              id="workspace-analytics-card"
              className="journey-card"
              onClick={() => { window.location.href = '/analytics'; }}
            >
              <div className="card-icon">📊</div>
              <h2>Workspace Analytics</h2>
              <p>View usage metrics — visits, completion rate, and recommendation selections. No customer data stored.</p>
              <button className="cta-btn">Open Analytics →</button>
            </div>
            )}

            {/* Workspace Branding — local brand editor */}
            {canEditBranding && (
            <div
              id="workspace-branding-card"
              className="journey-card"
              onClick={() => { window.location.href = `${window.location.pathname}?brand-settings=1`; }}
            >
              <div className="card-icon">🎨</div>
              <h2>Workspace Branding</h2>
              <p>Edit your company name, colours, and contact details for Atlas outputs. Saved locally.</p>
              <button className="cta-btn">Open Branding →</button>
            </div>
            )}

            {/* Create Workspace — self-serve workspace onboarding */}
            {canManageWorkspace && (
            <div
              id="create-workspace-card"
              className="journey-card"
              onClick={() => { window.location.href = `${window.location.pathname}?create-workspace=1`; }}
            >
              <div className="card-icon">🏢</div>
              <h2>Create workspace</h2>
              <p>Set up a new Atlas workspace with your branding, contact details, and slug. Saved locally.</p>
              <button className="cta-btn">Create workspace →</button>
            </div>
            )}

            {/* User Profile — local engineer profile */}
            <div
              id="user-profile-card"
              className="journey-card"
              onClick={() => setJourney('user-profile')}
            >
              <div className="card-icon">👤</div>
              <h2>User Profile</h2>
              {activeUser !== null ? (
                <p>Signed in as <strong>{activeUser.displayName}</strong>. Edit your profile or switch user.</p>
              ) : (
                <p>Create a local profile to attribute visits, set a default workspace, and enable dev mode.</p>
              )}
              <button className="cta-btn">{activeUser !== null ? 'Manage Profile →' : 'Set Up Profile →'}</button>
            </div>

            {/* Tools — standalone utilities */}
            <h3 className="journey-section-label">Tools</h3>
            <div
              className="journey-card"
              onClick={() => setJourney('floor-plan')}
            >
              <div className="card-icon">🗺️</div>
              <h2>Floor Plan Builder</h2>
              <p>Map heating components to your property layout across floors.</p>
              <button className="cta-btn">Open Floor Plan →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('heat-loss')}
            >
              <div className="card-icon">🔥</div>
              <h2>Heat Loss Calculator</h2>
              <p>Sketch the property perimeter and get a fast whole-house heat loss estimate.</p>
              <button className="cta-btn">Open Heat Loss →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('building-height')}
            >
              <div className="card-icon">📐</div>
              <h2>Building Height Check</h2>
              <p>Estimate building height from manual distance and captured base/top angles.</p>
              <button className="cta-btn">Open Height Check →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('lego-set')}
            >
              <div className="card-icon">🧱</div>
              <h2>Lego Building Set</h2>
              <p>Assemble heating systems from first-principles blocks — boilers, cylinders, emitters and controls.</p>
              <button className="cta-btn">Open Lego Set →</button>
            </div>
            {/* Physics Visual Library — dev review surface */}
            <div
              className="journey-card"
              onClick={() => setJourney('gallery')}
            >
              <div className="card-icon">🎨</div>
              <h2>Physics Visual Library</h2>
              <p>Dev preview — browse all registered explainer animations with controls and scripts.</p>
              <button className="cta-btn">Open Gallery →</button>
            </div>
            {/* UI Inventory — component browser, only visible when ?devmenu=1 */}
            {DEV_MENU_ENABLED && (
              <div
                className="journey-card"
                onClick={() => setJourney('dev-menu')}
              >
                <div className="card-icon">🗂</div>
                <h2>UI Inventory</h2>
                <p>Browse and classify all registered UI surfaces by human name, code name, category and status.</p>
                <button className="cta-btn">Open UI Inventory →</button>
              </div>
            )}
            {/* System Explorer hidden from primary UX — access via ?explorer=1 */}
          </div>
          <Footer onNavigate={setJourney} />
        </div>
      )}

      {/* New-visit panel — shown when the user clicks "Start new visit".
           StartVisitPanel handles the API call and brand selection internally;
           on success the visit (with brandId) is set as the active visit.
           When the app is accessed via a branded subdomain, defaultWorkspaceSlug
           pre-selects that workspace so the engineer does not have to choose it. */}
      {showNewVisitDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewVisitDialog(false);
            }
          }}
        >
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxWidth: 520, width: '100%', margin: '0 1rem' }}>
            <StartVisitPanel
              onStart={(visit) => {
                setActiveAtlasVisit(visit);
                setActiveVisitId(visit.visitId);
                setShowNewVisitDialog(false);
                setJourney('visit');
              }}
              onCancel={() => {
                setShowNewVisitDialog(false);
              }}
              defaultWorkspaceSlug={
                hostResolution.source === 'host' ? hostResolution.workspaceSlug : undefined
              }
              onCreateWorkspace={() => {
                setShowNewVisitDialog(false);
                window.location.href = `${window.location.pathname}?create-workspace=1`;
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ActiveUserProvider>
      <AppInner />
    </ActiveUserProvider>
  );
}
