/**
 * EvidenceReviewControls.tsx
 *
 * Engineer-facing review action controls for a single evidence item.
 *
 * Renders three action buttons (Confirm / Needs Review / Reject) alongside the
 * current review decision badge.  An optional free-text note input slides open
 * when any action button is pressed.
 *
 * Design rules:
 *   - Does not mutate the underlying SessionCaptureV2.
 *   - Does not call the Atlas engine or alter any recommendation.
 *   - Passes decisions upward via onDecide; parent is responsible for
 *     persistence (via useEvidenceReviewStore).
 *   - The component is self-contained and can be dropped into any evidence
 *     row without context providers.
 *   - Rejected evidence remains visible in engineer mode — only hidden from
 *     customer-facing output.
 */

import { useState } from 'react';
import type { EvidenceItemKind, EvidenceReviewStatus } from './EvidenceReviewDecisionV1';
import { ReviewStatusBadge } from './ReviewStatusBadge';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EvidenceReviewControlsProps {
  /** Stable identifier for the evidence item (e.g. pinId, photoId). */
  itemId: string;
  /** Category of the evidence item (used when calling onDecide). */
  kind: EvidenceItemKind;
  /** Current review status, or undefined if the item has not been reviewed yet. */
  currentStatus?: EvidenceReviewStatus;
  /** Current engineer note for this item. */
  currentNote?: string;
  /**
   * Called when the engineer makes a review decision.
   * The parent (useEvidenceReviewStore) handles persistence.
   */
  onDecide: (
    itemId: string,
    kind: EvidenceItemKind,
    status: EvidenceReviewStatus,
    note?: string,
  ) => void;
  /**
   * Called when the engineer clears an existing decision.
   * If omitted, clearing is not available.
   */
  onClear?: (itemId: string) => void;
}

// ─── Button style helpers ─────────────────────────────────────────────────────

const BASE_BTN: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.15rem 0.5rem',
  borderRadius: 4,
  border: '1px solid',
  cursor: 'pointer',
  lineHeight: 1.5,
  transition: 'opacity 0.12s',
};

const BTN_CONFIRM: React.CSSProperties = {
  ...BASE_BTN,
  background: '#f0fdf4',
  color: '#166534',
  borderColor: '#86efac',
};

const BTN_NEEDS_REVIEW: React.CSSProperties = {
  ...BASE_BTN,
  background: '#fff7ed',
  color: '#9a3412',
  borderColor: '#fdba74',
};

const BTN_REJECT: React.CSSProperties = {
  ...BASE_BTN,
  background: '#fef2f2',
  color: '#991b1b',
  borderColor: '#fca5a5',
};

