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

const MAX_CUSTOMER_RECOMMENDATION_REASONS = 5;
const DEFAULT_COVER_TITLE = 'Your recommendation';
const DEFAULT_COVER_SUMMARY = 'Recommendation details are currently unavailable.';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface LegacyPortalJourneyPrintModelInput extends Partial<PortalJourneyPrintModelV1> {
  recommendationSummary?: unknown;
  customerFacts?: unknown;
  deepDiveDestinations?: unknown;
}

function resolveCoverSummary(model: LegacyPortalJourneyPrintModelInput): string {
  if (hasText(model.cover?.summary)) return model.cover.summary;
  if (hasText(model.recommendationSummary)) return model.recommendationSummary;
  return DEFAULT_COVER_SUMMARY;
}

export function buildCustomerDocumentModel(
  input: BuildCustomerDocumentModelInputV1,
): CustomerDocumentModelV1 {
  const model: LegacyPortalJourneyPrintModelInput = input.model;
  const recommendationReasons = (Array.isArray(model.recommendationReasons) ? model.recommendationReasons : [])
    .filter((reason) => isRecord(reason) && hasText(reason.title) && hasText(reason.summary))
    .slice(0, MAX_CUSTOMER_RECOMMENDATION_REASONS);
  const coverCustomerFacts = Array.isArray(model.cover?.customerFacts)
    ? model.cover.customerFacts
    : Array.isArray(model.customerFacts)
    ? model.customerFacts
    : [];
  const coverSummary = resolveCoverSummary(model);
  const cover = {
    title: hasText(model.cover?.title) ? model.cover.title : DEFAULT_COVER_TITLE,
    summary: coverSummary,
    customerFacts: coverCustomerFacts.filter(hasText),
    ...(hasText(model.cover?.brandName) ? { brandName: model.cover.brandName } : {}),
    ...(hasText(model.cover?.addressSummary) ? { addressSummary: model.cover.addressSummary } : {}),
  };
  const sections = Array.isArray(model.sections) ? model.sections : [];
  const nextSteps = Array.isArray(model.nextSteps) ? model.nextSteps : [];
  const qrDestinations = Array.isArray(model.qrDestinations)
    ? model.qrDestinations
    : Array.isArray(model.deepDiveDestinations)
    ? model.deepDiveDestinations
    : [];
  const systemProtection = isRecord(model.systemProtection) ? model.systemProtection : undefined;

  return {
    mode: input.mode,
    cover,
    recommendationReasons,
    sections,
    systemProtection,
    nextSteps,
    qrDestinations,
    packageEmbedded: input.mode === 'packageEmbedded',
  };
}
