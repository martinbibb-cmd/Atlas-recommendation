/**
 * InsightLayerPage.tsx
 *
 * "What we need to keep in mind"
 *
 * Post-survey insight page that bridges survey capture (inputs) and
 * recommendations (outputs).  Displays:
 *   1. Heat load
 *   2. Present system
 *   3. Demands
 *   4. Objectives (captured priorities)
 *   5. Potential
 *   6. Limitations
 *   7. Quick wins
 *   8. System recommendations
 *
 * No engine run is performed here — all signals are derived purely from
 * surveyed values.
 */

import type { CSSProperties } from 'react';
import type { SystemBuilderState } from '../systemBuilder/systemBuilderTypes';
import type { HomeState } from '../usage/usageTypes';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import type { PrioritiesState } from '../priorities/prioritiesTypes';
import { PRIORITY_META } from '../priorities/prioritiesTypes';
import { normalisePriorities } from '../priorities/prioritiesNormalizer';
import {
  deriveHeatLoadInsight,
  derivePresentSystemInsight,
  deriveDemandsInsight,
  derivePotentialInsight,
  deriveLimitationsInsight,
  deriveQuickWins,
  deriveSystemRecommendations,
} from './insightDerivations';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InsightLayerPageProps {
  systemBuilder: SystemBuilderState;
  home: HomeState;
  input: FullSurveyModelV1;
  priorities: PrioritiesState;
  onNext: () => void;
  onPrev: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1rem 1.25rem',
  background: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#374151',
  marginBottom: '0.75rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  marginBottom: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: '#718096',
  minWidth: '160px',
};

const valueStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#2d3748',
};

function pillStyle(variant: 'green' | 'amber' | 'red' | 'blue' | 'grey'): CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    green: { bg: '#f0fff4', color: '#276749' },
    amber: { bg: '#fffbeb', color: '#92400e' },
    red:   { bg: '#fff5f5', color: '#9b2c2c' },
    blue:  { bg: '#ebf8ff', color: '#2b6cb0' },
    grey:  { bg: '#f7fafc', color: '#718096' },
  };
  const { bg, color } = map[variant];
  return {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    background: bg,
    color,
  };
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{children}</span>
    </div>
  );
}

function formatHeatSource(v: string | null): string {
  if (!v) return '—';
  const map: Record<string, string> = {
    regular: 'Regular (heat-only)',
    system: 'System boiler',
    combi: 'Combi boiler',
    storage_combi: 'Storage combi',
  };
  return map[v] ?? v;
}

function formatDhwType(v: string | null): string {
  if (!v) return '—';
  const map: Record<string, string> = {
    open_vented: 'Open-vented cylinder',
    unvented: 'Unvented cylinder',
    thermal_store: 'Thermal store',
    plate_hex: 'On-demand hot water',
    small_store: 'Integral small store',
  };
  return map[v] ?? v;
}

