/**
 * WhatIfScenarioCard.tsx
 *
 * Myth-busting scenario card for the What-If Lab.
 *
 * Renders a four-part structured card:
 *  1. Myth      — the common assumption being busted
 *  2. Verdict   — what actually happens (punchy one-liner badge)
 *  3. Visual    — before/after or wrong/right animated diagram
 *  4. Physics   — why it happens physically (one concise sentence)
 *  5. Recommends — what Atlas would do instead
 *
 * Each scenario is deliberately compact — explainable in under a minute.
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
  const { title, myth, shortVerdict, physicsReason, recommendation, beforeLabel, afterLabel } = scenario;

  return (
    <div className="wisc" aria-label={`Scenario: ${title}`}>

      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="wisc__header">
        <h3 className="wisc__title">{title}</h3>
      </div>

      {/* ── Myth ─────────────────────────────────────────────────────────── */}
      <div className="wisc__section-block">
        <span className="wisc__section-label wisc__section-label--myth">Myth</span>
        <p className="wisc__myth-text">{myth}</p>
      </div>

      {/* ── Verdict badge ────────────────────────────────────────────────── */}
      <span className="wisc__verdict-badge" role="status">
        {shortVerdict}
      </span>

      {/* ── Animated visual ──────────────────────────────────────────────── */}
      <WhatIfVisualFrame beforeLabel={beforeLabel} afterLabel={afterLabel}>
        <VisualComponent />
      </WhatIfVisualFrame>

      {/* ── Physics reason ───────────────────────────────────────────────── */}
      <div className="wisc__section-block">
        <span className="wisc__section-label wisc__section-label--physics">Why this happens</span>
        <p className="wisc__physics-text">{physicsReason}</p>
      </div>

      {/* ── Recommendation ───────────────────────────────────────────────── */}
      <div className="wisc__section-block wisc__section-block--rec">
        <span className="wisc__section-label wisc__section-label--rec">We recommend</span>
        <p className="wisc__rec-text">{recommendation}</p>
      </div>

    </div>
  );
}
