export default function ScopePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="governance-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Scope Statement</span>
      </div>

      <div className="governance-content">
        <h1>Our Scope Statement</h1>

        <p className="governance-lead">
          We provide a thermodynamic modelling engine for domestic heating systems.
        </p>

        <h2>We provide</h2>
        <ul>
          <li>Hydraulic viability assessment</li>
          <li>Seasonal efficiency estimation</li>
          <li>Domestic hot water demand modelling</li>
          <li>System architecture comparison</li>
          <li>Behavioural performance simulation</li>
        </ul>

        <h2>We do not provide</h2>
        <ul>
          <li>Financial advice</li>
          <li>Tariff comparison</li>
          <li>Credit brokerage</li>
          <li>Installation contracts</li>
          <li>Regulatory certification</li>
          <li>A substitute for on-site professional survey</li>
        </ul>

        <div className="governance-disclaimer">
          Our outputs are modelled estimates based on declared assumptions and supplied inputs. Final
          system specification, compliance, commissioning, and customer advice remain the responsibility
          of the installing professional.
        </div>
      </div>
    </div>
  );
}
