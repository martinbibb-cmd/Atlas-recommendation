/**
 * WhatIfLab.tsx
 *
 * Interactive "What if…?" explainer lab.
 *
 * Replaces the Behaviour Console with a cause-and-effect learning tool.
 * Each scenario shows a plain-English explanation, key bullet points,
 * and a simple diagram — no engine calculations required.
 *
 * Scenarios are defined in whatIfScenarios.ts so additional explainers
 * can be added later without touching component logic.
 */

import { useState } from 'react';
import type { ComponentType } from 'react';
import { WHAT_IF_SCENARIOS } from './whatIfScenarios';
import type { WhatIfScenario } from './whatIfScenarios';
import BoilerCyclingAnimation from '../whatif/BoilerCyclingAnimation';
import FlowRestrictionAnimation from '../whatif/FlowRestrictionAnimation';
import RadiatorUpgradeAnimation from '../whatif/RadiatorUpgradeAnimation';
import './WhatIfLab.css';

// ─── Re-export for consumers that reference SCENARIOS from this module ────────

/** @deprecated Use WHAT_IF_SCENARIOS from ./whatIfScenarios instead. */
export const SCENARIOS = WHAT_IF_SCENARIOS;

// ─── Diagram components ───────────────────────────────────────────────────────
// NOTE: 'cycling', 'pressure', 'emitters' use the animated versions from
//       src/components/whatif/. The remaining three static diagrams stay here.

function ControlsDiagram() {
  const cyclingPattern = [1, 1, 0, 0, 1, 1, 0, 0] as const;
  const steadyPattern  = [1, 1, 1, 1, 1, 1, 1, 1] as const;
  return (
    <div className="wil-diagram wil-diagram--controls" aria-label="Fixed higher flow vs lower steadier running">
      <div className="wil-diagram__label">Fixed higher flow</div>
      <div className="wil-diagram__bars">
        {cyclingPattern.map((on, i) => (
          <div key={i} className={`wil-diagram__bar wil-diagram__bar--${on ? 'on' : 'off'}`} />
        ))}
      </div>
      <div className="wil-diagram__label wil-diagram__label--secondary">Lower, steadier flow</div>
      <div className="wil-diagram__bars">
        {steadyPattern.map((_, i) => (
          <div key={i} className="wil-diagram__bar wil-diagram__bar--steady" />
        ))}
      </div>
    </div>
  );
}

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

const DIAGRAM_MAP: Record<WhatIfScenario['visualType'], ComponentType> = {
  cycling:   BoilerCyclingAnimation,
  pressure:  FlowRestrictionAnimation,
  emitters:  RadiatorUpgradeAnimation,
  controls:  ControlsDiagram,
  primaries: PrimariesDiagram,
  storage:   StorageDiagram,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function WhatIfLab() {
  const [activeId, setActiveId] = useState<string>(WHAT_IF_SCENARIOS[0].id);

  const active = WHAT_IF_SCENARIOS.find(s => s.id === activeId) ?? WHAT_IF_SCENARIOS[0];
  const DiagramComponent = DIAGRAM_MAP[active.visualType];

  return (
    <div className="wil-wrap">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="wil-header">
        <h2 className="wil-title">What if…?</h2>
        <p className="wil-subtitle">See how system behaviour changes when conditions change.</p>
      </div>

      {/* ── Scenario buttons ───────────────────────────────────────────────── */}
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

      {/* ── Scenario explanation panel ─────────────────────────────────────── */}
      <div className="wil-panel" aria-live="polite">
        <h3 className="wil-panel__title">{active.title}</h3>
        <p className="wil-panel__verdict">{active.shortVerdict}</p>
        <ul className="wil-panel__bullets">
          {active.whyItMatters.map((point, i) => (
            <li key={i} className="wil-panel__bullet">{point}</li>
          ))}
        </ul>
        <div className="wil-panel__diagram">
          <DiagramComponent />
        </div>
      </div>

    </div>
  );
}
