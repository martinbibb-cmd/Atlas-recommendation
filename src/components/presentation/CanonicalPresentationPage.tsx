/**
 * CanonicalPresentationPage.tsx
 *
 * Multi-page structured recommendation presentation built directly on canonical
 * model outputs — no generic copy that does not reference house/home/energy/
 * current-system/objective signals.
 *
 * Page structure:
 *   1       — What we know (house · home · energy · current system · objectives)
 *   1.5     — Contextual ageing / degradation framing (probabilistic)
 *   2       — Available options (each explained through house/home/energy)
 *   3       — Physics-first ranking (one-line causal reason per option)
 *   4+      — Shortlisted option detail (required work / best-performance upgrades)
 *   Final   — Simulator / proof layer
 *
 * Acceptance criteria enforced here:
 *   ✓ Changing demographics → "home" section copy changes visibly.
 *   ✓ Changing PV/battery status → "energy" section copy changes visibly.
 *   ✓ Good roof without PV ≠ existing PV (labelled distinctly).
 *   ✓ Planned PV → future-compatibility messaging only (not installed-benefit).
 *   ✓ Recommendation language is causally specific.
 *
 * Rules:
 *   - No engine logic. Pure presentation.
 *   - No Math.random() — deterministic.
 *   - All data from CanonicalPresentationModel (buildCanonicalPresentation).
 */

import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { ApplianceFamily } from '../../engine/topology/SystemTopology';
import {
  buildCanonicalPresentation,
  type CanonicalPresentationModel,
  type HouseSignal,
  type HomeSignal,
  type EnergySignal,
  type CurrentSystemSignal,
  type ObjectivesSignal,
  type Page1_5AgeingContext,
  type AvailableOptionExplanation,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
  type FinalPageSimulator,
} from './buildCanonicalPresentation';
import { resolveCurrentSystemVisualId } from './presentationVisualMapping';
import PresentationVisualSlot from './PresentationVisualSlot';
import PresentationDeck from './PresentationDeck';
import SystemArchitectureVisualiser from '../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import { inputToConceptModel } from '../../explainers/lego/autoBuilder/inputToConceptModel';
import { optionToConceptModel } from '../../explainers/lego/autoBuilder/optionToConceptModel';
import type { OptionId } from '../../explainers/lego/autoBuilder/optionToConceptModel';
import './CanonicalPresentationPage.css';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cpp-signal-card__row">
      <span className="cpp-signal-card__label">{label}</span>
      <span className="cpp-signal-card__value">{value}</span>
    </div>
  );
}

// ─── Page 1 sections (visual-first) ──────────────────────────────────────────

