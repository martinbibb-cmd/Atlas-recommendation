import { useState } from 'react';
import FastChoiceStepper from './components/stepper/FastChoiceStepper';
import FullSurveyStepper from './components/stepper/FullSurveyStepper';
import PortfolioDashboard from './components/PortfolioDashboard';
import Footer from './components/Footer';
import ScopePage from './components/governance/ScopePage';
import MethodologyPage from './components/governance/MethodologyPage';
import NeutralityPage from './components/governance/NeutralityPage';
import PrivacyPage from './components/governance/PrivacyPage';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import './App.css';

type Journey = 'landing' | 'fast' | 'full' | 'portfolio' | 'scope' | 'methodology' | 'neutrality' | 'privacy';

// Demo portfolio for the Housing Association dashboard
import type { PortfolioProperty } from './engine/schema/EngineInputV2_3';
const CURRENT_YEAR = new Date().getFullYear();
const demoPortfolio: PortfolioProperty[] = [
  {
    assetId: 'HA-001',
    address: '14 Ferndale Road, Birmingham, B15 2TH',
    maintenanceInput: {
      systemAgeYears: 14,
      boilerModelYear: CURRENT_YEAR - 14,
      waterHardnessCategory: 'hard',
      hasScaleInhibitor: false,
      hasMagneticFilter: false,
      annualServicedByEngineer: false,
    },
    lastMcsReviewYear: undefined,
    lastLegionellaAssessmentYear: CURRENT_YEAR - 3,
    lastDynamicPressureBar: 1.2,
  },
  {
    assetId: 'HA-002',
    address: '7 Oak Avenue, Manchester, M14 5GQ',
    maintenanceInput: {
      systemAgeYears: 5,
      boilerModelYear: CURRENT_YEAR - 5,
      waterHardnessCategory: 'moderate',
      hasScaleInhibitor: true,
      hasMagneticFilter: true,
      annualServicedByEngineer: true,
    },
    lastMcsReviewYear: CURRENT_YEAR - 2,
    lastLegionellaAssessmentYear: CURRENT_YEAR - 1,
    lastDynamicPressureBar: 1.8,
  },
  {
    assetId: 'HA-003',
    address: '22 Elm Street, Leeds, LS6 2BU',
    maintenanceInput: {
      systemAgeYears: 10,
      boilerModelYear: CURRENT_YEAR - 10,
      waterHardnessCategory: 'very_hard',
      hasScaleInhibitor: false,
      hasMagneticFilter: true,
      annualServicedByEngineer: true,
    },
    lastMcsReviewYear: CURRENT_YEAR - 6,
    lastLegionellaAssessmentYear: CURRENT_YEAR - 1,
    lastDynamicPressureBar: 0.4,
  },
];

export default function App() {
  const [journey, setJourney] = useState<Journey>('landing');
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('full');
  }

  if (journey === 'fast') return <FastChoiceStepper onBack={() => setJourney('landing')} onEscalate={handleEscalate} />;
  if (journey === 'full') return <FullSurveyStepper onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }} prefill={fullSurveyPrefill} />;
  if (journey === 'portfolio') return <PortfolioDashboard properties={demoPortfolio} onBack={() => setJourney('landing')} />;
  if (journey === 'scope') return <ScopePage onBack={() => setJourney('landing')} />;
  if (journey === 'methodology') return <MethodologyPage onBack={() => setJourney('landing')} />;
  if (journey === 'neutrality') return <NeutralityPage onBack={() => setJourney('landing')} />;
  if (journey === 'privacy') return <PrivacyPage onBack={() => setJourney('landing')} />;

  return (
    <div className="landing">
      <div className="hero">
        <h1>🏠 Atlas Heating Recommendation Engine</h1>
        <p className="subtitle">V2.3 — Pure Physics Core</p>
        <p className="tagline">
          Evidence-based heating recommendations powered by real thermodynamic,
          hydraulic, and geochemical simulation.
        </p>
      </div>
      <div className="journey-cards">
        <div className="journey-card fast" onClick={() => setJourney('fast')}>
          <div className="card-icon">📖</div>
          <h2>Story Toolbox</h2>
          <p className="card-time">~1 minute</p>
          <p>Advisor-led scenario mode. Select a situation, enter a handful of inputs, and see live physics-driven output.</p>
          <ul>
            <li>Combi vs Stored comparison</li>
            <li>Old boiler reality check</li>
            <li>Escalate to Full Survey with prefilled values</li>
          </ul>
          <button className="cta-btn">Start Story →</button>
        </div>
        <div className="journey-card full" onClick={() => setJourney('full')}>
          <div className="card-icon">🔬</div>
          <h2>Full Survey</h2>
          <p className="card-time">~5 minutes</p>
          <p>Complete technical specification with system transition analysis and 10-year performance projections.</p>
          <ul>
            <li>Building mass &amp; thermal inertia</li>
            <li>Geochemical scale analysis</li>
            <li>24-hour comfort simulation</li>
          </ul>
          <button className="cta-btn">Start Full Survey →</button>
        </div>
        <div className="journey-card full" onClick={() => setJourney('portfolio')} style={{ borderColor: '#9f7aea' }}>
          <div className="card-icon">🏘️</div>
          <h2>Portfolio Dashboard</h2>
          <p className="card-time">Housing Associations</p>
          <p>Fleet-level risk ranking and compliance tracking for landlords and housing associations.</p>
          <ul>
            <li>Kettling &amp; sludge risk ranking</li>
            <li>MCS &amp; Legionella compliance</li>
            <li>Proactive maintenance scheduling</li>
          </ul>
          <button className="cta-btn" style={{ background: '#9f7aea' }}>View Portfolio →</button>
        </div>
      </div>
      <Footer onNavigate={setJourney} />
    </div>
  );
}

