/**
 * src/features/analytics/VisitOutcomeActions.tsx
 *
 * Visit outcome action buttons for Atlas.
 *
 * Allows an engineer to mark a completed visit as:
 *   - Won   → records a quote_marked_won event
 *   - Lost  → records a quote_marked_lost event
 *   - Follow up → records a quote_follow_up_required event
 *
 * Privacy rules
 * ─────────────
 * - Only visitId and tenantId are passed to the tracker.
 * - No names, addresses, reports, scans, photos, or payloads are stored.
 * - Outcome is stored as a metadata-only analytics event.
 *
 * Each outcome can only be applied once per render — once the engineer picks
 * one the buttons are replaced with a confirmation message.  A reset callback
 * is provided for cases where the parent wants to allow re-marking (e.g.
 * correcting a mistake).
 */

import { useState } from 'react';
import {
  trackQuoteMarkedWon,
  trackQuoteMarkedLost,
  trackQuoteFollowUpRequired,
} from './analyticsTracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitOutcome = 'won' | 'lost' | 'follow_up';

export interface VisitOutcomeActionsProps {
  /** The visit ID being acted on.  Stored as-is in the analytics event. */
  visitId: string;
  /** Optional tenant — forwarded to the analytics event for aggregation. */
  tenantId?: string;
  /**
   * Called after the outcome event is recorded.
   * Use this to update parent state or navigate away.
   */
  onOutcome?: (outcome: VisitOutcome) => void;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  won: '✓ Marked as won',
  lost: '✗ Marked as lost',
  follow_up: '⏰ Follow-up required',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VisitOutcomeActions({
  visitId,
  tenantId,
  onOutcome,
}: VisitOutcomeActionsProps) {
  const [outcome, setOutcome] = useState<VisitOutcome | null>(null);

  function handleOutcome(selected: VisitOutcome) {
    if (outcome !== null) return; // already marked

    if (selected === 'won') {
      trackQuoteMarkedWon(visitId, tenantId);
    } else if (selected === 'lost') {
      trackQuoteMarkedLost(visitId, tenantId);
    } else {
      trackQuoteFollowUpRequired(visitId, tenantId);
    }

    setOutcome(selected);
    onOutcome?.(selected);
  }

  if (outcome !== null) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          background:
            outcome === 'won'
              ? '#dcfce7'
              : outcome === 'lost'
                ? '#fee2e2'
                : '#fef9c3',
          border: `1px solid ${
            outcome === 'won' ? '#bbf7d0' : outcome === 'lost' ? '#fecaca' : '#fef08a'
          }`,
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color:
            outcome === 'won'
              ? '#15803d'
              : outcome === 'lost'
                ? '#b91c1c'
                : '#854d0e',
        }}
      >
        {OUTCOME_LABELS[outcome]}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={() => handleOutcome('won')}
        style={{
          padding: '8px 18px',
          fontSize: 14,
          fontWeight: 600,
          background: '#16a34a',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Mark won
      </button>
      <button
        onClick={() => handleOutcome('lost')}
        style={{
          padding: '8px 18px',
          fontSize: 14,
          fontWeight: 600,
          background: '#dc2626',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Mark lost
      </button>
      <button
        onClick={() => handleOutcome('follow_up')}
        style={{
          padding: '8px 18px',
          fontSize: 14,
          fontWeight: 600,
          background: '#fff',
          color: '#374151',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Follow up
      </button>
    </div>
  );
}
