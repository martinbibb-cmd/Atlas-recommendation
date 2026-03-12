/**
 * WhatIfLab.tsx
 *
 * Interactive "What if…?" explainer lab.
 *
 * Replaces the Behaviour Console with a cause-and-effect learning tool.
 * Each scenario shows a plain-English explanation, key bullet points,
 * and a simple diagram — no engine calculations required.
 *
 * Scenarios are structured as plain data objects so additional explainers
 * can be added later without touching component logic.
 */

import { useState } from 'react';
import './WhatIfLab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagramType =
  | 'cycling'
  | 'pressure'
  | 'radiators'
  | 'weatherComp'
  | 'pipework'
  | 'cylinder';

interface Scenario {
  id: string;
  title: string;
  explanation: string;
  bullets: string[];
  diagramType: DiagramType;
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  {
    id: 'boiler_oversized',
    title: 'Boiler too big',
    explanation:
      'When a boiler is oversized for the heat loss of the building, it reaches target temperature too quickly and switches off. This short-cycle pattern repeats, reducing efficiency and comfort.',
    bullets: [
      'Boiler reaches target temperature quickly',
      'Shuts off before the heat is properly distributed',
      'Starts again repeatedly — known as short-cycling',
      'Reduces seasonal efficiency',
      'Creates uneven comfort across rooms',
    ],
    diagramType: 'cycling',
  },
  {
    id: 'pressure_low',
    title: 'Water pressure too low',
    explanation:
      'Combi boilers require adequate mains pressure to deliver on-demand hot water. Low pressure means the boiler cannot maintain consistent flow, leading to temperature fluctuations during use.',
    bullets: [
      'Combi cannot maintain stable flow rate',
      'Shower temperature fluctuates mid-use',
      'Cold spots occur as pressure dips',
      'A tank-fed hot water system may cope better',
    ],
    diagramType: 'pressure',
  },
  {
    id: 'radiator_upgrade',
    title: 'Upgrade radiators',
    explanation:
      'Larger radiators have more surface area, so they transfer the same heat output at lower water temperatures. Lower flow temperatures allow the boiler to condense more, improving efficiency and heat pump compatibility.',
    bullets: [
      'More surface area means lower flow temperature needed',
      'Boiler condenses more often — higher efficiency',
      'Better compatibility with heat pumps',
      'Improved comfort from steadier heat output',
    ],
    diagramType: 'radiators',
  },
  {
    id: 'weather_comp',
    title: 'Add weather compensation',
    explanation:
      "Weather compensation automatically adjusts the boiler's flow temperature based on outdoor conditions. On milder days the boiler runs cooler and longer, avoiding short-cycling and keeping efficiency high.",
    bullets: [
      'Flow temperature adjusted to outdoor temperature',
      'Boiler runs longer but steadier at lower temperatures',
      'More condensing — higher seasonal efficiency',
      'Less cycling — better comfort and lower wear',
    ],
    diagramType: 'weatherComp',
  },
  {
    id: 'pipework_upgrade',
    title: 'Upgrade primary pipework',
    explanation:
      'Undersized pipework restricts flow and limits how much heat the system can deliver. Upgrading from 15 mm to 22 mm pipe removes this bottleneck, enabling higher output and better heat pump compatibility.',
    bullets: [
      'Larger bore removes flow restriction',
      'Higher system output becomes possible',
      'Reduces noise from high-velocity flow',
      'Essential upgrade for heat pump compatibility',
    ],
    diagramType: 'pipework',
  },
  {
    id: 'cylinder_added',
    title: 'Add cylinder storage',
    explanation:
      'A hot water cylinder stores a tank of pre-heated water, so hot water is available immediately when taps or showers are opened. The boiler reheats the cylinder at a convenient time rather than on-demand at the point of use.',
    bullets: [
      'Hot water available instantly from stored supply',
      'Multiple outlets can run simultaneously',
      'Boiler reheats the cylinder at a scheduled time',
      'Reduces demand peaks on the boiler',
    ],
    diagramType: 'cylinder',
  },
];

// ─── Diagram components ───────────────────────────────────────────────────────

