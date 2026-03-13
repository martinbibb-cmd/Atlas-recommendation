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

// Priority order for selecting the most actionable unlock item.
// Mirrors RecommendationHub.UNLOCK_PRIORITY (kept local to avoid a circular dep).
const PROVISIONAL_UNLOCK_PRIORITY: ReadonlyArray<RegExp> = [
  /static\s*pressure/i,
  /dynamic|flow/i,
  /cylinder/i,
  /age|plate\s*hex|heat\s*exchanger/i,
];

/**
 * Returns the highest-priority item from an unlockBy list, or null when empty.
 * Uses the same keyword-rank order as TrustStrip in RecommendationHub.
 */
function topUnlockItem(unlockBy: ReadonlyArray<string>): string | null {
  if (unlockBy.length === 0) return null;
  const rank = (item: string): number => {
    for (let i = 0; i < PROVISIONAL_UNLOCK_PRIORITY.length; i++) {
      if (PROVISIONAL_UNLOCK_PRIORITY[i].test(item)) return i;
    }
    return PROVISIONAL_UNLOCK_PRIORITY.length;
  };
  const sorted = [...unlockBy].sort((a, b) => rank(a) - rank(b));
  return sorted[0];
}

/**
 * Returns a provisional note string when evidence is incomplete or confidence is low.
 * Returns null when the result is fully confident and no confirmation is pending.
 *
 * - Low confidence + unlockBy:    "Recommendation is provisional until [item] is confirmed."
 * - Medium confidence + unlockBy: "This recommendation would be firmer with [item]."
 * - High confidence / no unlock:  null
 *
 * Exported for unit testing.
 */
export function buildProvisionalNote(engineOutput: EngineOutputV1): string | null {
  const confidence = engineOutput.meta?.confidence ?? engineOutput.verdict?.confidence;
  if (!confidence) return null;

  const unlockBy = confidence.unlockBy ?? [];
  const level = confidence.level ?? 'medium';
  const top = topUnlockItem(unlockBy);
  if (!top) return null;

  if (level === 'low') {
    return `Recommendation is provisional until ${top} is confirmed.`;
  }
  if (level === 'medium') {
    return `This recommendation would be firmer with ${top}.`;
  }
  return null; // high confidence — no provisional note needed
}

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

/**
 * Returns an eyebrow string appropriate to the recommendation state.
 *
 * - Withheld/multiple:   "🏠 Current best fit based on available survey details"
 * - Low confidence:      "🏠 Best current fit based on available survey details"
 * - Otherwise:           "🏠 Recommended system for this home"
 */
function eyebrowText(primary: string, level: string): string {
  if (isWithheld(primary)) {
    return '🏠 Current best fit based on available survey details';
  }
  if (level === 'low') {
    return '🏠 Best current fit based on available survey details';
  }
  return '🏠 Recommended system for this home';
}

/**
 * Cleans the primary recommendation string for display in the withheld state.
 *
 * "Recommendation withheld — not enough measured data" is engine-internal
 * language.  Replace it with a customer-safe summary that still communicates
 * the situation without sounding broken.
 */
function withheldDisplayText(primary: string): string {
  if (primary.startsWith('Recommendation withheld')) {
    return 'Not enough measured data to lock down a single recommendation.';
  }
  return primary;
}


function topReasonByStatus(engineOutput: EngineOutputV1, status: 'caution' | 'rejected'): string | null {
  const item = engineOutput.eligibility.find(e => e.status === status && e.reason);
  return item?.reason ?? null;
}

export default function SystemRecommendationPanel({ engineOutput }: Props) {

  const primary = engineOutput.recommendation.primary;
  const withheld = isWithheld(primary);
  const bullets = whyBullets(engineOutput);
  const level = confidenceLevel(engineOutput);
  const provisionalNote = buildProvisionalNote(engineOutput);
  const needsChecking = topReasonByStatus(engineOutput, 'caution');
  const combiRejectedReason = engineOutput.eligibility.find(e => e.id === 'on_demand' && e.status === 'rejected')?.reason ?? null;

  return (
    <div className={`rec-summary${withheld ? ' rec-summary--withheld' : ''}`}>
      <p className="rec-summary__eyebrow">
        {eyebrowText(primary, level)}
      </p>

      {withheld ? (
        <p className="rec-summary__title">{withheldDisplayText(primary)}</p>
      ) : (
        <>
          <p className="rec-summary__title">Best fit:</p>
          <p className="rec-summary__system">{primary}</p>
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

      <hr className="rec-summary__divider" />
      <p className="rec-summary__why-label">Top decision summary</p>
      <ul className="rec-summary__bullets">
        <li><strong>Why this fits:</strong> {bullets[0] ?? 'Recommendation based on current measured and survey evidence.'}</li>
        <li><strong>What needs checking:</strong> {needsChecking ?? 'No active caution checks at this stage.'}</li>
        <li><strong>Why combi was ruled out:</strong> {combiRejectedReason ?? 'Combi remains within the viable set for this survey input.'}</li>
      </ul>

      <span
        className={`rec-summary__confidence rec-summary__confidence--${level}`}
        aria-label={`Recommendation confidence: ${CONFIDENCE_LABEL[level] ?? level}`}
      >
        <span aria-hidden="true">{CONFIDENCE_ICON[level] ?? '⚪'}</span>{' '}
        {CONFIDENCE_LABEL[level] ?? level}
      </span>

      {provisionalNote && (
        <p className="rec-summary__provisional-note" role="note">
          {provisionalNote}
        </p>
      )}
    </div>
  );
}
