/**
 * ScenarioShortlistPanel.tsx — PR6
 *
 * Shortlist UI for Atlas Mind — renders the ranked scenario list alongside a
 * side-by-side comparison table and per-scenario "Why Atlas suggested this"
 * explanations.
 *
 * Two view modes:
 *   customer — simplified cards; no engineer detail.
 *   engineer — full cards with required work, compliance, and upgrades.
 *
 * The panel is self-contained: it receives a ScenarioSynthesisResult and the
 * display names for each scenario, then renders everything inline.
 * Parent components are responsible for calling runScenariosFromSpatialTwin
 * and buildScenarioSynthesis before passing the result here.
 */

import type { ScenarioSynthesisResult } from '../synthesis/ScenarioSynthesisModel';
import { ScenarioComparisonCard } from './ScenarioComparisonCard';
import { ScenarioComparisonTable } from './ScenarioComparisonTable';

export interface ScenarioShortlistPanelProps {
  synthesis: ScenarioSynthesisResult;
  /** Map from scenarioId → display name for all included scenarios. */
  scenarioNames: Record<string, string>;
  viewMode?: 'customer' | 'engineer';
  /** Called when the user clicks a scenario card to select it. */
  onSelectScenario?: (scenarioId: string) => void;
}

export function ScenarioShortlistPanel({
  synthesis,
  scenarioNames,
  viewMode = 'engineer',
  onSelectScenario,
}: ScenarioShortlistPanelProps) {
  if (synthesis.envelopes.length === 0) {
    return (
      <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
        No design scenarios available. Create scenarios in the twin to generate a shortlist.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Section: Shortlist cards */}
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          Design scenario shortlist
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
          {synthesis.envelopes.length === 1
            ? '1 scenario evaluated.'
            : `${synthesis.envelopes.length} scenarios evaluated, ranked best-first.`}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {synthesis.envelopes.map(envelope => (
            <ScenarioComparisonCard
              key={envelope.scenarioId}
              summary={envelope.summary}
              scenarioName={scenarioNames[envelope.scenarioId] ?? envelope.scenarioId}
              isRecommended={envelope.scenarioId === synthesis.recommendedScenarioId}
              isSelected={envelope.scenarioId === synthesis.selectedScenarioId}
              viewMode={viewMode}
              onSelect={onSelectScenario}
            />
          ))}
        </div>
      </section>

      {/* Section: Comparison table (only when more than one scenario) */}
      {synthesis.envelopes.length > 1 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Side-by-side comparison
          </h2>
          <ScenarioComparisonTable
            matrix={synthesis.comparisonMatrix}
            recommendedScenarioId={synthesis.recommendedScenarioId}
            selectedScenarioId={synthesis.selectedScenarioId}
            scenarioNames={scenarioNames}
          />
        </section>
      )}

      {/* Section: Why Atlas suggested this (engineer view only) */}
      {viewMode === 'engineer' && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Why Atlas suggested this
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {synthesis.envelopes.map(envelope => {
              const explanation = synthesis.explanationsByScenario[envelope.scenarioId];
              if (!explanation) return null;
              const name = scenarioNames[envelope.scenarioId] ?? envelope.scenarioId;
              const isRecommended = envelope.scenarioId === synthesis.recommendedScenarioId;
              return (
                <div
                  key={envelope.scenarioId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: isRecommended ? '#eff6ff' : '#f8fafc',
                    borderLeft: isRecommended ? '3px solid #2563eb' : '3px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isRecommended ? '#2563eb' : '#64748b',
                      marginBottom: 4,
                    }}
                  >
                    {name}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