function CyclingDiagram() {
  const pattern = [1, 0, 1, 0, 1, 0, 1, 0] as const;
  return (
    <div className="wil-diagram wil-diagram--cycling" aria-label="Oversized boiler cycling pattern">
      <div className="wil-diagram__label">Oversized boiler</div>
      <div className="wil-diagram__bars">
        {pattern.map((on, i) => (
          <div
            key={i}
            className={`wil-diagram__bar wil-diagram__bar--${on ? 'on' : 'off'}`}
            title={on ? 'Firing' : 'Off'}
          />
        ))}
      </div>
      <div className="wil-diagram__legend">
        <span className="wil-diagram__legend-on">Firing</span>
        <span className="wil-diagram__legend-off">Off</span>
      </div>
    </div>
  );
}

function PressureDiagram() {
  return (
    <div className="wil-diagram wil-diagram--pressure" aria-label="Low pressure demand vs supply">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Demand</span>
        <span className="wil-diagram__icons">🚿 🚿</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Supply</span>
        <span className="wil-diagram__icons">🚿</span>
      </div>
      <div className="wil-diagram__row wil-diagram__row--result">
        <span className="wil-diagram__row-label">Result</span>
        <span className="wil-diagram__icons">Temperature drop ↓</span>
      </div>
    </div>
  );
}

function RadiatorsDiagram() {
  return (
    <div className="wil-diagram wil-diagram--radiators" aria-label="Radiator size vs flow temperature">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Small rads</span>
        <span className="wil-diagram__badge wil-diagram__badge--high">High flow temp</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">Large rads</span>
        <span className="wil-diagram__badge wil-diagram__badge--low">Lower flow temp ✓</span>
      </div>
    </div>
  );
}

function WeatherCompDiagram() {
  const cyclingPattern = [1, 1, 0, 0, 1, 1, 0, 0] as const;
  const steadyPattern  = [1, 1, 1, 1, 1, 1, 1, 1] as const;
  return (
    <div className="wil-diagram wil-diagram--weathercomp" aria-label="Weather compensation vs no controls">
      <div className="wil-diagram__label">Without controls</div>
      <div className="wil-diagram__bars">
        {cyclingPattern.map((on, i) => (
          <div key={i} className={`wil-diagram__bar wil-diagram__bar--${on ? 'on' : 'off'}`} />
        ))}
      </div>
      <div className="wil-diagram__label wil-diagram__label--secondary">With weather compensation</div>
      <div className="wil-diagram__bars">
        {steadyPattern.map((_, i) => (
          <div key={i} className="wil-diagram__bar wil-diagram__bar--steady" />
        ))}
      </div>
    </div>
  );
}

function PipeworkDiagram() {
  return (
    <div className="wil-diagram wil-diagram--pipework" aria-label="Pipework size comparison">
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">15 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--narrow">→ bottleneck</span>
      </div>
      <div className="wil-diagram__row">
        <span className="wil-diagram__row-label">22 mm</span>
        <span className="wil-diagram__pipe wil-diagram__pipe--wide">→ free flow ✓</span>
      </div>
    </div>
  );
}

function CylinderDiagram() {
  return (
    <div className="wil-diagram wil-diagram--cylinder" aria-label="Stored hot water system">
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

const DIAGRAM_MAP: Record<DiagramType, React.ComponentType> = {
  cycling:     CyclingDiagram,
  pressure:    PressureDiagram,
  radiators:   RadiatorsDiagram,
  weatherComp: WeatherCompDiagram,
  pipework:    PipeworkDiagram,
  cylinder:    CylinderDiagram,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function WhatIfLab() {
  const [activeId, setActiveId] = useState<string>(SCENARIOS[0].id);

  const active = SCENARIOS.find(s => s.id === activeId) ?? SCENARIOS[0];
  const DiagramComponent = DIAGRAM_MAP[active.diagramType];

  return (
    <div className="wil-wrap">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="wil-header">
        <h2 className="wil-title">What if…?</h2>
        <p className="wil-subtitle">See how system behaviour changes when conditions change.</p>
      </div>

      {/* ── Scenario buttons ───────────────────────────────────────────────── */}
      <div className="wil-scenarios" role="group" aria-label="Scenario selection">
        {SCENARIOS.map(scenario => (
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
        <h3 className="wil-panel__title">When the {active.title.toLowerCase()}:</h3>
        <p className="wil-panel__explanation">{active.explanation}</p>
        <ul className="wil-panel__bullets">
          {active.bullets.map((bullet, i) => (
            <li key={i} className="wil-panel__bullet">{bullet}</li>
          ))}
        </ul>
        <div className="wil-panel__diagram">
          <DiagramComponent />
        </div>
      </div>

    </div>
  );
}
