/**
 * FuturePathway.tsx — Presentation Layer v1.
 *
 * Simple horizontal strip showing the upgrade journey:
 *   Now → Improvements → Future option
 *
 * Example: Stored system → pipe upgrade → heat pump ready
 *
 * Copy is context-aware — the future pathway sentence changes based on
 * whether future-proofing, cost, or reliability is the customer's priority.
 *
 * Data source: RecommendationResult.interventions (PR11).
 */

import type { RecommendationIntervention } from '../../engine/recommendation/RecommendationModel';
import type { RecommendationDecision } from '../../engine/recommendation/RecommendationModel';
import type { SurveyorContext } from './presentationTypes';
import './FuturePathway.css';

// ─── Family display helpers ───────────────────────────────────────────────────

const FAMILY_SHORT: Record<string, string> = {
  combi:        'On-demand system',
  system:       'Stored system',
  stored_water: 'Stored system',
  heat_pump:    'Heat pump',
  regular:      'Tank-fed system',
  open_vented:  'Tank-fed system',
};

// ─── Context-aware future pathway copy ───────────────────────────────────────

interface FutureStepCopy {
  label: string;
  detail: string;
}

function deriveFutureStepCopy(
  family: string,
  surveyorContext: SurveyorContext,
): FutureStepCopy {
  if (family === 'heat_pump') {
    // Already on the best long-term path
    return {
      label: 'Grid-interactive',
      detail: surveyorContext.costSensitive
        ? 'Time-of-use tariffs can cut running costs further when the system is running efficiently.'
        : 'Time-of-use tariffs and grid export when the system is running efficiently.',
    };
  }

  // Heat pump as next step — tone changes based on priorities
  if (surveyorContext.futureProofingImportant) {
    return {
      label: 'Heat pump ready',
      detail: "This system is designed with that next step in mind — the infrastructure will be in place when you're ready.",
    };
  }
  if (surveyorContext.costSensitive) {
    return {
      label: 'Heat pump pathway',
      detail: 'A heat pump becomes an option once the home is ready — no wasted investment in the meantime.',
    };
  }
  if (surveyorContext.wantsReliability) {
    return {
      label: 'Heat pump ready',
      detail: 'Heat pumps are simpler mechanically than gas boilers — fewer parts that can fail over time.',
    };
  }
  return {
    label: 'Heat pump ready',
    detail: 'Once the infrastructure is in place, a heat pump becomes a realistic next step.',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  bestOverall: RecommendationDecision;
  interventions: readonly RecommendationIntervention[];
  /** Surveyor context flags — adjust future pathway copy to match household priorities. */
  surveyorContext?: SurveyorContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FuturePathway({
  bestOverall,
  interventions,
  surveyorContext = { highHotWaterUse: false, futureProofingImportant: false, spaceIsLimited: false, wantsReliability: false, costSensitive: false },
}: Props) {
  const nowLabel = FAMILY_SHORT[bestOverall.family] ?? bestOverall.family;
  const futureStep = deriveFutureStepCopy(bestOverall.family, surveyorContext);

  // Infrastructure and hydraulic upgrades are most relevant for future-pathway.
  // Deduplicate by ID to avoid repeated steps in the strip.
  const seen = new Set<string>();
  const pathwayInterventions = interventions
    .filter(
      (i) =>
        i.affectedObjectives.includes('eco') ||
        i.affectedObjectives.includes('longevity') ||
        i.affectedObjectives.includes('performance'),
    )
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .slice(0, 2);

  return (
    <section className="future-pathway" aria-label="Future upgrade pathway">
      <p className="future-pathway__heading">Where this leads</p>
      <div className="future-pathway__strip" role="list">
        {/* Step 1 — Now */}
        <div className="future-pathway__step future-pathway__step--now" role="listitem">
          <span className="future-pathway__step-dot" aria-hidden="true" />
          <span className="future-pathway__step-label">Now</span>
          <span className="future-pathway__step-name">{nowLabel}</span>
        </div>

        {/* Step 2 — Improvements (from interventions) */}
        {pathwayInterventions.map((intervention) => (
          <div key={intervention.id} className="future-pathway__step future-pathway__step--improve" role="listitem">
            <div className="future-pathway__connector" aria-hidden="true">→</div>
            <span className="future-pathway__step-dot" aria-hidden="true" />
            <span className="future-pathway__step-label">Upgrade</span>
            <span className="future-pathway__step-name">{intervention.label}</span>
          </div>
        ))}

        {/* Step 3 — Future option */}
        <div className="future-pathway__step future-pathway__step--future" role="listitem">
          <div className="future-pathway__connector" aria-hidden="true">→</div>
          <span className="future-pathway__step-dot" aria-hidden="true" />
          <span className="future-pathway__step-label">Future option</span>
          <span className="future-pathway__step-name">{futureStep.label}</span>
          <span className="future-pathway__step-detail">{futureStep.detail}</span>
        </div>
      </div>
    </section>
  );
}
