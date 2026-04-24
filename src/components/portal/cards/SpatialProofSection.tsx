/**
 * SpatialProofSection.tsx — Portal "Where the work happens" section.
 *
 * Deeper version of the SpatialProofBlock for the portal proof surface.
 * Shows rooms, key objects, route summaries, and confidence badges.
 *
 * Rules:
 *   - No engineer-only detail (no pipe specs, no raw confidence levels).
 *   - Assumed / needs-verification items use softened language.
 *   - No duplicate spatial model — content derived from SpatialProofBlock fields only.
 *   - Confidence badges are simple colours: green = recorded/planned, amber = to check.
 */

import type { SpatialProofBlock } from '../../../contracts/VisualBlock';
import { objectIcon } from '../../presentation/blocks/spatialProofUtils';
import './SpatialProofSection.css';

interface Props {
  block: SpatialProofBlock;
}

/** Determine badge colour from confidence copy. */
function badgeVariant(text: string): 'confirmed' | 'planned' | 'check' {
  const lower = text.toLowerCase();
  if (lower.includes('recorded') || lower.includes('existing') || lower.includes('identified')) {
    return 'confirmed';
  }
  if (lower.includes('planned') || lower.includes('proposed')) {
    return 'planned';
  }
  return 'check';
}

const BADGE_LABEL: Record<'confirmed' | 'planned' | 'check', string> = {
  confirmed: 'Recorded',
  planned:   'Planned',
  check:     'To check',
};

export function SpatialProofSection({ block }: Props) {
  return (
    <section className="spatial-proof-section" aria-label="Where the work happens">
      <h3 className="spatial-proof-section__heading">📍 {block.title}</h3>
      <p className="spatial-proof-section__outcome">{block.outcome}</p>

      {/* Rooms */}
      {block.rooms.length > 0 && (
        <div className="spatial-proof-section__group">
          <h4 className="spatial-proof-section__group-heading">Key rooms</h4>
          <ul className="spatial-proof-section__chip-list" aria-label="Key rooms">
            {block.rooms.map((room) => (
              <li key={room} className="spatial-proof-section__chip spatial-proof-section__chip--room">
                🏠 {room}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key objects */}
      {block.keyObjects.length > 0 && (
        <div className="spatial-proof-section__group">
          <h4 className="spatial-proof-section__group-heading">Proposed equipment</h4>
          <ul className="spatial-proof-section__chip-list" aria-label="Proposed equipment">
            {block.keyObjects.map((obj) => (
              <li key={obj} className="spatial-proof-section__chip spatial-proof-section__chip--object">
                <span aria-hidden="true">{objectIcon(obj)}</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Route summaries */}
      {block.routeSummary.length > 0 && (
        <div className="spatial-proof-section__group">
          <h4 className="spatial-proof-section__group-heading">Proposed routes</h4>
          <ul className="spatial-proof-section__route-list" aria-label="Proposed routes">
            {block.routeSummary.map((route) => (
              <li key={route} className="spatial-proof-section__route-item">
                <span className="spatial-proof-section__route-icon" aria-hidden="true">→</span>
                {route}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence badges */}
      {block.confidenceSummary.length > 0 && (
        <div className="spatial-proof-section__group">
          <h4 className="spatial-proof-section__group-heading">Status summary</h4>
          <ul className="spatial-proof-section__badge-list" aria-label="Status summary">
            {block.confidenceSummary.map((item) => {
              const variant = badgeVariant(item);
              return (
                <li key={item} className={`spatial-proof-section__badge spatial-proof-section__badge--${variant}`}>
                  <span className="spatial-proof-section__badge-label">{BADGE_LABEL[variant]}</span>
                  {item}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
