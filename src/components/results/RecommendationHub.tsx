/**
 * RecommendationHub — the primary results composition page.
 *
 * Replaces the previous fail-heavy diagnostic screen with a structured
 * technical recommendation report:
 *
 *   1. Recommendation Summary  — headline decision (why this system fits)
 *   2. System Comparison       — option cards with new recommendation states
 *   3. Measurement Confidence  — what was measured vs assumed vs missing
 *   4. Evidence & Context      — supporting context bullets
 *
 * Rules:
 * - No engine logic; only presentation and composition.
 * - All data sourced from EngineOutputV1 / FullEngineResult.
 * - No mention of "fail", "rejected", or judgement language in user-facing copy.
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EvidenceItemV1 } from '../../contracts/EngineOutputV1';
import SystemRecommendationPanel from './SystemRecommendationPanel';
import SystemOptionCard from './SystemOptionCard';
import './results.css';

interface Props {
  result: FullEngineResult;
}

// ─── Measurement Confidence Panel ────────────────────────────────────────────

interface ConfidencePanelProps {
  result: FullEngineResult;
}

function MeasurementConfidencePanel({ result }: ConfidencePanelProps) {
  const { engineOutput } = result;
  const confidence = engineOutput.meta?.confidence ?? engineOutput.verdict?.confidence;
  const evidence = engineOutput.evidence ?? [];

  const measured   = evidence.filter((e: EvidenceItemV1) => e.source === 'manual');
  const assumed    = evidence.filter((e: EvidenceItemV1) => e.source === 'assumed' || e.source === 'derived');
  const missing    = evidence.filter((e: EvidenceItemV1) => e.source === 'placeholder');

  // Don't render if there's nothing to show
  if (!confidence && evidence.length === 0) return null;

  const level = confidence?.level ?? 'medium';
  const unlockBy = confidence?.unlockBy ?? [];

  const LEVEL_ICON: Record<string, string> = {
    high: '🟢', medium: '🟡', low: '🔴',
  };
  const LEVEL_LABEL: Record<string, string> = {
    high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence',
  };

  return (
    <div className="conf-panel">
      <h4 className="conf-panel__title">Measurement Confidence</h4>
      <span
        className={`conf-panel__level conf-panel__level--${level}`}
        aria-label={`Confidence: ${LEVEL_LABEL[level] ?? level}`}
      >
        <span aria-hidden="true">{LEVEL_ICON[level] ?? '⚪'}</span>{' '}
        {LEVEL_LABEL[level] ?? level}
      </span>

      <div className="conf-panel__groups">
        {measured.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Measured on site</p>
            <div className="conf-panel__chips">
              {measured.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--measured">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {assumed.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Assumptions used</p>
            <div className="conf-panel__chips">
              {assumed.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--assumed">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div>
            <p className="conf-panel__group-label">Not measured</p>
            <div className="conf-panel__chips">
              {missing.map(e => (
                <span key={e.id} className="conf-panel__chip conf-panel__chip--missing">
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {unlockBy.length > 0 && (
        <div className="conf-panel__unlock">
          <span className="conf-panel__unlock-label">
            Measuring these values would increase accuracy:
          </span>
          {unlockBy.join(' · ')}
        </div>
      )}
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function RecommendationHub({ result }: Props) {
  const { engineOutput } = result;
  const options = engineOutput.options ?? [];

  return (
    <div className="rec-hub">

      {/* 1 — Recommendation Summary */}
      <SystemRecommendationPanel engineOutput={engineOutput} />

      {/* 2 — System Comparison */}
      {options.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">System Comparison</h3>
          {options.map(card => (
            <SystemOptionCard key={card.id} card={card} />
          ))}
        </section>
      )}

      {/* 3 — Measurement Confidence */}
      <MeasurementConfidencePanel result={result} />

      {/* 4 — Evidence & Context */}
      {engineOutput.contextSummary && engineOutput.contextSummary.bullets.length > 0 && (
        <section className="rec-hub__section">
          <h3 className="rec-hub__section-title">Evidence &amp; Context</h3>
          <ul className="rec-summary__bullets">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
