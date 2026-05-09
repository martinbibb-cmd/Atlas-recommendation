/**
 * WhatIfLab.tsx
 *
 * Myth-busting "What if…?" edge-case physics lab.
 *
 * Each scenario exposes a common assumption about heating systems,
 * shows what actually happens physically, and states what Atlas recommends.
 * Scenarios are compact — each explainable in under a minute.
 *
 * Scenarios are defined in whatIfScenarios.ts so additional myths can be
 * added without touching component logic.
 *
 * Animation approach: pure CSS keyframes in whatif-animations.css.
 * Reduced-motion support is provided by WhatIfVisualFrame.
 */

import { useState } from 'react';
import type { ComponentType } from 'react';
import { WHAT_IF_SCENARIOS } from './whatIfScenarios';
import type { VisualType } from './whatIfScenarios';
import BoilerCyclingAnimation from '../whatif/BoilerCyclingAnimation';
import FlowRestrictionAnimation from '../whatif/FlowRestrictionAnimation';
import RadiatorUpgradeAnimation from '../whatif/RadiatorUpgradeAnimation';
import ControlsVisual from '../whatif/visuals/ControlsVisual';
import WhatIfScenarioCard from '../whatif/WhatIfScenarioCard';
import './WhatIfLab.css';

// ─── Re-export for consumers that reference SCENARIOS from this module ────────

/** @deprecated Use WHAT_IF_SCENARIOS from ./whatIfScenarios instead. */
export const SCENARIOS = WHAT_IF_SCENARIOS;

// ─── Static diagrams for scenarios without animated visuals ──────────────────

export function PrimariesDiagram() {
  return (
    <div className="wil-diagram wil-diagram--primaries" aria-label="Primary pipework size comparison">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">22 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--narrow">→ restricted above ~12 kW</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">28 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--wide">→ adequate flow ✓</span>
      </div>
    </div>
  );
}

export function StorageDiagram() {
  return (
    <div className="wil-diagram wil-diagram--storage" aria-label="Combi efficiency with frequent short DHW draws">
      <div className="wil-diagram__row wil-diagram__row--result">
        <span className="wil-diagram__row-label">Many short draws</span>
        <span className="wil-diagram__icons">→ cold-start losses erode combi efficiency</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Stored hot water</span>
        <span className="wil-diagram__icons">→ already hot · no cold-start penalty ✓</span>
      </div>
    </div>
  );
}

export function HpCylinderDiagram() {
  return (
    <div className="wil-diagram wil-diagram--hp-cylinder" aria-label="Heat-pump cylinder temperature and Legionella risk">
      <div className="wil-diagram__row wil-diagram__row--result">
        <span className="wil-diagram__row-label">55 °C</span>
        <span className="wil-diagram__icons">→ Legionella risk ⚠</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">60 °C</span>
        <span className="wil-diagram__icons">→ weekly kill cycle ✓</span>
      </div>
    </div>
  );
}

export function OversizingDiagram() {
  return (
    <div className="wil-diagram wil-diagram--oversizing" aria-label="Cylinder volume and standing losses">
      <div className="wil-diagram__row wil-diagram__row--result">
        <span className="wil-diagram__row-label">300 L</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--narrow">→ high losses · slow recovery</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">170 L</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--wide">→ right-sized · faster recovery ✓</span>
      </div>
    </div>
  );
}

export function VelocityDiagram() {
  return (
    <div className="wil-diagram wil-diagram--velocity" aria-label="Primary pipe bore and flow threshold">
      <div className="wil-diagram__row wil-diagram__row--result">
        <span className="wil-diagram__row-label">Below threshold</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--narrow">→ extra volume · slow response</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Above threshold</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--wide">→ adequate flow ✓</span>
      </div>
    </div>
  );
}

// ─── Visual type → component mapping ─────────────────────────────────────────

const VISUAL_MAP: Record<VisualType, ComponentType> = {
  cycling:    BoilerCyclingAnimation,
  pressure:   FlowRestrictionAnimation,
  emitters:   RadiatorUpgradeAnimation,
  controls:   ControlsVisual,
  primaries:  PrimariesDiagram,
  storage:    StorageDiagram,
  hp_cylinder: HpCylinderDiagram,
  oversizing: OversizingDiagram,
  velocity:   VelocityDiagram,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function WhatIfLab() {
  const [activeId, setActiveId] = useState<string>(WHAT_IF_SCENARIOS[0].id);

  const active = WHAT_IF_SCENARIOS.find(s => s.id === activeId) ?? WHAT_IF_SCENARIOS[0];
  const VisualComponent = VISUAL_MAP[active.visualType];

  return (
    <div className="wil-wrap">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="wil-header">
        <h2 className="wil-title">What if…?</h2>
        <p className="wil-subtitle">
          Each scenario busts a common assumption — and explains the physics behind what really happens.
        </p>
      </div>

      {/* ── Scenario selector ──────────────────────────────────────────────── */}
      <div className="wil-scenarios" role="group" aria-label="Scenario selection">
        {WHAT_IF_SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            className={`wil-scenario-btn${activeId === scenario.id ? ' wil-scenario-btn--active' : ''}`}
            onClick={() => setActiveId(scenario.id)}
            aria-pressed={activeId === scenario.id}
          >
            {scenario.title}
          </button>
        ))}
      </div>

      {/* ── Myth-busting scenario card ─────────────────────────────────────── */}
      <div aria-live="polite">
        <WhatIfScenarioCard
          key={active.id}
          scenario={active}
          VisualComponent={VisualComponent}
        />
      </div>

    </div>
  );
}
