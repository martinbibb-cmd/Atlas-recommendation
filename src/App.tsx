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
import AtlasTour from './components/tour/AtlasTour';
import FloorPlanBuilder from './components/floorplan/FloorPlanBuilder';
import AtlasExplorerPage from './components/explorer/AtlasExplorerPage';
import VisitPage from './components/visit/VisitPage';
import VisitHubPage from './components/visit/VisitHubPage';
import RecentVisitsList from './components/visit/RecentVisitsList';
import ReportPage from './components/reportpage/ReportPage';
import GlobalMenuShell from './components/shell/GlobalMenuShell';
import { resetAtlasTourSeen } from './lib/tourStorage';
import { createVisit } from './lib/visits/visitApi';
import { listReportsForVisit } from './lib/reports/reportApi';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import { runEngine } from './engine/Engine';
import { getMissingLabFields } from './lib/lab/getMissingLabFields';
import { mergeLabQuickInputs } from './lib/lab/mergeLabQuickInputs';
import type { DerivedFloorplanOutput } from './components/floorplan/floorplanDerivations';
import './App.css';

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
 * Demo engine input used by the report mode (?report=1).
 * Produces a realistic UK combi-vs-stored scenario for demonstration.
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
};

type Journey = 'landing' | 'visit-hub' | 'visit' | 'fast' | 'full' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab' | 'lab-quick-inputs' | 'simulator' | 'floor-plan' | 'explorer' | 'report';

const FLOOR_PLAN_TOOL_MODE =
  typeof window !== 'undefined' && window.location.pathname === '/floor-plan-tool';

/** Detect /report/:id path — renders a saved report by ID. */
const REPORT_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/report\/([^/]+)$/)
    : null;
const INITIAL_REPORT_ID = REPORT_PATH_MATCH ? REPORT_PATH_MATCH[1] : null;

/** Detect ?explorer=1 — allows access to the System Explorer via hidden route. */
const EXPLORER_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('explorer') === '1';

