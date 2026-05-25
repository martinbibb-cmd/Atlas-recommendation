import { describe, expect, it } from 'vitest';
import {
  PORTAL_LAUNCH_PAYLOAD_SCHEMA,
  PORTAL_LAUNCH_PAYLOAD_VERSION,
  buildPortalLaunchPayload,
  parsePortalLaunchPayload,
  validatePortalLaunchPayload,
} from '..';
import { buildCanonicalVisitPackage } from '../../visitPackage/buildCanonicalVisitPackage';
import type { CanonicalVisitPackageV1 } from '../../visitPackage/CanonicalVisitPackageV1';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';
import {
  renderVisitPackagePdfDocument,
  parseCanonicalVisitPackageFromPdfEnvelope,
} from '../../visitPackage/visitPackagePdfEnvelopeTransport';
import { buildVisitPackagePdfEnvelope } from '../../visitPackage/buildVisitPackagePdfEnvelope';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makePackageWithJourneyPack(): CanonicalVisitPackageV1 {
  const customerJourneyPack = buildCustomerJourneyPack({
    selectedSectionIds: [],
    recommendationSummary: 'System boiler with cylinder: Best fit for this home',
    customerFacts: ['3-person household', '2 bathrooms'],
    journeyType: 'open_vented',
  });
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-launch-001',
        visitReference: 'REF-LAUNCH-001',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
        brandId: 'atlas-default',
      },
      customerPropertyDetails: {
        propertyFacts: ['2 bathrooms'],
        usageFacts: ['3-person household'],
        portalVisitContext: {
          addressSummary: '10 Downing St, London',
          personalDataMode: 'address_visible',
        },
      },
      surveyDraft: {
        postcode: 'SW1A 1AA',
        occupancyCount: 3,
        bathroomCount: 2,
      } as never,
      proposalTruth: {
        selectedScenarioId: 'system_unvented_cylinder',
      },
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: true, generatedAt: '2026-05-20T10:01:00.000Z', url: 'https://portal.example.com/portal/ref-001', snapshotId: 'snapshot-001' },
          pdf: { generated: false },
          customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
            customerJourneyPack,
            generatedAt: '2026-05-20T10:01:00.000Z',
            snapshotId: 'snapshot-001',
          }),
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      },
      recommendationAuthority: {
        snapshotId: 'snapshot-001',
        createdAt: '2026-05-20T10:01:00.000Z',
        sourceVisitRevision: '2026-05-20T10:01:00.000Z',
        checksum: 'fnv1a32-portaltest001',
      },
      importExportMetadata: {
        exportedAt: '2026-05-20T10:02:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
        recommendationSnapshot: {
          snapshotId: 'snapshot-001',
          createdAt: '2026-05-20T10:01:00.000Z',
          sourceVisitRevision: '2026-05-20T10:01:00.000Z',
          checksum: 'fnv1a32-portaltest001',
        },
      },
    },
  });
}

