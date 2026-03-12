/**
 * cylinderGraphic.model.ts
 *
 * Presentation-only helpers for CylinderBehaviourGraphic.
 * Normalises incoming card data into a stable visual state:
 *   - clamps fractions to safe display ranges
 *   - decides standard vs Mixergy rendering path
 *   - derives compact label strings
 *
 * No physics recalculation here — pure display mapping.
 */

export type CylinderGraphicType = 'standard' | 'mixergy'

export interface CylinderBehaviourGraphicProps {
  type: CylinderGraphicType
  /** 0–1: hints gradient intensity for standard cylinders (usable volume factor). */
  hotFraction?: number
  /** 0–1: fraction of cylinder volume currently heated (Mixergy only). */
  heatedLayerFraction?: number
  topTempC?: number | null
  bottomTempC?: number | null
  drawActive?: boolean
  recoveryActive?: boolean
  compact?: boolean
}

export interface CylinderVisualState {
  type: CylinderGraphicType
  /** Hot-zone height as a percentage of the vessel body (5–95). */
  hotZonePct: number
  topTempLabel: string
  bottomLabel: string
  ariaLabel: string
  /** Short behaviour label — e.g. "Gradual blending" */
  behaviourLabel: string
  /** One-sentence note — e.g. "Delivery falls progressively" */
  behaviourNote: string
}

/** Representative Mixergy heated fraction for a static explainer (70% heated). */
export const DEFAULT_HEATED_FRACTION = 0.7

/** Representative standard-cylinder hot fraction for a static explainer (mid-range usable volume). */
export const DEFAULT_HOT_FRACTION = 0.5

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function buildCylinderVisualState(
  props: CylinderBehaviourGraphicProps,
): CylinderVisualState {
  const { type, hotFraction, heatedLayerFraction, topTempC, bottomTempC } = props
  const topLabel = topTempC != null ? `${topTempC}°C` : '—'

  if (type === 'mixergy') {
    const fraction    = heatedLayerFraction ?? hotFraction ?? DEFAULT_HEATED_FRACTION
    const hotZonePct  = clamp(Math.round(fraction * 100), 5, 95)
    const heatedPct   = Math.round(fraction * 100)

    return {
      type: 'mixergy',
      hotZonePct,
      topTempLabel: topLabel,
      bottomLabel: 'cool reserve',
      ariaLabel: `Cylinder schematic: heated layer ${topTempC ?? '—'}°C, ${heatedPct}% heated, cool reserve below`,
      behaviourLabel: 'Defined heated layer',
      behaviourNote: 'Stable delivery until thermocline reaches outlet',
    }
  }

  // Standard — hotZonePct scales with usable volume, capped to avoid
  // the misleading "almost all hot" appearance at high fill factors.
  const fraction    = hotFraction ?? DEFAULT_HOT_FRACTION
  const hotZonePct  = clamp(Math.round(fraction * 60), 15, 50)
  const bottomLabel = bottomTempC != null ? `${bottomTempC}°C` : '—'

  return {
    type: 'standard',
    hotZonePct,
    topTempLabel: topLabel,
    bottomLabel,
    ariaLabel: `Cylinder schematic: top ${topTempC ?? '—'}°C, bulk ${bottomTempC ?? '—'}°C`,
    behaviourLabel: 'Gradual blending',
    behaviourNote: 'Delivery falls progressively',
  }
}
