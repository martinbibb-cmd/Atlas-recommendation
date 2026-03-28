/**
 * InsightLayerPage.tsx
 *
 * "What we need to keep in mind"
 *
 * Post-survey insight page that bridges survey capture (inputs) and
 * recommendations (outputs).  Displays four sections:
 *   1. At a glance   — compact snapshot (heat load, system, demands, objectives)
 *   2. Constraints   — limitations that affect options (amber; only when present)
 *   3. Quick wins    — low-cost improvements + potential upgrades
 *   4. Recommendations — ranked system options (Why it fits / Trade-offs / Constraints)
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
import SystemArchitectureVisualiser from '../../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import { systemBuilderToConceptModel } from '../../../explainers/lego/autoBuilder/systemBuilderToConceptModel';
import { optionToConceptModel } from '../../../explainers/lego/autoBuilder/optionToConceptModel';
import type { OptionId } from '../../../explainers/lego/autoBuilder/optionToConceptModel';
import type { SystemConceptModel } from '../../../explainers/lego/model/types';
import { imageForCurrentSystem, imageForRecId } from '../../../ui/systemImages/systemImageMap';
import { SystemRealWorldImage } from '../../../components/systemImages/SystemRealWorldImage';
import {
  solarSuitabilitySummary,
  deriveSolarPotential,
  roofOrientationLabel,
} from '../heatLoss/heatLossDerivations';
import type { RoofType } from '../heatLoss/heatLossTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InsightLayerPageProps {
  systemBuilder: SystemBuilderState;
  home: HomeState;
  input: FullSurveyModelV1;
  priorities: PrioritiesState;
  onNext: () => void;
  onPrev: () => void;
  /** When provided, renders a "Try in Simulator →" shortcut CTA in the footer. */
  onOpenSimulator?: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: CSSProperties = {
  marginBottom: '1rem',
  padding: '0.875rem 1rem',
  background: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#374151',
  marginBottom: '0.6rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  flexWrap: 'wrap',
  marginBottom: '0.3rem',
  alignItems: 'center',
};

