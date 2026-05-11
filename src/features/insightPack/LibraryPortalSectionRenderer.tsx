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
}

const DIAGRAM_ID_ALIASES: Record<string, string> = {
  pressure_window: 'pressure_vs_storage',
  warm_radiator_pattern: 'warm_vs_hot_radiators',
  open_to_sealed: 'open_vented_to_unvented',
};
const MAX_PORTAL_CARDS = 4;

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
}: Props) {
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
  const isSafe = Boolean(
    composed?.readiness.safeForCustomer
    && composed?.brandedViewModel.recommendedScenarioId === customerSummary.recommendedScenarioId
    && section
    && authoredCards.length > 0,
  );

  if (!isSafe || !section || !composed) {
    return (
      <div data-testid="library-portal-section-fallback">
        <DailyUsePanel quotes={fallbackQuotes} recommendedQuoteId={recommendedQuoteId} />
      </div>
    );
  }

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
  const fallbackDiagrams = composed.brandedViewModel.diagramsBySection?.[section.sectionId]
    ?.filter((diagramId) => getDiagramById(diagramId));
  const diagrams = diagramsFromCards.length > 0 ? diagramsFromCards : (fallbackDiagrams ?? []);

  return (
    <section
      className={`library-portal-section${accessibilityPreferences?.prefersReducedMotion ? ' library-portal-section--reduced-motion' : ''}`}
      data-testid="library-portal-section"
      aria-labelledby="library-portal-day-to-day-heading"
    >
      <h2 id="library-portal-day-to-day-heading" className="daily-use__heading">What that means day-to-day</h2>
      <p className="daily-use__sub">Here&apos;s what that means for you in everyday use.</p>
      {!import.meta.env.PROD ? (
        <p className="library-portal-section__source-label" data-testid="library-portal-source-label">
          Insight from Atlas Library
        </p>
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
