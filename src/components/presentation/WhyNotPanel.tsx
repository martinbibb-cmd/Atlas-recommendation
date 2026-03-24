/**
 * WhyNotPanel.tsx — Presentation Layer v1.
 *
 * Shows a brief explanation for each non-recommended family, tied directly
 * to the limiter that rules it out or constrains it.
 *
 * Data source: RecommendationResult.disqualifiedCandidates (PR11).
 * Each card shows 1 sentence tied to the blocking limiter.
 *
 * Language rules:
 *   - Never say "not suitable" — use "requires a change first" or similar
 *   - Never say "this system fails"
 *   - Use "your home" framing
 */

import type { RecommendationDecision } from '../../engine/recommendation/RecommendationModel';
import type { SurveyorContext } from './presentationTypes';
import { getLimiterHumanCopy } from './limiterHumanLanguage';
import './WhyNotPanel.css';

// ─── Family display helpers ───────────────────────────────────────────────────

const FAMILY_LABEL: Record<string, string> = {
  combi:        'On-demand hot water system',
  system:       'Stored hot water system',
  stored_water: 'Stored hot water system',
  heat_pump:    'Air source heat pump',
  regular:      'Tank-fed hot water system',
  open_vented:  'Tank-fed hot water system',
};

function familyLabel(family: string): string {
  return FAMILY_LABEL[family] ?? family;
}

/**
 * Returns a tailored "resolve this" action sentence based on context.
 * For heat pumps, adjusts framing based on future-proofing flag.
 */
function resolveAction(family: string, surveyorContext: SurveyorContext): string {
  if (family === 'heat_pump' && surveyorContext.futureProofingImportant) {
    return 'This is still the right long-term direction — the steps to get there are clear.';
  }
  if (family === 'heat_pump') {
    return 'Resolve the infrastructure and this becomes a realistic future option.';
  }
  return 'Resolve this and it becomes a realistic option.';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Candidates that were excluded from the primary recommendation. */
  disqualifiedCandidates: readonly RecommendationDecision[];
  /** Surveyor context flags — adjust action sentence framing. */
  surveyorContext?: SurveyorContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhyNotPanel({
  disqualifiedCandidates,
  surveyorContext = { highHotWaterUse: false, futureProofingImportant: false, spaceIsLimited: false, wantsReliability: false, costSensitive: false },
}: Props) {
  if (disqualifiedCandidates.length === 0) {
    return null;
  }

  return (
    <section className="why-not" aria-label="Why not other options">
      <p className="why-not__heading">Why not the others?</p>
      <div className="why-not__cards">
        {disqualifiedCandidates.map((candidate) => {
          const blockingLimiterId = candidate.evidenceTrace.hardStopLimiters[0];
          const reason = blockingLimiterId
            ? getLimiterHumanCopy(blockingLimiterId).headline
            : candidate.caveats[0] ?? 'Worth a closer look before committing.';

          return (
            <div key={candidate.family} className="why-not__card">
              <p className="why-not__family">{familyLabel(candidate.family)}</p>
              <p className="why-not__reason">{reason}</p>
              {blockingLimiterId && (
                <p className="why-not__action">
                  {resolveAction(candidate.family, surveyorContext)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
