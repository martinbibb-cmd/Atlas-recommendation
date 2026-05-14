import type {
  PortalPersonalDataModeV1,
  PortalVisitContextV1,
} from '../../contracts/PortalVisitContextV1';

export interface PortalVisitDisplayContext {
  readonly customerDisplayLabel?: string;
  readonly addressSummary?: string;
  readonly personalDataMode?: PortalPersonalDataModeV1;
}

export const PORTAL_HOME_FALLBACK = 'Your home';
export const PORTAL_RECOMMENDATION_FALLBACK = 'This recommendation';
export const PORTAL_INSTALLATION_PLAN_FALLBACK = 'Your installation plan';

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function canShowDisplayLabel(mode: PortalPersonalDataModeV1 | undefined): boolean {
  return mode === 'display_label_only'
    || mode === 'address_summary'
    || mode === 'full_customer_record';
}

function canShowAddressSummary(mode: PortalPersonalDataModeV1 | undefined): boolean {
  return mode === 'address_summary' || mode === 'full_customer_record';
}

export function resolvePortalHomeLabel(context?: PortalVisitDisplayContext | null): string {
  const mode = context?.personalDataMode;
  const customerDisplayLabel = trimOptional(context?.customerDisplayLabel);
  if (customerDisplayLabel && canShowDisplayLabel(mode)) {
    return customerDisplayLabel;
  }
  return PORTAL_HOME_FALLBACK;
}

export function resolvePortalAddressSummary(
  context?: PortalVisitDisplayContext | null,
  options?: { readonly includeInPrint?: boolean },
): string | undefined {
  if (options?.includeInPrint !== true) {
    return undefined;
  }
  const mode = context?.personalDataMode;
  const addressSummary = trimOptional(context?.addressSummary);
  if (addressSummary && canShowAddressSummary(mode)) {
    return addressSummary;
  }
  return undefined;
}

export function sanitizePortalVisitContextForExport(
  context: PortalVisitContextV1,
  options?: { readonly allowFullCustomerRecord?: boolean },
): PortalVisitContextV1 {
  const baseContext = {
    ...context,
    customerDisplayLabel: undefined,
    addressSummary: undefined,
  };
  const customerDisplayLabel = trimOptional(context.customerDisplayLabel);
  const addressSummary = trimOptional(context.addressSummary);

  let personalDataMode = context.personalDataMode;
  if (personalDataMode === 'full_customer_record' && options?.allowFullCustomerRecord !== true) {
    personalDataMode = addressSummary
      ? 'address_summary'
      : customerDisplayLabel
        ? 'display_label_only'
        : 'none';
  }

  const includeDisplayLabel = customerDisplayLabel && canShowDisplayLabel(personalDataMode)
    ? customerDisplayLabel
    : undefined;
  const includeAddressSummary = addressSummary && canShowAddressSummary(personalDataMode)
    ? addressSummary
    : undefined;

  return {
    ...baseContext,
    personalDataMode,
    ...(includeDisplayLabel ? { customerDisplayLabel: includeDisplayLabel } : {}),
    ...(includeAddressSummary ? { addressSummary: includeAddressSummary } : {}),
  };
}
