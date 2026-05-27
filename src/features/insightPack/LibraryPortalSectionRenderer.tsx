import { useMemo } from 'react';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { DiagramRenderer } from '../../library/diagrams/DiagramRenderer';
import { EducationalAnimationRenderer } from '../../library/animations';
import { getDiagramById } from '../../library/diagrams/diagramExplanationRegistry';
import { atlasMvpContentMapRegistry, educationalContentRegistry } from '../../library/content';
import { getPortalEducationalContent } from '../../library/portal/getPortalEducationalContent';
import type { WelcomePackAccessibilityPreferencesV1 } from '../../library/packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackFromAtlasDecision } from '../../library/packRenderer/buildCalmWelcomePackFromAtlasDecision';
import {
  resolveLegoTechnicCustomerVisualDecision,
  type LegoTechnicCustomerVisualDecision,
} from '../../library/portal/pdf/legoTechnicCustomerVisualManifest';
import {
  EducationalInfoCard,
  PortalDiagramFrame,
  PortalMisconceptionBlock,
  QRDeepDiveCard,
  ReassurancePanel,
  SectionDivider,
  WhatYouMayNoticePanel,
} from '../../library/portal/ui/PortalPrimitives';
import type { QuoteInsight } from './insightPack.types';
import DailyUsePanel from './DailyUsePanel';
import './LibraryPortalSectionRenderer.css';

interface Props {
  fallbackQuotes: QuoteInsight[];
  recommendedQuoteId?: string;
  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1;
  userConcernTags?: string[];
  propertyConstraintTags?: string[];
  showDebugDiagnostics?: boolean;
}

const DIAGRAM_ID_ALIASES: Record<string, string> = {
  pressure_window: 'pressure_vs_storage',
  warm_radiator_pattern: 'warm_vs_hot_radiators',
  open_to_sealed: 'open_vented_to_unvented',
};
const MAX_PORTAL_CARDS = 4;
const DETERMINISTIC_SCENARIO_DIAGRAMS: Record<'stored_hot_water' | 'low_temp_heat' | 'water_main_constraint', string> = {
  stored_hot_water: 'pressure_vs_storage',
  low_temp_heat: 'warm_vs_hot_radiators',
  water_main_constraint: 'water_main_limitation',
};
const STORED_HOT_WATER_SCENARIO_PATTERN = /\b(system_unvented|regular_unvented|unvented)\b/i;
const STORED_HOT_WATER_LABEL_PATTERN = /\b(stored hot water|unvented|system boiler)\b/i;
const LOW_TEMP_SCENARIO_PATTERN = /\b(heat_pump|ashp)\b/i;
const LOW_TEMP_TAG_PATTERN = /\b(heat_pump|low_temp|flow_temperature)\b/i;
const WATER_CONSTRAINT_TAG_PATTERN = /\b(pressure|flow|hydraulic|mains)\b/i;
const WATER_CONSTRAINT_CONCEPT_IDS = [
  'water_main_limit_not_boiler_limit',
  'hydraulic_constraint',
  'flow_restriction',
];

function toRenderableDiagramId(diagramId: string): string | undefined {
  const normalized = diagramId
    .replace(/^diagram[-_]/i, '')
    .replace(/-/g, '_')
    .toLowerCase();
  const aliased = DIAGRAM_ID_ALIASES[normalized] ?? normalized;
  return getDiagramById(aliased) ? aliased : undefined;
}

function stableUnique(values: string[]): string[] {
  const uniqueValues: string[] = [];
  for (const value of values) {
    if (!uniqueValues.includes(value)) {
      uniqueValues.push(value);
    }
  }
  return uniqueValues;
}

function formatVisualDecision(decision: LegoTechnicCustomerVisualDecision): string {
  return [
    `requested visual ID: ${decision.requestedVisualId ?? 'none'}`,
    `visual classification: ${decision.classification}`,
    `renderer used: ${decision.rendererUsed}`,
    `blocked/retired reason: ${decision.blockedReason ?? 'none'}`,
  ].join(' · ');
}

