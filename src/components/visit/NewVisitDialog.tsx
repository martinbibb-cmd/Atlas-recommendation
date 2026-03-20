/**
 * NewVisitDialog
 *
 * Modal dialog shown when the user clicks "Start new visit".
 * Prompts for an optional reference number before creating the visit record.
 *
 * The reference is stored in `visit_reference` — a searchable field
 * that appears in the Recent Visits list search.
 */

import { useRef, useState } from 'react';
import './NewVisitDialog.css';

interface Props {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Whether a creation request is in flight. */
  creating: boolean;
  /** Error message from the last creation attempt, if any. */
  error: string | null;
  /** Called when the user confirms (with the trimmed reference or empty string). */
  onConfirm: (reference: string) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

export default function NewVisitDialog({
  open,
  creating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [reference, setReference] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleConfirm() {
    if (creating) return;
    onConfirm(reference.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    // Close only when clicking the backdrop itself, not its children.
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div
      className="nvd-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Start new visit"
      onClick={handleBackdropClick}
    >
      <div className="nvd">
        <div className="nvd__header">
          <h2 className="nvd__title">Start new visit</h2>
          <button
            className="nvd__close"
            onClick={onCancel}
            aria-label="Cancel"
            disabled={creating}
          >
            ✕
          </button>
        </div>

        <div className="nvd__body">
          <label className="nvd__label" htmlFor="nvd-ref-input">
            Reference number
            <span className="nvd__label-hint"> (optional)</span>
          </label>
          <p className="nvd__hint">
            Add your own lead, job or customer reference — makes it easy to find later.
          </p>
          <input
            id="nvd-ref-input"
            ref={inputRef}
            className="nvd__input"
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Lead 12345, Job 678"
            aria-label="Reference number"
            aria-describedby="nvd-hint-text"
            autoFocus
            disabled={creating}
            maxLength={120}
          />
          <span id="nvd-hint-text" className="nvd__label-hint nvd__hidden-hint">
            Add your own lead, job or customer reference
          </span>

          {error && (
            <p className="nvd__error" role="alert">
              ⚠ {error}
            </p>
          )}
        </div>

        <div className="nvd__footer">
          <button
            className="nvd__cancel-btn"
            onClick={onCancel}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            className="nvd__confirm-btn"
            onClick={handleConfirm}
            disabled={creating}
            aria-busy={creating}
          >
            {creating ? 'Creating…' : 'Start visit'}
          </button>
        </div>
      </div>
    </div>
  );
}
