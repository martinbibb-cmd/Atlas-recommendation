/**
 * panelConstants.ts
 *
 * Shared confidence badge styles and helper formatters for visualizer panels.
 * Used by ExpertPanel and CustomerSummaryPanel to keep visual language consistent.
 */

import type { ConfidenceV1 } from '../../contracts/EngineOutputV1';

// ── Confidence badge colours ───────────────────────────────────────────────────

export const CONFIDENCE_COLOUR: Record<ConfidenceV1['level'], string> = {
  high:   '#38a169',
  medium: '#d69e2e',
  low:    '#e53e3e',
};

export const CONFIDENCE_BG: Record<ConfidenceV1['level'], string> = {
  high:   '#f0fff4',
  medium: '#fffaf0',
  low:    '#fff5f5',
};

export const CONFIDENCE_BORDER: Record<ConfidenceV1['level'], string> = {
  high:   '#9ae6b4',
  medium: '#fbd38d',
  low:    '#feb2b2',
};

export const CONFIDENCE_LABEL: Record<ConfidenceV1['level'], string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

// ── Pathway status badges ──────────────────────────────────────────────────────

export const PATHWAY_RANK_LABEL: Record<number, string> = {
  1: '⭐ Recommended',
  2: '2nd option',
  3: '3rd option',
};

/** Return a short label for a pathway rank. */
export function formatRankLabel(rank: number): string {
  return PATHWAY_RANK_LABEL[rank] ?? `Option ${rank}`;
}

/** Format a confidence badge string including level and first reason. */
export function formatConfidenceBadge(confidence: ConfidenceV1): string {
  const level = CONFIDENCE_LABEL[confidence.level];
  const reason = confidence.reasons[0] ?? '';
  return reason ? `${level} — ${reason}` : level;
}

/** Strips any HTML-like markup from a string for safe plain-text export. */
export function toPlainText(text: string): string {
  return text.replace(/[<>]/g, '').trim();
}
