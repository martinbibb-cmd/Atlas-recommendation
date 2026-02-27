/**
 * shouldShowPanel.ts
 *
 * Utility for the Story Mode results renderer.
 *
 * Determines whether a given output panel should be rendered based on the
 * scenario's outputFocus list.  Default behaviour is backward-compatible:
 * if outputFocus is undefined every panel is shown.
 */

import type { OutputPanel } from '../scenarioRegistry';

/**
 * Returns true when the panel should be rendered.
 *
 * - If `outputFocus` is undefined (scenario predates outputFocus) → show all.
 * - If `outputFocus` is present → show only panels explicitly listed.
 */
export function shouldShowPanel(
  outputFocus: OutputPanel[] | undefined,
  panel: OutputPanel,
): boolean {
  if (outputFocus === undefined) return true;
  return outputFocus.includes(panel);
}
