/**
 * WhatIfScenarioCard.tsx
 *
 * Reusable animated scenario card for the What-If Lab.
 *
 * Renders a structured card with:
 *  - Header: scenario title + short-verdict badge
 *  - Main visual: animated before/after explainer via WhatIfVisualFrame
 *  - Why it matters: concise bullet list
 *  - Optional footer: applicability note
 *
 * The card is deliberately visual-first.  Text confirms what the diagram
 * already showed — it does not replace it.
 *
 * No engine logic — display only.
 */

import type { ComponentType } from 'react';
import WhatIfVisualFrame from './WhatIfVisualFrame';
import type { WhatIfScenario } from '../explainers/whatIfScenarios';
import './WhatIfScenarioCard.css';

export interface WhatIfScenarioCardProps {
  scenario: WhatIfScenario;
  /** The animated (or static) visual component for this scenario. */
  VisualComponent: ComponentType;
}

export default function WhatIfScenarioCard({
  scenario,
  VisualComponent,
}: WhatIfScenarioCardProps) {
  const { title, shortVerdict, whyItMatters, beforeLabel, afterLabel } = scenario;

  return (
    <div className="wisc" aria-label={`Scenario: ${title}`}>

      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="wisc__header">
        <h3 className="wisc__title">{title}</h3>
        <span className="wisc__verdict-badge" role="status">
          {shortVerdict}
        </span>
      </div>

      {/* ── Animated visual ──────────────────────────────────────────────── */}
      <WhatIfVisualFrame beforeLabel={beforeLabel} afterLabel={afterLabel}>
        <VisualComponent />
      </WhatIfVisualFrame>

      {/* ── Why it matters ───────────────────────────────────────────────── */}
      <ul className="wisc__bullets" aria-label="Why this matters">
        {whyItMatters.map((point, i) => (
          <li key={i} className="wisc__bullet">
            {point}
          </li>
        ))}
      </ul>

    </div>
  );
}