export default function App() {
  const [journey, setJourney] = useState<Journey>(
    FLOOR_PLAN_TOOL_MODE ? 'floor-plan'
    : INITIAL_REPORT_ID != null ? 'report'
    : 'landing'
  );
  /** Active report ID for the /report/:id route. */
  const [activeReportId, setActiveReportId] = useState<string | null>(INITIAL_REPORT_ID);
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();
  /** Controls replay of the landing tour without a full page reload. */
  const [replayLandingTour, setReplayLandingTour] = useState(false);
  /**
   * Partial engine input accumulated before opening the Simulator.
   * Populated by Fast Choice / home entry; merged with quick-input values
   * before the simulator opens.
   */
  const [labPartialInput, setLabPartialInput] = useState<Partial<EngineInputV2_3>>({});
  /** Completed engine input passed to the Simulator Dashboard and LabShell. */
  const [labEngineInput, setLabEngineInput] = useState<EngineInputV2_3 | undefined>();
  const [floorPlanSystemType, setFloorPlanSystemType] = useState<'combi' | 'system' | 'regular' | 'heat_pump' | undefined>();
  /**
   * Latest floor-plan derived output captured from FloorPlanBuilder.
   * Passed to ExplainersHubPage so the simulator and advice surfaces can show
   * which physics assumptions are informed by the floor plan.
   */
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  /** Active visit ID — set when the user starts or opens a visit. */
  const [activeVisitId, setActiveVisitId] = useState<string | undefined>();
  /** Tracks whether "Start new visit" is in flight. */
  const [startingVisit, setStartingVisit] = useState(false);

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('full');
  }

  /**
   * Start a new visit — creates a visit record in D1, then routes to the
   * visit survey shell.  Falls back gracefully to a local-only visit if the
   * API is unreachable (e.g., local dev without Cloudflare bindings).
   */
  async function handleStartNewVisit() {
    if (startingVisit) return;
    setStartingVisit(true);
    try {
      const { id } = await createVisit();
      setActiveVisitId(id);
    } catch {
      // API unavailable — use a local-only UUID so the UX still progresses.
      setActiveVisitId(crypto.randomUUID());
    } finally {
      setStartingVisit(false);
    }
    setJourney('visit');
  }

  /** Open an existing visit by ID — routes to the Visit Hub page. */
  function handleOpenVisit(visitId: string) {
    setActiveVisitId(visitId);
    setJourney('visit-hub');
  }

  /**
   * View recommendation for a completed visit.
   *
   * Resolves the latest saved report linked to the visit.  If one exists,
   * opens it directly on the report page.  Falls back to the survey if no
   * saved report is found (e.g. legacy visit completed before report-saving
   * was introduced).
   */
  async function handleViewRecommendation(visitId: string) {
    try {
      const reports = await listReportsForVisit(visitId);
      // Sort defensively newest-first in case the API order ever changes.
      const latest = Array.isArray(reports)
        ? [...reports].sort((a, b) => {
            const aTime = new Date(a.created_at).getTime();
            const bTime = new Date(b.created_at).getTime();
            return bTime - aTime;
          })[0]
        : null;
      if (latest?.id) {
        setActiveVisitId(visitId);
        setActiveReportId(latest.id);
        setJourney('report');
        return;
      }
    } catch (err) {
      // Log the failure so it is visible in dev tools, then fall back to survey.
      console.error('[Atlas] Could not load reports for visit', visitId, err);
    }
    // Fallback: no saved report — send back to survey so the user can
    // complete and save it.
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
      // any remaining required EngineInputV2_3 fields before opening the simulator.
      setLabEngineInput(mergeLabQuickInputs(partial, {}));
      setJourney('simulator');
    }
  }

  // ?report=1 feature flag — render the unified ReportView with demo engine output.
  if (REPORT_MODE_ENABLED) {
    const { engineOutput } = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <ReportView
        output={engineOutput}
        onBack={() => {
          window.location.href = window.location.pathname;
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
          onViewRecommendation={() => { void handleViewRecommendation(activeVisitId); }}
          onOpenReport={(reportId) => {
            setActiveReportId(reportId);
            setJourney('report');
          }}
        />
      )}
      {journey === 'visit' && activeVisitId != null && (
        <GlobalMenuShell>
          <VisitPage
            visitId={activeVisitId}
            onBack={() => setJourney('landing')}
            onComplete={(engineInput) => {
              setLabEngineInput(engineInput);
              setJourney('simulator');
            }}
            onOpenFloorPlan={(surveyResults) => {
              const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
              setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
              setJourney('floor-plan');
            }}
            onOpenReport={(reportId) => {
              setActiveReportId(reportId);
              setJourney('report');
            }}
            floorplanOutput={floorplanOutput}
          />
        </GlobalMenuShell>
      )}
      {journey === 'full' && (
        <GlobalMenuShell>
          <FullSurveyStepper
            onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }}
            prefill={fullSurveyPrefill}
            onComplete={(engineInput) => {
              // Route directly to the Simulator Dashboard after survey completion —
              // the primary result experience.
              setFullSurveyPrefill(undefined);
              setLabEngineInput(engineInput);
              setJourney('simulator');
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
            onBack={() => setJourney('landing')}
            onOpenSystemLab={() => setJourney('lab')}
            surveyData={labEngineInput}
            floorplanOutput={floorplanOutput}
          />
        </GlobalMenuShell>
      )}
      {journey === 'lab' && <LabShell onHome={() => setJourney('landing')} engineInput={labEngineInput} />}
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
      {journey === 'landing' && (
        <div className="landing">
          {/* PR 1 — First-run tour: landing phase (steps 1–2) */}
          <AtlasTour
            context="landing"
            run={replayLandingTour ? true : undefined}
            onClose={() => setReplayLandingTour(false)}
          />

          <div className="hero">
            <h1>
              <span className="hero-brand">Atlas</span>
              System Lab
            </h1>
            <p className="tagline">
              Compare heating systems and see why one fits better.
            </p>
            <div className="hero-actions">
              <button
                className="tour-replay-link"
                onClick={() => {
                  resetAtlasTourSeen();
                  setReplayLandingTour(true);
                }}
                aria-label="Replay the Atlas tour"
              >
                ? Take a tour
              </button>
            </div>
          </div>

          {/* Primary CTA — Start new visit */}
          <div className="visit-cta-row">
            <button
              className="cta-btn cta-btn--visit"
              onClick={() => { void handleStartNewVisit(); }}
              disabled={startingVisit}
              aria-busy={startingVisit}
            >
              {startingVisit ? 'Creating visit…' : '＋ Start new visit'}
            </button>
          </div>

          {/* Recent visits — open an existing visit */}
          <RecentVisitsList onOpenVisit={handleOpenVisit} />

          <div className="journey-cards">
            <div
              id="fast-choice-card"
              data-tour="mode-choice"
              className="journey-card fast"
              onClick={() => setJourney('fast')}
            >
              <div className="card-icon">⚡</div>
              <h2>Fast Choice</h2>
              <p>Quick recommendation from key inputs.</p>
              <button className="cta-btn">Start Fast Choice →</button>
            </div>
            <div
              id="survey-panel"
              data-tour="survey-panel"
              className="journey-card journey-card--featured full"
              onClick={() => setJourney('full')}
            >
              <div className="card-icon">🔬</div>
              <h2>Full Survey</h2>
              <p>Full technical survey with Simulator Dashboard result.</p>
              <button className="cta-btn">Start Full Survey →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => { setLabEngineInput(undefined); setJourney('lab'); }}
            >
              <div className="card-icon">🔭</div>
              <h2>System Lab</h2>
              <p>Side-by-side system comparison with physical constraints and trade-offs.</p>
              <button className="cta-btn">Open System Lab →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('floor-plan')}
            >
              <div className="card-icon">🗺️</div>
              <h2>Floor Plan Builder</h2>
              <p>Map heating components to your property layout across floors.</p>
              <button className="cta-btn">Open Floor Plan →</button>
            </div>
            {/* System Explorer hidden from primary UX — access via ?explorer=1 */}
          </div>
          <Footer onNavigate={setJourney} />
        </div>
      )}
    </>
  );
}

