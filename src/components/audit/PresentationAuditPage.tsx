/**
 * PresentationAuditPage.tsx
 *
 * Internal developer-only audit surface for the Atlas presentation engine.
 *
 * NOT customer-facing. Accessible via ?audit=1 URL flag.
 *
 * Displays a grid of all golden scenarios, each showing:
 *   - Scenario name and description
 *   - Input summary (key dimensions)
 *   - Key derived signals (dhwStorageType, drivingStyleMode, pvStatus, etc.)
 *   - Ranking (ordered option families + scores)
 *   - Shortlisted options with compliance / required work / upgrades
 *   - Rule violation flags (forbidden phrases, empty fields, conflation errors)
 *
 * Clicking a scenario card expands the full canonical model for detailed inspection.
 */

import { useState, useMemo } from 'react';
import { runEngine } from '../../engine/Engine';
import { buildCanonicalPresentation } from '../presentation/buildCanonicalPresentation';
import { resolveShortlistVisualId } from '../presentation/presentationVisualMapping';
import type { CanonicalPresentationModel } from '../presentation/buildCanonicalPresentation';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import {
  AUDIT_SCENARIOS,
  AUDIT_SCENARIO_DESCRIPTIONS,
  SCENARIO_PAIRS,
} from '../presentation/__tests__/presentationAuditFixtures';

// ─── Rule engine ──────────────────────────────────────────────────────────────

/** A single rule violation detected in a scenario's canonical model. */
interface RuleViolation {
  severity: 'error' | 'warning';
  rule: string;
  detail: string;
}

const FORBIDDEN_PHRASES = [
  'instantaneous hot water',
  'gravity system',
  'low pressure system',
  'high pressure system',
  'unlimited hot water',
];

/** Collect all visible strings from a model for phrase scanning. */
function collectStrings(model: CanonicalPresentationModel): string[] {
  const strings: string[] = [];
  const h = model.page1.house;
  strings.push(h.heatLossLabel, h.pipeworkLabel, h.waterSupplyLabel, h.pvPotentialLabel,
    h.wallTypeLabel, h.insulationLabel, ...h.notes);
  const ho = model.page1.home;
  strings.push(ho.demandProfileLabel, ho.dailyHotWaterLabel, ho.peakOutletsLabel,
    ho.bathUseIntensityLabel, ho.occupancyTimingLabel, ho.storageBenefitLabel,
    ...ho.narrativeSignals);
  const e = model.page1.energy;
  strings.push(e.pvStatusLabel, e.batteryStatusLabel, e.pvSuitabilityLabel,
    e.energyAlignmentLabel, e.solarStorageOpportunityLabel, ...e.narrativeSignals);
  const cs = model.page1.currentSystem;
  strings.push(cs.systemTypeLabel, cs.ageLabel, cs.ageContext);
  if (cs.makeModelText) strings.push(cs.makeModelText);
  if (cs.outputLabel) strings.push(cs.outputLabel);
  strings.push(model.page1_5.heading, model.page1_5.ageBandLabel, ...model.page1_5.probabilisticNotes);
  if (model.page1_5.waterQualityNote) strings.push(model.page1_5.waterQualityNote);
  for (const opt of model.page2.options) {
    strings.push(opt.label, opt.headline, opt.whatItIs, ...opt.throughHouseNotes,
      ...opt.throughHomeNotes, ...opt.throughEnergyNotes, ...opt.worksWellWhen, ...opt.limitedWhen);
  }
  for (const item of model.page3.items) {
    strings.push(item.label, item.reasonLine);
    if (item.demandFitNote) strings.push(item.demandFitNote);
    if (item.waterFitNote) strings.push(item.waterFitNote);
    if (item.infrastructureFitNote) strings.push(item.infrastructureFitNote);
    if (item.energyFitNote) strings.push(item.energyFitNote);
  }
  for (const opt of model.page4Plus.options) {
    strings.push(opt.label, ...opt.complianceItems, ...opt.requiredWork, ...opt.bestPerformanceUpgrades);
  }
  strings.push(model.finalPage.homeScenarioDescription,
    ...model.finalPage.houseConstraintNotes, ...model.finalPage.energyTimingNotes);
  return strings.filter(str => str.length > 0);
}

