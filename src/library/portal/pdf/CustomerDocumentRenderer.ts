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
const DEFAULT_COVER_SUMMARY = 'Recommendation details unavailable. Please contact your installer for a new document.';

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
  const inputModel: LegacyPortalJourneyPrintModelInput = input.model;
  const recommendationReasons = (Array.isArray(inputModel.recommendationReasons) ? inputModel.recommendationReasons : [])
    .filter((reason) => isRecord(reason) && hasText(reason.title) && hasText(reason.summary))
    .slice(0, MAX_CUSTOMER_RECOMMENDATION_REASONS);
  const coverCustomerFacts = Array.isArray(inputModel.cover?.customerFacts)
    ? inputModel.cover.customerFacts
    : Array.isArray(inputModel.customerFacts)
    ? inputModel.customerFacts
    : [];
  const coverSummary = resolveCoverSummary(inputModel);
  const cover = {
    title: hasText(inputModel.cover?.title) ? inputModel.cover.title : DEFAULT_COVER_TITLE,
    summary: coverSummary,
    customerFacts: coverCustomerFacts.filter(hasText),
    ...(hasText(inputModel.cover?.brandName) ? { brandName: inputModel.cover.brandName } : {}),
    ...(hasText(inputModel.cover?.addressSummary) ? { addressSummary: inputModel.cover.addressSummary } : {}),
  };
  const sections = Array.isArray(inputModel.sections) ? inputModel.sections : [];
  const nextSteps = Array.isArray(inputModel.nextSteps) ? inputModel.nextSteps : [];
  const qrDestinations = Array.isArray(inputModel.qrDestinations)
    ? inputModel.qrDestinations
    : Array.isArray(inputModel.deepDiveDestinations)
    ? inputModel.deepDiveDestinations
    : [];
  const systemProtection = isRecord(inputModel.systemProtection) ? inputModel.systemProtection : undefined;

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
