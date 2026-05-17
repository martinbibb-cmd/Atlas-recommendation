import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { PortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { DiagramRenderer } from '../../library/diagrams/DiagramRenderer';
import { getDiagramById } from '../../library/diagrams/diagramExplanationRegistry';
import { isCustomerReadyProductionVisual } from '../../library/visualReadiness';
import { CustomerPortalJourneySectionV1 } from './CustomerPortalJourneySectionV1';
import './customerPortalJourney.css';

interface CustomerPortalJourneyComposerProps {
  decision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  viewModel: PortalViewModel;
  engineInput: EngineInputV2_3;
  engineResult: FullEngineResult;
  propertyTitle: string;
}

function humanizeCurrentSystem(input: EngineInputV2_3): string {
  switch (input.currentHeatSourceType) {
    case 'system':
      return input.dhwStorageType === 'vented'
        ? 'System boiler with open vented hot water'
        : 'System boiler with unvented hot water';
    case 'regular':
      return input.dhwStorageType === 'vented'
        ? 'Regular boiler with open vented hot water'
        : 'Regular boiler with unvented hot water';
    case 'ashp':
      return 'Heat pump system';
    default:
      return 'Combination boiler with on-demand hot water';
  }
}

function describeDemandPattern(input: EngineInputV2_3): string {
  const occupancy = input.occupancyCount ?? 0;
  const bathrooms = input.bathroomCount ?? 0;
  if (occupancy >= 4 || bathrooms >= 2 || (input.peakConcurrentOutlets ?? 0) >= 2) {
    return 'Daily use points to overlapping hot-water demand and a stronger comfort reserve requirement.';
  }
  if (input.currentHeatSourceType === 'ashp') {
    return 'Daily comfort depends on steady heat delivery rather than short hot bursts.';
  }
  return 'Daily use looks closest to a straightforward heating pattern with one main hot-water task at a time.';
}

function formatBathroomCount(count: number): string {
  return `${count} bathroom${count === 1 ? '' : 's'}`;
}

function describeMainIssue(decision: AtlasDecisionV1): string {
  return decision.compatibilityWarnings[0]
    ?? decision.avoidedRisks[0]
    ?? decision.keyReasons[0]
    ?? decision.summary;
}

function buildFamiliarPoints(
  input: EngineInputV2_3,
  scenario: ScenarioResult | undefined,
): string[] {
  const points = ['Your room temperatures and daily routine stay the focus of the design.'];
  if (scenario?.system.type !== 'ashp') {
    points.push('Heating controls remain familiar once the new system is commissioned.');
  } else {
    points.push('Comfort stays steady even when radiators feel warm rather than very hot.');
  }
  if (input.currentHeatSourceType === scenario?.system.type) {
    points.push('The main heating format stays familiar while the weak points are addressed.');
  } else if (scenario?.system.type === 'combi') {
    points.push('Hot water stays on-demand without adding stored hot-water equipment.');
  } else {
    points.push('Your taps and showers still work in the same places after the upgrade.');
  }
  return points.slice(0, 3);
}

function buildPreparationItems(decision: AtlasDecisionV1, scenario: ScenarioResult | undefined): string[] {
  const items = [
    ...decision.requiredWorks,
    ...decision.includedItems,
    ...(scenario?.requiredWorks ?? []),
  ];
  return [...new Set(items)].slice(0, 4);
}

function buildNextSteps(decision: AtlasDecisionV1): string[] {
  const steps = [
    'Atlas confirms the final installation plan around the recommendation.',
    'The install team prepares the protection, controls, and handover items included in your route.',
    'You receive a handover that explains day-to-day use and the first checks to expect.',
  ];
  if (decision.futureUpgradePaths.length > 0) {
    steps.push(`Future-ready option: ${decision.futureUpgradePaths[0]}.`);
  }
  return steps.slice(0, 4);
}

function describeSupply(input: EngineInputV2_3): string {
  if ((input.dynamicMainsPressure ?? 0) < 1.5 || (input.mainsDynamicFlowLpm ?? 0) < 10) {
    return 'Mains-fed supply is a real design limit, so outlet overlap has to be managed carefully.';
  }
  if (input.dhwStorageType === 'vented') {
    return 'The current hot-water pattern relies on tank-fed supply rather than mains pressure.';
  }
  return 'Measured mains-fed supply gives Atlas room to improve delivery and comfort confidence.';
}

function getRecommendedScenario(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): ScenarioResult | undefined {
  return scenarios.find((scenario) => scenario.scenarioId === decision.recommendedScenarioId);
}

function getScenarioTitle(scenario: ScenarioResult | undefined): string {
  return scenario?.display?.title ?? scenario?.system.summary ?? 'Recommended system';
}

function StatusChip({ label, tone }: { label: string; tone: 'good' | 'warn' | 'neutral' }) {
  return <span className={`customer-portal-journey__chip customer-portal-journey__chip--${tone}`}>{label}</span>;
}

function SystemCard({
  title,
  summary,
  bullets,
  badge,
  testId,
}: {
  title: string;
  summary: string;
  bullets: string[];
  badge: string;
  testId: string;
}) {
  return (
    <article className="customer-portal-journey__system-card" data-testid={testId}>
      <p className="customer-portal-journey__system-card-badge">{badge}</p>
      <h3 className="customer-portal-journey__card-title">{title}</h3>
      <p className="customer-portal-journey__card-copy">{summary}</p>
      <ul className="customer-portal-journey__bullet-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

function BoilerAgeingCurve({
  ageYears,
  conditionSummary,
}: {
  ageYears: number;
  conditionSummary: string;
}) {
  const clampedAge = Math.max(0, Math.min(ageYears, 25));
  const progressPct = (clampedAge / 25) * 100;

  return (
    <article className="customer-portal-journey__visual-card" data-testid="customer-portal-visual-boiler-ageing-curve">
      <div className="customer-portal-journey__visual-header">
        <h3 className="customer-portal-journey__card-title">Boiler ageing curve</h3>
        <StatusChip label={`${clampedAge} years`} tone={clampedAge >= 15 ? 'warn' : 'neutral'} />
      </div>
      <div className="customer-portal-journey__ageing-track" aria-hidden="true">
        <div className="customer-portal-journey__ageing-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="customer-portal-journey__ageing-scale" aria-hidden="true">
        <span>Newer</span>
        <span>Mid-life</span>
        <span>Older</span>
      </div>
      <p className="customer-portal-journey__card-copy">{conditionSummary}</p>
    </article>
  );
}

function PressureVsStorageVisual({
  shouldRenderDiagram,
}: {
  shouldRenderDiagram: boolean;
}) {
  return (
    <article className="customer-portal-journey__visual-card">
      <div className="customer-portal-journey__visual-header">
        <h3 className="customer-portal-journey__card-title">Water pressure vs stored volume</h3>
        <StatusChip
          label={shouldRenderDiagram ? 'Production-ready visual' : 'Illustrated summary'}
          tone={shouldRenderDiagram ? 'good' : 'neutral'}
        />
      </div>
      {shouldRenderDiagram ? (
        <div className="customer-portal-journey__diagram-frame" data-testid="customer-portal-visual-pressure-vs-storage">
          <DiagramRenderer diagramId="pressure_vs_storage" printSafe />
        </div>
      ) : (
        <div className="customer-portal-journey__summary-visual" data-testid="customer-portal-visual-fallback-pressure-vs-storage">
          <div className="customer-portal-journey__summary-column">
            <span className="customer-portal-journey__summary-label">Pressure</span>
            <strong>Mains-fed supply decides delivery force.</strong>
          </div>
          <div className="customer-portal-journey__summary-column">
            <span className="customer-portal-journey__summary-label">Stored volume</span>
            <strong>Cylinder size decides how much hot water is ready before recovery.</strong>
          </div>
        </div>
      )}
      <p className="customer-portal-journey__card-copy">
        Pressure and stored volume are designed separately so Atlas can protect both comfort and recovery expectations.
      </p>
    </article>
  );
}

function CylinderRecoveryReserveVisual() {
  return (
    <article className="customer-portal-journey__visual-card" data-testid="customer-portal-visual-fallback-cylinder-recovery">
      <div className="customer-portal-journey__visual-header">
        <h3 className="customer-portal-journey__card-title">Cylinder recovery and reserve</h3>
        <StatusChip label="Illustrated summary" tone="neutral" />
      </div>
      <div className="customer-portal-journey__reserve-bars" aria-hidden="true">
        <div className="customer-portal-journey__reserve-bar customer-portal-journey__reserve-bar--full" />
        <div className="customer-portal-journey__reserve-bar customer-portal-journey__reserve-bar--used" />
        <div className="customer-portal-journey__reserve-bar customer-portal-journey__reserve-bar--recovering" />
      </div>
      <p className="customer-portal-journey__card-copy">
        Stored hot water is about reserve first, then recovery. Heavy overlap uses reserve and the cylinder tops back up afterwards.
      </p>
    </article>
  );
}

function WarmRadiatorExpectationVisual() {
  return (
    <article className="customer-portal-journey__visual-card" data-testid="customer-portal-visual-fallback-warm-radiator">
      <div className="customer-portal-journey__visual-header">
        <h3 className="customer-portal-journey__card-title">Heat pump warm radiator expectation</h3>
        <StatusChip label="Illustrated summary" tone="neutral" />
      </div>
      <div className="customer-portal-journey__temperature-steps" aria-hidden="true">
        <div>
          <span className="customer-portal-journey__summary-label">Radiator feel</span>
          <strong>Warm for longer</strong>
        </div>
        <div>
          <span className="customer-portal-journey__summary-label">Room comfort</span>
          <strong>Steady and even</strong>
        </div>
        <div>
          <span className="customer-portal-journey__summary-label">System response</span>
          <strong>Lower peaks, longer runtime</strong>
        </div>
      </div>
      <p className="customer-portal-journey__card-copy">
        Warm radiators are expected with a heat pump. Comfort comes from steady delivery, not very hot bursts.
      </p>
    </article>
  );
}

function ProtectionSummaryVisual({ items, testId }: { items: string[]; testId: string }) {
  return (
    <article className="customer-portal-journey__visual-card" data-testid={testId}>
      <div className="customer-portal-journey__visual-header">
        <h3 className="customer-portal-journey__card-title">Low-hanging fruit and system protection</h3>
        <StatusChip label="Included in route" tone="good" />
      </div>
      <ul className="customer-portal-journey__bullet-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function DailyUseTeaser({ viewModel }: { viewModel: PortalViewModel }) {
  if (viewModel.experienceData.simulation) {
    return (
      <div className="customer-portal-journey__teaser-grid" data-testid="customer-portal-daily-use-teaser">
        {viewModel.experienceData.simulation.steps.slice(0, 3).map((step) => (
          <article key={step.label} className="customer-portal-journey__teaser-card">
            <p className="customer-portal-journey__summary-label">{step.label}</p>
            <strong>{step.reactions[0]?.title ?? 'Expected response'}</strong>
            <p className="customer-portal-journey__card-copy">{step.reactions[0]?.outcome ?? 'Atlas has a day-to-day response preview for this event.'}</p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="customer-portal-journey__teaser-grid" data-testid="customer-portal-daily-use-teaser">
      {viewModel.experienceData.cards.slice(0, 3).map((card) => (
        <article key={card.scenarioId} className="customer-portal-journey__teaser-card">
          <p className="customer-portal-journey__summary-label">{card.title}</p>
          <strong>{card.outcomes[0] ?? 'Day-to-day proof'}</strong>
        </article>
      ))}
    </div>
  );
}

export function CustomerPortalJourneyComposer({
  decision,
  scenarios,
  viewModel,
  engineInput,
  engineResult,
  propertyTitle,
}: CustomerPortalJourneyComposerProps) {
  const recommendedScenario = getRecommendedScenario(decision, scenarios);
  const currentSystem = humanizeCurrentSystem(engineInput);
  const currentAge = engineInput.currentSystem?.boiler?.ageYears ?? 0;
  const pressureDiagram = getDiagramById('pressure_vs_storage');
  const isPressureDiagramReady = pressureDiagram != null
    && isCustomerReadyProductionVisual(pressureDiagram);
  const isStoredWaterSystem = recommendedScenario?.system.type === 'system'
    || recommendedScenario?.system.type === 'regular'
    || recommendedScenario?.dhwSubtype === 'mixergy';
  const shouldRenderPressureDiagram = isStoredWaterSystem && isPressureDiagramReady;
  const protectionItems = buildPreparationItems(decision, recommendedScenario).slice(0, 3);
  const comparisonCards = viewModel.verdictData.comparisonCards.filter((card) => !card.isRecommended).slice(0, 2);
  const familiarPoints = buildFamiliarPoints(engineInput, recommendedScenario);
  const nextSteps = buildNextSteps(decision);
  const shouldShowStoredWaterVisual = isStoredWaterSystem;
  const shouldShowWarmRadiatorExpectation = recommendedScenario?.system.type === 'ashp';
  const journeyTitle = getScenarioTitle(recommendedScenario);
  const recommendationSummary = recommendedScenario?.system.summary ?? decision.summary;
  const dailyUseSummary = engineResult.engineOutput.showerCompatibilityNote?.customerSummary ?? decision.dayToDayOutcomes[0] ?? decision.summary;

  return (
    <main
      className="customer-portal-journey"
      data-testid="portal-page"
      style={{ overflowX: 'clip' }}
    >
      <div className="customer-portal-journey__surface" data-testid="customer-portal-journey-composer">
        <CustomerPortalJourneySectionV1
          sectionId="hero"
          eyebrow="Here’s what Atlas found"
          title={journeyTitle}
          intro={decision.summary}
        >
          <div className="customer-portal-journey__hero-grid">
            <div className="customer-portal-journey__hero-copy">
              <p className="customer-portal-journey__hero-property">{propertyTitle}</p>
              <p className="customer-portal-journey__hero-summary">{decision.headline}</p>
              <div className="customer-portal-journey__chip-row">
                <StatusChip label={`${engineInput.occupancyCount ?? 0} people`} tone="neutral" />
                <StatusChip label={formatBathroomCount(engineInput.bathroomCount ?? 0)} tone="neutral" />
                <StatusChip label={recommendedScenario?.dhwSubtype === 'mixergy' ? 'Mixergy-ready route' : 'Customer-ready route'} tone="good" />
              </div>
            </div>
            <SystemCard
              title={journeyTitle}
              summary={recommendationSummary}
              bullets={decision.keyReasons.slice(0, 3)}
              badge="Recommended route"
              testId="customer-portal-recommended-system-card"
            />
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="home-pattern"
          eyebrow="Your home pattern"
          title="How your home uses heat and hot water"
          intro={describeDemandPattern(engineInput)}
        >
          <div className="customer-portal-journey__two-column">
            <SystemCard
              title="Current system card"
              summary={currentSystem}
              bullets={[
                describeSupply(engineInput),
                `${engineInput.occupancyCount ?? 0} people and ${formatBathroomCount(engineInput.bathroomCount ?? 0)} shaped the route.`,
                `Peak heat demand is tracked at ${((engineInput.heatLossWatts ?? 0) / 1000).toFixed(1)} kW.`,
              ]}
              badge="Current system"
              testId="customer-portal-current-system-card"
            />
            <PressureVsStorageVisual shouldRenderDiagram={shouldRenderPressureDiagram} />
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="system-condition"
          eyebrow="Current system condition"
          title="Ageing and condition"
          intro={decision.lifecycle.summary}
        >
          <BoilerAgeingCurve ageYears={currentAge} conditionSummary={decision.lifecycle.summary} />
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="main-issue"
          eyebrow="Main issue affecting comfort and hot water"
          title="What Atlas needed to solve"
          intro={describeMainIssue(decision)}
        >
          <div className="customer-portal-journey__insight-grid">
            {decision.avoidedRisks.slice(0, 3).map((risk) => (
              <article key={risk} className="customer-portal-journey__insight-card">
                <p className="customer-portal-journey__summary-label">Risk Atlas avoided</p>
                <strong>{risk}</strong>
              </article>
            ))}
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="recommended-route"
          eyebrow="Recommended route"
          title="The route Atlas is confident in"
          intro={decision.summary}
        >
          <div className="customer-portal-journey__two-column">
            <SystemCard
              title={journeyTitle}
              summary={recommendationSummary}
              bullets={recommendedScenario?.keyBenefits.slice(0, 3) ?? decision.keyReasons.slice(0, 3)}
              badge="Recommended system card"
              testId="customer-portal-recommended-route-card"
            />
            {shouldShowStoredWaterVisual ? (
              <CylinderRecoveryReserveVisual />
            ) : shouldShowWarmRadiatorExpectation ? (
              <WarmRadiatorExpectationVisual />
            ) : (
              <ProtectionSummaryVisual items={protectionItems} testId="customer-portal-visual-system-protection-route" />
            )}
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="changes-and-familiar"
          eyebrow="What changes and what stays familiar"
          title="Upgrade impact at a glance"
          intro="Atlas separates the work that changes from the parts of daily use that should still feel straightforward."
        >
          <div className="customer-portal-journey__two-column">
            <article className="customer-portal-journey__visual-card">
              <h3 className="customer-portal-journey__card-title">What changes</h3>
              <ul className="customer-portal-journey__bullet-list">
                {buildPreparationItems(decision, recommendedScenario).slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="customer-portal-journey__visual-card">
              <h3 className="customer-portal-journey__card-title">What stays familiar</h3>
              <ul className="customer-portal-journey__bullet-list">
                {familiarPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="alternatives"
          eyebrow="Why this beats the alternatives"
          title="Why Atlas did not stop at the first option"
          intro="Alternatives were assessed against the same home signals, then compared against the chosen route."
        >
          <div className="customer-portal-journey__insight-grid">
            {comparisonCards.map((card) => (
              <article key={card.scenarioId} className="customer-portal-journey__insight-card">
                <p className="customer-portal-journey__summary-label">{card.title}</p>
                <strong>{card.summary}</strong>
                <p className="customer-portal-journey__card-copy">
                  {card.constraints[0] ?? card.strengths[0] ?? 'Atlas found a better fit elsewhere.'}
                </p>
              </article>
            ))}
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="daily-use"
          eyebrow="Daily-use proof"
          title="How day-to-day use should feel"
          intro={dailyUseSummary}
        >
          <DailyUseTeaser viewModel={viewModel} />
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="installation-preparation"
          eyebrow="Installation preparation"
          title="What Atlas is preparing before the install"
          intro="These are the practical items that protect comfort, commissioning quality, and handover clarity."
        >
          <ProtectionSummaryVisual items={protectionItems} testId="customer-portal-visual-system-protection-prep" />
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="next-steps"
          eyebrow="What happens next"
          title="The path from recommendation to install"
          intro="Atlas keeps the next steps clear so you know what happens before installation day and at handover."
        >
          <ol className="customer-portal-journey__ordered-list">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </CustomerPortalJourneySectionV1>
      </div>
    </main>
  );
}
