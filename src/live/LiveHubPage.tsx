/**
 * LiveHubPage — iPad-first live output control room.
 *
 * Decision-first layout based on the Atlas Output System Overhaul.
 *
 * Layout:
 *  1. Recommendation Card — large decision-first hero
 *  2. Trust Builders — House Heat Map, Hot Water Demand, Water Supply Gauge
 *  3. System Architecture — connection diagram
 *  4. Suitability Summary — system comparison table
 *  5. Future Upgrade Path — staged retrofit roadmap
 *  6. Detail Tiles — drill-down to physics detail sections
 *  7. Launch Proof Workspace CTA
 *  8. Export actions (primary: Print Recommendation; secondary: Technical Comparison, Engineering Detail)
 *
 * PR16: Added "Launch Simulator" CTA that opens the simulator pre-configured
 *       from the completed full survey, skipping the setup stepper.
 * PR17: Added print actions that reuse the existing lab print surfaces, fed from the current survey result.
 * PR8:  Rationalised export actions — Print Recommendation is the primary customer-facing output.
 *       Technical Comparison and Engineering Detail are secondary technical exports.
 *       Legacy "Customer Summary" and "Full Output Report" buttons removed.
 */
import { useState, useCallback } from 'react';
import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { ApplianceFamily } from '../engine/topology/SystemTopology';
import { FAMILY_TO_ELIGIBILITY_ID } from '../engine/OutputBuilder';
import LiveSectionPage from './LiveSectionPage';
import VerdictStrip from '../components/live/VerdictStrip';
import HubPage from '../components/hub/HubPage';
import ExplainersHubPage from '../explainers/ExplainersHubPage';
import LabPrintTechnical from '../components/lab/LabPrintTechnical';
import LabPrintComparison from '../components/lab/LabPrintComparison';
import { CustomerAdvicePrintPack } from '../components/print/CustomerAdvicePrintPack';
import { buildScenariosFromEngineOutput } from '../engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from '../engine/modules/buildDecisionFromScenarios';
import { buildVisualBlocks } from '../engine/modules/buildVisualBlocks';
import type { LifecycleBoilerType } from '../contracts/LifecycleAssessment';
import { buildPrintData } from './buildPrintData';
import { buildOutputHubSections } from './printSections.model';
import RecommendationCard from '../components/live/RecommendationCard';
import HouseHeatMapPanel from '../components/live/HouseHeatMapPanel';
import HotWaterDemandPanel from '../components/live/HotWaterDemandPanel';
import SystemArchitecturePanel from '../components/live/SystemArchitecturePanel';
import SuitabilitySummaryPanel from '../components/live/SuitabilitySummaryPanel';
import UpgradePathwayPanel from '../components/live/UpgradePathwayPanel';
import CanonicalPresentationPage from '../components/presentation/CanonicalPresentationPage';
import './LiveHubPage.css';

export type LiveSection =
  | 'current'
  | 'water'
  | 'usage'
  | 'evidence'
  | 'constraints'
  | 'chemistry'
  | 'glassbox'
  | 'hub'
  | 'simulator';

type PrintView = 'technical' | 'comparison' | 'recommendation';

interface Props {
  result: FullEngineResult;
  input: FullSurveyModelV1;
  onBack: () => void;
}

/**
 * Maps the engine heat-source family to the nearest LifecycleBoilerType.
 * Falls back to 'regular' for non-gas-boiler variants (ashp, other, unknown).
 */
function toLifecycleBoilerType(
  value: 'combi' | 'system' | 'regular' | 'ashp' | 'other' | undefined,
): LifecycleBoilerType {
  if (value === 'combi' || value === 'system' || value === 'regular') return value;
  return 'regular';
}

