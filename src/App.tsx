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
import { resetAtlasTourSeen } from './lib/tourStorage';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import { runEngine } from './engine/Engine';
import { getMissingLabFields } from './lib/lab/getMissingLabFields';
import { mergeLabQuickInputs } from './lib/lab/mergeLabQuickInputs';
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

type Journey = 'landing' | 'fast' | 'full' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab' | 'lab-quick-inputs' | 'floor-plan' | 'explorer';

const FLOOR_PLAN_TOOL_MODE =
  typeof window !== 'undefined' && window.location.pathname === '/floor-plan-tool';

export default function App() {
  const [journey, setJourney] = useState<Journey>(FLOOR_PLAN_TOOL_MODE ? 'floor-plan' : 'landing');
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();
  /** Controls replay of the landing tour without a full page reload. */
  const [replayLandingTour, setReplayLandingTour] = useState(false);
  /**
   * Partial engine input accumulated before opening Lab.
   * Populated by Fast Choice / home entry; merged with quick-input values
   * before the full lab opens.
   */
  const [labPartialInput, setLabPartialInput] = useState<Partial<EngineInputV2_3>>({});
  /** Completed engine input passed to LabShell when the lab is fully open. */
  const [labEngineInput, setLabEngineInput] = useState<EngineInputV2_3 | undefined>();
  const [floorPlanSystemType, setFloorPlanSystemType] = useState<'combi' | 'system' | 'regular' | 'heat_pump' | undefined>();

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('full');
  }

  /**
   * Open the System Lab, optionally with a partial engine input already known
   * from Fast Choice.  If simulation-critical fields are missing, route through
   * the quick-input gate first; otherwise open the lab directly.
   */
  function handleOpenLab(partial: Partial<EngineInputV2_3> = {}) {
    setLabPartialInput(partial);
    const missing = getMissingLabFields(partial);
    if (missing.length > 0) {
      setJourney('lab-quick-inputs');
    } else {
      // All quick-form fields are present.  Merge with safe defaults to fill
      // any remaining required EngineInputV2_3 fields before opening the lab.
      setLabEngineInput(mergeLabQuickInputs(partial, {}));
      setJourney('lab');
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
      {journey === 'fast' && <FastChoiceStepper onBack={() => setJourney('landing')} onEscalate={handleEscalate} onOpenLab={handleOpenLab} />}
      {journey === 'full' && (
        <FullSurveyStepper
          onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }}
          prefill={fullSurveyPrefill}
          onComplete={(engineInput) => {
            // Route directly to the simulator after first-pass survey completion,
            // bypassing the text-heavy LiveHubPage intermediate screen.
            setFullSurveyPrefill(undefined);
            setLabEngineInput(engineInput);
            setJourney('lab');
          }}
          onOpenFloorPlan={(surveyResults) => {
            const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
            setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
            setJourney('floor-plan');
          }}
        />
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
            setJourney('lab');
          }}
          onCancel={() => setJourney('landing')}
        />
      )}
      {journey === 'lab' && <LabShell onHome={() => setJourney('landing')} engineInput={labEngineInput} />}
      {journey === 'explorer' && <AtlasExplorerPage onBack={() => setJourney('landing')} />}
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
              className="journey-card journey-card--featured"
              onClick={() => handleOpenLab({})}
            >
              <div className="card-icon">🔭</div>
              <h2>System Lab</h2>
              <p>Side-by-side system comparison with physical constraints and trade-offs.</p>
              <button className="cta-btn">Open System Lab →</button>
            </div>
            <div
              id="survey-panel"
              data-tour="survey-panel"
              className="journey-card full"
              onClick={() => setJourney('full')}
            >
              <div className="card-icon">🔬</div>
              <h2>Full Survey</h2>
              <p>Full technical survey. Detailed inputs for higher confidence.</p>
              <button className="cta-btn">Start Full Survey →</button>
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
            <div
              className="journey-card journey-card--explorer"
              onClick={() => setJourney('explorer')}
            >
              <div className="card-icon">🏠</div>
              <h2>System Explorer</h2>
              <p>Tap through a house to see how each room, radiator, pipe, and boiler connects.</p>
              <button className="cta-btn">Explore System →</button>
            </div>
          </div>
          <Footer onNavigate={setJourney} />
        </div>
      )}
    </>
  );
}

