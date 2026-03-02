/**
 * Shared UI constants for the expert pathway panels.
 */

/** Background and text colour for confidence level badges. */
export const CONFIDENCE_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#c6f6d5', text: '#276749', label: '🟢 High confidence' },
  medium: { bg: '#fef3c7', text: '#92400e', label: '🟡 Medium confidence' },
  low:    { bg: '#fed7d7', text: '#9b2c2c', label: '🔴 Low confidence' },
};
