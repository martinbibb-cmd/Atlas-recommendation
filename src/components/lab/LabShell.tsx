import ExplainersHubPage from '../../explainers/ExplainersHubPage';
import LabHomeLink from './LabHomeLink';
import './lab.css';

interface Props {
  onHome: () => void;
}

export default function LabShell({ onHome }: Props) {
  return (
    <div className="lab-wrap">
      <header className="lab-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-title">
          <h2 style={{ margin: 0 }}>🧱 System Lab</h2>
          <div className="lab-subtitle">Build-your-own system, physics-first.</div>
        </div>
        <div className="lab-pill" title="Lab status">
          MVP shell
        </div>
      </header>

      <main className="lab-main">
        <section className="lab-panel">
          <h3 className="lab-h3">Palette</h3>
          <p className="lab-muted">
            This becomes your component library: heat sources, cylinders, valves, pumps, buffers, vents, etc.
          </p>

          <div className="lab-grid">
            <div className="lab-card">🔥 Heat source (boiler / ASHP)</div>
            <div className="lab-card">🚿 DHW store (unvented / Mixergy / vented)</div>
            <div className="lab-card">🧠 Controls (Y-plan / S-plan / zones)</div>
            <div className="lab-card">🧯 Safety (PRV / tundish / expansion)</div>
            <div className="lab-card">🧱 Hydraulics (buffer / LLH)</div>
            <div className="lab-card">🧰 Emitters (rads / UFH)</div>
          </div>
        </section>

        <section className="lab-panel">
          <h3 className="lab-h3">Workbench</h3>
          <div className="lab-workbench">
            <ExplainersHubPage />
          </div>
        </section>
      </main>
    </div>
  );
}
