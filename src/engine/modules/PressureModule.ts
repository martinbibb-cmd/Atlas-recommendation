/**
 * PressureModule
 *
 * Analyses mains pressure from static and dynamic readings.
 * Dynamic pressure alone is meaningless — the drop between static
 * (no-flow) and dynamic (under-flow) reveals pipe restriction, shared
 * mains weakness, and whether an unvented or on-demand system will
 * perform reliably.
 *
 * Drop classification:
 *   drop < 0.5 bar  → 'strong'   (minimal restriction)
 *   drop < 1.0 bar  → 'moderate' (acceptable, minor restriction)
 *   drop ≥ 1.0 bar  → 'weak'     (significant restriction — caution for
 *                                   on-demand and unvented systems)
 */

export interface PressureAnalysis {
  /** Static mains pressure (bar) — measured with no flow. */
  staticBar?: number;
  /** Dynamic mains pressure (bar) — measured under flow. */
  dynamicBar: number;
  /** Pressure drop (bar) = static − dynamic. Undefined when static is unknown. */
  dropBar?: number;
  /** Supply quality classification. Undefined when static is unknown. */
  quality?: 'strong' | 'moderate' | 'weak';
  /** Human-readable formatted bullet for contextSummary. */
  formattedBullet: string;
}

/**
 * Analyse mains pressure and compute drop quality.
 *
 * @param dynamicBar  Dynamic mains pressure (bar) — required.
 * @param staticBar   Static mains pressure (bar) — optional.
 */
export function analysePressure(dynamicBar: number, staticBar?: number): PressureAnalysis {
  if (staticBar !== undefined) {
    const dropBar = staticBar - dynamicBar;
    let quality: PressureAnalysis['quality'];
    if (dropBar < 0.5) {
      quality = 'strong';
    } else if (dropBar < 1.0) {
      quality = 'moderate';
    } else {
      quality = 'weak';
    }

    const formattedBullet =
      `Mains pressure: ${staticBar.toFixed(1)} → ${dynamicBar.toFixed(1)} bar ` +
      `(static → dynamic). Drop: ${dropBar.toFixed(1)} bar (${quality}).`;

    return { staticBar, dynamicBar, dropBar, quality, formattedBullet };
  }

  // Dynamic only — static not measured
  const formattedBullet =
    `Mains pressure (dynamic only): ${dynamicBar.toFixed(1)} bar. ` +
    `Static pressure not measured — flow stability unknown.`;

  return { dynamicBar, formattedBullet };
}
