/**
 * panelConstants.ts – Shared confidence badge styles and helper formatters
 * for the expert-first pathway planning UI.
 */

import type { ConfidenceV1 } from '../../contracts/EngineOutputV1';

// ─── Confidence badge styles ──────────────────────────────────────────────────

export const CONFIDENCE_BADGE_STYLE: Record<
  ConfidenceV1['level'],
  { background: string; border: string; color: string }
> = {
  high:   { background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' },
  medium: { background: '#fffaf0', border: '1px solid #fbd38d', color: '#c05621' },
  low:    { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030' },
};

export const CONFIDENCE_LABEL: Record<ConfidenceV1['level'], string> = {
  high:   '✅ High confidence',
  medium: '⚠️ Medium confidence',
  low:    '🔴 Low confidence',
};

// ─── Pathway status colours ────────────────────────────────────────────────────

export const PATHWAY_RANK_BADGE: Record<number, { background: string; color: string }> = {
  1: { background: '#ebf8ff', color: '#2c5282' },
  2: { background: '#faf5ff', color: '#553c9a' },
  3: { background: '#f0fff4', color: '#276749' },
  4: { background: '#fffff0', color: '#744210' },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a pathway option ID.
 */
export function formatPathwayId(id: string): string {
  const labels: Record<string, string> = {
    direct_ashp:               'Direct ASHP Install',
    boiler_mixergy_enablement: 'Boiler + Mixergy → ASHP Ready',
    convert_later_unvented:    'Vented Now → Unvented Later',
    combi_single_tech:         'Combi — Minimum Disruption',
  };
  return labels[id] ?? id;
}
