/**
 * ExplainerPanel — displays all educational explainers in a responsive grid.
 *
 * This is the dedicated surface for short, 1-minute educational topics.
 * It is intentionally separate from the What-If myth-busting lab so each
 * surface can serve its own purpose without overlap.
 */

import { EDUCATIONAL_EXPLAINERS } from './content';
import ExplainerCard from './ExplainerCard';
import DrivingStylePhysicsExplainer from '../../components/visualizers/DrivingStylePhysicsExplainer';
import './ExplainerPanel.css';

export default function ExplainerPanel() {
  return (
    <section className="ep-panel" aria-labelledby="ep-panel-heading">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="ep-panel__header">
        <h2 id="ep-panel-heading" className="ep-panel__title">
          Physics Explainers
        </h2>
        <p className="ep-panel__subtitle">
          Short, clear explanations of the key concepts behind heating system
          recommendations — each readable in about one minute.
        </p>
      </div>

      {/* ── Driving-style system comparison explainer ──────────────────────── */}
      <div className="ep-panel__visual-explainer">
        <DrivingStylePhysicsExplainer />
      </div>

      {/* ── Cards grid ─────────────────────────────────────────────────────── */}
      <div className="ep-panel__grid">
        {EDUCATIONAL_EXPLAINERS.map((explainer) => (
          <ExplainerCard key={explainer.id} explainer={explainer} />
        ))}
      </div>

    </section>
  );
}