const labelStyle: CSSProperties = {
  fontSize: '0.76rem',
  color: '#718096',
  minWidth: '120px',
  flexShrink: 0,
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

function formatRoofType(v: RoofType | undefined): string {
  if (!v || v === 'unknown') return '—';
  const map: Record<string, string> = {
    pitched: 'Pitched',
    flat:    'Flat',
    hipped:  'Hipped',
    dormer:  'Dormer',
  };
  return map[v] ?? v;
}

// ─── Recommendation → OptionId mapping ───────────────────────────────────────

/** Maps insight recommendation IDs to OptionId values used by optionToConceptModel. */
function recIdToOptionId(recId: string): OptionId | null {
  switch (recId) {
    case 'combi_upgrade': return 'combi';
    case 'system_unvented': return 'stored_unvented';
    case 'heat_pump': return 'ashp';
    default: return null;
  }
}

// ─── Rec card sub-component ───────────────────────────────────────────────────

type RecItem = ReturnType<typeof deriveSystemRecommendations>[number];

function RecCard({
  rec,
  index,
  currentConcept,
}: {
  rec: RecItem;
  index: number;
  currentConcept: SystemConceptModel;
}) {
  const optionId = recIdToOptionId(rec.id);
  const recImage = imageForRecId(rec.id);

  return (
    <div
      key={rec.id}
      data-testid={`recommendation-${rec.id}`}
      style={{
        padding: '0.75rem',
        background: index === 0 ? '#f0fff4' : '#fff',
        border: index === 0 ? '1px solid #68d391' : '1px solid #e2e8f0',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        {index === 0 && <span style={pillStyle('green')}>Best fit</span>}
        {rec.tier === 'alternative' && <span style={pillStyle('blue')}>Alternative</span>}
        {rec.tier === 'fallback' && <span style={pillStyle('grey')}>Fallback</span>}
        <strong style={{ fontSize: '0.82rem', color: '#2d3748' }}>{rec.name}</strong>
      </div>
      {/* Compare visualiser: current system vs proposed system */}
      {optionId && (
        <div style={{ marginBottom: '0.6rem' }}>
          <SystemArchitectureVisualiser
            mode="compare"
            currentSystem={currentConcept}
            recommendedSystem={optionToConceptModel(optionId)}
          />
        </div>
      )}
      {/* Real-world reference image for the proposed system type */}
      {recImage && (
        <div style={{ marginBottom: '0.6rem' }}>
          <SystemRealWorldImage image={recImage} testId={`rec-real-world-image-${rec.id}`} />
        </div>
      )}
      <div data-testid="rec-prose-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
        {rec.whyItFits.length > 0 && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#276749', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Why it fits
            </span>
            <ul style={{ margin: '0.15rem 0 0', paddingLeft: '1rem' }}>
              {rec.whyItFits.map(r => (
                <li key={r} style={{ fontSize: '0.74rem', color: '#2d3748', marginBottom: '0.1rem' }}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {rec.tradeOffs.length > 0 && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trade-offs
            </span>
            <ul style={{ margin: '0.15rem 0 0', paddingLeft: '1rem' }}>
              {rec.tradeOffs.map(t => (
                <li key={t} style={{ fontSize: '0.74rem', color: '#4a5568', marginBottom: '0.1rem' }}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {rec.constraints.length > 0 && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9b2c2c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Constraints
            </span>
            <ul style={{ margin: '0.15rem 0 0', paddingLeft: '1rem' }}>
              {rec.constraints.map(c => (
                <li key={c} style={{ fontSize: '0.74rem', color: '#9b2c2c', marginBottom: '0.1rem' }}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightLayerPage({
  systemBuilder,
  home,
  input,
  priorities,
  onNext,
  onPrev,
  onOpenSimulator,
}: InsightLayerPageProps) {
  const heatLoad     = deriveHeatLoadInsight(input, systemBuilder);
  const presentSys   = derivePresentSystemInsight(systemBuilder);
  const demands      = deriveDemandsInsight(home);
  const potential    = derivePotentialInsight(systemBuilder, input);
  const limitations  = deriveLimitationsInsight(systemBuilder, input);
  const quickWins    = deriveQuickWins(systemBuilder, input);
  const normPriorities = normalisePriorities(priorities);
  const recs         = deriveSystemRecommendations(systemBuilder, home, input, normPriorities);

  // Build current system concept model for the Lego visualiser
  const currentConcept = systemBuilderToConceptModel(systemBuilder);

  // Real-world image for the current system (null when no confident mapping)
  const currentSystemImage = imageForCurrentSystem(systemBuilder.heatSource, systemBuilder.dhwType);

  // Roof / solar context — sourced from the heat-loss step's HeatLossState
  const heatLossState = input.fullSurvey?.heatLoss;
  const roofType = heatLossState?.roofType;
  const roofOrientation = heatLossState?.roofOrientation;
  const shadingLevel = heatLossState?.shadingLevel;
  const hasRoofData = roofType !== undefined && roofType !== 'unknown';
  const hasOrientationData = roofOrientation !== undefined && roofOrientation !== 'unknown';
  const solarPotential = heatLossState
    ? deriveSolarPotential(heatLossState.roofOrientation, heatLossState.shadingLevel)
    : 'unknown';

  const hasLimitations =
    limitations.mainsPressureLow ||
    limitations.pipeworkAccessDifficult ||
    limitations.sealingConversionRisk ||
    limitations.systemCleanComplexity;

  // Merge potential improvements and quick wins into a single list
  const allQuickWins: Array<{ id: string; title: string; reason: string }> = [
    ...(potential.condensingOpportunity
      ? [{ id: 'condensing', title: 'Upgrade to condensing boiler', reason: 'seasonal efficiency gain from below-B-band baseline' }]
      : []),
    ...(potential.emitterUpgradeHeadroom
      ? [{ id: 'emitters', title: 'Radiator upgrade / TRV fitting', reason: 'enables lower flow temperatures' }]
      : []),
    ...(potential.controlUpgradeHeadroom
      ? [{ id: 'controls', title: 'Controls upgrade', reason: 'programmable or smart thermostat — significant headroom available' }]
      : []),
    ...(potential.insulationOpportunity
      ? [{ id: 'insulation', title: 'Fabric improvement', reason: 'poor or unknown insulation; reduces heat demand' }]
      : []),
    ...quickWins,
  ];

  return (
    <div className="step-card" data-testid="insight-layer-page">
      <h2 style={{ marginBottom: '1.25rem' }}>🧠 What we need to keep in mind</h2>

      {/* ── 0. Current system visualiser ─────────────────────────────────────── */}
      {systemBuilder.heatSource && (
        <div style={{ ...sectionStyle, marginBottom: '1rem' }}>
          <p style={sectionTitleStyle}>🏠 Your current system</p>
          <SystemArchitectureVisualiser
            mode="current"
            currentSystem={currentConcept}
          />
          {currentSystemImage && (
            <SystemRealWorldImage image={currentSystemImage} testId="current-system-real-world-image" />
          )}
        </div>
      )}

      {/* ── 1. At a glance ───────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>At a glance</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.3rem 1.5rem' }}>
          <Row label="Peak heat loss">
            <strong>{heatLoad.peakHeatLossKw.toFixed(1)} kW</strong>
            {' '}
            <span style={pillStyle(
              heatLoad.confidence === 'measured' ? 'green' :
              heatLoad.confidence === 'estimated' ? 'blue' : 'amber'
            )}>
              {heatLoad.confidence === 'measured' ? 'Measured' :
               heatLoad.confidence === 'estimated' ? 'Est.' : 'Default'}
            </span>
          </Row>
          <Row label="Current system">
            {formatHeatSource(presentSys.heatSource)}
            {' · '}
            {formatDhwType(presentSys.dhwType)}
          </Row>
          <Row label="Efficiency">
            {presentSys.efficiencyBaseline === 'A_band' ? (
              <span style={pillStyle('green')}>Band A</span>
            ) : presentSys.efficiencyBaseline === 'B_band' ? (
              <span style={pillStyle('blue')}>Band B</span>
            ) : presentSys.efficiencyBaseline === 'C_or_below' ? (
              <span style={pillStyle('amber')}>Band C or below</span>
            ) : (
              <span style={pillStyle('grey')}>Not recorded</span>
            )}
          </Row>
          <Row label="Emitters">
            {heatLoad.emitterCompatibilitySignal === 'compatible' ? (
              <span style={pillStyle('green')}>HP-compatible</span>
            ) : heatLoad.emitterCompatibilitySignal === 'upgrade_may_be_needed' ? (
              <span style={pillStyle('amber')}>Review needed for HP</span>
            ) : (
              <span style={pillStyle('grey')}>Not assessed</span>
            )}
          </Row>
          <Row label="Occupancy">
            {demands.occupancyCount} {demands.occupancyCount === 1 ? 'person' : 'people'}
            {' · '}
            <span style={pillStyle(
              demands.concurrencyLevel === 'high' ? 'red' :
              demands.concurrencyLevel === 'medium' ? 'amber' : 'green'
            )}>
              {demands.concurrencyLevel === 'high' ? 'High concurrency' :
               demands.concurrencyLevel === 'medium' ? 'Medium concurrency' :
               'Low concurrency'}
            </span>
          </Row>
          <Row label="Condition">
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
          {/* Roof / solar summary — only shown when at least roof type or orientation is known */}
          {(hasRoofData || hasOrientationData) && (
            <Row label="Roof">
              {hasRoofData && <span>{formatRoofType(roofType)}</span>}
              {hasRoofData && hasOrientationData && <span style={{ color: '#718096', margin: '0 0.3rem' }}>·</span>}
              {hasOrientationData && roofOrientation && <span>{roofOrientationLabel(roofOrientation)} facing</span>}
            </Row>
          )}
          {solarPotential !== 'unknown' && (
            <Row label="Solar potential">
              {(() => {
                const potentialMeta: Record<string, { variant: 'green' | 'blue' | 'amber'; label: string }> = {
                  good:     { variant: 'green', label: 'Good' },
                  moderate: { variant: 'blue',  label: 'Moderate' },
                  poor:     { variant: 'amber', label: 'Limited' },
                };
                const shadingMeta: Record<string, string> = {
                  little_or_none: '· Little shading',
                  some:           '· Some shading',
                  heavy:          '· Heavy shading',
                };
                const meta = potentialMeta[solarPotential];
                return (
                  <>
                    {meta && <span style={pillStyle(meta.variant)}>{meta.label}</span>}
                    {shadingLevel && shadingLevel !== 'unknown' && (
                      <span style={{ color: '#718096', fontSize: '0.74rem', marginLeft: '0.4rem' }}>
                        {shadingMeta[shadingLevel]}
                      </span>
                    )}
                  </>
                );
              })()}
            </Row>
          )}
        </div>
        {normPriorities.hasPriorities && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
                  border: '1px solid #90cdf4',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1a4971',
                }}
              >
                <span>{m.emoji}</span>{m.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Constraints ───────────────────────────────────────────────────── */}
      {hasLimitations && (
        <div style={{ ...sectionStyle, background: '#fffbeb', borderColor: '#fed7aa' }}>
          <p style={{ ...sectionTitleStyle, color: '#92400e' }}>⚠️ Constraints to note</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {limitations.mainsPressureLow && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                <strong>Low mains pressure</strong> — verify static pressure before specifying combi or unvented cylinder.
              </div>
            )}
            {limitations.sealingConversionRisk && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                <strong>Sealing conversion</strong> — open-vented to sealed requires hydraulic survey and feed cistern removal.
              </div>
            )}
            {limitations.systemCleanComplexity && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                <strong>System clean needed</strong> — older/open-vented system likely carries sludge; power flush before replacement.
              </div>
            )}
            {limitations.pipeworkAccessDifficult && (
              <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                <strong>Buried pipework</strong> — difficult access increases labour risk for any pipework modifications.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Quick wins ────────────────────────────────────────────────────── */}
      {allQuickWins.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>⚡ Quick wins</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {allQuickWins.map(win => (
              <div key={win.id} style={{ fontSize: '0.78rem', color: '#2d3748' }}>
                <strong>{win.title}</strong>
                {win.reason && <span style={{ color: '#718096' }}> — {win.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Recommendations ───────────────────────────────────────────────── */}
      {recs.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>🔧 Recommendations</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recs.map((rec, i) => (
              <RecCard key={rec.id} rec={rec} index={i} currentConcept={currentConcept} />
            ))}
          </div>
        </div>
      )}

      {/* ── DEV: canonical input readout ─────────────────────────────────────
           Compact readout of the exact inputs driving insight + recommendations.
           Only rendered in development builds (import.meta.env.DEV).
           This proves the source-of-truth is correct after PR1 repairs. */}
      {import.meta.env.DEV && (() => {
        const canonicalHeatLossW =
          input.fullSurvey?.heatLoss?.estimatedPeakHeatLossW ?? input.heatLossWatts ?? 8000;
        const shellPersisted = !!(input.fullSurvey?.heatLoss?.shellModel);
        const devRoofOrientation = input.fullSurvey?.heatLoss?.roofOrientation ?? '—';
        const devRoofType = input.fullSurvey?.heatLoss?.roofType ?? '—';
        const roofOrientationPersisted =
          input.fullSurvey?.heatLoss?.roofOrientation !== undefined &&
          input.fullSurvey?.heatLoss?.roofOrientation !== 'unknown';
        const devSolarPotential = heatLossState
          ? deriveSolarPotential(heatLossState.roofOrientation, heatLossState.shadingLevel)
          : 'unknown';
        const devSolarSummary = heatLossState ? solarSuitabilitySummary(heatLossState) : '—';
        const systemFamily = systemBuilder.heatSource ?? '—';
        const canonicalBathrooms = home.bathroomCount ?? input.bathroomCount ?? 1;
        const peakOutlets = input.peakConcurrentOutlets ?? '—';
        const mainsFlow = input.mainsDynamicFlowLpm != null ? `${input.mainsDynamicFlowLpm} L/min` : '—';
        const mainsPressure =
          input.dynamicMainsPressureBar != null ? `${input.dynamicMainsPressureBar} bar`
          : input.dynamicMainsPressure != null   ? `${input.dynamicMainsPressure} bar`
          : '—';
        const prioritiesPresent = normPriorities.hasPriorities;

        return (
          <div
            data-testid="dev-canonical-inputs"
            style={{
              margin: '1rem 0',
              padding: '0.75rem 1rem',
              background: '#1a1a2e',
              borderRadius: '8px',
              border: '1px dashed #4a5568',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              color: '#a0aec0',
            }}
          >
            <div style={{ color: '#68d391', fontWeight: 700, marginBottom: '0.4rem' }}>
              🔍 DEV — canonical inputs (PR4 roof truth check)
            </div>
            <div>heatLossWatts: <span style={{ color: '#fbbf24' }}>{canonicalHeatLossW} W ({(canonicalHeatLossW / 1000).toFixed(2)} kW)</span></div>
            <div>shell persisted: <span style={{ color: shellPersisted ? '#68d391' : '#fc8181' }}>{shellPersisted ? 'yes' : 'no'}</span></div>
            <div>roof type: <span style={{ color: '#fbbf24' }}>{devRoofType}</span></div>
            <div>roof orientation: <span style={{ color: '#fbbf24' }}>{devRoofOrientation}</span>{' '}<span style={{ color: roofOrientationPersisted ? '#68d391' : '#fc8181' }}>({roofOrientationPersisted ? 'persisted' : 'not set'})</span></div>
            <div>solar suitability: <span style={{ color: devSolarPotential === 'good' ? '#68d391' : devSolarPotential === 'moderate' ? '#fbbf24' : devSolarPotential === 'poor' ? '#fc8181' : '#a0aec0' }}>{devSolarPotential}</span></div>
            <div>solar summary: <span style={{ color: '#fbbf24' }}>{devSolarSummary}</span></div>
            <div>current system family: <span style={{ color: '#fbbf24' }}>{systemFamily}</span></div>
            <div>bathrooms: <span style={{ color: '#fbbf24' }}>{canonicalBathrooms}</span></div>
            <div>peak concurrent outlets: <span style={{ color: '#fbbf24' }}>{peakOutlets}</span></div>
            <div>mains flow: <span style={{ color: '#fbbf24' }}>{mainsFlow}</span> @ <span style={{ color: '#fbbf24' }}>{mainsPressure}</span></div>
            <div>priorities present: <span style={{ color: prioritiesPresent ? '#68d391' : '#fc8181' }}>{prioritiesPresent ? 'yes' : 'no'}</span></div>
          </div>
        );
      })()}

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <div className="step-actions" style={{ marginTop: '1.5rem' }}>
        <button className="back-btn" type="button" onClick={onPrev}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {onOpenSimulator != null && (
            <button
              className="simulator-shortcut-btn"
              type="button"
              onClick={onOpenSimulator}
            >
              Try in Simulator →
            </button>
          )}
          <button
            className="next-btn"
            type="button"
            onClick={onNext}
          >
            Run Full Analysis →
          </button>
        </div>
      </div>
    </div>
  );
}