export function LibraryPortalSectionRenderer({
  fallbackQuotes,
  recommendedQuoteId,
  customerSummary,
  atlasDecision,
  scenarios,
  accessibilityPreferences,
  userConcernTags,
  propertyConstraintTags,
  showDebugDiagnostics,
}: Props) {
  const showDebug = showDebugDiagnostics ?? !import.meta.env.PROD;
  const composed = useMemo(() => {
    try {
      return buildCalmWelcomePackFromAtlasDecision({
        customerSummary,
        atlasDecision,
        scenarios,
        accessibilityPreferences,
        userConcernTags,
        propertyConstraintTags,
      });
    } catch {
      return undefined;
    }
  }, [
    customerSummary,
    atlasDecision,
    scenarios,
    accessibilityPreferences,
    userConcernTags,
    propertyConstraintTags,
  ]);

  const routingTriggerTags = useMemo(
    () => [...(userConcernTags ?? []), ...(propertyConstraintTags ?? [])],
    [userConcernTags, propertyConstraintTags],
  );
  const section = composed?.brandedViewModel.customerFacingSections
    .find((entry) => entry.sectionId === 'living_with_the_system');
  const authoredCards = useMemo(
    () => (composed ? getPortalEducationalContent({
      selectedConceptIds: composed.plan.selectedConceptIds,
      routingTriggerTags,
      atlasMvpContentMapRegistry,
      educationalContentRegistry,
    }).slice(0, MAX_PORTAL_CARDS) : []),
    [composed, routingTriggerTags],
  );
  const matchedMvpContentIds = useMemo(() => {
    const matched = new Set<string>();
    for (const card of authoredCards) {
      for (const entry of atlasMvpContentMapRegistry) {
        if (entry.title === card.title) {
          matched.add(entry.id);
        }
      }
    }
    return [...matched];
  }, [authoredCards]);
  const matchedAnimationIds = useMemo(
    () => stableUnique(authoredCards.flatMap((card) => card.suggestedAnimationIds)),
    [authoredCards],
  );
  const animationVisualDecisions = useMemo(
    () => matchedAnimationIds.map((animationId) => resolveLegoTechnicCustomerVisualDecision({
      visualId: animationId,
      rendererUsed: 'educational_animation',
      surface: 'customer_portal',
    })),
    [matchedAnimationIds],
  );
  const canonicalAnimationIds = useMemo(
    () => animationVisualDecisions
      .filter((decision) => decision.allowed && decision.requestedVisualId != null)
      .map((decision) => decision.requestedVisualId as string),
    [animationVisualDecisions],
  );
  const composedScenarioId = composed?.brandedViewModel.recommendedScenarioId;
  const recommendationMatches = Boolean(
    composedScenarioId
    && customerSummary.recommendedScenarioId
    && composedScenarioId === customerSummary.recommendedScenarioId,
  );
  const fallbackReason = useMemo(() => {
    if (!composed) return 'library_composition_failed';
    if (!composed.readiness.safeForCustomer) return 'library_output_not_safe_for_customer';
    if (!recommendationMatches) {
      return 'library_recommendation_mismatch';
    }
    if (!section) return 'library_section_missing_living_with_the_system';
    if (authoredCards.length === 0) return 'library_content_missing_cards';
    return 'none';
  }, [authoredCards.length, composed, recommendationMatches, section]);
  const isSafe = Boolean(
    composed?.readiness.safeForCustomer
    && recommendationMatches
    && section
    && authoredCards.length > 0,
  );

  const selectedConceptIds = composed?.plan.selectedConceptIds ?? [];
  const diagramsFromCards = useMemo(() => {
    const diagramIds = new Set<string>();
    for (const card of authoredCards) {
      for (const suggestedDiagramId of card.suggestedDiagramIds) {
        const renderableDiagramId = toRenderableDiagramId(suggestedDiagramId);
        if (renderableDiagramId) {
          diagramIds.add(renderableDiagramId);
        }
      }
    }
    return [...diagramIds];
  }, [authoredCards]);
  const recommendedScenarioId = composed?.brandedViewModel.recommendedScenarioId ?? '';
  const recommendedSystemLabel = customerSummary.recommendedSystemLabel ?? '';
  const hasStoredHotWaterPath = STORED_HOT_WATER_SCENARIO_PATTERN.test(recommendedScenarioId)
    || STORED_HOT_WATER_LABEL_PATTERN.test(recommendedSystemLabel);
  const hasLowTemperaturePath = LOW_TEMP_SCENARIO_PATTERN.test(recommendedScenarioId)
    || selectedConceptIds.includes('hot_radiator_expectation')
    || selectedConceptIds.includes('flow_temperature_living_with_it')
    || routingTriggerTags.some((tag) => LOW_TEMP_TAG_PATTERN.test(tag));
  const hasWaterMainConstraintPath = selectedConceptIds.some((conceptId) => WATER_CONSTRAINT_CONCEPT_IDS.includes(conceptId))
    || routingTriggerTags.some((tag) => WATER_CONSTRAINT_TAG_PATTERN.test(tag));
  const fallbackDiagrams = composed?.brandedViewModel.diagramsBySection?.[section?.sectionId ?? '']
    ?.filter((diagramId) => getDiagramById(diagramId));
  const candidateDeterministicDiagrams = [
    hasStoredHotWaterPath ? DETERMINISTIC_SCENARIO_DIAGRAMS.stored_hot_water : undefined,
    hasLowTemperaturePath ? DETERMINISTIC_SCENARIO_DIAGRAMS.low_temp_heat : undefined,
    hasWaterMainConstraintPath ? DETERMINISTIC_SCENARIO_DIAGRAMS.water_main_constraint : undefined,
  ].filter((diagramId): diagramId is string => diagramId !== undefined);
  const requestedDiagramIds = stableUnique([
    ...candidateDeterministicDiagrams,
    ...diagramsFromCards,
    ...(fallbackDiagrams ?? []),
  ]);
  const diagramVisualDecisions = useMemo(
    () => requestedDiagramIds.map((diagramId) => resolveLegoTechnicCustomerVisualDecision({
      visualId: diagramId,
      rendererUsed: 'diagram_component',
      surface: 'customer_portal',
    })),
    [requestedDiagramIds],
  );
  const diagrams = useMemo(
    () => diagramVisualDecisions
      .filter((decision) => decision.allowed && decision.requestedVisualId != null)
      .map((decision) => decision.requestedVisualId as string),
    [diagramVisualDecisions],
  );
  const blockedVisualDecisions = useMemo(
    () => [...animationVisualDecisions, ...diagramVisualDecisions].filter((decision) => !decision.allowed),
    [animationVisualDecisions, diagramVisualDecisions],
  );

  if (!isSafe || !section || !composed) {
    return (
      <div data-testid="library-portal-section-fallback">
        {showDebug ? (
          <aside className="library-portal-section__debug" data-testid="library-portal-debug-strip">
            <p>libraryRendererUsed: false</p>
            <p data-testid="library-portal-debug-fallback-reason">fallbackReason: {fallbackReason}</p>
            <p>selectedConceptIds: {selectedConceptIds.join(', ') || 'none'}</p>
            <p>matchedMvpContentIds: {matchedMvpContentIds.join(', ') || 'none'}</p>
            <p>matchedDiagramIds: none</p>
            <p>matchedAnimationIds: {canonicalAnimationIds.join(', ') || 'none'}</p>
            {blockedVisualDecisions.map((decision) => (
              <p key={`fallback-blocked-${decision.rendererUsed}-${decision.requestedVisualId ?? 'none'}`}>
                {formatVisualDecision(decision)}
              </p>
            ))}
          </aside>
        ) : null}
        <DailyUsePanel quotes={fallbackQuotes} recommendedQuoteId={recommendedQuoteId} />
      </div>
    );
  }
  // Precedence is intentional: deterministic scenario diagrams first, then authored-card matches,
  // then section-level fallback diagrams, with duplicates removed for stable rendering.
  const showTechnicalAppendix = Boolean(accessibilityPreferences?.includeTechnicalAppendix);

  return (
    <section
      className={`library-portal-section${accessibilityPreferences?.prefersReducedMotion ? ' library-portal-section--reduced-motion' : ''}`}
      data-testid="library-portal-section"
      aria-labelledby="library-portal-why-matters-heading"
    >
      <h2 id="library-portal-why-matters-heading" className="daily-use__heading">Why this matters day to day</h2>
      <p className="daily-use__sub">Here&apos;s what that means for you in everyday use.</p>
      {showDebug ? (
        <p className="library-portal-section__source-label" data-testid="library-portal-source-label">
          Insight from Atlas Library
        </p>
      ) : null}
      {showDebug ? (
        <aside className="library-portal-section__debug" data-testid="library-portal-debug-strip">
          <p>libraryRendererUsed: true</p>
          <p data-testid="library-portal-debug-fallback-reason">fallbackReason: {fallbackReason}</p>
          <p>selectedConceptIds: {selectedConceptIds.join(', ') || 'none'}</p>
          <p>matchedMvpContentIds: {matchedMvpContentIds.join(', ') || 'none'}</p>
          <p>matchedDiagramIds: {diagrams.join(', ') || 'none'}</p>
          <p>matchedAnimationIds: {canonicalAnimationIds.join(', ') || 'none'}</p>
          {blockedVisualDecisions.map((decision) => (
            <p key={`blocked-${decision.rendererUsed}-${decision.requestedVisualId ?? 'none'}`}>
              {formatVisualDecision(decision)}
            </p>
          ))}
        </aside>
      ) : null}

      <div className="library-portal-section__cards" data-testid="library-portal-sequenced-cards">
        {authoredCards.map((card, index) => (
          <EducationalInfoCard
            key={`${card.title}:${index}`}
            heading={card.title}
            body={card.oneLineSummary}
            tone={index === 0 ? 'primary' : 'default'}
            data-testid="library-portal-authored-card"
          >
            {card.customerWording ? (
              <p className="portal-info-card__body">{card.customerWording}</p>
            ) : null}
            {(card.whatYouMayNotice || card.whatStaysFamiliar) ? (
              <WhatYouMayNoticePanel
                blocks={[
                  ...(card.whatYouMayNotice ? [{ label: 'What you may notice', body: card.whatYouMayNotice }] : []),
                  ...(card.whatStaysFamiliar ? [{ label: 'What stays familiar', body: card.whatStaysFamiliar }] : []),
                ]}
              />
            ) : null}
            {card.whatNotToWorryAbout ? (
              <ReassurancePanel
                eyebrow="What not to worry about"
                heading="No need to worry"
                body={card.whatNotToWorryAbout}
              />
            ) : null}
            {card.misconception && card.reality ? (
              <PortalMisconceptionBlock
                label="Common misunderstanding"
                misconception={card.misconception}
                reality={card.reality}
              />
            ) : null}
            {showTechnicalAppendix && card.technicalAppendixSummary ? (
              <p className="library-portal-section__tech-appendix">
                <strong>Technical appendix:</strong> {card.technicalAppendixSummary}
              </p>
            ) : null}
          </EducationalInfoCard>
        ))}
      </div>

      {canonicalAnimationIds.length > 0 ? (
        <>
          <SectionDivider label={canonicalAnimationIds.length > 1 ? 'Guided animations' : 'Guided animation'} />
          <div className="library-portal-section__diagrams" data-testid="library-portal-animations">
            {canonicalAnimationIds.map((animationId) => (
              <PortalDiagramFrame
                key={`portal-animation-${animationId}`}
                data-testid="library-portal-animation-frame"
              >
                <EducationalAnimationRenderer
                  animationId={animationId}
                  prefersReducedMotion={Boolean(accessibilityPreferences?.prefersReducedMotion)}
                />
              </PortalDiagramFrame>
            ))}
          </div>
        </>
      ) : null}

      {/* Diagrams are the fallback surface when no resolved animation IDs are available. */}
      {diagrams.length > 0 && canonicalAnimationIds.length === 0 ? (
        <>
          <SectionDivider label="System diagram" />
          <div className="library-portal-section__diagrams" data-testid="library-portal-diagrams">
            {diagrams.map((diagramId) => (
              <PortalDiagramFrame
                key={`portal-diagram-${diagramId}`}
                data-testid="library-portal-diagram-frame"
              >
                <DiagramRenderer diagramId={diagramId} printSafe={false} />
              </PortalDiagramFrame>
            ))}
          </div>
        </>
      ) : showDebug ? (
        <p data-testid="library-portal-no-diagram">No matching diagram found</p>
      ) : null}

      {composed.brandedViewModel.qrDestinations.length > 0 ? (
        <QRDeepDiveCard
          data-testid="library-portal-qr"
          note="Scan to explore in detail — diagram-guided walkthrough available."
          destinations={composed.brandedViewModel.qrDestinations.map((dest) => ({
            title: dest.title,
            assetId: dest.assetId,
          }))}
        />
      ) : null}
    </section>
  );
}