function formatControlFamily(v: string | null): string {
  if (!v) return '—';
  const map: Record<string, string> = {
    combi_integral: 'Combi integral',
    y_plan: 'Y-plan',
    s_plan: 'S-plan',
    s_plan_plus: 'S-plan+',
    thermal_store: 'Thermal store',
    unknown: 'Unknown',
  };
  return map[v] ?? v;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightLayerPage({
  systemBuilder,
  home,
  input,
  priorities,
  onNext,
  onPrev,
}: InsightLayerPageProps) {
  const heatLoad     = deriveHeatLoadInsight(input, systemBuilder);
  const presentSys   = derivePresentSystemInsight(systemBuilder);
  const demands      = deriveDemandsInsight(home);
  const potential    = derivePotentialInsight(systemBuilder, input);
  const limitations  = deriveLimitationsInsight(systemBuilder, input);
  const quickWins    = deriveQuickWins(systemBuilder, input);
  const normPriorities = normalisePriorities(priorities);
  const recs         = deriveSystemRecommendations(systemBuilder, home, input, normPriorities);

  const hasLimitations =
    limitations.mainsPressureLow ||
    limitations.pipeworkAccessDifficult ||
    limitations.sealingConversionRisk ||
    limitations.systemCleanComplexity;

  return (
    <div className="step-card" data-testid="insight-layer-page">
      <h2 style={{ marginBottom: '0.25rem' }}>🧠 What we need to keep in mind</h2>
      <p style={{ color: '#4a5568', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        A summary of what the survey tells us about this home before we make recommendations.
      </p>

      {/* ── 1. Heat load ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>1 — Heat load</p>
        <Row label="Peak heat loss">
          <strong>{heatLoad.peakHeatLossKw.toFixed(1)} kW</strong>
        </Row>
        <Row label="Confidence">
          <span style={pillStyle(
            heatLoad.confidence === 'measured' ? 'green' :
            heatLoad.confidence === 'estimated' ? 'blue' : 'amber'
          )}>
            {heatLoad.confidence === 'measured' ? 'Measured' :
             heatLoad.confidence === 'estimated' ? 'Estimated' : 'Default — not measured'}
          </span>
        </Row>
        <Row label="Emitter compatibility">
          {heatLoad.emitterCompatibilitySignal === 'compatible' ? (
            <span style={pillStyle('green')}>Compatible with heat pump</span>
          ) : heatLoad.emitterCompatibilitySignal === 'upgrade_may_be_needed' ? (
            <span style={pillStyle('amber')}>Emitter review may be needed for HP retrofit</span>
          ) : (
            <span style={pillStyle('grey')}>Unknown — emitters not selected</span>
          )}
        </Row>
      </div>

      {/* ── 2. Present system ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>2 — Present system</p>
        <Row label="Heat source">{formatHeatSource(presentSys.heatSource)}</Row>
        <Row label="Hot water">{formatDhwType(presentSys.dhwType)}</Row>
        <Row label="Controls">{formatControlFamily(presentSys.controlClass)}</Row>
        <Row label="Efficiency baseline">
          {presentSys.efficiencyBaseline === 'A_band' ? (
            <span style={pillStyle('green')}>Band A — high efficiency</span>
          ) : presentSys.efficiencyBaseline === 'B_band' ? (
            <span style={pillStyle('blue')}>Band B — good efficiency</span>
          ) : presentSys.efficiencyBaseline === 'C_or_below' ? (
            <span style={pillStyle('amber')}>Band C or below — efficiency improvement available</span>
          ) : (
            <span style={pillStyle('grey')}>Not recorded</span>
          )}
        </Row>
        <Row label="System condition">
          {presentSys.condition === 'good' ? (
            <span style={pillStyle('green')}>Good</span>
          ) : presentSys.condition === 'fair' ? (
            <span style={pillStyle('blue')}>Fair</span>
          ) : presentSys.condition === 'poor' ? (
            <span style={pillStyle('red')}>Poor</span>
          ) : (
            <span style={pillStyle('grey')}>Unknown</span>
          )}
        </Row>
      </div>

      {/* ── 3. Demands ───────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>3 — Demands</p>
        <Row label="Occupancy">{demands.occupancyCount} {demands.occupancyCount === 1 ? 'person' : 'people'}</Row>
        <Row label="Concurrency level">
          <span style={pillStyle(
            demands.concurrencyLevel === 'high' ? 'red' :
            demands.concurrencyLevel === 'medium' ? 'amber' : 'green'
          )}>
            {demands.concurrencyLevel === 'high' ? 'High — simultaneous demand likely' :
             demands.concurrencyLevel === 'medium' ? 'Medium — borderline' :
             'Low — single household, limited simultaneous risk'}
          </span>
        </Row>
        <Row label="Volume demand">
          <span style={pillStyle(
            demands.volumeDemandBand === 'high' ? 'red' :
            demands.volumeDemandBand === 'medium' ? 'blue' : 'green'
          )}>
            {demands.volumeDemandBand.charAt(0).toUpperCase() + demands.volumeDemandBand.slice(1)}
          </span>
        </Row>
        <Row label="Timing pattern">
          {demands.timingPattern === 'all_day' ? 'All-day occupancy — spread demand' :
           demands.timingPattern === 'morning_peak' ? 'Morning-peak dominant' :
           demands.timingPattern === 'variable' ? 'Variable / irregular' :
           'Standard morning + evening peaks'}
        </Row>
      </div>

      {/* ── 4. Objectives ────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>4 — Objectives</p>
        {normPriorities.hasPriorities ? (
          <div>
            <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.75rem' }}>
              {normPriorities.count} {normPriorities.count === 1 ? 'priority' : 'priorities'} captured —
              recommendations surface these benefits first where relevant.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {PRIORITY_META.filter(m => priorities.selected.includes(m.key)).map(m => (
                <span
                  key={m.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    background: '#ebf8ff',
                    border: '1px solid #bee3f8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#2b6cb0',
                  }}
                >
                  <span>{m.emoji}</span>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.78rem', color: '#718096', fontStyle: 'italic', margin: 0 }}>
            No priorities selected — recommendations are shown by physics fit only.
            You can go back to the Priorities step to add objectives.
          </p>
        )}
      </div>

      {/* ── 5. Potential ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>5 — Potential</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {potential.condensingOpportunity && (
            <div style={{ fontSize: '0.78rem', color: '#2d3748' }}>
              <span style={pillStyle('blue')}>Condensing</span>
              {' '}Upgrade from below-B-band to a condensing boiler will improve seasonal efficiency.
            </div>
          )}
          {potential.emitterUpgradeHeadroom && (
            <div style={{ fontSize: '0.78rem', color: '#2d3748' }}>
              <span style={pillStyle('blue')}>Emitters</span>
              {' '}Radiator upgrade or TRV fitting could enable lower flow temperatures.
            </div>
          )}
          {potential.controlUpgradeHeadroom && (
            <div style={{ fontSize: '0.78rem', color: '#2d3748' }}>
              <span style={pillStyle('blue')}>Controls</span>
              {' '}Significant headroom for controls improvement — programmable or smart thermostat.
            </div>
          )}
          {potential.insulationOpportunity && (
            <div style={{ fontSize: '0.78rem', color: '#2d3748' }}>
              <span style={pillStyle('blue')}>Insulation</span>
              {' '}Poor or unknown insulation — fabric improvement would reduce heat demand.
            </div>
          )}
          {!potential.condensingOpportunity &&
           !potential.emitterUpgradeHeadroom &&
           !potential.controlUpgradeHeadroom &&
           !potential.insulationOpportunity && (
            <div style={{ fontSize: '0.78rem', color: '#718096' }}>No significant improvement potential detected from current data.</div>
          )}
        </div>
      </div>

      {/* ── 6. Limitations ───────────────────────────────────────────────────── */}
      {hasLimitations && (
        <div style={{ ...sectionStyle, borderColor: '#fed7aa' }}>
          <p style={sectionTitleStyle}>6 — Limitations</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {limitations.mainsPressureLow && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                ⚠️ <strong>Mains pressure low</strong> — combi or unvented cylinder performance may be affected. Verify static pressure.
              </div>
            )}
            {limitations.sealingConversionRisk && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                ⚠️ <strong>Open-vented circuit sealing risk</strong> — converting from open-vented to sealed system requires hydraulic survey and feed cistern removal.
              </div>
            )}
            {limitations.systemCleanComplexity && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                ⚠️ <strong>System clean complexity</strong> — open-vented or older regular system is more likely to carry sludge. Power flush required before replacement.
              </div>
            )}
            {limitations.pipeworkAccessDifficult && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                ⚠️ <strong>Buried pipework</strong> — difficult access increases labour risk and cost for any pipework modifications.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 7. Quick wins ────────────────────────────────────────────────────── */}
      {quickWins.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>⚡ Quick wins</p>
          <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.75rem' }}>
            Low-cost, high-impact actions based on this survey.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {quickWins.map(win => (
              <div key={win.id} style={{ fontSize: '0.78rem', color: '#2d3748' }}>
                <strong>{win.title}</strong>
                <span style={{ color: '#718096' }}> — {win.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 8. System recommendations ────────────────────────────────────────── */}
      {recs.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>🔧 System recommendations</p>
          <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.75rem' }}>
            Ranked by physics fit, demand match and constraint compatibility — not by cost or product bias.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recs.map((rec, i) => (
              <div
                key={rec.id}
                data-testid={`recommendation-${rec.id}`}
                style={{
                  padding: '0.875rem 1rem',
                  background: i === 0 ? '#f0fff4' : '#fff',
                  border: i === 0 ? '1px solid #68d391' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {i === 0 && (
                    <span style={pillStyle('green')}>Best fit</span>
                  )}
                  {rec.tier === 'alternative' && (
                    <span style={pillStyle('blue')}>Alternative</span>
                  )}
                  {rec.tier === 'fallback' && (
                    <span style={pillStyle('grey')}>Fallback</span>
                  )}
                  <strong style={{ fontSize: '0.82rem', color: '#2d3748' }}>{rec.name}</strong>
                </div>

                {rec.whyItFits.length > 0 && (
                  <div style={{ marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#276749', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Why it fits
                    </span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                      {rec.whyItFits.map(r => (
                        <li key={r} style={{ fontSize: '0.75rem', color: '#2d3748', marginBottom: '0.15rem' }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.tradeOffs.length > 0 && (
                  <div style={{ marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Trade-offs
                    </span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                      {rec.tradeOffs.map(t => (
                        <li key={t} style={{ fontSize: '0.75rem', color: '#4a5568', marginBottom: '0.15rem' }}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.constraints.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9b2c2c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Constraints
                    </span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                      {rec.constraints.map(c => (
                        <li key={c} style={{ fontSize: '0.75rem', color: '#9b2c2c', marginBottom: '0.15rem' }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <div className="step-actions" style={{ marginTop: '1.5rem' }}>
        <button className="back-btn" type="button" onClick={onPrev}>
          ← Back
        </button>
        <button
          className="next-btn"
          type="button"
          onClick={onNext}
        >
          Run Full Analysis →
        </button>
      </div>
    </div>
  );
}
