/**
 * InterventionsList.tsx — Presentation Layer v1.
 *
 * Shows all upgrade interventions grouped by domain (hot water / heating /
 * infrastructure).
 *
 * Data source: RecommendationResult.interventions (PR11).
 *
 * Grouping:
 *   Hot water     — interventions affecting performance/reliability
 *   Heating       — interventions affecting space_heating
 *   Infrastructure — interventions affecting hydraulic/installability
 */

import type { RecommendationIntervention } from '../../engine/recommendation/RecommendationModel';
import './InterventionsList.css';

// ─── Grouping logic ───────────────────────────────────────────────────────────

interface InterventionGroup {
  label: string;
  icon: string;
  items: RecommendationIntervention[];
}

function groupInterventions(
  interventions: readonly RecommendationIntervention[],
): InterventionGroup[] {
  const hotWater: RecommendationIntervention[] = [];
  const heating: RecommendationIntervention[] = [];
  const infrastructure: RecommendationIntervention[] = [];

  for (const intervention of interventions) {
    const objs = intervention.affectedObjectives;
    if (objs.includes('performance') || objs.includes('reliability')) {
      hotWater.push(intervention);
    } else if (objs.includes('eco') || objs.includes('ease_of_control')) {
      heating.push(intervention);
    } else {
      infrastructure.push(intervention);
    }
  }

  return [
    { label: 'Hot water', icon: '🚿', items: hotWater },
    { label: 'Heating', icon: '🔥', items: heating },
    { label: 'Infrastructure', icon: '🔧', items: infrastructure },
  ].filter((g) => g.items.length > 0);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  interventions: readonly RecommendationIntervention[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterventionsList({ interventions }: Props) {
  if (interventions.length === 0) {
    return (
      <section className="interventions" aria-label="What to improve">
        <p className="interventions__heading">What to improve</p>
        <p className="interventions__empty">No upgrades identified for your home at this time.</p>
      </section>
    );
  }

  const groups = groupInterventions(interventions);

  return (
    <section className="interventions" aria-label="What to improve">
      <p className="interventions__heading">What to improve</p>
      {groups.map((group) => (
        <div key={group.label} className="interventions__group">
          <p className="interventions__group-label">
            <span aria-hidden="true">{group.icon} </span>
            {group.label}
          </p>
          <ul className="interventions__list">
            {group.items.map((item) => (
              <li key={`${item.id}-${item.sourceFamily}`} className="interventions__item">
                <span className="interventions__item-label">{item.label}</span>
                <span className="interventions__item-desc">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
