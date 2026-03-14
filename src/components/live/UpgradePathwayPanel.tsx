/**
 * UpgradePathwayPanel
 *
 * Hub Section 6 — Future Upgrade Path.
 *
 * Shows the staged retrofit roadmap: what gets installed now, what follows,
 * and what the long-term trajectory looks like.
 *
 * This is Atlas's planning differentiator — it turns a point-in-time survey
 * into a multi-year retrofit roadmap.  Customers leave with a clear picture
 * of what happens next, not just what happens today.
 */

import type { OutputHubSection } from '../../live/printSections.model';

interface UpgradeStage {
  stage:  number;
  label:  string;
  detail: string;
}

interface Props {
  section: OutputHubSection;
}

export default function UpgradePathwayPanel({ section }: Props) {
  const c = section.content as {
    source:              'engine' | 'derived';
    stages:              UpgradeStage[];
    outcomeToday:        string | null;
    outcomeAfterTrigger: string | null;
    rationale:           string | null;
  };

  return (
    <div className="hub-graphic hub-graphic--upgrade" aria-label="Future upgrade path">
      <h3 className="hub-graphic__title">🗺 Future Upgrade Path</h3>

      {c.rationale && (
        <p className="hub-graphic__intro">{c.rationale}</p>
      )}

      {/* Staged roadmap */}
      <div className="hub-upgrade__stages" role="list" aria-label="Upgrade stages">
        {c.stages.map(stage => (
          <div key={stage.stage} className="hub-upgrade__stage" role="listitem">
            <div className="hub-upgrade__stage-badge" aria-label={`Stage ${stage.stage}`}>
              Stage {stage.stage}
            </div>
            <div className="hub-upgrade__stage-body">
              <div className="hub-upgrade__stage-label">{stage.label}</div>
              {stage.detail && (
                <p className="hub-upgrade__stage-detail">{stage.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Outcome statements */}
      {(c.outcomeToday || c.outcomeAfterTrigger) && (
        <div className="hub-upgrade__outcomes">
          {c.outcomeToday && (
            <div className="hub-upgrade__outcome">
              <span className="hub-upgrade__outcome-label">Today</span>
              <span className="hub-upgrade__outcome-text">{c.outcomeToday}</span>
            </div>
          )}
          {c.outcomeAfterTrigger && (
            <div className="hub-upgrade__outcome">
              <span className="hub-upgrade__outcome-label">Next step</span>
              <span className="hub-upgrade__outcome-text">{c.outcomeAfterTrigger}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
