/**
 * EnergyLiteracyPanel.tsx — top-level assembly for the Energy Literacy module.
 *
 * Renders all energy explainer components in a scrollable panel with a
 * clear header.  Wired into ExplainersHubPage as a dedicated tab/section.
 *
 * Phase 1 components are shown first (PrimaryEnergyLadder, SpongeHeatPumpExplainer,
 * BigEmitterExplainer, TortoiseVsBeeExplainer, SourceSafetyTable, CopBreakEvenChart).
 *
 * Phase 2 components follow (GridMixStack, SourceEmissionsTable, SourceCostTable).
 *
 * Phase 3 simulator is last (EnergyScenarioSimulator).
 */

import PrimaryEnergyLadder from './PrimaryEnergyLadder';
import SpongeHeatPumpExplainer from './SpongeHeatPumpExplainer';
import BigEmitterExplainer from './BigEmitterExplainer';
import TortoiseVsBeeExplainer from './TortoiseVsBeeExplainer';
import SourceSafetyTable from './SourceSafetyTable';
import CopBreakEvenChart from './CopBreakEvenChart';
import GridMixStack from './GridMixStack';
import SourceEmissionsTable from './SourceEmissionsTable';
import SourceCostTable from './SourceCostTable';
import EnergyScenarioSimulator from './EnergyScenarioSimulator';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import './EnergyLiteracyPanel.css';

export default function EnergyLiteracyPanel() {
  return (
    <section className="elp" aria-labelledby="elp-heading">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="elp__header">
        <h2 id="elp-heading" className="elp__title">{ENERGY_COPY.panelTitle}</h2>
        <p className="elp__subtitle">{ENERGY_COPY.panelSubtitle}</p>
      </div>

      {/* ── Phase 1 — static / lightly interactive explainers ──────────────── */}
      <div className="elp__section">
        <h3 className="elp__section-title">How it works</h3>
        <div className="elp__grid elp__grid--wide">
          <PrimaryEnergyLadder />
          <SpongeHeatPumpExplainer />
          <BigEmitterExplainer />
          <TortoiseVsBeeExplainer />
        </div>
      </div>

      {/* ── Phase 2 — data tables ───────────────────────────────────────────── */}
      <div className="elp__section">
        <h3 className="elp__section-title">Numbers by source</h3>
        <div className="elp__grid">
          <SourceSafetyTable />
          <SourceEmissionsTable />
          <SourceCostTable />
          <GridMixStack />
        </div>
      </div>

      {/* ── Phase 1 COP chart ───────────────────────────────────────────────── */}
      <div className="elp__section">
        <h3 className="elp__section-title">The economics</h3>
        <div className="elp__grid">
          <CopBreakEvenChart />
        </div>
      </div>

      {/* ── Phase 3 — simulator ─────────────────────────────────────────────── */}
      <div className="elp__section">
        <h3 className="elp__section-title">Grid scenario simulator</h3>
        <EnergyScenarioSimulator />
      </div>

    </section>
  );
}
