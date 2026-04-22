/**
 * CompleteVisitPanel
 *
 * Renders the explicit "Complete Visit" section inside the Visit Hub.
 *
 * Behaviour:
 *  - When the survey is not yet complete: shows a locked "Complete Visit" button
 *    with a clear message that the survey must be finished first.
 *  - When the survey is complete and the visit is not yet formally closed:
 *    shows a readiness checklist and an active "Complete Visit" button.
 *  - When the visit has been formally completed (`completed_at` is set):
 *    shows a read-only "Visit completed" confirmation banner.
 *
 * The completion action:
 *  - persists `completed_at` (ISO timestamp), `completion_method = 'manual_pwa'`,
 *    and `status = 'recommendation_ready'` via the visit API.
 */

import { useState } from 'react';
import { isSurveyComplete, isVisitCompleted, saveVisit, type VisitMeta } from '../../lib/visits/visitApi';
import './CompleteVisitPanel.css';

interface ReadinessItem {
  label: string;
  pass: boolean;
}

function buildReadinessItems(meta: VisitMeta): ReadinessItem[] {
  return [
    {
      label: 'Survey complete',
      pass: isSurveyComplete(meta),
    },
  ];
}

interface Props {
  meta: VisitMeta;
  /** Called after a successful completion save so the parent can refresh meta. */
  onCompleted: (completedAt: string) => void;
}

export default function CompleteVisitPanel({ meta, onCompleted }: Props) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Already completed ──────────────────────────────────────────────────────

  if (isVisitCompleted(meta)) {
    const completedDate = new Date(meta.completed_at!).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <div className="complete-visit-panel complete-visit-panel--done" data-testid="complete-visit-panel-done">
        <div className="complete-visit-panel__icon" aria-hidden="true">✅</div>
        <div className="complete-visit-panel__done-text">
          <strong>Visit completed</strong>
          <span className="complete-visit-panel__done-date">{completedDate}</span>
        </div>
      </div>
    );
  }

  // ── Readiness check ────────────────────────────────────────────────────────

  const items = buildReadinessItems(meta);
  const allPass = items.every(i => i.pass);

  async function handleComplete() {
    if (!allPass || completing) return;
    setCompleting(true);
    setError(null);
    const completedAt = new Date().toISOString();
    try {
      await saveVisit(meta.id, {
        completed_at: completedAt,
        completion_method: 'manual_pwa',
        status: 'recommendation_ready',
      });
      onCompleted(completedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete visit. Please try again.');
      setCompleting(false);
    }
  }

  return (
    <div className="complete-visit-panel" data-testid="complete-visit-panel">
      <h3 className="complete-visit-panel__heading">Complete visit</h3>

      <ul className="complete-visit-panel__checklist" aria-label="Readiness checklist">
        {items.map((item) => (
          <li
            key={item.label}
            className={`complete-visit-panel__check-item complete-visit-panel__check-item--${item.pass ? 'pass' : 'fail'}`}
          >
            <span className="complete-visit-panel__check-icon" aria-hidden="true">
              {item.pass ? '✓' : '✗'}
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      {!allPass && (
        <p className="complete-visit-panel__hint">
          Finish the survey to unlock visit completion.
        </p>
      )}

      {error && (
        <p className="complete-visit-panel__error" role="alert">{error}</p>
      )}

      <button
        className="complete-visit-panel__btn"
        onClick={handleComplete}
        disabled={!allPass || completing}
        aria-disabled={!allPass || completing}
        data-testid="complete-visit-btn"
      >
        {completing ? '⏳ Completing…' : '✔ Complete visit'}
      </button>
    </div>
  );
}
