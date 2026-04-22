import { useState } from 'react';
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

import FloorPlanBuilder from './components/floorplan/FloorPlanBuilder';
import LegoBuildingSetPage from './explainers/lego/LegoBuildingSetPage';
import HeatLossCalculator from './components/heatloss/HeatLossCalculator';
import BuildingHeightCheck from './components/measurements/BuildingHeightCheck';
import AtlasExplorerPage from './components/explorer/AtlasExplorerPage';
import VisitPage from './components/visit/VisitPage';
import VisitHubPage from './components/visit/VisitHubPage';
import RecentVisitsList from './components/visit/RecentVisitsList';
import NewVisitDialog from './components/visit/NewVisitDialog';
import EngineerPreinstallPage from './components/engineer/EngineerPreinstallPage';
import { SpatialTwinPage } from './features/spatialTwin/routes/SpatialTwinPage';
import ReportPage from './components/reportpage/ReportPage';
import CustomerPortalPage from './components/portal/CustomerPortalPage';
import GlobalMenuShell from './components/shell/GlobalMenuShell';

import { createVisit, getVisit } from './lib/visits/visitApi';
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
import HandoffArrivalPage from './components/handoff/HandoffArrivalPage';
import VisitHandoffReviewPage from './features/visitHandoff/components/VisitHandoffReviewPage';
import CustomerSummaryPrintPage from './features/visitHandoff/components/CustomerSummaryPrintPage';
import EngineerSummaryPrintPage from './features/visitHandoff/components/EngineerSummaryPrintPage';
import { SAMPLE_VISIT_HANDOFF_PACK } from './features/visitHandoff/fixtures/sampleVisitHandoffPack';
import InsightPackDeck from './features/insightPack/InsightPackDeck';
import { buildInsightPackFromEngine } from './features/insightPack/buildInsightPackFromEngine';
import type { InsightPackSurveyContext } from './features/insightPack/buildInsightPackFromEngine';
import type { QuoteInput } from './features/insightPack/insightPack.types';
import './App.css';

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
 * Detect ?handoff=1 — renders the canonical AtlasPropertyV1 handoff arrival page.
 * Entry point for post-handoff arrival flow from Atlas Scan.
 * Not visible in production UX.
 */
const HANDOFF_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('handoff') === '1';

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

type Journey = 'landing' | 'visit-hub' | 'visit' | 'visit-handoff' | 'fast' | 'full' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab' | 'lab-quick-inputs' | 'simulator' | 'floor-plan' | 'heat-loss' | 'building-height' | 'explorer' | 'report' | 'presentation' | 'gallery' | 'dev-menu' | 'lego-set' | 'printout' | 'engineer' | 'insight-pack';

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
        />
      </div>
    </div>
  );
}

