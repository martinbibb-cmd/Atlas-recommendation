/**
 * SystemRecommendationPanel — the headline recommendation summary card.
 *
 * Sits at the top of the results page. Shows the recommended system,
 * why it suits the property, and the recommendation confidence level.
 *
 * Rules:
 * - Must NEVER mention system failures or rejection language.
 * - Only explains why the recommended system is a good fit.
 * - All data must come from EngineOutputV1 — no re-derivation.
 */
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import './results.css';

interface Props {
  engineOutput: EngineOutputV1;
}

const CONFIDENCE_ICON: Record<string, string> = {
  high:   '🟢',
  medium: '🟡',
  low:    '🔴',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

/** Derives the best-fit system label from the primary recommendation string. */
function bestFitLabel(primary: string): string {
  if (primary.startsWith('Recommendation withheld')) return primary;
  if (primary.startsWith('Multiple')) return primary;
  return primary;
}

/**
 * Returns bullets explaining why the recommended system suits the property.
 * Uses verdict.reasons first, then contextSummary as a fallback.
 */
function whyBullets(engineOutput: EngineOutputV1): string[] {
  const verdict = engineOutput.verdict;
  if (verdict && verdict.status !== 'fail' && verdict.reasons.length > 0) {
    return verdict.reasons;
  }
  // For a viable recommendation, show the winning option's why[] if available
  const winningOption = (engineOutput.options ?? []).find(
    o => o.status === 'viable',
  );
  if (winningOption && winningOption.why.length > 0) {
    return winningOption.why;
  }
  // Fall back to context summary bullets
  return engineOutput.contextSummary?.bullets ?? [];
}

/** Returns the confidence level for the overall recommendation. */
function confidenceLevel(engineOutput: EngineOutputV1): 'high' | 'medium' | 'low' {
  return engineOutput.meta?.confidence?.level
    ?? engineOutput.verdict?.confidence?.level
    ?? 'medium';
}

/** True when the engine withheld or couldn't give a single recommendation. */
function isWithheld(primary: string): boolean {
  return (
    primary.startsWith('Recommendation withheld') ||
    primary.startsWith('Multiple')
  );
}

export default function SystemRecommendationPanel({ engineOutput }: Props) {
  const primary = engineOutput.recommendation.primary;
  const withheld = isWithheld(primary);
  const bullets = whyBullets(engineOutput);
  const level = confidenceLevel(engineOutput);

  return (
    <div className={`rec-summary${withheld ? ' rec-summary--withheld' : ''}`}>
      <p className="rec-summary__eyebrow">
        🏠 Recommended system for this home
      </p>

      {withheld ? (
        <p className="rec-summary__title">{primary}</p>
      ) : (
        <>
          <p className="rec-summary__title">Best fit:</p>
          <p className="rec-summary__system">{bestFitLabel(primary)}</p>
        </>
      )}

      {bullets.length > 0 && (
        <>
          <hr className="rec-summary__divider" />
          <p className="rec-summary__why-label">Why this suits the property</p>
          <ul className="rec-summary__bullets">
            {bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </>
      )}

      <span
        className={`rec-summary__confidence rec-summary__confidence--${level}`}
        aria-label={`Recommendation confidence: ${CONFIDENCE_LABEL[level] ?? level}`}
      >
        <span aria-hidden="true">{CONFIDENCE_ICON[level] ?? '⚪'}</span>{' '}
        {CONFIDENCE_LABEL[level] ?? level}
        {engineOutput.meta?.confidence?.reasons?.[0]
          ? ` — ${engineOutput.meta.confidence.reasons[0]}`
          : ''}
      </span>
    </div>
  );
}
