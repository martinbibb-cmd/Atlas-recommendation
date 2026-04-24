/**
 * spatialProofUtils.ts — Shared helpers for spatial proof UI components.
 *
 * Used by both SpatialProofBlockView (customer deck) and SpatialProofSection (portal).
 */

export const OBJECT_ICON: Record<string, string> = {
  boiler:   '🔥',
  cylinder: '🛢️',
  flue:     '🏭',
};

/**
 * Returns an emoji icon for a key-object label string.
 * Falls back to the generic box emoji when no match is found.
 */
export function objectIcon(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(OBJECT_ICON)) {
    if (lower.includes(key)) return icon;
  }
  return '📦';
}