function makePackageWithoutJourneyPack(): CanonicalVisitPackageV1 {
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-old-001',
        visitReference: 'REF-OLD-001',
        updatedAt: '2026-05-19T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
        brandId: 'atlas-default',
      },
      customerPropertyDetails: {
        propertyFacts: ['1 bathroom'],
        usageFacts: ['2-person household'],
      },
      surveyDraft: {
        postcode: 'EC1A 1BB',
        occupancyCount: 2,
        bathroomCount: 1,
      } as never,
      proposalTruth: {
        selectedScenarioId: 'combi',
      },
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: false },
          pdf: { generated: false },
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      },
      importExportMetadata: {
        exportedAt: '2026-05-19T09:00:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
      },
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortalLaunchPayloadV1 — roundtrip', () => {
  it('builds payload with canonical schema and version', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.schema).toBe(PORTAL_LAUNCH_PAYLOAD_SCHEMA);
    expect(payload.version).toBe(PORTAL_LAUNCH_PAYLOAD_VERSION);
  });

  it('roundtrips through JSON serialise/parse with schema intact', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const json = JSON.stringify(payload);
    const parsed = parsePortalLaunchPayload(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.payload.schema).toBe(PORTAL_LAUNCH_PAYLOAD_SCHEMA);
    expect(parsed.payload.version).toBe(PORTAL_LAUNCH_PAYLOAD_VERSION);
    expect(parsed.payload.visitIdentity.visitId).toBe('visit-launch-001');
    expect(parsed.payload.hasCustomerJourneyPack).toBe(true);
    expect(parsed.payload.rebuildRequired).toBe(false);
  });

  it('roundtrips payload object directly via validatePortalLaunchPayload', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const validated = validatePortalLaunchPayload(payload);

    expect(validated.ok).toBe(true);
  });

  it('preserves customerJourneyPack schema and version through roundtrip', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const json = JSON.stringify(payload);
    const parsed = parsePortalLaunchPayload(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.payload.customerJourneyPack?.schema).toBe('atlas.customer-journey-pack');
    expect(parsed.payload.customerJourneyPack?.version).toBe('1.0');
  });

  it('preserves portalVisitContext address through roundtrip', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const json = JSON.stringify(payload);
    const parsed = parsePortalLaunchPayload(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.payload.portalVisitContext?.addressSummary).toBe('10 Downing St, London');
    expect(parsed.payload.portalVisitContext?.personalDataMode).toBe('address_visible');
  });
});

describe('PortalLaunchPayloadV1 — missing customerJourneyPack shows safe fallback/rebuild warning', () => {
  it('sets hasCustomerJourneyPack=false when pack is absent', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.hasCustomerJourneyPack).toBe(false);
    expect(payload.customerJourneyPack).toBeUndefined();
  });

  it('sets rebuildRequired=true when pack is absent', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.rebuildRequired).toBe(true);
  });

  it('provides a non-empty rebuildWarning when pack is absent', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(typeof payload.rebuildWarning).toBe('string');
    expect((payload.rebuildWarning ?? '').length).toBeGreaterThan(10);
  });

  it('sets rebuildRequired=false and no warning when pack is present', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.rebuildRequired).toBe(false);
    expect(payload.rebuildWarning).toBeUndefined();
  });

  it('still builds a valid payload even without customerJourneyPack', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const validated = validatePortalLaunchPayload(payload);
    expect(validated.ok).toBe(true);
  });

  it('blocks packaged portal launch when journey artifact snapshot is stale', () => {
    const pkg = makePackageWithJourneyPack();
    const stalePkg = buildCanonicalVisitPackage({
      packageData: {
        ...pkg,
        recommendationAuthority: {
          snapshotId: 'snapshot-active',
          createdAt: '2026-05-20T10:02:00.000Z',
          sourceVisitRevision: '2026-05-20T10:02:00.000Z',
          checksum: 'fnv1a32-active',
        },
        importExportMetadata: {
          ...pkg.importExportMetadata,
          recommendationSnapshot: {
            snapshotId: 'snapshot-active',
            createdAt: '2026-05-20T10:02:00.000Z',
            sourceVisitRevision: '2026-05-20T10:02:00.000Z',
            checksum: 'fnv1a32-active',
          },
        },
        generatedOutputStatus: {
          ...pkg.generatedOutputStatus,
          generatedOutputs: {
            ...pkg.generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: {
              ...pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack,
              generated: true,
              snapshotId: 'snapshot-stale',
            },
          },
        },
      },
    });
    const payload = buildPortalLaunchPayload(stalePkg);
    expect(payload.generatedOutputMetadata.staleSnapshotBlocked).toBe(true);
    expect(payload.hasCustomerJourneyPack).toBe(false);
    expect(payload.rebuildRequired).toBe(true);
  });
});

