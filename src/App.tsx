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
import LabPrintCustomer from './components/lab/LabPrintCustomer';
import LabPrintTechnical from './components/lab/LabPrintTechnical';
import LabPrintComparison from './components/lab/LabPrintComparison';
import AtlasTour from './components/tour/AtlasTour';
import { resetAtlasTourSeen } from './lib/tourStorage';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import { runEngine } from './engine/Engine';
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

type Journey = 'landing' | 'fast' | 'full' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab';

export default function App() {
  const [journey, setJourney] = useState<Journey>('landing');
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();
  /** Controls replay of the landing tour without a full page reload. */
  const [replayLandingTour, setReplayLandingTour] = useState(false);

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('full');
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
      {journey === 'fast' && <FastChoiceStepper onBack={() => setJourney('landing')} onEscalate={handleEscalate} onOpenLab={() => setJourney('lab')} />}
      {journey === 'full' && <FullSurveyStepper onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }} prefill={fullSurveyPrefill} />}
      {journey === 'scope' && <ScopePage onBack={() => setJourney('landing')} />}
      {journey === 'methodology' && <MethodologyPage onBack={() => setJourney('landing')} />}
      {journey === 'neutrality' && <NeutralityPage onBack={() => setJourney('landing')} />}
      {journey === 'privacy' && <PrivacyPage onBack={() => setJourney('landing')} />}
      {journey === 'lab' && <LabShell onHome={() => setJourney('landing')} />}
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
              onClick={() => setJourney('lab')}
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
          </div>
          <Footer onNavigate={setJourney} />
        </div>
      )}
    </>
  );
}

