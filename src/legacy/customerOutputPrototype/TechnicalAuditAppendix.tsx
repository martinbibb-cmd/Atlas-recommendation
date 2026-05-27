/**
 * TechnicalAuditAppendix.tsx
 *
 * Dense "Technical Audit Log" appendix for the end of the printed PDF.
 * Renders supporting facts, per-scenario performance summaries, hard
 * constraints, performance penalties, and a machine-readable JSON block.
 *
 * Audience: engineer / surveyor (appended to print pack on request).
 *
 * Rules:
 *   - No recommendation logic — all content from AtlasDecisionV1 and ScenarioResult.
 *   - No Math.random().
 *   - JSON summary is a deterministic serialisation of decision + scenarios.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import './TechnicalAuditAppendix.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TechnicalAuditAppendixProps {
  decision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
}

// ─── Machine-readable summary ─────────────────────────────────────────────────

function buildJsonSummary(decision: AtlasDecisionV1, scenarios: ScenarioResult[]): string {
  const summary = {
    atlasVersion: '1',
    recommendedScenarioId: decision.recommendedScenarioId,
    headline: decision.headline,
    supportingFacts: decision.supportingFacts,
    ...(decision.energyMetrics ? { energyMetrics: decision.energyMetrics } : {}),
    scenarios: scenarios.map((s) => ({
      scenarioId: s.scenarioId,
      'system.type': s.system.type,
      'system.summary': s.system.summary,
      performance: s.performance,
      ...(s.efficiencyMetric ? { efficiencyMetric: s.efficiencyMetric } : {}),
      hardConstraints: s.hardConstraints ?? [],
    })),
    hardConstraints: decision.hardConstraints ?? [],
    performancePenalties: decision.performancePenalties ?? [],
  };
  return JSON.stringify(summary, null, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TechnicalAuditAppendix
 *
 * Print appendix with supporting facts, scenario summaries, and a
 * machine-readable JSON block for independent verification.
 */
export function TechnicalAuditAppendix({ decision, scenarios }: TechnicalAuditAppendixProps) {
  const jsonSummary = buildJsonSummary(decision, scenarios);

  return (
    <section
      className="taa-appendix"
      aria-label="Technical Audit Log"
      data-testid="technical-audit-appendix"
    >
      {/* ── Header ── */}
      <div className="taa-appendix__header">
        <h2 className="taa-appendix__title">Technical Audit Log — Machine-Readable Appendix</h2>
        <p className="taa-appendix__preamble">
          We are confident in our physics. Share this data with any independent engineer or AI
          for unbiased verification.
        </p>
      </div>

      {/* ── Supporting facts ── */}
      {decision.supportingFacts.length > 0 && (
        <div className="taa-appendix__section">
          <h3 className="taa-appendix__section-title">Supporting Facts</h3>
          <table className="taa-appendix__table" aria-label="Supporting facts">
            <thead>
              <tr>
                <th className="taa-appendix__th">Label</th>
                <th className="taa-appendix__th">Value</th>
                <th className="taa-appendix__th">Source</th>
              </tr>
            </thead>
            <tbody>
              {decision.supportingFacts.map((fact, i) => (
                <tr key={i} className="taa-appendix__tr">
                  <td className="taa-appendix__td">{fact.label}</td>
                  <td className="taa-appendix__td taa-appendix__td--value">{fact.value}</td>
                  <td className="taa-appendix__td taa-appendix__td--source">{fact.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Per-scenario performance summaries ── */}
      {scenarios.length > 0 && (
        <div className="taa-appendix__section">
          <h3 className="taa-appendix__section-title">Scenario Performance Summary</h3>
          <table className="taa-appendix__table" aria-label="Scenario performance summary">
            <thead>
              <tr>
                <th className="taa-appendix__th">Scenario</th>
                <th className="taa-appendix__th">Hot Water</th>
                <th className="taa-appendix__th">Heating</th>
                <th className="taa-appendix__th">Efficiency</th>
                <th className="taa-appendix__th">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr
                  key={s.scenarioId}
                  className={`taa-appendix__tr${s.scenarioId === decision.recommendedScenarioId ? ' taa-appendix__tr--recommended' : ''}`}
                >
                  <td className="taa-appendix__td">
                    {s.system.summary}
                    {s.scenarioId === decision.recommendedScenarioId && (
                      <span className="taa-appendix__rec-badge">★ recommended</span>
                    )}
                  </td>
                  <td className="taa-appendix__td">{s.performance.hotWater}</td>
                  <td className="taa-appendix__td">{s.performance.heating}</td>
                  <td className="taa-appendix__td">{s.performance.efficiency}</td>
                  <td className="taa-appendix__td">{s.performance.reliability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Hard constraints ── */}
      {decision.hardConstraints && decision.hardConstraints.length > 0 && (
        <div className="taa-appendix__section">
          <h3 className="taa-appendix__section-title">Hard Constraints</h3>
          <ul className="taa-appendix__list" aria-label="Hard constraints">
            {decision.hardConstraints.map((c, i) => (
              <li key={i} className="taa-appendix__list-item taa-appendix__list-item--constraint">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Performance penalties ── */}
      {decision.performancePenalties && decision.performancePenalties.length > 0 && (
        <div className="taa-appendix__section">
          <h3 className="taa-appendix__section-title">Performance Penalties</h3>
          <ul className="taa-appendix__list" aria-label="Performance penalties">
            {decision.performancePenalties.map((p, i) => (
              <li key={i} className="taa-appendix__list-item taa-appendix__list-item--penalty">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Machine-readable JSON block ── */}
      <div className="taa-appendix__section taa-appendix__section--json">
        <p className="taa-appendix__json-label">
          Machine-readable summary — copy into any AI assistant for independent verification
        </p>
        <pre className="taa-appendix__json-block" data-testid="taa-json-block">
          {jsonSummary}
        </pre>
      </div>
    </section>
  );
}
