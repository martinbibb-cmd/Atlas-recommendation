/**
 * ScenarioComparisonCard.tsx — PR6
 *
 * Renders a single scenario card within the scenario shortlist.
 * Shows headline, suitability badge, primary reason, strengths, trade-offs,
 * and a recommended / selected badge when applicable.
 *
 * Supports two view modes:
 *   customer — simplified language; strengths and headline only.
 *   engineer — full detail including required work, compliance, and upgrades.
 */

import type { ScenarioRecommendationSummary } from '../synthesis/ScenarioSynthesisModel';

export interface ScenarioComparisonCardProps {
  summary: ScenarioRecommendationSummary;
  scenarioName: string;
  isRecommended?: boolean;
  isSelected?: boolean;
  viewMode?: 'customer' | 'engineer';
  onSelect?: (scenarioId: string) => void;
}

const SUITABILITY_LABELS: Record<ScenarioRecommendationSummary['suitability'], string> = {
  recommended: 'Best fit',
  possible_with_caveats: 'Possible with caveats',
  less_suited: 'Less suited',
};

const SUITABILITY_COLORS: Record<ScenarioRecommendationSummary['suitability'], string> = {
  recommended: '#16a34a',
  possible_with_caveats: '#d97706',
  less_suited: '#dc2626',
};

export function ScenarioComparisonCard({
  summary,
  scenarioName,
  isRecommended = false,
  isSelected = false,
  viewMode = 'engineer',
  onSelect,
}: ScenarioComparisonCardProps) {
  const suitabilityColor = SUITABILITY_COLORS[summary.suitability];
  const suitabilityLabel = SUITABILITY_LABELS[summary.suitability];

  return (
    <div
      style={{
        border: isRecommended ? '2px solid #2563eb' : '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        position: 'relative',
        cursor: onSelect != null ? 'pointer' : undefined,
      }}
      onClick={onSelect != null ? () => onSelect(summary.scenarioId) : undefined}
      role={onSelect != null ? 'button' : undefined}
      tabIndex={onSelect != null ? 0 : undefined}
      onKeyDown={
        onSelect != null
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(summary.scenarioId); }
          : undefined
      }
      aria-label={`Scenario card: ${scenarioName}`}
    >
      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {isRecommended && (
          <span
            style={{
              background: '#2563eb',
              color: '#fff',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            ATLAS RECOMMENDS
          </span>
        )}
        {isSelected && (
          <span
            style={{
              background: '#0f172a',
              color: '#fff',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            CUSTOMER SELECTED
          </span>
        )}
        <span
          style={{
            background: suitabilityColor + '1a',
            color: suitabilityColor,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            border: `1px solid ${suitabilityColor}4d`,
          }}
        >
          {suitabilityLabel}
        </span>
      </div>

      {/* Scenario name */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{scenarioName}</div>

      {/* Headline */}
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
        {summary.headline}
      </h3>

      {/* Primary reason */}
      {summary.primaryReason.length > 0 && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          {summary.primaryReason}
        </p>
      )}

      {/* Strengths */}
      {summary.strengths.length > 0 && (
        <section style={{ marginBottom: 10 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
            Strengths
          </h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#374151' }}>
            {summary.strengths.map((s, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Trade-offs */}
      {summary.tradeoffs.length > 0 && (
        <section style={{ marginBottom: 10 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#d97706' }}>
            Trade-offs
          </h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#374151' }}>
            {summary.tradeoffs.map((t, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Engineer-only detail */}
      {viewMode === 'engineer' && (
        <>
          {summary.requiredWork.length > 0 && (
            <section style={{ marginBottom: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                Required work
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#374151' }}>
                {summary.requiredWork.map((w, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.requiredSafetyAndCompliance.length > 0 && (
            <section style={{ marginBottom: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
                Safety &amp; compliance
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#374151' }}>
                {summary.requiredSafetyAndCompliance.map((c, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.upgrades.length > 0 && (
            <section>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#0284c7' }}>
                Likely upgrades
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#374151' }}>
                {summary.upgrades.map((u, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{u}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
