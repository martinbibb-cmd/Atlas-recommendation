/**
 * PressureModule
 *
 * Analyses mains pressure from static and dynamic readings.
 * The static-to-dynamic drop is a diagnostic clue (restriction/shared main)
 * but does NOT classify supply quality on its own.
 *
 * Hard rule: dynamic must not exceed static (within tolerance).
 * If dynamicBar > staticBar + 0.2, readings are flagged as inconsistent.
 */

/** Tolerance (bar) for dynamic > static inconsistency check. */
const INCONSISTENCY_TOLERANCE = 0.2;
/** Drop threshold (bar) above which a large-drop warning note is added. */
const LARGE_DROP_THRESHOLD = 1.0;

export interface PressureAnalysis {
  /** Static mains pressure (bar) — measured with no flow. */
  staticBar?: number;
  /** Dynamic mains pressure (bar) — measured under flow. */
  dynamicBar: number;
  /** Pressure drop (bar) = static − dynamic. Only set when both readings are present and consistent. */
  dropBar?: number;
  /** True when dynamicBar > staticBar + tolerance — readings are physically inconsistent. */
  inconsistentReading?: boolean;
  /** Diagnostic notes (never eligibility verdicts). */
  notes: string[];
  /** Human-readable formatted bullet for contextSummary. */
  formattedBullet: string;
}

/**
 * Analyse mains pressure and compute drop diagnostics.
 *
 * @param dynamicBar  Dynamic mains pressure (bar) — required.  May be 0 for flow-cup tests.
 * @param staticBar   Static mains pressure (bar) — optional.
 */
export function analysePressure(dynamicBar: number, staticBar?: number): PressureAnalysis {
  const notes: string[] = [];

  if (staticBar !== undefined) {
    // Hard rule: dynamic must not exceed static (within tolerance)
    if (dynamicBar > staticBar + INCONSISTENCY_TOLERANCE) {
      const formattedBullet =
        `Mains pressure: ${staticBar.toFixed(1)} bar static / ${dynamicBar.toFixed(1)} bar dynamic ` +
        `— readings inconsistent (dynamic > static). Recheck.`;
      notes.push('Static/dynamic inconsistent (dynamic > static) — recheck readings.');
      return { staticBar, dynamicBar, inconsistentReading: true, notes, formattedBullet };
    }

    const dropBar = staticBar - dynamicBar;

    if (dropBar >= LARGE_DROP_THRESHOLD) {
      notes.push('Large pressure drop suggests restriction/shared main — confirm with a flow test.');
    }

    const formattedBullet =
      `Mains pressure: ${staticBar.toFixed(1)} → ${dynamicBar.toFixed(1)} bar ` +
      `(static → dynamic). Drop: ${dropBar.toFixed(1)} bar.`;

    return { staticBar, dynamicBar, dropBar, notes, formattedBullet };
  }

  // Dynamic only — static not measured
  const formattedBullet =
    `Mains pressure (dynamic only): ${dynamicBar.toFixed(1)} bar. ` +
    `Static pressure not measured — flow stability unknown.`;

  return { dynamicBar, notes, formattedBullet };
}