function HouseSection({ house }: { house: HouseSignal }) {
  return (
    <div className="cpp-visual-section">
      <div className="cpp-visual-section__context">
        <p className="cpp-visual-section__context-detail">
          {house.heatLossLabel} · {house.heatLossBand}
        </p>
        <p className="cpp-visual-section__context-detail">
          {house.wallTypeLabel} · {house.insulationLabel}
        </p>
        {house.roofOrientationLabel && (
          <p className="cpp-visual-section__context-detail">
            {house.roofOrientationLabel}
            {house.roofTypeLabel ? ` · ${house.roofTypeLabel}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function HomeSection({ home }: { home: HomeSignal }) {
  const outletsActive = Math.max(1, Math.min(home.peakSimultaneousOutlets, 3)) as 1 | 2 | 3;
  return (
    <div className="cpp-visual-section">
      <PresentationVisualSlot
        visualId="flow_split"
        visualData={{ outletsActive }}
      />
      <div className="cpp-visual-section__context">
        <p className="cpp-visual-section__context-detail">
          {home.dailyHotWaterLabel}
        </p>
        <p className="cpp-visual-section__context-detail">
          {home.peakOutletsLabel}
        </p>
      </div>
    </div>
  );
}

function EnergySection({ energy }: { energy: EnergySignal }) {
  return (
    <div className="cpp-visual-section">
      <PresentationVisualSlot
        visualId="solar_mismatch"
      />
      <div className="cpp-visual-section__context">
        <p className="cpp-visual-section__context-detail">
          {energy.pvStatusLabel} · {energy.pvSuitabilityLabel}
        </p>
        <p className="cpp-visual-section__context-detail">
          {energy.energyAlignmentLabel}
        </p>
      </div>
    </div>
  );
}

function CurrentSystemSection({ sys }: { sys: CurrentSystemSignal }) {
  const visualId = resolveCurrentSystemVisualId(sys.dhwArchitecture);
  return (
    <div className="cpp-visual-section">
      {visualId === 'thermal_store' ? (
        // Thermal stores always require high primary temperatures (75–85 °C) —
        // that is the defining physics constraint of this architecture.
        <PresentationVisualSlot
          visualId="thermal_store"
          visualData={{ flowTempBand: 'high' }}
        />
      ) : visualId === 'cylinder_charge_mixergy' ? (
        <PresentationVisualSlot visualId="cylinder_charge_mixergy" />
      ) : visualId === 'cylinder_charge_standard' ? (
        <PresentationVisualSlot visualId="cylinder_charge_standard" />
      ) : (
        <PresentationVisualSlot
          visualId="driving_style"
          visualData={{ mode: sys.drivingStyleMode }}
        />
      )}
      <div className="cpp-visual-section__context">
        {(sys.systemTypeLabel != null || sys.ageLabel != null) && (
          <p className="cpp-visual-section__context-detail">
            {[sys.systemTypeLabel, sys.ageLabel].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="cpp-visual-section__context-detail cpp-visual-section__context-detail--muted">
          {sys.ageContext}
        </p>
        {sys.emittersLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Emitters: {sys.emittersLabel}
          </p>
        )}
        {sys.controlFamilyLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Controls: {sys.controlFamilyLabel}
            {sys.thermostatStyleLabel != null ? ` · ${sys.thermostatStyleLabel}` : ''}
          </p>
        )}
        {sys.pipeLayoutLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Pipework: {sys.pipeLayoutLabel}
          </p>
        )}
        {sys.sedbukBandLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Efficiency: {sys.sedbukBandLabel}
          </p>
        )}
        {sys.serviceHistoryLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Service: {sys.serviceHistoryLabel}
          </p>
        )}
        {sys.heatingSystemTypeLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Circuit: {sys.heatingSystemTypeLabel}
          </p>
        )}
        {sys.pipeworkAccessLabel != null && (
          <p className="cpp-visual-section__context-detail">
            Pipework access: {sys.pipeworkAccessLabel}
          </p>
        )}
        {sys.conditionSignalPills.length > 0 && (
          <div className="cpp-condition-pills">
            {sys.conditionSignalPills.map((pill, i) => (
              <span
                key={i}
                className={`cpp-condition-pill cpp-condition-pill--${pill.status}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectivesSection({ objectives }: { objectives: ObjectivesSignal }) {
  if (objectives.priorities.length === 0) {
    return (
      <div className="cpp-signal-card cpp-signal-card--objectives">
        <p className="cpp-signal-card__heading">🎯 Your objectives</p>
        <p className="cpp-signal-card__empty">No priorities were selected.</p>
      </div>
    );
  }
  return (
    <div className="cpp-signal-card cpp-signal-card--objectives">
      <p className="cpp-signal-card__heading">🎯 Your objectives</p>
      {objectives.priorities.map((p, i) => (
        <SignalRow key={i} label={p.label} value={p.value} />
      ))}
    </div>
  );
}

// ─── Page 1.5 ────────────────────────────────────────────────────────────────

function AgeingContextSection({ ctx }: { ctx: Page1_5AgeingContext }) {
  if (!ctx.hasRealEvidence) {
    return (
      <div className="cpp-ageing">
        <p className="cpp-ageing__band">Condition not assessed from current survey data</p>
        <p className="cpp-ageing__note">
          No age, condition band, or sludge signal was recorded for this system.
          Condition analysis is only shown when backed by captured evidence.
        </p>
      </div>
    );
  }
  return (
    <div className="cpp-ageing">
      <p className="cpp-ageing__band">
        System age: <strong>{ctx.ageBandLabel}</strong>
      </p>
      <ul className="cpp-ageing__notes">
        {ctx.probabilisticNotes.map((note, i) => <li key={i}>{note}</li>)}
      </ul>
      {ctx.waterQualityNote && (
        <p className="cpp-ageing__water-note">{ctx.waterQualityNote}</p>
      )}
    </div>
  );
}

// ─── Page 2 ──────────────────────────────────────────────────────────────────

function OptionLens({
  modifier,
  heading,
  items,
}: {
  modifier: string;
  heading: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className={`cpp-option-lens cpp-option-lens--${modifier}`}>
      <p className="cpp-option-lens__heading">{heading}</p>
      <ul className="cpp-option-lens__list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function AvailableOptionCard({ option }: { option: AvailableOptionExplanation }) {
  return (
    <article
      className={`cpp-option-card cpp-option-card--${option.status}`}
      aria-label={option.label}
    >
      <header className="cpp-option-card__header">
        <p className="cpp-option-card__label">{option.label}</p>
        <span className={`cpp-status-badge cpp-status-badge--${option.status}`}>
          {option.status === 'viable'   ? '✅ Viable' :
           option.status === 'caution'  ? '⚠️ Caution' :
           '⚠️ Not advised'}
        </span>
      </header>
      <div className="cpp-option-card__body">
        <p className="cpp-option-card__what">{option.whatItIs}</p>
        <p className="cpp-option-card__headline">{option.headline}</p>
        <div className="cpp-option-lenses">
          <OptionLens modifier="house"  heading="🏠 In your house" items={option.throughHouseNotes} />
          <OptionLens modifier="home"   heading="👥 In your home"  items={option.throughHomeNotes} />
          <OptionLens modifier="energy" heading="⚡ For your energy" items={option.throughEnergyNotes} />
        </div>
        {option.worksWellWhen.length > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#276749', marginTop: '0.5rem' }}>
            <strong>Works well when: </strong>{option.worksWellWhen.join(' · ')}
          </div>
        )}
        {option.limitedWhen.length > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#c05621', marginTop: '0.25rem' }}>
            <strong>Limited when: </strong>{option.limitedWhen.join(' · ')}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Page 3 ──────────────────────────────────────────────────────────────────

function RankingItem({ item }: { item: PhysicsRankingItem }) {
  return (
    <div
      className={`cpp-ranking-item${item.rank === 1 ? ' cpp-ranking-item--rank-1' : ''}`}
      aria-label={`Rank ${item.rank}: ${item.label}`}
    >
      <div className="cpp-ranking-item__rank" aria-hidden="true">{item.rank}</div>
      <div className="cpp-ranking-item__body">
        <p className="cpp-ranking-item__label">{item.label}</p>
        {item.overallScore > 0 && (
          <p className="cpp-ranking-item__score">Score: {item.overallScore}</p>
        )}
        <p className="cpp-ranking-item__reason">{item.reasonLine}</p>
        <div className="cpp-ranking-fit-notes" aria-label="Fit dimensions">
          {item.demandFitNote && (
            <span className="cpp-fit-note cpp-fit-note--demand">Demand: {item.demandFitNote}</span>
          )}
          {item.waterFitNote && (
            <span className="cpp-fit-note cpp-fit-note--water">Water: {item.waterFitNote}</span>
          )}
          {item.infrastructureFitNote && (
            <span className="cpp-fit-note cpp-fit-note--infra">Infra: {item.infrastructureFitNote}</span>
          )}
          {item.energyFitNote && (
            <span className="cpp-fit-note cpp-fit-note--energy">Energy: {item.energyFitNote}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pages 4+ ────────────────────────────────────────────────────────────────

function ShortlistedCard({
  option,
  input,
}: {
  option: ShortlistedOptionDetail;
  input: EngineInputV2_3;
}) {
  const currentConcept      = inputToConceptModel(input);
  const isMixergy           = option.dhwArchitecture === 'mixergy';
  const recommendedConcept  = optionToConceptModel(
    option.family as OptionId,
    isMixergy,
    input.emitterType ? [input.emitterType] : undefined,
  );
  const futurePathways = option.solarStorageOpportunity === 'high'
    ? [{ id: 'solar_connection' as const }]
    : [];

  return (
    <div className="cpp-shortlist-card">
      <header className="cpp-shortlist-card__header">
        <p className="cpp-shortlist-card__label">{option.label}</p>
      </header>
      {/* Architecture diff — shown when current system data is available */}
      {currentConcept && (
        <div className="cpp-shortlist-card__architecture">
          <SystemArchitectureVisualiser
            mode="compare"
            currentSystem={currentConcept}
            recommendedSystem={recommendedConcept}
            futurePathways={futurePathways}
          />
        </div>
      )}
      <div className="cpp-shortlist-card__body">
        {option.complianceItems.length > 0 && (
          <section className="cpp-shortlist-section cpp-shortlist-section--compliance">
            <p className="cpp-shortlist-section__heading">🔒 Required safety &amp; compliance</p>
            <ul className="cpp-shortlist-section__list">
              {option.complianceItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        )}
        <section className="cpp-shortlist-section cpp-shortlist-section--required">
          <p className="cpp-shortlist-section__heading">🔨 Required work</p>
          {option.requiredWork.length > 0 ? (
            <ul className="cpp-shortlist-section__list">
              {option.requiredWork.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="cpp-shortlist-section__empty">No required enabling works recorded.</p>
          )}
        </section>
        <section className="cpp-shortlist-section cpp-shortlist-section--best">
          <p className="cpp-shortlist-section__heading">✨ To get the most from it</p>
          {option.bestPerformanceUpgrades.length > 0 ? (
            <ul className="cpp-shortlist-section__list">
              {option.bestPerformanceUpgrades.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="cpp-shortlist-section__empty">No additional upgrades identified.</p>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Final page ───────────────────────────────────────────────────────────────

function SimulatorSection({
  sim,
  onOpenSimulator,
}: {
  sim: FinalPageSimulator;
  onOpenSimulator?: () => void;
}) {
  return (
    <div className="cpp-simulator">
      <p className="cpp-simulator__identity">
        System Simulator · Live taps, heating, and full system diagram
      </p>
      <p className="cpp-simulator__scenario">{sim.homeScenarioDescription}</p>
      <p className="cpp-simulator__architecture-note">{sim.dhwArchitectureNote}</p>
      {sim.simulatorCapabilities.length > 0 && (
        <ul className="cpp-simulator__capabilities">
          {sim.simulatorCapabilities.map((cap, i) => <li key={i}>{cap}</li>)}
        </ul>
      )}
      {sim.houseConstraintNotes.length > 0 && (
        <ul className="cpp-simulator__notes">
          {sim.houseConstraintNotes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      )}
      {sim.energyTimingNotes.length > 0 && (
        <ul className="cpp-simulator__notes">
          {sim.energyTimingNotes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      )}
      {sim.physicsEvidenceSummary.length > 0 && (
        <div className="cpp-simulator__evidence">
          <p className="cpp-simulator__evidence-heading">Key physics signals</p>
          <ul className="cpp-simulator__evidence-list">
            {sim.physicsEvidenceSummary.map((item, i) => (
              <li
                key={i}
                className={`cpp-simulator__evidence-item cpp-simulator__evidence-item--${item.severity}`}
              >
                <span>{item.signal}</span>
                <span className="cpp-simulator__evidence-outcome">{item.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {onOpenSimulator && (
        <button
          type="button"
          className="cpp-simulator__cta"
          onClick={onOpenSimulator}
        >
          Open System Simulator →
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  result: FullEngineResult;
  input: EngineInputV2_3;
  /**
   * Optional PR11/PR12 recommendation result.
   * When provided, drives Page 3 (physics-first ranking) and Pages 4+.
   */
  recommendationResult?: RecommendationResult;
  /**
   * Optional callback to open the interactive simulator.
   * When provided, the final page shows an "Open simulator" CTA.
   */
  onOpenSimulator?: () => void;
  /**
   * Optional callback to open the print/PDF view.
   * When provided, the final page shows a "Print summary" CTA.
   */
  onPrint?: () => void;
  /**
   * Optional callback fired when the user changes their Option 1 / Option 2
   * selections on the ranking page.  The parent can store these families and
   * pass them to the print component so the printout reflects in-room choices.
   */
  onOptionsChange?: (opt1Family: ApplianceFamily | null, opt2Family: ApplianceFamily | null) => void;
  /**
   * When true, renders the swipeable visual story deck instead of the
   * vertical scrollable layout.  Defaults to false (vertical mode).
   */
  deckMode?: boolean;
  /**
   * Optional heat-loss survey state (PR8b/PR8c).
   * When provided, the quadrant dashboard uses the shell perimeter snapshot
   * and roof orientation.
   */
  heatLossState?: import('../../features/survey/heatLoss/heatLossTypes').HeatLossState;
  /**
   * Optional chip-style priorities from the Priorities step (PR8a).
   * When provided, the Your Priorities tile shows the selected chips.
   */
  prioritiesState?: import('../../features/survey/priorities/prioritiesTypes').PrioritiesState;
}

/**
 * CanonicalPresentationPage — multi-page structured recommendation presentation.
 *
 * Every rendered statement is causally tied to a house, home, energy,
 * current-system, or objective signal. No generic standalone assertions.
 */
export default function CanonicalPresentationPage({
  result,
  input,
  recommendationResult,
  onOpenSimulator,
  onPrint,
  onOptionsChange,
  deckMode = true,
  heatLossState,
  prioritiesState,
}: Props) {
  // Delegate to the swipeable deck when deckMode is enabled.
  if (deckMode) {
    return (
      <PresentationDeck
        result={result}
        input={input}
        recommendationResult={recommendationResult}
        onOpenSimulator={onOpenSimulator}
        onPrint={onPrint}
        onOptionsChange={onOptionsChange}
        heatLossState={heatLossState}
        prioritiesState={prioritiesState}
      />
    );
  }

  const model: CanonicalPresentationModel = buildCanonicalPresentation(
    result,
    input,
    recommendationResult,
    prioritiesState,
  );

  const { page1, page1_5, page2, page3, page4Plus, finalPage } = model;

  return (
    <div className="cpp" data-testid="canonical-presentation-page">

      {/* ── Page 1 — What we know ───────────────────────────────────── */}
      <section
        className="cpp-page"
        aria-label="Page 1 — What we know about this home"
        data-canonical-source="page1"
      >
        <p className="cpp-page__eyebrow">Page 1</p>
        <h2 className="cpp-page__heading">What we know about this home</h2>

        <div className="cpp-visual-sections">
          <div
            className="cpp-visual-section-wrapper"
            data-canonical-source="page1.house"
          >
            <p className="cpp-visual-section__heading">🏠 Your house</p>
            <HouseSection house={page1.house} />
          </div>

          <div
            className="cpp-visual-section-wrapper"
            data-canonical-source="page1.home"
          >
            <p className="cpp-visual-section__heading">👥 Your home</p>
            <HomeSection home={page1.home} />
          </div>

          <div
            className="cpp-visual-section-wrapper"
            data-canonical-source="page1.energy"
          >
            <p className="cpp-visual-section__heading">⚡ Your energy</p>
            <EnergySection energy={page1.energy} />
          </div>

          <div
            className="cpp-visual-section-wrapper"
            data-canonical-source="page1.currentSystem"
          >
            <p className="cpp-visual-section__heading">🔧 Your current system</p>
            <CurrentSystemSection sys={page1.currentSystem} />
          </div>
        </div>

        <div data-canonical-source="page1.objectives">
          <ObjectivesSection objectives={page1.objectives} />
        </div>
      </section>

      {/* ── Page 1.5 — Contextual ageing ────────────────────────────── */}
      <section
        className="cpp-page"
        aria-label="Page 1.5 — About your current system"
        data-canonical-source="page1_5"
      >
        <p className="cpp-page__eyebrow">Page 1.5</p>
        <h2 className="cpp-page__heading">{page1_5.heading}</h2>
        <AgeingContextSection ctx={page1_5} />
      </section>

      {/* ── Page 2 — Available options ───────────────────────────────── */}
      <section
        className="cpp-page"
        aria-label="Page 2 — Available system options"
        data-canonical-source="page2"
      >
        <p className="cpp-page__eyebrow">Page 2</p>
        <h2 className="cpp-page__heading">Available options for this home</h2>
        {page2.options.length > 0 ? (
          <div className="cpp-options-list">
            {page2.options.map(opt => (
              <AvailableOptionCard key={opt.id} option={opt} />
            ))}
          </div>
        ) : (
          <p className="cpp-empty">No options returned by the engine.</p>
        )}
      </section>

      {/* ── Page 3 — Physics-first ranking ──────────────────────────── */}
      <section
        className="cpp-page"
        aria-label="Page 3 — Physics-first ranking"
        data-canonical-source="page3"
      >
        <p className="cpp-page__eyebrow">Page 3</p>
        <h2 className="cpp-page__heading">Physics-first ranking</h2>
        {page3.items.length > 0 ? (
          <div className="cpp-ranking-list">
            {page3.items.map(item => (
              <RankingItem key={item.family} item={item} />
            ))}
          </div>
        ) : (
          <p className="cpp-empty">No ranking available — run the engine with recommendation output.</p>
        )}
      </section>

      {/* ── Pages 4+ — Shortlisted option detail ────────────────────── */}
      {page4Plus.options.length > 0 && (
        <section
          className="cpp-page"
          aria-label="Pages 4+ — Shortlisted option detail"
          data-canonical-source="page4Plus"
        >
          <p className="cpp-page__eyebrow">Pages 4 – 5</p>
          <h2 className="cpp-page__heading">Shortlisted options — required work and upgrades</h2>
          <div className="cpp-shortlist-options">
            {page4Plus.options.map(opt => (
              <ShortlistedCard key={opt.family} option={opt} input={input} />
            ))}
          </div>
        </section>
      )}

      {/* ── Final page — Simulator ───────────────────────────────────── */}
      <section
        className="cpp-page"
        aria-label="Final page — Simulator and proof"
        data-canonical-source="finalPage"
      >
        <p className="cpp-page__eyebrow">Final page</p>
        <h2 className="cpp-page__heading">Proof — test this recommendation</h2>
        <SimulatorSection sim={finalPage} onOpenSimulator={onOpenSimulator} />
      </section>

    </div>
  );
}
