/**
 * PortalFindingsSection.tsx
 *
 * Section A — "What we found in your home."
 *
 * Shows: current setup, household/use facts, priorities, constraints, and
 * evidence-backed observation snippets.
 */

import type { JourneyFindings } from '../types/portalJourney.types';

interface Props {
  findings: JourneyFindings;
}

export default function PortalFindingsSection({ findings }: Props) {
  const {
    currentSystem,
    householdSummary,
    propertySummary,
    priorities,
    constraints,
    evidenceSummary,
  } = findings;

  return (
    <section
      className="portal-section portal-journey-findings"
      aria-labelledby="portal-findings-heading"
      data-testid="portal-findings-section"
    >
      <h2 className="portal-section__heading" id="portal-findings-heading">
        What we found in your home
      </h2>

      <div className="portal-findings__grid">

        {/* Current setup */}
        {(currentSystem || householdSummary || propertySummary) && (
          <div className="portal-findings__card" data-testid="portal-findings-setup">
            <h3 className="portal-findings__card-title">Your setup</h3>
            <dl className="portal-findings__details">
              {currentSystem && (
                <div className="portal-findings__detail-row">
                  <dt>Current system</dt>
                  <dd>{currentSystem}</dd>
                </div>
              )}
              {householdSummary && (
                <div className="portal-findings__detail-row">
                  <dt>Household</dt>
                  <dd>{householdSummary}</dd>
                </div>
              )}
              {propertySummary && (
                <div className="portal-findings__detail-row">
                  <dt>Property</dt>
                  <dd>{propertySummary}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Priorities */}
        {priorities.length > 0 && (
          <div className="portal-findings__card" data-testid="portal-findings-priorities">
            <h3 className="portal-findings__card-title">Priorities noted</h3>
            <ul className="portal-findings__list">
              {priorities.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {/* Constraints */}
        {constraints.length > 0 && (
          <div className="portal-findings__card portal-findings__card--constraint" data-testid="portal-findings-constraints">
            <h3 className="portal-findings__card-title">Constraints identified</h3>
            <ul className="portal-findings__list">
              {constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

      </div>

      {/* Evidence-backed observations */}
      {evidenceSummary.length > 0 && (
        <div className="portal-findings__evidence" data-testid="portal-findings-evidence">
          <h3 className="portal-findings__evidence-title">Evidence captured</h3>
          <ul className="portal-findings__evidence-list">
            {evidenceSummary.map((obs, i) => (
              <li key={i} className="portal-findings__evidence-item">{obs}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
