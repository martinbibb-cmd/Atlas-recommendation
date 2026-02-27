export default function MethodologyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="governance-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Methodology</span>
      </div>

      <div className="governance-content">
        <h1>Atlas Methodology</h1>
        <p className="governance-lead">Draft structure — full equations will be published in a future release.</p>

        <h2>1. Heat Loss Modelling</h2>
        <ul>
          <li>Design temperature basis (e.g., −3 °C SAP reference)</li>
          <li>Simplified fabric modelling approach</li>
          <li>Known limitations</li>
        </ul>

        <h2>2. Hydraulic Assessment</h2>
        <ul>
          <li>Velocity thresholds (0.8–1.5 m/s band)</li>
          <li>EN 1057 internal diameter assumptions</li>
          <li>Flow derate modelling</li>
          <li>ASHP risk gating</li>
        </ul>

        <h2>3. Seasonal Efficiency & Band Equivalence</h2>
        <ul>
          <li>SEDBUK thresholds used</li>
          <li>ERP alignment notes</li>
          <li>Effective seasonal % derivation</li>
          <li>Age drift assumptions</li>
        </ul>

        <h2>4. Domestic Hot Water Modelling</h2>
        <ul>
          <li>Mixed @ 40 °C convention</li>
          <li>Overlap probability model (Poisson)</li>
          <li>Combi purge modelling</li>
          <li>Scale derate logic</li>
        </ul>

        <h2>5. Thermal Behaviour Simulation</h2>
        <ul>
          <li>Lumped capacitance model</li>
          <li>Cycling behaviour</li>
          <li>Building mass assumptions</li>
        </ul>

        <h2>6. Known Limitations</h2>
        <ul>
          <li>Does not replace heat-loss calc for MCS submission</li>
          <li>Assumes competent installation</li>
          <li>Does not model micro-zoning anomalies</li>
          <li>Assumes correct commissioning</li>
        </ul>
      </div>
    </div>
  );
}
