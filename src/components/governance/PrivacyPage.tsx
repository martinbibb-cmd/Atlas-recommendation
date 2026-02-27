export default function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="governance-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Privacy</span>
      </div>

      <div className="governance-content">
        <h1>Privacy</h1>

        <p className="governance-lead">Atlas is designed with minimal data collection.</p>

        <h2>What Atlas collects</h2>
        <ul>
          <li>Survey inputs you provide during a session (pipe diameter, occupancy, pressure readings, etc.)</li>
          <li>No full postcode is stored or transmitted</li>
          <li>No personal identifiers are required to use Atlas</li>
        </ul>

        <h2>What Atlas does not collect</h2>
        <ul>
          <li>No analytics tracking (zero third-party analytics at this time)</li>
          <li>No cookies beyond those required for the session</li>
          <li>No account creation or login required</li>
          <li>No data sold or shared with third parties</li>
        </ul>

        <div className="governance-disclaimer">
          All calculations are performed locally in your browser. Survey data entered during a session
          is not persisted after the browser tab is closed.
        </div>
      </div>
    </div>
  );
}
