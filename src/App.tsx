import { useState } from 'react';
import FastChoiceStepper from './components/stepper/FastChoiceStepper';
import FullSurveyStepper from './components/stepper/FullSurveyStepper';
import './App.css';

type Journey = 'landing' | 'fast' | 'full';

export default function App() {
  const [journey, setJourney] = useState<Journey>('landing');

  if (journey === 'fast') return <FastChoiceStepper onBack={() => setJourney('landing')} />;
  if (journey === 'full') return <FullSurveyStepper onBack={() => setJourney('landing')} />;

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
          <div className="card-icon">⚡</div>
          <h2>Fast Choice</h2>
          <p className="card-time">~30 seconds</p>
          <p>Instant red-flag elimination of unsuitable technology based on your home's physical constraints.</p>
          <ul>
            <li>Bathroom count &amp; occupancy</li>
            <li>Loft conversion status</li>
            <li>Pipe diameter &amp; heat loss</li>
          </ul>
          <button className="cta-btn">Start Fast Filter →</button>
        </div>
        <div className="journey-card full" onClick={() => setJourney('full')}>
          <div className="card-icon">🔬</div>
          <h2>Full Survey</h2>
          <p className="card-time">~5 minutes</p>
          <p>Complete technical specification with bill of materials and 10-year performance projections.</p>
          <ul>
            <li>Building mass &amp; thermal inertia</li>
            <li>Geochemical scale analysis</li>
            <li>24-hour comfort simulation</li>
          </ul>
          <button className="cta-btn">Start Full Survey →</button>
        </div>
      </div>
    </div>
  );
}