/** Run all rule checks on a model and return violations. */
function detectViolations(model: CanonicalPresentationModel): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const strings = collectStrings(model);

  // Forbidden phrase check
  for (const phrase of FORBIDDEN_PHRASES) {
    const hits = strings.filter(s => s.toLowerCase().includes(phrase.toLowerCase()));
    if (hits.length > 0) {
      violations.push({
        severity: 'error',
        rule: 'Forbidden phrase',
        detail: `"${phrase}" found: ${hits.slice(0, 2).join('; ')}`,
      });
    }
  }

  // Compliance items must not appear in upgrades
  for (const opt of model.page4Plus.options) {
    const complianceSet = new Set(opt.complianceItems);
    for (const upgrade of opt.bestPerformanceUpgrades) {
      if (complianceSet.has(upgrade)) {
        violations.push({
          severity: 'error',
          rule: 'Compliance item in upgrades',
          detail: `"${opt.family}": "${upgrade}" is in both complianceItems and bestPerformanceUpgrades`,
        });
      }
    }
    for (const work of opt.requiredWork) {
      if (complianceSet.has(work)) {
        violations.push({
          severity: 'error',
          rule: 'Compliance item in required work',
          detail: `"${opt.family}": "${work}" is in both complianceItems and requiredWork`,
        });
      }
    }
  }

  // Empty required fields
  if (!model.page1.home.storageBenefitLabel) {
    violations.push({ severity: 'error', rule: 'Empty field', detail: 'storageBenefitLabel is empty' });
  }
  if (!model.page1.energy.pvStatusLabel) {
    violations.push({ severity: 'error', rule: 'Empty field', detail: 'pvStatusLabel is empty' });
  }
  if (!model.page1_5.heading) {
    violations.push({ severity: 'error', rule: 'Empty field', detail: 'page1_5 heading is empty' });
  }
  if (!model.finalPage.homeScenarioDescription) {
    violations.push({ severity: 'error', rule: 'Empty field', detail: 'homeScenarioDescription is empty' });
  }

  // Shortlist visual mismatch warnings
  for (const opt of model.page4Plus.options) {
    const visual = resolveShortlistVisualId(
      opt.solarStorageOpportunity,
      opt.peakSimultaneousOutlets,
      opt.family,
    );
    // If solar is high but visual is not cylinder_charge — that's a conflict
    if (opt.solarStorageOpportunity === 'high' && visual !== 'cylinder_charge') {
      violations.push({
        severity: 'warning',
        rule: 'Visual signal mismatch',
        detail: `Option "${opt.family}": solar=high but visual="${visual}" (expected cylinder_charge)`,
      });
    }
  }

  // Empty page2 options
  if (model.page2.options.length === 0) {
    violations.push({ severity: 'error', rule: 'Empty section', detail: 'page2 has no options' });
  }

  // Empty page3 ranking
  if (model.page3.items.length === 0) {
    violations.push({ severity: 'error', rule: 'Empty section', detail: 'page3 ranking is empty' });
  }

  return violations;
}

// ─── Shared audit builder ─────────────────────────────────────────────────────

interface AuditEntry {
  name: string;
  description: string;
  input: EngineInputV2_3;
  model: CanonicalPresentationModel;
  violations: RuleViolation[];
}

