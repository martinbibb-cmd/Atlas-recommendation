/**
 * EvidenceRecommendationPanel — PR11/PR12: canonical recommendation surface.
 *
 * Renders the full PR11 RecommendationResult:
 *   1. Best overall — headline system recommendation with evidence trace
 *   2. Best by objective — per-objective winners (eco, space, performance, etc.)
 *   3. Interventions — upgrade paths derived from removable limiters
 *   4. Disqualified candidates — hard-stop explanations and what would need to change
 *   5. Confidence summary — how much evidence was considered
 *
 * Rules:
 *  - No engine logic; pure presentation.
 *  - All data must come from RecommendationResult (PR11 output).
 *  - Hard-stop explanations must name the limiter and the required change.
 *  - Never silently drop a disqualified candidate.
 */

import type {
  RecommendationResult,
  RecommendationDecision,
  RecommendationIntervention,
  RecommendationObjective,
} from '../../engine/recommendation/RecommendationModel';
import { ALL_OBJECTIVES } from '../../engine/recommendation/RecommendationModel';
import './EvidenceRecommendationPanel.css';

// ─── Display helpers ──────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<string, string> = {
  combi:       'Combi boiler',
  system:      'System boiler with cylinder',
  heat_pump:   'Air source heat pump',
  regular:     'Regular boiler (vented)',
  open_vented: 'Regular boiler (vented)',
};

const OBJECTIVE_LABELS: Record<RecommendationObjective, string> = {
  performance:     '⚡ Performance',
  reliability:     '🔒 Reliability',
  longevity:       '🔧 Longevity',
  ease_of_control: '🎛️ Ease of control',
  eco:             '🌿 Eco',
  disruption:      '🔨 Low disruption',
  space:           '📦 Space',
};

const SUITABILITY_LABELS: Record<string, string> = {
  suitable:              '✅ Suitable',
  suitable_with_caveats: '⚠️ Suitable with caveats',
  not_recommended:       '⚠️ Not advised',
};

const CONFIDENCE_ICON: Record<string, string> = {
  high:   '🟢',
  medium: '🟡',
  low:    '🔴',
};

function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? `System (${family})`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="erp-score-bar" aria-label={`Score: ${score} out of 100`}>
      <div className="erp-score-bar__fill" style={{ width: `${score}%` }} />
      <span className="erp-score-bar__label">{score}</span>
    </div>
  );
}