describe('PortalLaunchPayloadV1 — imported PDF can hydrate portal launch context', () => {
  it('preserves selectedScenarioId from the canonical package', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.selectedScenarioId).toBe('system_unvented_cylinder');
  });

  it('preserves visit identity from the canonical package', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.visitIdentity.visitId).toBe('visit-launch-001');
    expect(payload.visitIdentity.visitReference).toBe('REF-LAUNCH-001');
  });

  it('does not trust portal URLs packaged inside imported artifacts', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.generatedOutputMetadata.hasPortalUrl).toBe(false);
    expect(payload.generatedOutputMetadata.portalUrl).toBeUndefined();
  });

  it('exposes lifecycle state from the source package', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.generatedOutputMetadata.lifecycleState).toBe('recommendation_ready');
  });

  it('can build portal launch payload from a package extracted from a PDF envelope', () => {
    const pkg = makePackageWithJourneyPack();
    const envelope = buildVisitPackagePdfEnvelope({
      packagePayload: pkg,
    });
    const pdfText = renderVisitPackagePdfDocument(envelope);
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdfText);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const payload = buildPortalLaunchPayload(parsed.pkg);
    expect(payload.hasCustomerJourneyPack).toBe(true);
    expect(payload.visitIdentity.visitId).toBe('visit-launch-001');
    expect(payload.schema).toBe(PORTAL_LAUNCH_PAYLOAD_SCHEMA);
  });

  it('missing portalVisitContext in package leaves portalVisitContext undefined in payload', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.portalVisitContext).toBeUndefined();
  });

  it('no portal URL in package leaves hasPortalUrl=false', () => {
    const pkg = makePackageWithoutJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    expect(payload.generatedOutputMetadata.hasPortalUrl).toBe(false);
    expect(payload.generatedOutputMetadata.portalUrl).toBeUndefined();
  });
});

describe('PortalLaunchPayloadV1 — portal refuses malformed package payload', () => {
  it('rejects non-object input', () => {
    const result = validatePortalLaunchPayload('not an object');
    expect(result.ok).toBe(false);
  });

  it('rejects null input', () => {
    const result = validatePortalLaunchPayload(null);
    expect(result.ok).toBe(false);
  });

  it('rejects wrong schema', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const invalid = { ...payload, schema: 'atlas.wrong-schema' };
    const result = validatePortalLaunchPayload(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Schema mismatch/);
  });

  it('rejects wrong version', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const invalid = { ...payload, version: '9.9' };
    const result = validatePortalLaunchPayload(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Version mismatch/);
  });

  it('rejects missing visitIdentity', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const { visitIdentity: _vi, ...withoutIdentity } = payload;
    const result = validatePortalLaunchPayload(withoutIdentity);
    expect(result.ok).toBe(false);
  });

  it('rejects non-boolean hasCustomerJourneyPack', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const invalid = { ...payload, hasCustomerJourneyPack: 'yes' };
    const result = validatePortalLaunchPayload(invalid);
    expect(result.ok).toBe(false);
  });

  it('rejects non-boolean rebuildRequired', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const invalid = { ...payload, rebuildRequired: 1 };
    const result = validatePortalLaunchPayload(invalid);
    expect(result.ok).toBe(false);
  });

  it('rejects missing generatedOutputMetadata', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const { generatedOutputMetadata: _gom, ...withoutMeta } = payload;
    const result = validatePortalLaunchPayload(withoutMeta);
    expect(result.ok).toBe(false);
  });

  it('rejects missing builtAt', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const { builtAt: _ba, ...withoutBuiltAt } = payload;
    const result = validatePortalLaunchPayload(withoutBuiltAt);
    expect(result.ok).toBe(false);
  });

  it('rejects malformed JSON string', () => {
    const result = parsePortalLaunchPayload('{invalid json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/valid JSON/);
  });

  it('accepts valid payload parsed from JSON string', () => {
    const pkg = makePackageWithJourneyPack();
    const payload = buildPortalLaunchPayload(pkg);
    const json = JSON.stringify(payload);
    const result = parsePortalLaunchPayload(json);
    expect(result.ok).toBe(true);
  });
});
