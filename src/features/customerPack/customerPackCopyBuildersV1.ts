import type { CustomerEvidenceCardV1 } from '../legoTechnix/customerEvidence/CustomerEvidenceCardV1';
import type { CustomerEvidencePackV1 } from '../legoTechnix/customerEvidence/CustomerEvidencePackV1';

export interface CustomerCardCopyV1 {
  readonly title: string;
  readonly takeaway: string;
  readonly practicalImplication?: string;
  readonly engineerConfirmationNote?: string;
}

export interface CustomerRecommendationEvidenceV1 {
  readonly chosenSystemLabel: string;
  readonly whyItFitsThisHome: string;
  readonly whatAtlasSimulated: string;
  readonly whatRemainsToBeConfirmed: string;
}

function toSingleSentence(text: string): string {
  const normalised = text.replace(/\s+/g, ' ').trim();
  if (!normalised) {
    return '';
  }
  const firstSentence = normalised.split(/(?<=[.!?])\s+/)[0];
  return /[.!?]$/.test(firstSentence) ? firstSentence : `${firstSentence}.`;
}

function buildPracticalImplication(card: CustomerEvidenceCardV1): string | undefined {
  switch (card.type) {
    case 'thermal_story':
      return 'This indicates how quickly rooms can warm up when your thermostat calls for heat.';
    case 'hot_water_story':
      return 'This helps set expectations for shower and bath availability through the day.';
    case 'comfort_story':
      return 'This shows what room comfort and response time are likely to feel like at home.';
    case 'efficiency_story':
      return 'This highlights where steady operation can help reduce energy waste.';
    case 'confidence_story':
      return 'This shows which details are confirmed and which are still estimated.';
    case 'assumption_story':
      return 'This marks details that are finalised during the installation visit.';
    case 'warning_story':
      return card.warnings.length > 0
        ? 'These points are for planning and commissioning checks.'
        : undefined;
    default:
      return undefined;
  }
}

function buildEngineerConfirmationNote(card: CustomerEvidenceCardV1): string | undefined {
  const warningWithConfirmation = card.warnings.find((warning) =>
    /(confirm|check|installer|engineer)/i.test(warning.message),
  );
  if (warningWithConfirmation) {
    return toSingleSentence(warningWithConfirmation.message);
  }
  if (card.confidenceWording && /installer/i.test(card.confidenceWording)) {
    return 'Your installer will confirm this detail on site.';
  }
  return undefined;
}

export function buildCustomerCardCopyV1(card: CustomerEvidenceCardV1): CustomerCardCopyV1 {
  return {
    title: card.heading,
    takeaway: toSingleSentence(card.summary),
    practicalImplication: buildPracticalImplication(card),
    engineerConfirmationNote: buildEngineerConfirmationNote(card),
  };
}

function pickSectionSummary(pack: CustomerEvidencePackV1, id: string): string {
  return pack.sections.find((section) => section.id === id)?.summary ?? '';
}

function pickCardSummary(pack: CustomerEvidencePackV1, id: string): string {
  return pack.sections.find((section) => section.id === id)?.cards[0]?.summary ?? '';
}

export function buildCustomerRecommendationEvidenceV1(
  pack: CustomerEvidencePackV1,
): CustomerRecommendationEvidenceV1 {
  const whyItFits = toSingleSentence(
    `${pickSectionSummary(pack, 'home_understanding')} ${pickSectionSummary(pack, 'comfort_expectations')}`.trim(),
  );
  const simulated = toSingleSentence(
    `${pickCardSummary(pack, 'heating_behaviour')} ${pickCardSummary(pack, 'hot_water_behaviour')}`.trim(),
  );
  const remainingChecks = toSingleSentence(
    `${pickSectionSummary(pack, 'engineer_confirmation')} ${pickCardSummary(pack, 'engineer_confirmation')}`.trim(),
  );

  return {
    chosenSystemLabel: pack.systemLabel,
    whyItFitsThisHome: whyItFits || 'This system matches the heating and hot water pattern seen in your survey evidence.',
    whatAtlasSimulated:
      simulated || 'Atlas simulated heating response, hot water recovery, and day-to-day operating conditions.',
    whatRemainsToBeConfirmed:
      remainingChecks || 'Final commissioning checks confirm settings and any remaining unknown details on site.',
  };
}