/** Derive a status chip value from engine output for each section. */
function sectionStatus(
  section: LiveSection,
  result: FullEngineResult,
  input?: FullSurveyModelV1,
): 'ok' | 'watch' | 'missing' {
  const { engineOutput } = result;
  switch (section) {
    case 'current': {
      const hasRejected = engineOutput.eligibility.some(e => e.status === 'rejected');
      const hasCaution = engineOutput.eligibility.some(e => e.status === 'caution');
      return hasRejected ? 'watch' : hasCaution ? 'watch' : 'ok';
    }
    case 'water': {
      const combiRisk = result.combiDhwV1?.verdict.combiRisk ?? 'pass';
      return combiRisk === 'fail' ? 'watch' : combiRisk === 'warn' ? 'watch' : 'ok';
    }
    case 'usage': {
      const hasOccupancy = input?.occupancyCount != null;
      const hasBathrooms = input?.bathroomCount != null;
      if (!hasOccupancy || !hasBathrooms) return 'missing';
      const storedRisk = result.storedDhwV1?.verdict.storedRisk ?? 'pass';
      return storedRisk === 'warn' ? 'watch' : 'ok';
    }
    case 'evidence': {
      if (!engineOutput.evidence || engineOutput.evidence.length === 0) return 'missing';
      const hasLow = engineOutput.evidence.some(e => e.confidence === 'low');
      return hasLow ? 'watch' : 'ok';
    }
    case 'constraints': {
      if (!engineOutput.limiters) return 'missing';
      const hasFail = engineOutput.limiters.limiters.some(l => l.severity === 'fail');
      return hasFail ? 'watch' : 'ok';
    }
    case 'chemistry': {
      const decay = result.normalizer.tenYearEfficiencyDecayPct;
      return decay > 8 ? 'watch' : 'ok';
    }
    case 'glassbox':
      return 'ok';
    case 'hub':
      return 'ok';
    case 'simulator':
      return 'ok';
  }
}

const TILE_CONFIG: Array<{
  id: LiveSection;
  icon: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'current',
    icon: '🏠',
    title: 'Current System',
    subtitle: 'Situation summary & transition architecture',
  },
  {
    id: 'water',
    icon: '💧',
    title: 'Water Power',
    subtitle: 'DHW flow capacity & concurrency analysis',
  },
  {
    id: 'usage',
    icon: '👥',
    title: 'Usage Model',
    subtitle: 'Daily demand, peak draw & sizing verdict',
  },
  {
    id: 'evidence',
    icon: '🔬',
    title: 'Evidence',
    subtitle: 'What the engine knows and how confident it is',
  },
  {
    id: 'constraints',
    icon: '⚖️',
    title: 'Constraints',
    subtitle: 'Physics limiters — observed vs allowed',
  },
  {
    id: 'chemistry',
    icon: '🧪',
    title: 'Chemistry',
    subtitle: 'Geochemical analysis — scale & silicate tax',
  },
  {
    id: 'glassbox',
    icon: '🔭',
    title: 'Glass Box',
    subtitle: 'Full physics trace & raw calculation detail',
  },
  {
    id: 'hub',
    icon: '🎛️',
    title: 'Control Room',
    subtitle: 'Demo Lab · Physics explainers & sandbox',
  },
];

const STATUS_LABEL: Record<'ok' | 'watch' | 'missing', string> = {
  ok: 'OK',
  watch: 'Watch',
  missing: 'Missing',
};

const WITHHELD_PREFIX = 'Recommendation withheld';
const MULTIPLE_PREFIX = 'Multiple';

/** Maps the deterministic recommendation string to a chip modifier class and label. */
function recommendationChipKind(primary: string): 'recommended' | 'multiple' | 'withheld' {
  if (primary.startsWith(WITHHELD_PREFIX)) return 'withheld';
  if (primary.startsWith(MULTIPLE_PREFIX)) return 'multiple';
  return 'recommended';
}

function RecommendationChip({ primary }: { primary: string }) {
  const kind = recommendationChipKind(primary);
  return (
    <div className={`live-hub__verdict-chip live-hub__verdict-chip--${kind}`}>
      <span className="live-hub__verdict-label">Recommendation</span>
      <span className={`live-hub__verdict-value live-hub__verdict-value--${kind}`}>
        {primary}
      </span>
    </div>
  );
}

