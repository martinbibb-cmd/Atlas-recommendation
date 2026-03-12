/**
 * WhatIfLab.tsx
 *
 * Interactive "What if…?" explainer lab.
 *
 * Replaces the Behaviour Console with a cause-and-effect learning tool.
 * Each scenario is rendered as an animated WhatIfScenarioCard — showing
 * what changed, what the system does before/after, and why it matters.
 *
 * Scenarios are defined in whatIfScenarios.ts so additional explainers
 * can be added later without touching component logic.
 *
 * Animation approach: pure CSS keyframes in whatif-animations.css.
 * Reduced-motion support is provided by WhatIfVisualFrame.
 */

import { useState } from 'react';
import type { ComponentType } from 'react';
import { WHAT_IF_SCENARIOS } from './whatIfScenarios';
import type { WhatIfScenario } from './whatIfScenarios';
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

function PrimariesDiagram() {
  return (
    <div className="wil-diagram wil-diagram--primaries" aria-label="Primary pipework size comparison">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">22 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--narrow">→ standard domestic</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">28 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--wide">→ reduced restriction ✓</span>
      </div>
    </div>
  );
}

function StorageDiagram() {
  return (
    <div className="wil-diagram wil-diagram--storage" aria-label="Stored hot water system">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Draw</span>
        <span className="wil-diagram__icons">→ cylinder</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Later</span>
        <span className="wil-diagram__icons">→ reheat</span>
      </div>
    </div>
  );
}

// ─── Visual type → component mapping ─────────────────────────────────────────

const VISUAL_MAP: Record<WhatIfScenario['visualType'], ComponentType> = {
  cycling:   BoilerCyclingAnimation,
  pressure:  FlowRestrictionAnimation,
  emitters:  RadiatorUpgradeAnimation,
  controls:  ControlsVisual,
  primaries: PrimariesDiagram,
  storage:   StorageDiagram,
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
        <p className="wil-subtitle">See how system behaviour changes when conditions change.</p>
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

      {/* ── Animated scenario card ─────────────────────────────────────────── */}
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
