export type PortalAccessModeV1 =
  | 'token_link'
  | 'workspace_preview'
  | 'printed_qr';

export type PortalPersonalDataModeV1 =
  | 'none'
  | 'display_label_only'
  | 'address_summary'
  | 'full_customer_record';

export interface PortalVisitContextV1 {
  readonly portalReference: string;
  readonly workspaceId: string;
  readonly brandId: string;
  readonly visitReference: string;
  readonly customerDisplayLabel?: string;
  readonly addressSummary?: string;
  readonly propertyFacts: readonly string[];
  readonly usageFacts: readonly string[];
  readonly recommendationSummary: string;
  readonly selectedScenarioId: string;
  readonly expiresAt?: string;
  readonly accessMode: PortalAccessModeV1;
  readonly personalDataMode: PortalPersonalDataModeV1;
}
