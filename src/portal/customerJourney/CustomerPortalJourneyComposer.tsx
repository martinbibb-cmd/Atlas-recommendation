import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { PortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { DiagramRenderer } from '../../library/diagrams/DiagramRenderer';
import { getDiagramById } from '../../library/diagrams/diagramExplanationRegistry';
import { isCustomerReadyProductionVisual } from '../../library/visualReadiness';
import { computeCurrentEfficiencyPct, DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';
import { AtlasHeatFlowGraphic } from '../visualLanguage/AtlasHeatFlowGraphic';
import { AtlasPhysicsVisualCard } from '../visualLanguage/AtlasPhysicsVisualCard';
import { AtlasStoryPanel } from '../visualLanguage/AtlasStoryPanel';
import { AtlasSystemStateGraphic } from '../visualLanguage/AtlasSystemStateGraphic';
import { AtlasWaterReserveGraphic } from '../visualLanguage/AtlasWaterReserveGraphic';
import {
  buildCustomerJourneyPack,
  inferCustomerJourneyTypeFromSystemContext,
  type CustomerJourneyPackV1,
} from '../../library/portal/pdf/buildPortalJourneyPrintModel';
import { REASON_ICON_BY_CATEGORY } from '../../library/portal/pdf/recommendationReasonVisuals';
import { CustomerPortalJourneySectionV1 } from './CustomerPortalJourneySectionV1';
import './customerPortalJourney.css';

interface CustomerPortalJourneyComposerProps {
  decision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  viewModel: PortalViewModel;
  engineInput: EngineInputV2_3;
  engineResult: FullEngineResult;
  propertyTitle: string;
  customerJourneyPack?: CustomerJourneyPackV1;
}

type VisualTone = 'good' | 'warn' | 'danger' | 'neutral';
const MAX_VISUAL_FILL_PCT = 90 + 2;
const MAX_LIFECYCLE_AGE_SHARE = 1.2;

function humanizeCurrentSystem(input: EngineInputV2_3): string {
  switch (input.currentHeatSourceType) {
    case 'system':
      return input.dhwStorageType === 'vented'
        ? 'System boiler with tank-fed hot water'
        : 'System boiler with mains-fed hot water';
    case 'regular':
      return input.dhwStorageType === 'vented'
        ? 'Regular boiler with tank-fed hot water'
        : 'Regular boiler with mains-fed hot water';
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

function buildPreparationItems(decision: AtlasDecisionV1, scenario: ScenarioResult | undefined): string[] {
  const items = [
    ...decision.requiredWorks,
    ...decision.includedItems,
    ...(scenario?.requiredWorks ?? []),
  ];
  return [...new Set(items)].slice(0, 4);
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

function lifecycleTone(condition: AtlasDecisionV1['lifecycle']['currentSystem']['condition']): VisualTone {
  switch (condition) {
    case 'good':
      return 'good';
    case 'average':
    case 'unknown':
      return 'neutral';
    case 'worn':
      return 'warn';
    case 'at_risk':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatConditionLabel(condition: AtlasDecisionV1['lifecycle']['currentSystem']['condition']): string {
  return condition.replaceAll('_', ' ');
}

function buildLifecycleVisualModel(lifecycle: AtlasDecisionV1['lifecycle']) {
  const ageYears = lifecycle.currentSystem.ageYears;
  const condition = lifecycle.currentSystem.condition;
  const { scaleRisk, usageIntensity, maintenanceLevel } = lifecycle.influencingFactors;
  const [, adjustedMax] = lifecycle.expectedLifespan.adjustedRangeYears;
  const ageShare = adjustedMax > 0 ? Math.min(MAX_LIFECYCLE_AGE_SHARE, ageYears / adjustedMax) : 0;
  const scalePenalty = scaleRisk === 'high' ? 11 : scaleRisk === 'medium' ? 6 : 2;
  const cyclingPenalty = usageIntensity === 'high' ? 8 : usageIntensity === 'medium' ? 4 : 1;
  const maintenancePenalty = maintenanceLevel === 'poor' ? 6 : maintenanceLevel === 'unknown' ? 4 : maintenanceLevel === 'average' ? 2 : 0;
  const decayPerYear = maintenanceLevel === 'poor' ? 1.4 : maintenanceLevel === 'average' ? 1.1 : maintenanceLevel === 'good' ? 0.8 : 1.2;
  const modelledDecayPct = Math.min(38, Math.round(ageYears * decayPerYear * 0.6 + scalePenalty + cyclingPenalty + maintenancePenalty));
  const efficiencyPct = computeCurrentEfficiencyPct(DEFAULT_NOMINAL_EFFICIENCY_PCT, modelledDecayPct);
  const exchangerRestrictionPct = Math.min(46, Math.round(scalePenalty * 2 + ageShare * 16));
  const warmUpDelayMins = Math.max(1, Math.round(2 + ageShare * 5 + exchangerRestrictionPct / 10));
  const comfortVariabilityPct = Math.min(42, Math.round(cyclingPenalty * 2 + maintenancePenalty + ageShare * 12));
  const stabilityPct = Math.max(54, 100 - exchangerRestrictionPct);

  return {
    tone: lifecycleTone(condition),
    statusLabel: ageYears > 0
      ? `${ageYears} years · ${formatConditionLabel(condition)}`
      : 'Age not recorded',
    takeaway: condition === 'at_risk'
      ? 'The current boiler can still fire, but age and internal drag mean longer warm-up, less stable flow, and a smaller efficient window.'
      : condition === 'worn'
        ? 'The current boiler still heats the home, but wear is now visible as slower recovery and a shorter steady-running phase.'
        : 'The current boiler still settles into useful heat, but Atlas has modelled how age and condition are starting to shape response.',
    detail: `Modelled from ${ageYears || 'unknown'} years of service, ${scaleRisk} scale risk, ${usageIntensity} usage intensity, and ${maintenanceLevel} maintenance history.`,
    phases: [
      {
        label: 'Warm-up',
        widthPct: 18 + warmUpDelayMins * 4,
        copy: `Warm-up stretches by about ${warmUpDelayMins} minutes before the system settles.`,
        tone: 'warn' as VisualTone,
      },
      {
        label: 'Stable burn',
        widthPct: Math.max(20, efficiencyPct - 42),
        copy: `${efficiencyPct}% modelled seasonal efficiency remains available once the boiler is settled.`,
        tone: condition === 'good' ? 'good' as VisualTone : 'neutral' as VisualTone,
      },
      {
        label: 'Instability tail',
        widthPct: 14 + comfortVariabilityPct,
        copy: `Cycling, exchanger drag, and wear widen comfort variability to ${comfortVariabilityPct}%.`,
        tone: condition === 'at_risk' ? 'danger' as VisualTone : 'warn' as VisualTone,
      },
    ],
    nodes: [
      {
        label: 'Efficiency drift',
        value: `${efficiencyPct}%`,
        detail: 'Seasonal efficiency after age, scale, and cycling penalties.',
        active: true,
      },
      {
        label: 'Warm-up delay',
        value: `+${warmUpDelayMins} min`,
        detail: 'Longer time before steady heat delivery reaches the emitters.',
      },
      {
        label: 'Exchanger restriction',
        value: `${exchangerRestrictionPct}%`,
        detail: 'Scale accumulation narrows the easy-flow window through the heat exchanger.',
      },
      {
        label: 'Flow stability',
        value: `${stabilityPct}%`,
        detail: 'Lower stability means more temperature drift when demand changes quickly.',
      },
    ],
  };
}

function buildStoredWaterVisualModel(input: EngineInputV2_3, scenario: ScenarioResult | undefined) {
  const occupancy = input.occupancyCount ?? 2;
  const bathrooms = input.bathroomCount ?? 1;
  const outlets = Math.max(input.peakConcurrentOutlets ?? 1, bathrooms >= 2 ? 2 : 1);
  const mixergy = scenario?.dhwSubtype === 'mixergy';
  const baseReserve = mixergy ? 86 : scenario?.system.type === 'ashp' ? 80 : 74;
  const demandPenalty = Math.max(0, occupancy - 2) * 5 + Math.max(0, outlets - 1) * 14;
  const usableReservePct = Math.max(28, Math.min(MAX_VISUAL_FILL_PCT, baseReserve - demandPenalty));
  const rechargePct = mixergy ? 32 : scenario?.system.type === 'ashp' ? 18 : 24;
  const tone: VisualTone = usableReservePct >= 55 ? 'good' : usableReservePct >= 42 ? 'warn' : 'danger';
  const overlapLabel = outlets >= 2 ? 'Two outlets at once' : 'Main hot-water draw';

  return {
    tone,
    statusLabel: mixergy ? 'Layered reserve' : 'Stored reserve',
    takeaway: mixergy
      ? 'The cylinder keeps the hottest water at the top, so usable reserve shrinks more slowly and recovery starts where comfort matters first.'
      : 'Stored hot water is visible reserve: the house uses the tank first, then recovery refills comfort afterwards.',
    detail: mixergy
      ? 'Mixergy prioritises the heated upper layer, mirroring demand into usable reserve before the whole store is reheated.'
      : 'Atlas separates supply pressure from stored volume so the reserve story stays about comfort, not plumbing labels.',
    reserve: usableReservePct,
    recharge: rechargePct,
    modeLabel: mixergy ? 'Top-heated reserve' : 'Whole-cylinder reserve',
    storySummary: outlets >= 2
      ? 'This home has real overlap risk, so the useful question is how much hot water is still ready after the second draw starts.'
      : 'This home mainly needs a reliable first draw and a clear top-up path afterwards.',
    events: [
      {
        label: overlapLabel,
        copy: mixergy
          ? 'The demand pulls from the hot upper layer first, so the shower feel stays steadier for longer.'
          : 'The first heavy draw spends stored hot water before recovery takes over.',
      },
      {
        label: 'Recharge state',
        copy: mixergy
          ? 'Reheat targets the useful top layer first, reducing the rapid cycling penalty you would feel with an on-demand boiler.'
          : scenario?.system.type === 'ashp'
            ? 'Recovery is gentler, but the reserve keeps comfort moving while the cylinder rebuilds heat.'
            : 'The boiler can recover after the draw instead of trying to satisfy every outlet instantly.',
      },
    ],
    annotations: [
      outlets >= 2 ? 'Overlap buffered by storage' : 'Single-draw comfort protected',
      mixergy ? 'Demand mirrored into the heated layer' : 'Reserve then recovery',
    ],
  };
}

function buildWarmRadiatorModel(scenario: ScenarioResult | undefined) {
  const highTemp = scenario?.physicsFlags.highTempRequired ?? false;
  const tone: VisualTone = highTemp ? 'warn' : 'good';

  return {
    tone,
    statusLabel: highTemp ? 'Higher flow target' : 'Steady low-temperature heat',
    takeaway: 'Radiators feel warm rather than scorching because comfort arrives through a longer, steadier heat spread across the day.',
    detail: highTemp
      ? 'Atlas still expects a heat pump route to feel steady, but emitter upgrades may be needed to unlock the calmest response.'
      : 'Lower flow temperature gives the system more time in its efficient operating range while rooms stay even.',
    storySummary: 'A customer should be able to read this as: the room warms more gently, then stays comfortable without sharp peaks.',
    phases: [
      {
        label: 'Start-up',
        widthPct: highTemp ? 26 : 18,
        copy: highTemp ? 'The system ramps up carefully because the emitters still ask for a higher flow temperature.' : 'Heat begins with a gentle rise rather than a burst.',
        tone: 'neutral' as VisualTone,
      },
      {
        label: 'Radiator warmth',
        widthPct: highTemp ? 34 : 42,
        copy: 'Radiators feel warm for longer while heat spreads through the room fabric.',
        tone: 'good' as VisualTone,
      },
      {
        label: 'Room comfort',
        widthPct: highTemp ? 28 : 36,
        copy: 'Once settled, comfort stays flatter instead of overshooting and falling away.',
        tone: highTemp ? 'warn' as VisualTone : 'good' as VisualTone,
      },
    ],
    nodes: [
      {
        label: 'Radiator feel',
        value: 'Warm, not scorching',
        detail: 'Lower peak surface temperature with longer delivery.',
        active: true,
      },
      {
        label: 'Runtime',
        value: 'Longer cycles',
        detail: 'Steady output replaces short, high-temperature bursts.',
      },
      {
        label: 'Comfort read',
        value: highTemp ? 'Needs emitter proof' : 'Even room warmth',
        detail: highTemp ? 'Atlas keeps checking emitter output on the coldest day.' : 'Rooms stay settled once the house fabric has warmed through.',
      },
    ],
  };
}

function buildScenarioStory(
  scenario: ScenarioResult,
  isRecommended: boolean,
  input: EngineInputV2_3,
) {
  const statusLabel = isRecommended ? 'Chosen route' : 'Alternative route';

  if (scenario.system.type === 'combi') {
    const simultaneousRisk = scenario.physicsFlags.combiFlowRisk ?? false;
    return {
      title: simultaneousRisk ? 'Two showers at once' : 'On-demand hot water',
      tone: simultaneousRisk ? 'warn' as VisualTone : 'neutral' as VisualTone,
      statusLabel,
      takeaway: simultaneousRisk
        ? 'This route depends on one live heat exchanger, so a second outlet pulls straight against the first.'
        : 'This route feels immediate on the first draw, but it still has no stored reserve when demand stacks up later.',
      detail: scenario.system.summary,
      storySummary: simultaneousRisk
        ? 'The visual should read as: both outlets are asking at once, and there is no stored buffer to absorb that overlap.'
        : 'The visual should read as: the first draw feels quick, but comfort is only as strong as the live firing rate.',
      phases: [
        {
          label: 'First outlet',
          widthPct: 32,
          copy: 'The first draw is fed directly from live burner output.',
          tone: 'good' as VisualTone,
        },
        {
          label: 'Second outlet',
          widthPct: simultaneousRisk ? 38 : 22,
          copy: simultaneousRisk ? 'A second outlet splits the same on-demand capacity.' : 'A second outlet remains manageable for this usage pattern.',
          tone: simultaneousRisk ? 'warn' as VisualTone : 'neutral' as VisualTone,
        },
        {
          label: 'Cycling penalty',
          widthPct: simultaneousRisk ? 30 : 18,
          copy: simultaneousRisk ? 'Rapid adjustments increase temperature wobble and cycling losses.' : 'No stored reserve means the boiler still has to react to every change immediately.',
          tone: simultaneousRisk ? 'danger' as VisualTone : 'warn' as VisualTone,
        },
      ],
      bullets: [...scenario.keyConstraints, ...(scenario.performancePenalties ?? [])].slice(0, 3),
      graphic: 'heat' as const,
    };
  }

  if (scenario.system.type === 'ashp') {
    const warmModel = buildWarmRadiatorModel(scenario);
    return {
      title: scenario.physicsFlags.highTempRequired ? 'Cold-day response' : 'Radiators warm-up',
      tone: warmModel.tone,
      statusLabel,
      takeaway: warmModel.takeaway,
      detail: scenario.system.summary,
      storySummary: warmModel.storySummary,
      phases: warmModel.phases,
      bullets: [...scenario.keyBenefits, ...scenario.keyConstraints].slice(0, 3),
      graphic: 'heat' as const,
      nodes: warmModel.nodes,
    };
  }

  const storedModel = buildStoredWaterVisualModel(input, scenario);
  return {
    title: (input.bathroomCount ?? 1) >= 2 ? 'Stored reserve after bath' : 'Morning recovery',
    tone: storedModel.tone,
    statusLabel,
    takeaway: storedModel.takeaway,
    detail: scenario.system.summary,
    storySummary: storedModel.storySummary,
    events: storedModel.events,
    annotations: storedModel.annotations,
    reserve: storedModel.reserve,
    recharge: storedModel.recharge,
    modeLabel: storedModel.modeLabel,
    bullets: [...scenario.keyBenefits, ...scenario.keyConstraints].slice(0, 3),
    graphic: 'water' as const,
  };
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

function BoilerAgeingVisual({ lifecycle }: { lifecycle: AtlasDecisionV1['lifecycle'] }) {
  const model = buildLifecycleVisualModel(lifecycle);

  return (
    <AtlasPhysicsVisualCard
      title="Boiler ageing and response"
      statusLabel={model.statusLabel}
      tone={model.tone}
      takeaway={model.takeaway}
      detail={model.detail}
      testId="customer-portal-visual-boiler-ageing-curve"
    >
      <AtlasHeatFlowGraphic
        phases={model.phases}
        leftLabel="Clean start-up"
        rightLabel="Wear-driven instability"
      />
      <AtlasStoryPanel summary={lifecycle.summary} bullets={lifecycle.riskIndicators.slice(0, 3)} />
      <AtlasSystemStateGraphic nodes={model.nodes} />
    </AtlasPhysicsVisualCard>
  );
}

function PressureVsStorageVisual({
  shouldRenderDiagram,
  input,
  scenario,
}: {
  shouldRenderDiagram: boolean;
  input: EngineInputV2_3;
  scenario: ScenarioResult | undefined;
}) {
  const mainsPressure = input.dynamicMainsPressure ?? 0;
  const mainsFlow = input.mainsDynamicFlowLpm ?? 0;
  const pressureTone: VisualTone = mainsPressure < 1.5 || mainsFlow < 10 ? 'warn' : 'good';
  const reserveStory = buildStoredWaterVisualModel(input, scenario);

  return (
    <AtlasPhysicsVisualCard
      title="Pressure, reserve, and overlap"
      statusLabel={shouldRenderDiagram ? 'Production visual + story read' : 'Story read'}
      tone={pressureTone}
      takeaway="Pressure decides outlet force; stored hot water decides how much comfort is already waiting before recovery begins."
      detail="Atlas separates supply force from stored reserve so a customer can see whether an overlap problem is plumbing-limited or storage-limited."
      testId={shouldRenderDiagram ? 'customer-portal-visual-pressure-vs-storage-story' : 'customer-portal-visual-fallback-pressure-vs-storage'}
    >
      {shouldRenderDiagram ? (
        <div className="customer-portal-journey__diagram-frame" data-testid="customer-portal-visual-pressure-vs-storage">
          <DiagramRenderer diagramId="pressure_vs_storage" printSafe />
        </div>
      ) : (
        <AtlasSystemStateGraphic
          nodes={[
            {
              label: 'Mains-fed supply',
              value: mainsPressure >= 1.5 && mainsFlow >= 10 ? 'Strong enough' : 'Shared force',
              detail: mainsPressure >= 1.5 && mainsFlow >= 10
                ? 'The incoming supply has room to support normal outlet use.'
                : 'Incoming pressure or flow means overlaps will feel weaker before storage even runs out.',
              active: true,
            },
            {
              label: 'Stored reserve',
              value: `${reserveStory.reserve}% usable`,
              detail: 'The cylinder holds the comfort buffer that protects the first minutes of a heavy draw.',
            },
            {
              label: 'Recovery',
              value: `${reserveStory.recharge}% visible`,
              detail: 'Recovery happens after the draw and should not be confused with pressure at the tap.',
            },
          ]}
        />
      )}
      <AtlasStoryPanel
        summary={mainsPressure >= 1.5 && mainsFlow >= 10
          ? 'The house has enough mains-fed supply to let storage do the comfort work instead of masking a weak inlet.'
          : 'The house has a real supply limit, so the visual needs to explain that pressure loss and hot-water reserve are separate parts of the story.'}
        bullets={[
          describeSupply(input),
          reserveStory.storySummary,
        ]}
      />
    </AtlasPhysicsVisualCard>
  );
}

function CylinderRecoveryReserveVisual({
  input,
  scenario,
}: {
  input: EngineInputV2_3;
  scenario: ScenarioResult | undefined;
}) {
  const model = buildStoredWaterVisualModel(input, scenario);

  return (
    <AtlasPhysicsVisualCard
      title={scenario?.dhwSubtype === 'mixergy' ? 'Layered hot-water reserve' : 'Hot-water reserve and recovery'}
      statusLabel={model.statusLabel}
      tone={model.tone}
      takeaway={model.takeaway}
      detail={model.detail}
      testId="customer-portal-visual-fallback-cylinder-recovery"
    >
      <AtlasWaterReserveGraphic
        usableReservePct={model.reserve}
        rechargePct={model.recharge}
        recoveryLabel={scenario?.dhwSubtype === 'mixergy' ? 'Top layer reheating' : 'Recovery underway'}
        modeLabel={model.modeLabel}
        eventCards={model.events}
        annotations={model.annotations}
      />
      <AtlasStoryPanel summary={model.storySummary} bullets={scenario?.dhwSubtype === 'mixergy'
        ? [
            'Demand mirrors into the heated top layer first.',
            'Reduced cycling penalty compared with an on-demand boiler trying to satisfy the same overlap live.',
          ]
        : [
            'The house spends reserve first, then gives the heat source time to recover afterwards.',
            'Comfort is about how much usable hot water is still left when the next outlet opens.',
          ]}
      />
    </AtlasPhysicsVisualCard>
  );
}

function WarmRadiatorExpectationVisual({ scenario }: { scenario: ScenarioResult | undefined }) {
  const model = buildWarmRadiatorModel(scenario);

  return (
    <AtlasPhysicsVisualCard
      title="Radiator warmth over time"
      statusLabel={model.statusLabel}
      tone={model.tone}
      takeaway={model.takeaway}
      detail={model.detail}
      testId="customer-portal-visual-fallback-warm-radiator"
    >
      <AtlasHeatFlowGraphic
        phases={model.phases}
        leftLabel="Call for heat"
        rightLabel="Steady comfort"
      />
      <AtlasStoryPanel summary={model.storySummary} />
      <AtlasSystemStateGraphic nodes={model.nodes} />
    </AtlasPhysicsVisualCard>
  );
}

function ProtectionSummaryVisual({ items, testId }: { items: string[]; testId: string }) {
  return (
    <AtlasPhysicsVisualCard
      title="Low-hanging fruit and system protection"
      statusLabel="Included in route"
      tone="good"
      takeaway="The practical protection work matters because it protects comfort before the first heating day, not because it looks tidy on a checklist."
      testId={testId}
    >
      <AtlasStoryPanel
        summary="Every item here prevents avoidable instability, commissioning drift, or handover confusion later on."
        bullets={items}
      />
    </AtlasPhysicsVisualCard>
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
  customerJourneyPack,
}: CustomerPortalJourneyComposerProps) {
  const recommendedScenario = getRecommendedScenario(decision, scenarios);
  const currentSystem = humanizeCurrentSystem(engineInput);
  const pressureDiagram = getDiagramById('pressure_vs_storage');
  const isPressureDiagramReady = pressureDiagram != null
    && isCustomerReadyProductionVisual(pressureDiagram);
  const isStoredWaterSystem = recommendedScenario?.system.type === 'system'
    || recommendedScenario?.system.type === 'regular'
    || recommendedScenario?.dhwSubtype === 'mixergy';
  const shouldRenderPressureDiagram = isStoredWaterSystem && isPressureDiagramReady;
  const protectionItems = buildPreparationItems(decision, recommendedScenario).slice(0, 3);
  const shouldShowStoredWaterVisual = isStoredWaterSystem;
  const shouldShowWarmRadiatorExpectation = recommendedScenario?.system.type === 'ashp';
  const journeyTitle = getScenarioTitle(recommendedScenario);
  const recommendationSummary = recommendedScenario?.system.summary ?? decision.summary;
  const journeyPack = buildCustomerJourneyPack({
    customerJourneyPack,
    selectedSectionIds: [],
    journeyType: inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: engineInput.currentHeatSourceType,
      currentSystemHeatingType: engineInput.currentSystem?.heatingSystemType,
      dhwStorageType: engineInput.dhwStorageType,
    }),
    recommendationSummary,
    customerFacts: [
      engineInput.occupancyCount != null && engineInput.occupancyCount > 0
        ? `${engineInput.occupancyCount}-person household`
        : null,
      engineInput.bathroomCount != null && engineInput.bathroomCount > 0
        ? formatBathroomCount(engineInput.bathroomCount)
        : null,
    ].filter((value): value is string => value != null),
    liveExperienceExplanations: [
      engineResult.engineOutput.showerCompatibilityNote?.customerSummary,
      decision.dayToDayOutcomes[0],
      decision.summary,
    ].filter((value): value is string => value != null && value.trim().length > 0),
  });
  const sharedRecommendationSummary = journeyPack.portalDeepDive.recommendationSummary;
  const recommendationReasons = (journeyPack.portalDeepDive.recommendationReasons ?? []).slice(0, 5);
  const liveExperienceSummary = journeyPack.portalDeepDive.liveExperienceExplanations[0]
    ?? 'Atlas has prepared day-to-day expectations for your home based on surveyed conditions.';
  const nextSteps = journeyPack.portalDeepDive.nextSteps.map((step) => `${step.label}: ${step.body}`);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.scenarioId, scenario]));
  const comparisonStoryCards = viewModel.verdictData.comparisonCards
    .slice(0, 3)
    .map((card) => {
      const scenario = scenarioById.get(card.scenarioId);
      if (!scenario) return null;
      return {
        scenario,
        isRecommended: card.isRecommended,
      };
    })
    .filter((entry): entry is { scenario: ScenarioResult; isRecommended: boolean } => entry != null);

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
                <span className="customer-portal-journey__chip customer-portal-journey__chip--neutral">{`${engineInput.occupancyCount ?? 0} people`}</span>
                <span className="customer-portal-journey__chip customer-portal-journey__chip--neutral">{formatBathroomCount(engineInput.bathroomCount ?? 0)}</span>
                <span className="customer-portal-journey__chip customer-portal-journey__chip--good">{recommendedScenario?.dhwSubtype === 'mixergy' ? 'Mixergy-ready route' : 'Customer-ready route'}</span>
              </div>
            </div>
            <SystemCard
              title={journeyTitle}
              summary={sharedRecommendationSummary}
              bullets={decision.keyReasons.slice(0, 3)}
              badge="Recommended route"
              testId="customer-portal-recommended-system-card"
            />
          </div>
        </CustomerPortalJourneySectionV1>

        {recommendationReasons.length > 0 ? (
          <CustomerPortalJourneySectionV1
            sectionId="recommendation-reasons"
            eyebrow="Why this recommendation fits your home"
            title="How survey facts shaped the route"
            intro="Scan each card: home fact, why it matters, Atlas choice, and what you will notice."
          >
            <div className="customer-portal-journey__reason-grid" data-testid="customer-portal-reason-grid">
              {recommendationReasons.map((reason) => (
                <article key={reason.id} className="customer-portal-journey__reason-card">
                  <h3 className="customer-portal-journey__reason-title">
                    <span aria-hidden="true" className="customer-portal-journey__reason-icon">
                      {REASON_ICON_BY_CATEGORY[reason.category]}
                    </span>
                    <span>{reason.homeFact}</span>
                  </h3>
                  <dl className="customer-portal-journey__reason-rows">
                    <div className="customer-portal-journey__reason-row">
                      <dt>Why it matters</dt>
                      <dd>{reason.whyItMatters}</dd>
                    </div>
                    <div className="customer-portal-journey__reason-row">
                      <dt>Atlas chose</dt>
                      <dd>{reason.atlasRecommendationOutcome}</dd>
                    </div>
                    <div className="customer-portal-journey__reason-row customer-portal-journey__reason-row--outcome">
                      <dt>What you will notice</dt>
                      <dd>{reason.practicalEffect}</dd>
                    </div>
                  </dl>
                  {reason.detail ? (
                    <details className="customer-portal-journey__reason-detail">
                      <summary>Show me why</summary>
                      <p>{reason.detail}</p>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </CustomerPortalJourneySectionV1>
        ) : null}

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
            <PressureVsStorageVisual
              shouldRenderDiagram={shouldRenderPressureDiagram}
              input={engineInput}
              scenario={recommendedScenario}
            />
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="system-condition"
          eyebrow="Current system condition"
          title="Ageing and condition"
          intro={decision.lifecycle.summary}
        >
          <BoilerAgeingVisual lifecycle={decision.lifecycle} />
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
              summary={sharedRecommendationSummary}
              bullets={recommendedScenario?.keyBenefits.slice(0, 3) ?? decision.keyReasons.slice(0, 3)}
              badge="Recommended system card"
              testId="customer-portal-recommended-route-card"
            />
            {shouldShowStoredWaterVisual ? (
              <CylinderRecoveryReserveVisual input={engineInput} scenario={recommendedScenario} />
            ) : shouldShowWarmRadiatorExpectation ? (
              <WarmRadiatorExpectationVisual scenario={recommendedScenario} />
            ) : (
              <ProtectionSummaryVisual items={protectionItems} testId="customer-portal-visual-system-protection-route" />
            )}
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="practical-outcomes"
          eyebrow="Practical outcomes"
          title="Upgrade impact at a glance"
          intro="Atlas keeps this focused on practical outcomes you will see at home."
        >
          <article className="customer-portal-journey__visual-card">
            <h3 className="customer-portal-journey__card-title">Practical outcomes</h3>
            <ul className="customer-portal-journey__bullet-list">
              {buildPreparationItems(decision, recommendedScenario).slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="alternatives"
          eyebrow="Scenario storytelling"
          title="What each route would feel like at home"
          intro="Each option is shown as a household moment, so the comparison is about lived behaviour rather than mystery lines on a chart."
        >
          <div className="customer-portal-journey__insight-grid">
            {comparisonStoryCards.map(({ scenario, isRecommended }) => {
              const story = buildScenarioStory(scenario, isRecommended, engineInput);
              return (
                <AtlasPhysicsVisualCard
                  key={scenario.scenarioId}
                  title={story.title}
                  statusLabel={story.statusLabel}
                  tone={story.tone}
                  takeaway={story.takeaway}
                  detail={story.detail}
                >
                  {story.graphic === 'water' ? (
                    <AtlasWaterReserveGraphic
                      usableReservePct={story.reserve}
                      rechargePct={story.recharge}
                      recoveryLabel="Recovery visible"
                      modeLabel={story.modeLabel}
                      eventCards={story.events}
                      annotations={story.annotations}
                    />
                  ) : (
                    <AtlasHeatFlowGraphic
                      phases={story.phases}
                      leftLabel="Start of event"
                      rightLabel="After demand stacks up"
                    />
                  )}
                  <AtlasStoryPanel summary={story.storySummary} bullets={story.bullets} />
                  {'nodes' in story && story.nodes ? <AtlasSystemStateGraphic nodes={story.nodes} /> : null}
                </AtlasPhysicsVisualCard>
              );
            })}
          </div>
        </CustomerPortalJourneySectionV1>

        <CustomerPortalJourneySectionV1
          sectionId="daily-use"
          eyebrow="Daily-use proof"
          title="How day-to-day use should feel"
          intro={liveExperienceSummary}
        >
          <DailyUseTeaser viewModel={viewModel} />
          {journeyPack.portalDeepDive.librarySupportedExplainers.length > 0 ? (
            <div className="customer-portal-journey__insight-grid">
              {journeyPack.portalDeepDive.librarySupportedExplainers.slice(0, 3).map((explainer) => (
                <article key={explainer.contentId} className="customer-portal-journey__insight-card">
                  <p className="customer-portal-journey__summary-label">Library-supported explainer</p>
                  <strong>{explainer.title}</strong>
                  <p className="customer-portal-journey__card-copy">{explainer.summary}</p>
                </article>
              ))}
            </div>
          ) : null}
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