const BTN_CLEAR: React.CSSProperties = {
  ...BASE_BTN,
  background: '#f8fafc',
  color: '#64748b',
  borderColor: '#cbd5e1',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * EvidenceReviewControls — inline review actions for one evidence item.
 *
 * Shows the current decision badge alongside Confirm / Needs Review / Reject
 * buttons.  When an action button is pressed, a note input appears so the
 * engineer can optionally add context before saving.
 */
export function EvidenceReviewControls({
  itemId,
  kind,
  currentStatus,
  currentNote,
  onDecide,
  onClear,
}: EvidenceReviewControlsProps) {
  // Which action is pending user input (note text)
  const [pendingAction, setPendingAction] = useState<EvidenceReviewStatus | null>(
    null,
  );
  const [noteText, setNoteText] = useState(currentNote ?? '');

  function handleActionClick(status: EvidenceReviewStatus) {
    if (pendingAction === status) {
      // Second click on the same button — save immediately
      onDecide(itemId, kind, status, noteText);
      setPendingAction(null);
    } else {
      setPendingAction(status);
      // Pre-fill note with existing note when switching action
      setNoteText(currentNote ?? '');
    }
  }

  function handleSave() {
    if (!pendingAction) return;
    onDecide(itemId, kind, pendingAction, noteText);
    setPendingAction(null);
  }

  function handleCancel() {
    setPendingAction(null);
    setNoteText(currentNote ?? '');
  }

  const reviewBadgeStatus = currentStatus === 'needs_review'
    ? 'needs_review'
    : currentStatus === 'confirmed'
    ? 'confirmed'
    : currentStatus === 'rejected'
    ? 'rejected'
    : null;

  return (
    <div
      data-testid={`evidence-review-controls-${itemId}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}
    >
      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
        {/* Current decision badge */}
        {reviewBadgeStatus && (
          <ReviewStatusBadge status={reviewBadgeStatus} />
        )}

        {/* Action buttons */}
        <button
          data-testid={`evidence-review-confirm-${itemId}`}
          style={{
            ...BTN_CONFIRM,
            fontWeight: currentStatus === 'confirmed' ? 800 : 600,
            opacity: pendingAction && pendingAction !== 'confirmed' ? 0.6 : 1,
          }}
          aria-label="Confirm this evidence item"
          aria-pressed={currentStatus === 'confirmed'}
          onClick={() => handleActionClick('confirmed')}
        >
          ✓ Confirm
        </button>

        <button
          data-testid={`evidence-review-needs-review-${itemId}`}
          style={{
            ...BTN_NEEDS_REVIEW,
            fontWeight: currentStatus === 'needs_review' ? 800 : 600,
            opacity: pendingAction && pendingAction !== 'needs_review' ? 0.6 : 1,
          }}
          aria-label="Flag this evidence item as needs review"
          aria-pressed={currentStatus === 'needs_review'}
          onClick={() => handleActionClick('needs_review')}
        >
          ⚑ Needs review
        </button>

        <button
          data-testid={`evidence-review-reject-${itemId}`}
          style={{
            ...BTN_REJECT,
            fontWeight: currentStatus === 'rejected' ? 800 : 600,
            opacity: pendingAction && pendingAction !== 'rejected' ? 0.6 : 1,
          }}
          aria-label="Reject this evidence item"
          aria-pressed={currentStatus === 'rejected'}
          onClick={() => handleActionClick('rejected')}
        >
          ✕ Reject
        </button>

        {/* Clear button — only when a decision exists */}
        {currentStatus && onClear && (
          <button
            data-testid={`evidence-review-clear-${itemId}`}
            style={BTN_CLEAR}
            aria-label="Clear review decision"
            onClick={() => {
              setPendingAction(null);
              onClear(itemId);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Note input — slides open when an action is pending */}
      {pendingAction && (
        <div
          data-testid={`evidence-review-note-area-${itemId}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            padding: '0.4rem 0.5rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
          }}
        >
          <label
            htmlFor={`evidence-review-note-${itemId}`}
            style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569' }}
          >
            Engineer note (optional)
          </label>
          <textarea
            id={`evidence-review-note-${itemId}`}
            data-testid={`evidence-review-note-input-${itemId}`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note explaining this decision…"
            rows={2}
            style={{
              fontSize: '0.78rem',
              padding: '0.3rem 0.4rem',
              border: '1px solid #cbd5e1',
              borderRadius: 3,
              resize: 'vertical',
              fontFamily: 'inherit',
              color: '#1e293b',
            }}
          />
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              data-testid={`evidence-review-save-${itemId}`}
              onClick={handleSave}
              style={{
                ...BASE_BTN,
                background: '#1d4ed8',
                color: '#fff',
                borderColor: '#1d4ed8',
              }}
            >
              Save
            </button>
            <button
              data-testid={`evidence-review-cancel-${itemId}`}
              onClick={handleCancel}
              style={BTN_CLEAR}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing note display (when saved and no pending action) */}
      {!pendingAction && currentNote && (
        <div
          data-testid={`evidence-review-saved-note-${itemId}`}
          style={{
            fontSize: '0.72rem',
            color: '#475569',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            padding: '0.25rem 0.4rem',
            fontStyle: 'italic',
          }}
        >
          Note: {currentNote}
        </div>
      )}
    </div>
  );
}
