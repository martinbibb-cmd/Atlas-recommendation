/**
 * CylinderBehaviourGraphic.tsx
 *
 * Physics-style static schematic that distinguishes:
 *   - standard stored hot water  → soft continuous gradient, no sharp bands
 *   - Mixergy stratified storage → defined hot upper layer, narrow thermocline
 *
 * Visual rules
 * ─────────────
 * Standard: full water-filled vessel with a smooth vertical thermal gradient.
 *   No visible air gap, no hard horizontal layer break.  Communicates
 *   progressive blending as hot water is drawn and reheating occurs.
 *
 * Mixergy: water-filled vessel with a solid warm upper layer, a narrow
 *   gradient thermocline band, and a clearly cooler lower bulk.  Communicates
 *   a maintained heated zone with a more abrupt depletion boundary.
 *
 * No engine physics are recalculated here — all values are normalised in
 * cylinderGraphic.model.ts before reaching this component.
 */

import './cylinderGraphic.css'
import { buildCylinderVisualState } from './cylinderGraphic.model'
import type { CylinderBehaviourGraphicProps } from './cylinderGraphic.model'
import { useCylinderAnimationPhase } from './useCylinderAnimationPhase'

export interface AnimatedCylinderProps extends CylinderBehaviourGraphicProps {
  /**
   * When true, the graphic applies animation phase classes and CSS custom
   * properties so CSS transitions make the visual feel alive.
   * Defaults to false (static rendering).
   */
  animate?: boolean
  /**
   * 'auto'   — animated where motion is appropriate (default).
   * 'static' — always render without transitions regardless of animate flag.
   */
  animationMode?: 'auto' | 'static'
}

export default function CylinderBehaviourGraphic(props: AnimatedCylinderProps) {
  const { animate = false, animationMode = 'auto' } = props
  const vs = buildCylinderVisualState(props)
  const compact = props.compact ?? false

  const { phaseClass, cssVars } = useCylinderAnimationPhase({
    type: props.type,
    drawActive: props.drawActive,
    recoveryActive: props.recoveryActive,
    hotFraction: props.hotFraction,
    heatedLayerFraction: props.heatedLayerFraction,
  })

  const shouldAnimate = animate && animationMode !== 'static'

  const wrapperClass = [
    'cbg',
    compact ? 'cbg--compact' : '',
    shouldAnimate ? 'cbg--animated' : '',
    shouldAnimate ? phaseClass : '',
  ].filter(Boolean).join(' ')

  // Apply CSS variables whenever animation is requested so the correct visual
  // phase renders even in reduced-motion mode (where transitions are disabled
  // by the @media rule but the phase state should still be reflected).
  const wrapperStyle = shouldAnimate ? cssVars : {}

  return (
    <div className={wrapperClass} style={wrapperStyle}>

      {/* ── Visual vessel (role=img, purely graphical) ──────────────── */}
      <div
        className="cbg__graphic"
        role="img"
        aria-label={vs.ariaLabel}
      >
        {/* Top elliptical fitting */}
        <div className="cbg__fitting cbg__fitting--top" aria-hidden="true" />

        {/* Vessel body — liquid fill */}
        <div className="cbg__vessel" aria-hidden="true">
          {vs.type === 'standard' ? (
            /* Standard: single continuous gradient, no zone boundaries */
            <div className="cbg__liquid cbg__liquid--standard" />
          ) : (
            /* Mixergy: defined hot layer + narrow thermocline + cool bulk */
            <>
              <div
                className="cbg__hot-zone"
                style={{ height: `${vs.hotZonePct}%` }}
              />
              <div className="cbg__thermocline cbg__thermocline--mixergy" />
              <div className="cbg__cool-zone">
                <span className="cbg__zone-label">{vs.bottomLabel}</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom elliptical fitting */}
        <div className="cbg__fitting cbg__fitting--bottom" aria-hidden="true" />
      </div>

      {/* ── Behaviour label row ─────────────────────────────────────── */}
      <div className="cbg__label-row">
        <span className="cbg__behaviour-label">{vs.behaviourLabel}</span>
        {vs.type === 'mixergy' && (
          <span className="cbg__heated-tag">Heated layer</span>
        )}
      </div>
    </div>
  )
}