export default function App() {
  const [journey, setJourney] = useState<Journey>(
    FLOOR_PLAN_TOOL_MODE    ? 'floor-plan'
    : ENGINEER_VISIT_ID != null ? 'engineer'
    : INITIAL_REPORT_ID != null ? 'report'
    : 'landing'
  );
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
   * Option 1 family agreed with the customer during the in-room presentation.
   * Captured via onOptionsChange from PresentationDeck so the printout reflects
   * the same choices as those discussed in the room.
   */
  const [labOption1Family, setLabOption1Family] = useState<ApplianceFamily | null>(null);
  /**
   * Option 2 family agreed with the customer during the in-room presentation.
   */
  const [labOption2Family, setLabOption2Family] = useState<ApplianceFamily | null>(null);
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
    ENGINEER_VISIT_ID ?? undefined,
  );
  /** Controls whether the new-visit dialog is open. */
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  /** Tracks whether "Start new visit" is in flight. */
  const [startingVisit, setStartingVisit] = useState(false);
  /** Inline error shown when visit creation fails. Cleared on retry. */
  const [visitCreateError, setVisitCreateError] = useState<string | null>(null);
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

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('full');
  }

  /**
   * Start a new visit — opens the new-visit dialog to collect an optional
   * reference number, then creates a visit record in D1 and routes to the
   * visit survey shell.
   */
  function handleStartNewVisit() {
    setVisitCreateError(null);
    setShowNewVisitDialog(true);
  }

  /**
   * Confirmed from the new-visit dialog — creates the visit with the supplied
   * reference (may be empty string) and navigates to the visit page.
   *
   * Navigation only happens after the POST succeeds and returns a valid visit
   * id. If creation fails the dialog stays open and shows an inline error.
   */
  async function handleConfirmNewVisit(reference: string) {
    if (startingVisit) return;
    setStartingVisit(true);
    setVisitCreateError(null);
    try {
      const opts = reference.length > 0 ? { visit_reference: reference } : {};
      const { id } = await createVisit(opts);
      console.info('[Atlas] Visit created:', id);
      setActiveVisitId(id);
      setShowNewVisitDialog(false);
      setJourney('visit');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create visit';
      console.error('[Atlas] Visit creation failed:', err);
      setVisitCreateError(message);
    } finally {
      setStartingVisit(false);
    }
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
        setLabOption1Family(null);
        setLabOption2Family(null);
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
        setJourney('printout');
        return;
      }
    } catch (err) {
      console.error('[Atlas] Could not load visit for print summary', visitId, err);
    }
    setJourney('visit');
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

  // /portal/:reference — render the customer-facing recommendation portal.
  if (PORTAL_REFERENCE != null) {
    return <CustomerPortalPage reference={PORTAL_REFERENCE} token={PORTAL_TOKEN} />;
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
    const pack = buildInsightPackFromEngine(engineOutput, DEMO_QUOTES, demoSurveyContext);
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

  // ?scan-package=1 — render Atlas Scan package import flow.
  if (SCAN_PACKAGE_ENABLED) {
    return (
      <ScanPackageImportFlow
        onImported={() => { window.location.href = window.location.pathname; }}
        onCancel={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?devmenu=1 feature flag — render Developer Component Browser directly.
  if (DEV_MENU_ENABLED) {
    return (
      <DevMenuPage onBack={() => { window.location.href = window.location.pathname; }} />
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
    const demoResult = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <CustomerRecommendationPrint
        result={demoResult}
        input={CONSOLE_DEMO_INPUT}
        recommendationResult={demoResult.recommendationResult}
        portalUrl={buildPortalUrl('demo', window.location.origin)}
        visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      />
    );
  }

  return (
    <>
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
      {/* Visit Hub — shown when opening an existing visit */}
      {journey === 'visit-hub' && activeVisitId != null && (
        <VisitHubPage
          visitId={activeVisitId}
          onBack={() => setJourney('landing')}
          onResumeSurvey={() => setJourney('visit')}
          onOpenPresentation={() => { void handleOpenPresentation(activeVisitId); }}
          onPrintSummary={() => { void handlePrintSummary(activeVisitId); }}
          onOpenReport={(reportId) => {
            const reportUrl = `${window.location.origin}/report/${reportId}`;
            window.open(reportUrl, '_blank', 'noopener,noreferrer');
          }}
          onOpenEngineerRoute={() => setJourney('engineer')}
          onOpenInsightPack={() => { void handleOpenInsightPackForVisit(activeVisitId); }}
          onOpenHandoffReview={() => { setActiveHandoffPack(null); setJourney('visit-handoff'); }}
        />
      )}
      {/* Completed-visit handoff review — reachable from Visit Hub after completion */}
      {journey === 'visit-handoff' && (
        <VisitHandoffReviewPage
          initialPack={activeHandoffPack ?? undefined}
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
              // priority chips — mirrors the same pattern used by the 'full' journey.
              if (draft.fullSurvey?.heatLoss) setLabHeatLossState(draft.fullSurvey.heatLoss);
              if (draft.fullSurvey?.priorities) setLabPrioritiesState(draft.fullSurvey.priorities);
              if (draft.fullSurvey?.quotes) setLabQuotes(draft.fullSurvey.quotes);
            }}
            onComplete={(engineInput) => {
              // Survey is complete — store engine input for presentation/simulator use,
              // then route to the Visit Hub so the engineer can formally complete the visit
              // by clicking "Complete visit" and accessing handoff tools.
              setLabEngineInput(engineInput);
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
            onOpenHandoffReview={() => { setActiveHandoffPack(null); setJourney('visit-handoff'); }}
            floorplanOutput={floorplanOutput}
          />
        </GlobalMenuShell>
      )}
      {journey === 'full' && (
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
            }}
            onComplete={(engineInput) => {
              // Route directly to simulator — fit-map step removed.
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setSimulatorFromJourney('full');
              setJourney('simulator');
            }}
            onOpenSimulator={(engineInput) => {
              // Direct shortcut from InsightLayerPage — skip fit-map.
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setSimulatorFromJourney('full');
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
            onOpenPresentation={labEngineInput != null ? () => { setPresentationFromJourney('simulator'); setLabOption1Family(null); setLabOption2Family(null); setJourney('presentation'); } : undefined}
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
          onPrint={() => setJourney('printout')}
          heatLossState={labHeatLossState}
          prioritiesState={labPrioritiesState}
          onOptionsChange={(opt1, opt2) => {
            setLabOption1Family(opt1);
            setLabOption2Family(opt2);
          }}
        />
      )}
      {journey === 'printout' && labEngineInput != null && (() => {
        const result = runEngine(labEngineInput);
        return (
          <CustomerRecommendationPrint
            result={result}
            input={labEngineInput}
            recommendationResult={result.recommendationResult}
            prioritiesState={labPrioritiesState}
            selectedOption1Family={labOption1Family ?? undefined}
            selectedOption2Family={labOption2Family ?? undefined}
            portalUrl={labPortalUrl}
            visitDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            onBack={() => setJourney('presentation')}
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
        const pack = buildInsightPackFromEngine(engineOutput, labQuotes, surveyContext);
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
        <DevMenuPage onBack={() => setJourney('landing')} />
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
      {journey === 'landing' && (
        <div className="landing">
          <div className="hero">
            <h1>
              Atlas Field Visits
            </h1>
            <p className="tagline">
              Create a visit, complete the survey, and generate a recommendation — all in one place.
            </p>
          </div>

          {/* Primary CTAs — new visit + search visits */}
          <div className="visit-cta-row">
            <button
              className="cta-btn cta-btn--visit"
              onClick={handleStartNewVisit}
              aria-haspopup="dialog"
            >
              ＋ New Visit
            </button>
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
            <div
              id="survey-panel"
              data-tour="survey-panel"
              className="journey-card full"
              onClick={() => setJourney('full')}
            >
              <div className="card-icon">🔬</div>
              <h2>Standalone Survey</h2>
              <p>Run a full technical survey without creating a visit record — useful for demos and training.</p>
              <button className="cta-btn">Start Survey →</button>
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

      {/* New-visit dialog — shown when the user clicks "Start new visit" */}
      <NewVisitDialog
        open={showNewVisitDialog}
        creating={startingVisit}
        error={visitCreateError}
        onConfirm={(ref) => { void handleConfirmNewVisit(ref); }}
        onCancel={() => {
          setShowNewVisitDialog(false);
          setVisitCreateError(null);
        }}
      />
    </>
  );
}
