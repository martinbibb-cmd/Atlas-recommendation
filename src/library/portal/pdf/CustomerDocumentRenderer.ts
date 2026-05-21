import type {
  PortalJourneyPrintModelV1,
  PortalJourneyPrintSectionV1,
  RecommendationReasonBlockV1,
} from './buildPortalJourneyPrintModel';
import type { SystemProtectionSummaryV1 } from './buildSystemProtectionSummary';

export type CustomerDocumentRendererMode = 'printable' | 'packageEmbedded' | 'portalPreview';

export interface CustomerDocumentModelV1 {
  readonly mode: CustomerDocumentRendererMode;
  readonly cover: PortalJourneyPrintModelV1['cover'];
  readonly recommendationReasons: readonly RecommendationReasonBlockV1[];
  readonly sections: readonly PortalJourneyPrintSectionV1[];
  readonly systemProtection?: SystemProtectionSummaryV1;
  readonly nextSteps: PortalJourneyPrintModelV1['nextSteps'];
  readonly qrDestinations: PortalJourneyPrintModelV1['qrDestinations'];
  readonly packageEmbedded: boolean;
}

export type CustomerDocumentSectionV1 = CustomerDocumentModelV1['sections'][number];

export interface BuildCustomerDocumentModelInputV1 {
  readonly model: PortalJourneyPrintModelV1;
  readonly mode: CustomerDocumentRendererMode;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildCustomerDocumentModel(
  input: BuildCustomerDocumentModelInputV1,
): CustomerDocumentModelV1 {
  const recommendationReasons = input.model.recommendationReasons
    .filter((reason) => hasText(reason.title) && hasText(reason.summary))
    .slice(0, 5);

  return {
    mode: input.mode,
    cover: input.model.cover,
    recommendationReasons,
    sections: input.model.sections,
    systemProtection: input.model.systemProtection,
    nextSteps: input.model.nextSteps,
    qrDestinations: input.model.qrDestinations,
    packageEmbedded: input.mode === 'packageEmbedded',
  };
}