function buildEntry(name: string, input: EngineInputV2_3): AuditEntry {
  const result = runEngine(input);
  const model = buildCanonicalPresentation(result, input, result.recommendationResult);
  return {
    name,
    description: AUDIT_SCENARIO_DESCRIPTIONS[name] ?? name,
    input,
    model,
    violations: detectViolations(model),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViolationBadge({ violations }: { violations: RuleViolation[] }) {
  if (violations.length === 0) {
    return <span style={STYLES.badge.ok}>✓ Clean</span>;
  }
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;
  return (
    <span style={errors > 0 ? STYLES.badge.error : STYLES.badge.warning}>
      {errors > 0 ? `✗ ${errors} error${errors > 1 ? 's' : ''}` : ''}
      {warnings > 0 ? `${errors > 0 ? ', ' : ''}${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
    </span>
  );
}

function InputSummary({ input }: { input: EngineInputV2_3 }) {
  return (
    <table style={STYLES.table}>
      <tbody>
        <tr><td style={STYLES.tdKey}>Occupancy</td><td>{input.occupancyCount ?? '?'} person(s)</td></tr>
        <tr><td style={STYLES.tdKey}>Bathrooms</td><td>{input.bathroomCount ?? '?'}</td></tr>
        <tr><td style={STYLES.tdKey}>Heat source</td><td>{input.currentHeatSourceType ?? 'not set'}</td></tr>
        <tr><td style={STYLES.tdKey}>DHW storage</td><td>{input.dhwStorageType ?? 'not set'}</td></tr>
        <tr><td style={STYLES.tdKey}>PV status</td><td>{input.pvStatus ?? 'not set'}</td></tr>
        <tr><td style={STYLES.tdKey}>Postcode</td><td>{input.postcode}</td></tr>
        <tr><td style={STYLES.tdKey}>Loft conv.</td><td>{input.hasLoftConversion ? 'Yes' : 'No'}{input.futureLoftConversion ? ' (future planned)' : ''}</td></tr>
      </tbody>
    </table>
  );
}

function SignalsSummary({ model }: { model: CanonicalPresentationModel }) {
  const cs = model.page1.currentSystem;
  const h  = model.page1.home;
  const e  = model.page1.energy;
  return (
    <table style={STYLES.table}>
      <tbody>
        <tr><td style={STYLES.tdKey}>DHW storage type</td><td style={{ fontWeight: 'bold', color: cs.dhwStorageType === 'unknown' ? '#888' : '#222' }}>{cs.dhwStorageType}</td></tr>
        <tr><td style={STYLES.tdKey}>Driving style</td><td>{cs.drivingStyleMode}</td></tr>
        <tr><td style={STYLES.tdKey}>Storage benefit</td><td>{h.storageBenefitLabel}</td></tr>
        <tr><td style={STYLES.tdKey}>Peak outlets</td><td>{h.peakSimultaneousOutlets}</td></tr>
        <tr><td style={STYLES.tdKey}>Daily litres</td><td>{Math.round(h.dailyHotWaterLitres)} L/day</td></tr>
        <tr><td style={STYLES.tdKey}>PV status</td><td>{e.pvStatusLabel}</td></tr>
        <tr><td style={STYLES.tdKey}>PV alignment</td><td>{e.energyAlignmentLabel}</td></tr>
        <tr><td style={STYLES.tdKey}>Solar opp.</td><td>{e.solarStorageOpportunityLabel}</td></tr>
      </tbody>
    </table>
  );
}

function RankingTable({ model }: { model: CanonicalPresentationModel }) {
  return (
    <table style={{ ...STYLES.table, width: '100%' }}>
      <thead>
        <tr>
          <th style={STYLES.th}>#</th>
          <th style={STYLES.th}>Family</th>
          <th style={STYLES.th}>Score</th>
          <th style={STYLES.th}>Reason</th>
        </tr>
      </thead>
      <tbody>
        {model.page3.items.map(item => (
          <tr key={item.family}>
            <td style={STYLES.td}>{item.rank}</td>
            <td style={STYLES.td}><strong>{item.label}</strong></td>
            <td style={STYLES.td}>{item.overallScore > 0 ? item.overallScore : '—'}</td>
            <td style={{ ...STYLES.td, fontSize: '11px' }}>{item.reasonLine}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ShortlistSummary({ model }: { model: CanonicalPresentationModel }) {
  return (
    <div>
      {model.page4Plus.options.map(opt => {
        const visual = resolveShortlistVisualId(
          opt.solarStorageOpportunity,
          opt.peakSimultaneousOutlets,
          opt.family,
        );
        return (
          <div key={opt.family} style={STYLES.shortlistItem}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {opt.label} <span style={STYLES.visualBadge}>visual: {visual}</span>
            </div>
            {opt.complianceItems.length > 0 && (
              <div style={{ color: '#c00' }}>
                <strong>Compliance:</strong> {opt.complianceItems.join('; ')}
              </div>
            )}
            {opt.requiredWork.length > 0 && (
              <div style={{ color: '#a60' }}>
                <strong>Required:</strong> {opt.requiredWork.join('; ')}
              </div>
            )}
            {opt.bestPerformanceUpgrades.length > 0 && (
              <div style={{ color: '#060' }}>
                <strong>Upgrades:</strong> {opt.bestPerformanceUpgrades.join('; ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ViolationsList({ violations }: { violations: RuleViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <div style={STYLES.violationsBox}>
      <strong>⚠ Rule violations:</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
        {violations.map((v, i) => (
          <li key={i} style={{ color: v.severity === 'error' ? '#c00' : '#a60', fontSize: 12 }}>
            [{v.rule}] {v.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioCard({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasErrors = entry.violations.some(v => v.severity === 'error');

  return (
    <div style={{ ...STYLES.card, borderColor: hasErrors ? '#c00' : entry.violations.length > 0 ? '#a60' : '#2a8' }}>
      <div
        style={STYLES.cardHeader}
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
      >
        <div>
          <span style={STYLES.scenarioName}>{entry.name}</span>
          <ViolationBadge violations={entry.violations} />
        </div>
        <div style={STYLES.scenarioDesc}>{entry.description}</div>
        <div style={STYLES.expandHint}>{expanded ? '▲ Collapse' : '▼ Expand'}</div>
      </div>

      {expanded && (
        <div style={STYLES.cardBody}>
          <div style={STYLES.grid2}>
            <div>
              <h4 style={STYLES.sectionHeading}>Input Summary</h4>
              <InputSummary input={entry.input} />
            </div>
            <div>
              <h4 style={STYLES.sectionHeading}>Derived Signals</h4>
              <SignalsSummary model={entry.model} />
            </div>
          </div>

          <h4 style={STYLES.sectionHeading}>Ranking</h4>
          <RankingTable model={entry.model} />

          <h4 style={STYLES.sectionHeading}>Shortlisted Options</h4>
          <ShortlistSummary model={entry.model} />

          <ViolationsList violations={entry.violations} />
        </div>
      )}
    </div>
  );
}

function DiffCard({ pair }: { pair: typeof SCENARIO_PAIRS[0] }) {
  const [expanded, setExpanded] = useState(false);

  const { modelA, modelB } = useMemo(() => {
    const resultA = runEngine(pair.scA);
    const resultB = runEngine(pair.scB);
    return {
      modelA: buildCanonicalPresentation(resultA, pair.scA, resultA.recommendationResult),
      modelB: buildCanonicalPresentation(resultB, pair.scB, resultB.recommendationResult),
    };
  }, [pair]);

  const fingerprint = (model: CanonicalPresentationModel) => ({
    dhwStorageType:   model.page1.currentSystem.dhwStorageType,
    drivingStyle:     model.page1.currentSystem.drivingStyleMode,
    pvStatus:         model.page1.energy.pvStatusLabel,
    storageBenefit:   model.page1.home.storageBenefitLabel,
    demandProfile:    model.page1.home.demandProfileLabel,
    peakOutlets:      model.page1.home.peakSimultaneousOutlets,
    dailyLitres:      Math.round(model.page1.home.dailyHotWaterLitres),
    rankingOrder:     model.page3.items.map(i => i.family).join(' > '),
    waterSupply:      model.page1.house.waterSupplyLabel,
    solarAlignment:   model.page1.energy.energyAlignmentLabel,
    solarOpportunity: model.page1.energy.solarStorageOpportunityLabel,
  });

  const fpA = fingerprint(modelA);
  const fpB = fingerprint(modelB);
  const changedKeys = Object.keys(fpA).filter(k => (fpA as Record<string, unknown>)[k] !== (fpB as Record<string, unknown>)[k]);

  return (
    <div style={{ ...STYLES.card, borderColor: '#48c' }}>
      <div
        style={STYLES.cardHeader}
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
      >
        <div>
          <span style={STYLES.scenarioName}>diff: {pair.name}</span>
          <span style={STYLES.badge.info}>{changedKeys.length} field(s) changed</span>
        </div>
        <div style={STYLES.scenarioDesc}>{pair.description}</div>
        <div style={STYLES.expandHint}>{expanded ? '▲ Collapse' : '▼ Expand'}</div>
      </div>

      {expanded && (
        <div style={STYLES.cardBody}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#555' }}>
            Differing dimension: <strong>{pair.differingDimension}</strong>
          </p>
          <table style={{ ...STYLES.table, width: '100%' }}>
            <thead>
              <tr>
                <th style={STYLES.th}>Field</th>
                <th style={{ ...STYLES.th, background: '#eaf0ff' }}>Scenario A</th>
                <th style={{ ...STYLES.th, background: '#eaffea' }}>Scenario B</th>
                <th style={STYLES.th}>Changed?</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fpA).map(([key, valA]) => {
                const valB = (fpB as Record<string, unknown>)[key];
                const changed = valA !== valB;
                return (
                  <tr key={key} style={{ background: changed ? '#fffbe6' : 'transparent' }}>
                    <td style={STYLES.td}>{key}</td>
                    <td style={{ ...STYLES.td, background: '#eaf0ff' }}>{String(valA)}</td>
                    <td style={{ ...STYLES.td, background: '#eaffea' }}>{String(valB)}</td>
                    <td style={{ ...STYLES.td, textAlign: 'center' }}>{changed ? '✓' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * PresentationAuditPage
 *
 * Developer-only surface that shows all golden audit scenarios and their
 * canonical presentation outputs, with rule-violation flags.
 *
 * Access via: ?audit=1
 */
export default function PresentationAuditPage() {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'diff'>('scenarios');

  const entries = useMemo(
    () => Object.entries(AUDIT_SCENARIOS).map(([name, input]) => buildEntry(name, input)),
    [],
  );

  const totalErrors   = entries.reduce((n, e) => n + e.violations.filter(v => v.severity === 'error').length, 0);
  const totalWarnings = entries.reduce((n, e) => n + e.violations.filter(v => v.severity === 'warning').length, 0);

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <h1 style={{ margin: 0, fontSize: 22 }}>
          🔬 Atlas Presentation Audit
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555' }}>
          Internal review surface — not customer-facing. Access via <code>?audit=1</code>.
        </p>
        <div style={STYLES.summaryBar}>
          <span>{entries.length} scenarios</span>
          {totalErrors > 0
            ? <span style={{ color: '#c00' }}>✗ {totalErrors} error{totalErrors > 1 ? 's' : ''}</span>
            : <span style={{ color: '#2a8' }}>✓ No errors</span>}
          {totalWarnings > 0
            ? <span style={{ color: '#a60' }}>{totalWarnings} warning{totalWarnings > 1 ? 's' : ''}</span>
            : null}
        </div>
      </header>

      <nav style={STYLES.nav}>
        <button
          style={{ ...STYLES.tabButton, ...(activeTab === 'scenarios' ? STYLES.tabButtonActive : {}) }}
          onClick={() => setActiveTab('scenarios')}
        >
          Scenarios ({entries.length})
        </button>
        <button
          style={{ ...STYLES.tabButton, ...(activeTab === 'diff' ? STYLES.tabButtonActive : {}) }}
          onClick={() => setActiveTab('diff')}
        >
          Difference tests ({SCENARIO_PAIRS.length})
        </button>
      </nav>

      <main style={STYLES.main}>
        {activeTab === 'scenarios' && (
          <div>
            {entries.map(entry => (
              <ScenarioCard key={entry.name} entry={entry} />
            ))}
          </div>
        )}

        {activeTab === 'diff' && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>
              Each card shows a paired scenario that differs by exactly one input dimension.
              Highlighted rows show fields that changed between Scenario A and B.
            </p>
            {SCENARIO_PAIRS.map(pair => (
              <DiffCard key={pair.name} pair={pair} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = {
  page: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '16px',
    background: '#f8f9fa',
    minHeight: '100vh',
  } as React.CSSProperties,
  header: {
    background: '#fff',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  devBadge: {
    marginLeft: 10,
    fontSize: 11,
    background: '#e00',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 600,
    verticalAlign: 'middle',
  } as React.CSSProperties,
  summaryBar: {
    display: 'flex',
    gap: 16,
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,
  nav: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,
  tabButton: {
    padding: '6px 14px',
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  } as React.CSSProperties,
  tabButtonActive: {
    background: '#1a73e8',
    color: '#fff',
    borderColor: '#1a73e8',
  } as React.CSSProperties,
  main: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
  card: {
    background: '#fff',
    borderRadius: 8,
    border: '2px solid #2a8',
    overflow: 'hidden',
  } as React.CSSProperties,
  cardHeader: {
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  } as React.CSSProperties,
  cardBody: {
    padding: '0 16px 16px',
    borderTop: '1px solid #eee',
  } as React.CSSProperties,
  scenarioName: {
    fontWeight: 700,
    fontSize: 14,
    marginRight: 10,
  } as React.CSSProperties,
  scenarioDesc: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  } as React.CSSProperties,
  expandHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  } as React.CSSProperties,
  badge: {
    ok: { background: '#d4edda', color: '#155724', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 } as React.CSSProperties,
    error: { background: '#f8d7da', color: '#721c24', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 } as React.CSSProperties,
    warning: { background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 } as React.CSSProperties,
    info: { background: '#d1ecf1', color: '#0c5460', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 } as React.CSSProperties,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 12,
    marginBottom: 12,
  } as React.CSSProperties,
  sectionHeading: {
    fontSize: 13,
    fontWeight: 700,
    margin: '12px 0 4px',
    color: '#333',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  table: {
    borderCollapse: 'collapse' as const,
    fontSize: 12,
  } as React.CSSProperties,
  th: {
    background: '#f1f3f5',
    padding: '4px 8px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: 11,
    borderBottom: '1px solid #dee2e6',
  } as React.CSSProperties,
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 12,
  } as React.CSSProperties,
  tdKey: {
    padding: '3px 8px 3px 0',
    color: '#666',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    fontSize: 12,
  } as React.CSSProperties,
  shortlistItem: {
    background: '#fafafa',
    border: '1px solid #e9ecef',
    borderRadius: 4,
    padding: '8px 10px',
    marginBottom: 6,
    fontSize: 12,
  } as React.CSSProperties,
  visualBadge: {
    fontSize: 11,
    background: '#e3f2fd',
    color: '#1565c0',
    padding: '1px 6px',
    borderRadius: 10,
    fontWeight: 600,
    marginLeft: 6,
  } as React.CSSProperties,
  violationsBox: {
    background: '#fff3f3',
    border: '1px solid #f5c6cb',
    borderRadius: 4,
    padding: '8px 12px',
    marginTop: 12,
    fontSize: 12,
  } as React.CSSProperties,
};