function BestOverallCard({ decision }: { decision: RecommendationDecision }) {
  return (
    <div className="erp-best-overall">
      <p className="erp-best-overall__eyebrow">🏠 Best all-round system for this home</p>
      <p className="erp-best-overall__family">{familyLabel(decision.family)}</p>
      <ScoreBar score={decision.overallScore} />
      <span className={`erp-suitability erp-suitability--${decision.suitability}`}>
        {SUITABILITY_LABELS[decision.suitability] ?? decision.suitability}
      </span>
      {decision.caveats.length > 0 && (
        <ul className="erp-caveats">
          {decision.caveats.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </div>
  );
}

function ObjectiveGrid({
  bestByObjective,
}: {
  bestByObjective: RecommendationResult['bestByObjective'];
}) {
  return (
    <div className="erp-objective-grid">
      {ALL_OBJECTIVES.map(obj => {
        const winner = bestByObjective[obj];
        return (
          <div key={obj} className="erp-objective-card">
            <p className="erp-objective-card__label">{OBJECTIVE_LABELS[obj]}</p>
            {winner ? (
              <>
                <p className="erp-objective-card__family">{familyLabel(winner.family)}</p>
                <ScoreBar score={winner.objectiveScores[obj]} />
              </>
            ) : (
              <p className="erp-objective-card__no-winner">No suitable candidate</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InterventionsList({
  interventions,
}: {
  interventions: RecommendationResult['interventions'];
}) {
  if (interventions.length === 0) return null;
  return (
    <section className="erp-section" aria-label="Upgrade interventions">
      <h3 className="erp-section__heading">Upgrade interventions</h3>
      <p className="erp-section__intro">
        These changes could unlock better system options or improve performance:
      </p>
      <ul className="erp-interventions">
        {interventions.map((item: RecommendationIntervention) => (
          <li key={`${item.id}-${item.sourceFamily}`} className="erp-intervention">
            <strong className="erp-intervention__label">{item.label}</strong>
            <p className="erp-intervention__desc">{item.description}</p>
            <p className="erp-intervention__meta">
              Affects:{' '}
              {item.affectedObjectives.map(o => OBJECTIVE_LABELS[o]).join(', ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DisqualifiedList({
  disqualified,
}: {
  disqualified: RecommendationResult['disqualifiedCandidates'];
}) {
  if (disqualified.length === 0) return null;
  return (
    <section className="erp-section erp-section--disqualified" aria-label="Not advised">
      <h3 className="erp-section__heading">Not advised for this home</h3>
      <p className="erp-section__intro">
        The following systems are not advised for this home. Each entry explains why
        and what would need to change for them to become viable.
      </p>
      <ul className="erp-disqualified">
        {disqualified.map(d => (
          <li key={d.family} className="erp-disqualified__item">
            <p className="erp-disqualified__family">
              🚫 <strong>{familyLabel(d.family)}</strong>
            </p>
            {d.caveats.length > 0 && (
              <>
                <p className="erp-disqualified__why-heading">Why it is not advised:</p>
                <ul className="erp-disqualified__caveats">
                  {d.caveats.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </>
            )}
            {d.evidenceTrace.hardStopLimiters.length > 0 && (
              <>
                <p className="erp-disqualified__blockers-heading">Limiting factors:</p>
                <ul className="erp-disqualified__blockers">
                  {d.evidenceTrace.hardStopLimiters.map(id => (
                    <li key={id}>
                      <code className="erp-disqualified__limiter-id">{id}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfidenceBadge({
  summary,
}: {
  summary: RecommendationResult['confidenceSummary'];
}) {
  return (
    <div className="erp-confidence">
      <span
        className={`erp-confidence__badge erp-confidence__badge--${summary.level}`}
        aria-label={`Recommendation confidence: ${summary.level}`}
      >
        {CONFIDENCE_ICON[summary.level] ?? '⚪'} {summary.level.charAt(0).toUpperCase() + summary.level.slice(1)} confidence
      </span>
      <p className="erp-confidence__detail">
        Based on {summary.evidenceCount} evidence items
        ({summary.limitersConsidered} limiters considered across all candidates).
      </p>
      {summary.notes.length > 0 && (
        <ul className="erp-confidence__notes">
          {summary.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** PR11 recommendation result — required; must not be null. */
  recommendation: RecommendationResult;
}

/**
 * EvidenceRecommendationPanel renders the full PR11 recommendation result.
 *
 * Designed to replace legacy SystemRecommendationPanel surfaces that read from
 * EngineOutputV1.recommendation.primary.  All data here is evidence-backed.
 */
export default function EvidenceRecommendationPanel({ recommendation }: Props) {
  return (
    <div className="erp" data-testid="evidence-recommendation-panel">
      {/* ── Best overall ──────────────────────────────────────────────── */}
      {recommendation.bestOverall ? (
        <BestOverallCard decision={recommendation.bestOverall} />
      ) : (
        <div className="erp-no-recommendation">
          <p>No suitable system could be identified from the available evidence.</p>
          <p>Review the interventions below to see what changes could unlock a recommendation.</p>
        </div>
      )}

      <ConfidenceBadge summary={recommendation.confidenceSummary} />

      {/* ── Best by objective ─────────────────────────────────────────── */}
      <section className="erp-section" aria-label="Best by objective">
        <h3 className="erp-section__heading">Best system by objective</h3>
        <p className="erp-section__intro">
          The best-overall winner optimises across all objectives. Individual objectives
          may have different winners — for example, eco may favour a heat pump while
          space favours a combi.
        </p>
        <ObjectiveGrid bestByObjective={recommendation.bestByObjective} />
      </section>

      {/* ── Interventions ─────────────────────────────────────────────── */}
      <InterventionsList interventions={recommendation.interventions} />

      {/* ── Disqualified candidates ───────────────────────────────────── */}
      <DisqualifiedList disqualified={recommendation.disqualifiedCandidates} />
    </div>
  );
}
