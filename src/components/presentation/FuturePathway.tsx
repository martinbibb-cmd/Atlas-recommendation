/**
 * FuturePathway.tsx — Presentation Layer v1.
 *
 * Simple horizontal strip showing the upgrade journey:
 *   Now → Improvements → Future option
 *
 * Example: Stored system → pipe upgrade → heat pump ready
 *
 * Data source: RecommendationResult.interventions (PR11).
 */

import type { RecommendationIntervention } from '../../engine/recommendation/RecommendationModel';
import type { RecommendationDecision } from '../../engine/recommendation/RecommendationModel';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  bestOverall: RecommendationDecision;
  interventions: readonly RecommendationIntervention[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FuturePathway({ bestOverall, interventions }: Props) {
  const nowLabel = FAMILY_SHORT[bestOverall.family] ?? bestOverall.family;

  // Infrastructure and hydraulic upgrades are most relevant for future-pathway
  const pathwayInterventions = interventions
    .filter(
      (i) =>
        i.affectedObjectives.includes('eco') ||
        i.affectedObjectives.includes('longevity') ||
        i.affectedObjectives.includes('performance'),
    )
    .slice(0, 2);

  // Simple future step — if HP is not already the best, suggest heat pump readiness
  const futureStep =
    bestOverall.family !== 'heat_pump' ? 'Heat pump ready' : 'Grid-interactive';

  return (
    <section className="future-pathway" aria-label="Future upgrade pathway">
      <p className="future-pathway__heading">Future pathway</p>
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
            <span className="future-pathway__step-label">Improvement</span>
            <span className="future-pathway__step-name">{intervention.label}</span>
          </div>
        ))}

        {/* Step 3 — Future option */}
        <div className="future-pathway__step future-pathway__step--future" role="listitem">
          <div className="future-pathway__connector" aria-hidden="true">→</div>
          <span className="future-pathway__step-dot" aria-hidden="true" />
          <span className="future-pathway__step-label">Future option</span>
          <span className="future-pathway__step-name">{futureStep}</span>
        </div>
      </div>
    </section>
  );
}
