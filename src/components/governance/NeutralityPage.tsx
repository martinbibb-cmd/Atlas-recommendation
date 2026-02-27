export default function NeutralityPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="governance-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Neutrality Statement</span>
      </div>

      <div className="governance-content">
        <h1>Atlas Neutrality Statement</h1>

        <p className="governance-lead">Atlas is manufacturer-neutral.</p>

        <p>
          Product references are illustrative and do not imply endorsement. Where example products are
          shown, they represent a category of solution rather than a commercial partnership unless
          explicitly stated.
        </p>

        <div className="governance-disclaimer">
          Atlas modelling outcomes are determined entirely by the physics of the installation — pipe
          diameters, pressures, occupancy, and thermal characteristics — not by commercial relationships.
          No manufacturer, distributor, or installer has any influence over assessment verdicts.
        </div>
      </div>
    </div>
  );
}
