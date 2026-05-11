import { useMemo } from 'react';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { DiagramRenderer } from '../../library/diagrams/DiagramRenderer';
import { getDiagramById } from '../../library/diagrams/diagramExplanationRegistry';
import { atlasMvpContentMapRegistry, educationalContentRegistry } from '../../library/content';
import { getPortalEducationalContent } from '../../library/portal/getPortalEducationalContent';
import type { WelcomePackAccessibilityPreferencesV1 } from '../../library/packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackFromAtlasDecision } from '../../library/packRenderer/buildCalmWelcomePackFromAtlasDecision';
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
const FALLBACK_DIAGRAMS: Record<'stored_hot_water' | 'low_temp_heat' | 'water_main_constraint', string> = {
  stored_hot_water: 'pressure_vs_storage',
  low_temp_heat: 'warm_vs_hot_radiators',
  water_main_constraint: 'water_main_limitation',
};

function toRenderableDiagramId(diagramId: string): string | undefined {
  const normalized = diagramId
    .replace(/^diagram[-_]/i, '')
    .replace(/-/g, '_')
    .toLowerCase();
  const aliased = DIAGRAM_ID_ALIASES[normalized] ?? normalized;
  return getDiagramById(aliased) ? aliased : undefined;
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
  const matchedMvpEntries = useMemo(
    () => atlasMvpContentMapRegistry.filter((entry) => matchedMvpContentIds.includes(entry.id)),
    [matchedMvpContentIds],
  );
  const matchedAnimationIds = useMemo(
    () => [...new Set(matchedMvpEntries.flatMap((entry) => entry.suggestedAnimationIds))],
    [matchedMvpEntries],
  );
  const fallbackReason = useMemo(() => {
    if (!composed) return 'library_composition_failed';
    if (!composed.readiness.safeForCustomer) return 'library_output_not_safe_for_customer';
    if (composed.brandedViewModel.recommendedScenarioId !== customerSummary.recommendedScenarioId) {
      return 'library_recommendation_mismatch';
    }
    if (!section) return 'library_section_missing_living_with_the_system';
    if (authoredCards.length === 0) return 'library_content_missing_cards';
    return 'none';
  }, [authoredCards.length, composed, customerSummary.recommendedScenarioId, section]);
  const isSafe = Boolean(
    composed?.readiness.safeForCustomer
    && composed?.brandedViewModel.recommendedScenarioId === customerSummary.recommendedScenarioId
    && section
    && authoredCards.length > 0,
  );

  const selectedConceptIds = composed?.plan.selectedConceptIds ?? [];
  const recommendedScenarioId = composed?.brandedViewModel.recommendedScenarioId ?? customerSummary.recommendedScenarioId;
  const hasStoredHotWaterPath = /system|unvented|stored/i.test(recommendedScenarioId)
    || /stored hot water|unvented|system boiler/i.test(customerSummary.recommendedSystemLabel)
    || selectedConceptIds.includes('pressure_vs_storage');
  const hasLowTemperaturePath = /heat_pump|ashp/i.test(recommendedScenarioId)
    || selectedConceptIds.includes('hot_radiator_expectation')
    || selectedConceptIds.includes('flow_temperature_living_with_it')
    || routingTriggerTags.some((tag) => /heat_pump|low_temp|flow_temperature/i.test(tag));
  const hasWaterMainConstraintPath = selectedConceptIds.some((conceptId) => (
    conceptId === 'water_main_limit_not_boiler_limit'
    || conceptId === 'hydraulic_constraint'
    || conceptId === 'flow_restriction'
  )) || routingTriggerTags.some((tag) => /pressure|flow|hydraulic|mains/i.test(tag));
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
            <p>matchedAnimationIds: {matchedAnimationIds.join(', ') || 'none'}{matchedAnimationIds.length > 0 ? ' (animation planned)' : ''}</p>
          </aside>
        ) : null}
        <DailyUsePanel quotes={fallbackQuotes} recommendedQuoteId={recommendedQuoteId} />
      </div>
    );
  }
  const fallbackDiagrams = composed.brandedViewModel.diagramsBySection?.[section.sectionId]
    ?.filter((diagramId) => getDiagramById(diagramId));
  const forcedDiagrams = [
    hasStoredHotWaterPath ? FALLBACK_DIAGRAMS.stored_hot_water : undefined,
    hasLowTemperaturePath ? FALLBACK_DIAGRAMS.low_temp_heat : undefined,
    hasWaterMainConstraintPath ? FALLBACK_DIAGRAMS.water_main_constraint : undefined,
  ].filter((diagramId): diagramId is string => Boolean(diagramId && getDiagramById(diagramId)));
  const diagrams = [...new Set([
    ...forcedDiagrams,
    ...diagramsFromCards,
    ...(fallbackDiagrams ?? []),
  ])];
  const showTechnicalAppendix = Boolean(accessibilityPreferences?.includeTechnicalAppendix);

  return (
    <section
      className={`library-portal-section${accessibilityPreferences?.prefersReducedMotion ? ' library-portal-section--reduced-motion' : ''}`}
      data-testid="library-portal-section"
      aria-labelledby="library-portal-day-to-day-heading"
    >
      <h2 id="library-portal-day-to-day-heading" className="daily-use__heading">Why this matters day to day</h2>
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
          <p>matchedAnimationIds: {matchedAnimationIds.join(', ') || 'none'}{matchedAnimationIds.length > 0 ? ' (animation planned)' : ''}</p>
        </aside>
      ) : null}

      <div className="library-portal-section__cards" data-testid="library-portal-sequenced-cards">
        {authoredCards.map((card, index) => (
          <article
            key={`${card.title}:${index}`}
            className="library-portal-section__card"
            data-testid="library-portal-authored-card"
          >
            <h3 className="library-portal-section__card-title">{card.title}</h3>
            <p>{card.oneLineSummary}</p>
            {card.customerWording ? <p>{card.customerWording}</p> : null}
            {card.whatYouMayNotice ? (
              <p><strong>What you may notice:</strong> {card.whatYouMayNotice}</p>
            ) : null}
            {card.whatStaysFamiliar ? (
              <p><strong>What stays familiar:</strong> {card.whatStaysFamiliar}</p>
            ) : null}
            {card.whatNotToWorryAbout ? (
              <p className="library-portal-section__safety"><strong>What not to worry about:</strong> {card.whatNotToWorryAbout}</p>
            ) : null}
            {card.misconception && card.reality ? (
              <p>
                <strong>Common misunderstanding:</strong> {card.misconception}
                {' '}
                <strong>Reality:</strong> {card.reality}
              </p>
            ) : null}
            {showTechnicalAppendix && card.technicalAppendixSummary ? (
              <p><strong>Technical appendix:</strong> {card.technicalAppendixSummary}</p>
            ) : null}
          </article>
        ))}
      </div>

      {diagrams.length > 0 ? (
        <div className="library-portal-section__diagrams" data-testid="library-portal-diagrams">
          {diagrams.map((diagramId) => (
            <figure key={`portal-diagram-${diagramId}`} className="library-portal-section__diagram">
              <DiagramRenderer diagramId={diagramId} printSafe={false} />
            </figure>
          ))}
        </div>
      ) : showDebug ? (
        <p data-testid="library-portal-no-diagram">No matching diagram found</p>
      ) : null}

      {composed.brandedViewModel.qrDestinations.length > 0 ? (
        <div className="library-portal-section__qr" data-testid="library-portal-qr">
          <h3>Go deeper</h3>
          <ul>
            {composed.brandedViewModel.qrDestinations.map((destination) => (
              <li key={`${destination.assetId}:${destination.destination}`}>{destination.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
