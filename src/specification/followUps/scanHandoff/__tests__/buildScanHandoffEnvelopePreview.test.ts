import { describe, expect, it } from 'vitest';
import type { FollowUpScanHandoffV1 } from '../../index';
import { buildScanHandoffEnvelopePreview } from '../buildScanHandoffEnvelopePreview';

function makeHandoff(overrides: Partial<FollowUpScanHandoffV1> = {}): FollowUpScanHandoffV1 {
  return {
    handoffId: 'follow_up_scan_handoff_v1_fixture',
    visitReference: 'visit_fixture_123',
    sourcePlanId: 'follow_up_evidence_plan_v1_fixture',
    createdAt: '2026-05-12T00:00:00.000Z',
    captureItems: [],
    unresolvedDependencies: [],
    ...overrides,
  };
}

describe('buildScanHandoffEnvelopePreview', () => {
  it('wraps the handoff payload in a dev envelope', () => {
    const handoff = makeHandoff();
    const envelope = buildScanHandoffEnvelopePreview(handoff, { createdAt: '2026-05-12T16:00:00.000Z' });

    expect(envelope.payload).toEqual(handoff);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.source).toBe('atlas_recommendation_dev');
    expect(envelope.handoffReason).toBe('follow_up_evidence_capture');
  });

  it('generates a deep link containing a safely encoded payload', () => {
    const handoff = makeHandoff();
    const envelope = buildScanHandoffEnvelopePreview(handoff);

    expect(envelope.deepLinkPreview.startsWith('atlas-scan://follow-up-capture?payload=')).toBe(true);
    expect(envelope.deepLinkPreview.includes(envelope.encodedPayloadPreview)).toBe(true);
    expect(JSON.parse(decodeURIComponent(envelope.encodedPayloadPreview))).toEqual(handoff);
  });

  it('sets dev-only safety flags and disables delivery/persistence', () => {
    const withVisit = buildScanHandoffEnvelopePreview(makeHandoff({ visitReference: 'visit_1' }));
    const withoutVisit = buildScanHandoffEnvelopePreview(makeHandoff({ visitReference: undefined }));

    expect(withVisit.safety.devOnly).toBe(true);
    expect(withVisit.safety.deliveryEnabled).toBe(false);
    expect(withVisit.safety.persistenceEnabled).toBe(false);
    expect(withVisit.safety.containsCustomerData).toBe(true);
    expect(withoutVisit.safety.containsCustomerData).toBe(false);
  });

  it('derives a deterministic envelope id from handoff id', () => {
    const handoff = makeHandoff({ handoffId: 'follow_up_scan_handoff_v1_same' });
    const first = buildScanHandoffEnvelopePreview(handoff, { createdAt: '2026-05-12T00:00:00.000Z' });
    const second = buildScanHandoffEnvelopePreview(handoff, { createdAt: '2026-05-12T08:00:00.000Z' });
    const third = buildScanHandoffEnvelopePreview(makeHandoff({ handoffId: 'follow_up_scan_handoff_v1_other' }));

    expect(first.envelopeId).toBe(second.envelopeId);
    expect(first.envelopeId).not.toBe(third.envelopeId);
  });

  it('does not include any native send action fields', () => {
    const envelope = buildScanHandoffEnvelopePreview(makeHandoff());
    const raw = envelope as unknown as Record<string, unknown>;

    expect(raw['nativeSendAction']).toBeUndefined();
    expect(raw['sendAction']).toBeUndefined();
  });
});

