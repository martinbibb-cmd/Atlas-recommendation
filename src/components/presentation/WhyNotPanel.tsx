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
 *   - Pattern: "Could work here, but… / would feel limited when… / becomes a stronger option when…"
 *   - Heat pump: decisive and long-term positive
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

// ─── Per-family copy helpers ──────────────────────────────────────────────────

/**
 * Returns the "could work here, but…" qualifying sentence.
 * This is shown after the blocking reason to keep the tone non-dismissive.
 */
function couldWorkCaveat(family: string): string {
  switch (family) {
    case 'heat_pump':
      return 'Could work here, but needs some infrastructure first.';
    case 'combi':
      return 'Could work here, but would feel limited during busy mornings.';
    case 'open_vented':
      return 'Could work here, but is better suited to lower-demand homes.';
    default:
      return 'Could work here, but requires a change before it fits well.';
  }
}

/**
 * Returns the "becomes a stronger option when…" future-hook sentence.
 * Keeps the door open and avoids any dismissive framing.
 */
function futureHook(family: string, surveyorContext: SurveyorContext): string {
  if (family === 'heat_pump') {
    return surveyorContext.futureProofingImportant
      ? 'A heat pump is the right direction long-term. With pipe and emitter upgrades, it becomes a strong option for your home.'
      : 'Becomes a strong option once pipework and emitters are upgraded — the path there is clear.';
  }
  if (family === 'combi') {
    return 'Becomes a stronger option in a lower-demand home — and is already worth considering for future properties.';
  }
  return 'Becomes a stronger option when the underlying constraint is resolved.';
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
              <p className="why-not__caveat">{couldWorkCaveat(candidate.family)}</p>
              <p className="why-not__reason">{reason}</p>
              <p className="why-not__hook">
                {futureHook(candidate.family, surveyorContext)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
