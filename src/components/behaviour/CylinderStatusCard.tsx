/**
 * CylinderStatusCard.tsx  (behaviour/)
 *
 * Secondary-grid tile for the Behaviour Console.
 * Renders a physics-style explainer for the cylinder/supply behaviour:
 *   - stored path  → CylinderBehaviourGraphic with standard or Mixergy visual
 *   - combi path   → concise text explainer, no graphic
 *
 * This component is a static explainer, not a live instrument.
 * It communicates *how the system type behaves*, not its current state.
 */

import CylinderBehaviourGraphic from './CylinderBehaviourGraphic'
import type { CylinderGraphicType } from './cylinderGraphic.model'

interface Props {
  /**
   * True when the system is an on-demand combi — no cylinder graphic shown.
   */
  isCombi: boolean
  /**
   * True when the stored system is Mixergy-style stratified storage.
   * Defaults to false (standard stored cylinder).
   */
  isMixergy?: boolean
  /**
   * Representative heated fraction for the static explainer (0–1).
   * Defaults to a representative 0.7 when not provided.
   */
  heatedFraction?: number
}

export default function CylinderStatusCard({ isCombi, isMixergy = false, heatedFraction = 0.7 }: Props) {
  const title = isCombi ? 'Supply / draw-off behaviour' : 'Cylinder behaviour'
  const type: CylinderGraphicType = isMixergy ? 'mixergy' : 'standard'

  if (isCombi) {
    return (
      <div className="cylinder-card__body">
        <div className="panel-title">{title}</div>
        <p className="cylinder-card__note">
          On-demand hot water — no cylinder storage.
        </p>
        <p className="cylinder-card__note cylinder-card__note--subtle">
          Supply begins within seconds of a draw; delivery falls immediately
          once the draw ends.
        </p>
      </div>
    )
  }

  return (
    <div className="cylinder-card__body">
      <div className="panel-title">{title}</div>

      {/* Physics-style explainer graphic */}
      <div className="cylinder-card__graphic-area">
        <CylinderBehaviourGraphic
          type={type}
          hotFraction={isMixergy ? undefined : heatedFraction}
          heatedLayerFraction={isMixergy ? heatedFraction : undefined}
          compact
        />
      </div>

      {/* One-sentence behaviour note */}
      <p className="cylinder-card__note">
        {isMixergy
          ? 'Stable delivery until thermocline reaches outlet.'
          : 'Delivery falls progressively as hot water is drawn.'}
      </p>
    </div>
  )
}
