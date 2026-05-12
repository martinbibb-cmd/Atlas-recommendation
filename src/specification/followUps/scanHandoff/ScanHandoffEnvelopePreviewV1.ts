import type { FollowUpScanHandoffV1 } from './FollowUpScanHandoffV1';

export interface ScanHandoffEnvelopePreviewV1 {
  readonly envelopeId: string;
  readonly schemaVersion: 1;
  readonly source: 'atlas_recommendation_dev';
  readonly visitReference?: string;
  readonly createdAt: string;
  readonly handoffReason: 'follow_up_evidence_capture';
  readonly payload: FollowUpScanHandoffV1;
  readonly deepLinkPreview: string;
  readonly encodedPayloadPreview: string;
  readonly safety: {
    readonly devOnly: true;
    readonly containsCustomerData: boolean;
    readonly persistenceEnabled: false;
    readonly deliveryEnabled: false;
  };
}

