import { useMemo } from 'react';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { DiagramRenderer } from '../../library/diagrams/DiagramRenderer';
import type { WelcomePackAccessibilityPreferencesV1 } from '../../library/packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackFromAtlasDecision } from '../../library/packRenderer/buildCalmWelcomePackFromAtlasDecision';
import { educationalSequenceRules } from '../../library/sequencing/educationalSequenceRules';
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

function sequenceStageForConcept(conceptId?: string): string | undefined {
  if (!conceptId) return undefined;
  return educationalSequenceRules.find((rule) => rule.conceptId === conceptId)?.sequenceStage;
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

  const section = composed?.brandedViewModel.customerFacingSections
    .find((entry) => entry.sectionId === 'living_with_the_system');
  const isSafe = Boolean(
    composed?.readiness.safeForCustomer
    && composed?.brandedViewModel.recommendedScenarioId === customerSummary.recommendedScenarioId
    && section
    && section.cards.length > 0,
  );

  if (!isSafe || !section || !composed) {
    return (
      <div data-testid="library-portal-section-fallback">
        <DailyUsePanel quotes={fallbackQuotes} recommendedQuoteId={recommendedQuoteId} />
      </div>
    );
  }

  const diagrams = composed.brandedViewModel.diagramsBySection?.[section.sectionId] ?? [];
  const reassuranceCards: typeof section.cards = [];
  const noticeCards: typeof section.cards = [];
  for (const card of section.cards) {
    const stage = sequenceStageForConcept(card.conceptId);
    if (stage === 'reassurance') {
      reassuranceCards.push(card);
    }
    if (stage === 'lived_experience') {
      noticeCards.push(card);
    }
  }

  return (
    <section
      className={`library-portal-section${accessibilityPreferences?.prefersReducedMotion ? ' library-portal-section--reduced-motion' : ''}`}
      data-testid="library-portal-section"
      aria-labelledby="library-portal-day-to-day-heading"
    >
      <h2 id="library-portal-day-to-day-heading" className="daily-use__heading">What that means day-to-day</h2>
      <p className="daily-use__sub">Here&apos;s what that means for you in everyday use.</p>

      {reassuranceCards.length > 0 ? (
        <div className="library-portal-section__reassurance" data-testid="library-portal-reassurance">
          {reassuranceCards.map((card) => (
            <p key={`reassure-${card.assetId ?? card.title}`} className="library-portal-section__reassurance-item">
              {card.summary}
            </p>
          ))}
        </div>
      ) : null}

      <div className="library-portal-section__cards" data-testid="library-portal-sequenced-cards">
        {section.cards.map((card, index) => (
          <details
            key={`${card.assetId ?? 'asset'}:${card.title}:${index}`}
            className="library-portal-section__card"
            open={index === 0}
          >
            <summary>{card.title}</summary>
            <p>{card.summary}</p>
            {card.safetyNotice ? <p className="library-portal-section__safety">{card.safetyNotice}</p> : null}
          </details>
        ))}
      </div>

      {noticeCards.length > 0 ? (
        <div className="library-portal-section__notice" data-testid="library-portal-notice">
          <h3>What you may notice</h3>
          <ul>
            {noticeCards.map((card) => (
              <li key={`notice-${card.assetId ?? card.title}`}>{card.summary}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