export default function LiveHubPage({ result, input, onBack }: Props) {
  const [activeSection, setActiveSection] = useState<LiveSection | null>(null);
  const [printView, setPrintView] = useState<PrintView | null>(null);
  const [deckMode, setDeckMode] = useState(true);

  // Track which Option 1 / Option 2 families the engineer agreed with the
  // customer during the in-room presentation so the printout reflects the
  // same choices.  Initialised to the engine's top-2 recommendation.
  const [deckOpt1Family, setDeckOpt1Family] = useState<ApplianceFamily | null>(
    () => (result.recommendationResult?.bestOverall?.family ?? null) as ApplianceFamily | null,
  );
  const [deckOpt2Family, setDeckOpt2Family] = useState<ApplianceFamily | null>(null);

  const handleOptionsChange = useCallback(
    (opt1: ApplianceFamily | null, opt2: ApplianceFamily | null) => {
      setDeckOpt1Family(opt1);
      setDeckOpt2Family(opt2);
    },
    [],
  );

  const { engineOutput } = result;
  const canonicalFamily = result.recommendationResult?.bestOverall?.family;
  const canonicalEligibilityId =
    canonicalFamily != null
      ? (FAMILY_TO_ELIGIBILITY_ID[canonicalFamily as keyof typeof FAMILY_TO_ELIGIBILITY_ID] ?? null)
      : null;
  const canonicalHeadline =
    (canonicalEligibilityId != null
      ? engineOutput.eligibility.find(e => e.id === canonicalEligibilityId)?.label
      : undefined) ?? engineOutput.recommendation.primary;

  // ── Print overlay ─────────────────────────────────────────────────────────
  // When a print view is active render the corresponding print surface
  // full-screen.  The print component's onBack callback dismisses the overlay.
  if (printView !== null) {
    const printData = buildPrintData(result, input);
    const closePrint = () => setPrintView(null);
    if (printView === 'recommendation') {
      // Build the canonical Decision-First print pack from the same
      // VisualBlock[] truth used by the presentation deck.  Falls back to
      // closing the overlay when the engine produced no option cards.
      const scenarios = buildScenariosFromEngineOutput(engineOutput);
      if (scenarios.length > 0) {
        const decision = buildDecisionFromScenarios({
          scenarios,
          boilerType:     toLifecycleBoilerType(input.currentHeatSourceType),
          ageYears:       input.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: input.occupancyCount,
          bathroomCount:  input.bathroomCount,
        });
        const visualBlocks = buildVisualBlocks(decision, scenarios, undefined, input);
        return (
          <CustomerAdvicePrintPack
            decision={decision}
            scenarios={scenarios}
            visualBlocks={visualBlocks}
            onBack={closePrint}
          />
        );
      }
      // No scenarios — engine hasn't produced option cards yet; close overlay.
      closePrint();
      return null;
    }
    if (printView === 'technical') {
      return <LabPrintTechnical data={printData} onBack={closePrint} />;
    }
    if (printView === 'comparison') {
      return <LabPrintComparison data={printData} onBack={closePrint} />;
    }
  }

  // Comparison print is only offered when the engine returned ≥ 2 options so
  // the table always has meaningful content.
  const hasComparisonData = (engineOutput.options?.length ?? 0) >= 2;

  if (activeSection === 'hub') {
    return (
      <HubPage
        result={result}
        input={input}
        onBack={() => setActiveSection(null)}
        onGoToPortal={() => { window.location.href = '/portal'; }}
      />
    );
  }

  if (activeSection === 'simulator') {
    return (
      <ExplainersHubPage
        surveyData={input}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  if (activeSection) {
    return (
      <LiveSectionPage
        section={activeSection}
        result={result}
        input={input}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  // Build all sections once — used for both visual panels and print
  const allSections = buildOutputHubSections(result, input);

  // Locate individual sections for the visual panel
  const heatMapSection       = allSections.find(s => s.id === 'heatMap')!;
  const hotWaterSection      = allSections.find(s => s.id === 'hotWaterDemand')!;
  const archSection          = allSections.find(s => s.id === 'systemArchitecture')!;
  const suitabilitySection   = allSections.find(s => s.id === 'suitabilitySummary')!;
  const upgradeSection       = allSections.find(s => s.id === 'upgradePathway')!;

  return (
    <div className="live-hub">
      {/* ── Sticky verdict strip ─────────────────────────────────────── */}
      <div className="live-hub__verdict-strip">
        <div className="live-hub__verdict-strip-inner">
          <button
            className="live-hub__back-btn"
            onClick={onBack}
            aria-label="Back to survey"
          >
            ← Back
          </button>
          <div className="live-hub__verdict-chips">
            <VerdictStrip
              result={result}
              onOpenCombi={() => setActiveSection('water')}
              onOpenStored={() => setActiveSection('usage')}
              onOpenConstraints={() => setActiveSection('constraints')}
            />
            <RecommendationChip primary={canonicalHeadline} />
          </div>
        </div>
      </div>

      {/* ── Hub title ────────────────────────────────────────────────── */}
      <div className="live-hub__header">
        <h1 className="live-hub__title">📡 Atlas Live Output Hub</h1>
        <p className="live-hub__subtitle">
          Physics-driven analysis. Every result answers: what system, why, what changes, what's next.
        </p>
      </div>

      {/* ── DEV: recommendation source alignment check ───────────────────
           Shows canonical top option (from evidence-backed ranking) vs
           the headline string (engineOutput.recommendation.primary).
           After PR6a these must always agree — any divergence here is a bug.
           Only rendered in development builds. */}
      {import.meta.env.DEV && result.recommendationResult != null && (() => {
        const canonicalTopOptionId = result.recommendationResult.bestOverall?.family ?? '(none)';
        const headlineOptionId = canonicalEligibilityId ?? '(none)';
        const inRoomOptionId = result.recommendationResult.bestOverall?.family ?? '(none)';
        const simulatorTargetStateId = result.recommendationResult.bestOverall?.family ?? '(none)';
        const peakHeatLossKw = ((input.heatLossWatts ?? 8000) / 1000).toFixed(2);
        const bathrooms = input.bathroomCount ?? 1;
        const peakOutlets = input.peakConcurrentOutlets ?? '—';
        const mainsFlow = input.mainsDynamicFlowLpm != null ? `${input.mainsDynamicFlowLpm} L/min` : '—';
        const mainsPressure = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure ?? '—';
        const currentSystemFamily = input.currentHeatSourceType ?? '(unknown)';
        const roofOrientation =
          input.fullSurvey?.heatLoss?.roofOrientation != null && input.fullSurvey.heatLoss.roofOrientation !== 'unknown'
            ? input.fullSurvey.heatLoss.roofOrientation
            : '—';
        const solarSummary =
          input.fullSurvey?.heatLoss != null
            ? `${input.fullSurvey.heatLoss.roofType}/${input.fullSurvey.heatLoss.shadingLevel}`
            : '—';
        const aligned = canonicalTopOptionId === headlineOptionId || canonicalTopOptionId === '(none)';
        return (
          <div
            data-testid="dev-truth-panel"
            style={{
              margin: '0.5rem 1rem 1rem',
              padding: '0.6rem 0.875rem',
              background: '#0f172a',
              borderRadius: '6px',
              border: `1px dashed ${aligned ? '#22c55e' : '#f97316'}`,
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#94a3b8',
            }}
          >
            <div style={{ color: aligned ? '#4ade80' : '#fb923c', fontWeight: 700, marginBottom: '0.25rem' }}>
              {aligned ? '✅ DEV — truth panel aligned' : '⚠️ DEV — truth panel mismatch'}
            </div>
            <div>canonical top option id: <span style={{ color: '#fbbf24' }}>{canonicalTopOptionId}</span></div>
            <div>headline option id: <span style={{ color: aligned ? '#fbbf24' : '#f87171' }}>{headlineOptionId}</span></div>
            <div>in-room option id: <span style={{ color: '#fbbf24' }}>{inRoomOptionId}</span></div>
            <div>heat loss kW: <span style={{ color: '#fbbf24' }}>{peakHeatLossKw}</span></div>
            <div>bathrooms: <span style={{ color: '#fbbf24' }}>{bathrooms}</span></div>
            <div>peak outlets: <span style={{ color: '#fbbf24' }}>{peakOutlets}</span></div>
            <div>mains flow @ pressure: <span style={{ color: '#fbbf24' }}>{mainsFlow}</span> @ <span style={{ color: '#fbbf24' }}>{mainsPressure}</span></div>
            <div>current system family: <span style={{ color: '#fbbf24' }}>{currentSystemFamily}</span></div>
            <div>roof orientation / solar summary: <span style={{ color: '#fbbf24' }}>{roofOrientation} · {solarSummary}</span></div>
            <div>simulator target state id: <span style={{ color: '#fbbf24' }}>{simulatorTargetStateId}</span></div>
            {!aligned && (
              <div style={{ color: '#f87171', marginTop: '0.25rem' }}>
                Canonical best option and headline mapping disagree.
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 0 — Canonical Presentation (physics-first, primary)   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="live-hub__section live-hub__section--canonical">
        <div className="live-hub__section-header">
          <h2 className="live-hub__section-title">🏡 Canonical Presentation Preview</h2>
          <button
            type="button"
            className="live-hub__deck-toggle"
            onClick={() => setDeckMode(m => !m)}
            aria-pressed={deckMode}
          >
            {deckMode ? '⬇ Vertical view' : '↔ Deck view'}
          </button>
        </div>
        <CanonicalPresentationPage
          result={result}
          input={input}
          recommendationResult={result.recommendationResult}
          onOpenSimulator={() => setActiveSection('simulator')}
          onPrint={() => setPrintView('recommendation')}
          onOptionsChange={handleOptionsChange}
          deckMode={deckMode}
          heatLossState={input.fullSurvey?.heatLoss}
          prioritiesState={input.fullSurvey?.priorities}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Recommendation Card (decision-first hero)         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="live-hub__section live-hub__section--recommendation">
        <RecommendationCard engineOutput={engineOutput} />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Three Trust Builders (visual evidence)            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="live-hub__section">
        <h2 className="live-hub__section-title">Visual Evidence</h2>
        <p className="live-hub__section-intro">
          Physics shown visually — not described in paragraphs.
        </p>
        <div className="live-hub__graphics-panel">
          <HouseHeatMapPanel section={heatMapSection} />
          <HotWaterDemandPanel section={hotWaterSection} />
          {/* Graphic 3 — Water Supply Gauge is shown via the Water Power tile below */}
          <div className="hub-graphic hub-graphic--water-cta">
            <h3 className="hub-graphic__title">💧 Water Supply</h3>
            <p className="hub-graphic__intro">
              Measured supply performance determines system eligibility.
            </p>
            <button
              className="live-hub__tile-link-btn"
              onClick={() => setActiveSection('water')}
              aria-label="Open water power detail"
            >
              View supply gauge & analysis →
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — System Architecture                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="live-hub__section live-hub__section--arch">
        <SystemArchitecturePanel section={archSection} />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Suitability Summary                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {suitabilitySection.visible && (
        <div className="live-hub__section">
          <SuitabilitySummaryPanel section={suitabilitySection} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Future Upgrade Path                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {upgradeSection.visible && (
        <div className="live-hub__section">
          <UpgradePathwayPanel section={upgradeSection} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — Detail Tiles (drill-down to physics detail)       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="live-hub__section">
        <h2 className="live-hub__section-title">Engineering Detail</h2>
        <p className="live-hub__section-intro">
          Tap any panel to inspect the full physics trace and calculation detail.
        </p>
        <div className="live-hub__grid">
          {TILE_CONFIG.map(tile => {
            const status = sectionStatus(tile.id, result, input);
            return (
              <button
                key={tile.id}
                className={`live-hub__tile live-hub__tile--${status}`}
                onClick={() => setActiveSection(tile.id)}
              >
                <div className="live-hub__tile-icon">{tile.icon}</div>
                <div className="live-hub__tile-title">{tile.title}</div>
                <div className="live-hub__tile-subtitle">{tile.subtitle}</div>
                <div className={`live-hub__tile-chip live-hub__tile-chip--${status}`}>
                  {STATUS_LABEL[status]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Launch Proof Workspace CTA ───────────────────────────────── */}
      <div className="live-hub__simulator-cta">
        <div className="live-hub__simulator-cta-inner">
          <div className="live-hub__simulator-cta-icon" aria-hidden="true">🧱</div>
          <div className="live-hub__simulator-cta-content">
            <div className="live-hub__simulator-cta-title">Open Proof Workspace</div>
            <div className="live-hub__simulator-cta-subtitle">
              See this home's system behaviour — prefilled from your survey data
            </div>
          </div>
          <button
            className="live-hub__simulator-cta-btn"
            onClick={() => setActiveSection('simulator')}
            aria-label="Open proof workspace prefilled from full survey data"
          >
            Open Workspace →
          </button>
        </div>
      </div>

      {/* ── Export actions ────────────────────────────────────────────── */}
      {/* Primary: Print Recommendation — the canonical customer-facing output.  */}
      {/* Secondary: Technical Comparison and Engineering Detail.               */}
      <div className="live-hub__print-actions">
        <div className="live-hub__print-actions-label">🖨 Print &amp; Export</div>
        <div className="live-hub__print-actions-buttons">
          {/* Primary export — canonical recommendation print */}
          <button
            className="live-hub__print-btn live-hub__print-btn--primary"
            onClick={() => setPrintView('recommendation')}
            aria-label="Print recommendation"
          >
            🎯 Print Recommendation
          </button>
        </div>
        <div className="live-hub__print-actions-secondary-label">Technical exports</div>
        <div className="live-hub__print-actions-buttons">
          <button
            className="live-hub__print-btn live-hub__print-btn--secondary"
            onClick={() => setPrintView('technical')}
            aria-label="Print engineering detail"
          >
            Engineering Detail
          </button>
          {hasComparisonData && (
            <button
              className="live-hub__print-btn live-hub__print-btn--secondary"
              onClick={() => setPrintView('comparison')}
              aria-label="Print technical comparison"
            >
              Technical Comparison
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
