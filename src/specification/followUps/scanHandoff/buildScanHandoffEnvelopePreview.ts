import type { FollowUpScanHandoffV1 } from './FollowUpScanHandoffV1';
import type { ScanHandoffEnvelopePreviewV1 } from './ScanHandoffEnvelopePreviewV1';

export interface BuildScanHandoffEnvelopePreviewOptions {
  readonly createdAt?: string;
  readonly visitReference?: string;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildScanHandoffEnvelopePreview(
  scanHandoff: FollowUpScanHandoffV1,
  options: BuildScanHandoffEnvelopePreviewOptions = {},
): ScanHandoffEnvelopePreviewV1 {
  const payload = scanHandoff;
  const encodedPayloadPreview = encodeURIComponent(JSON.stringify(payload));
  const deepLinkPreview = `atlas-scan://follow-up-capture?payload=${encodedPayloadPreview}`;
  const visitReference = options.visitReference ?? payload.visitReference;

  return {
    envelopeId: `scan_handoff_envelope_preview_v1_${hashString(payload.handoffId)}`,
    schemaVersion: 1,
    source: 'atlas_recommendation_dev',
    ...(visitReference ? { visitReference } : {}),
    createdAt: options.createdAt ?? new Date().toISOString(),
    handoffReason: 'follow_up_evidence_capture',
    payload,
    deepLinkPreview,
    encodedPayloadPreview,
    safety: {
      devOnly: true,
      containsCustomerData: Boolean(visitReference),
      persistenceEnabled: false,
      deliveryEnabled: false,
    },
  };
}

