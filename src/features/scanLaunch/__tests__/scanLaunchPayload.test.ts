import { describe, expect, it } from 'vitest';
import {
  SCAN_LAUNCH_PAYLOAD_SCHEMA,
  SCAN_LAUNCH_PAYLOAD_VERSION,
  buildScanLaunchPayload,
  parseScanLaunchPayload,
  prepareScanLaunchRoute,
  validateScanLaunchPayload,
} from '..';
import { buildCanonicalVisitPackage } from '../../visitPackage/buildCanonicalVisitPackage';
import type { CanonicalVisitPackageV1 } from '../../visitPackage/CanonicalVisitPackageV1';
import {
  buildVisitPackagePdfEnvelope,
  parseCanonicalVisitPackageFromPdfEnvelope,
  renderVisitPackagePdfDocument,
} from '../../visitPackage';

function makeCanonicalPackage(): CanonicalVisitPackageV1 {
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-scan-001',
        visitReference: 'REF-SCAN-001',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
        workspaceName: 'Demo Workspace',
        brandId: 'atlas-default',
      },
      customerPropertyDetails: {
        propertyFacts: ['2 bathrooms'],
        usageFacts: ['3-person household'],
      },
      surveyDraft: {
        postcode: 'SW1A 1AA',
        occupancyCount: 3,
        bathroomCount: 2,
      } as never,
      scanEvidenceRefs: {
        photoRefs: ['photo-1'],
        pinRefs: ['pin-1'],
      },
      proposalTruth: {
        selectedScenarioId: 'system_unvented_cylinder',
      },
      importExportMetadata: {
        exportedAt: '2026-05-20T10:02:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
      },
    },
  });
}

describe('ScanLaunchPayloadV1', () => {
  it('build/parse roundtrip preserves schema/version and visit identity', () => {
    const pkg = makeCanonicalPackage();
    const payload = buildScanLaunchPayload(pkg);
    const parsed = parseScanLaunchPayload(JSON.stringify(payload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.schema).toBe(SCAN_LAUNCH_PAYLOAD_SCHEMA);
    expect(parsed.payload.version).toBe(SCAN_LAUNCH_PAYLOAD_VERSION);
    expect(parsed.payload.visitIdentity.visitId).toBe('visit-scan-001');
  });

  it('builds payload from imported PDF package', () => {
    const pkg = makeCanonicalPackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    const pdf = renderVisitPackagePdfDocument(envelope);
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const payload = buildScanLaunchPayload(parsed.pkg);
    expect(payload.visitIdentity.visitReference).toBe('REF-SCAN-001');
    expect(payload.workspaceBrandReference.workspaceId).toBe('workspace-1');
  });

  it('rejects payload when visit identity is missing', () => {
    const payload = buildScanLaunchPayload(makeCanonicalPackage());
    const invalid = {
      ...payload,
      visitIdentity: {
        visitId: '   ',
        visitReference: '',
      },
    };
    const result = validateScanLaunchPayload(invalid);
    expect(result.ok).toBe(false);
  });

  it('preserves scan evidence refs from canonical package', () => {
    const payload = buildScanLaunchPayload(makeCanonicalPackage());
    expect(payload.scanEvidenceRefs).toEqual({
      photoRefs: ['photo-1'],
      pinRefs: ['pin-1'],
    });
  });

  it('keeps recommendation truth out of the Scan payload contract', () => {
    const pkg = makeCanonicalPackage();
    const payload = buildScanLaunchPayload(pkg) as unknown as Record<string, unknown>;
    expect(payload['proposalTruth']).toBeUndefined();
    expect(pkg.proposalTruth?.selectedScenarioId).toBe('system_unvented_cylinder');
  });

  it('prepares a deep-link route carrying encoded scan launch payload', () => {
    const payload = buildScanLaunchPayload(makeCanonicalPackage());
    const prepared = prepareScanLaunchRoute(payload);
    expect(prepared.route).toBe('visit-launch');
    expect(prepared.deepLink.startsWith('atlas-scan://visit-launch?payload=')).toBe(true);
    expect(prepared.encodedPayload.length).toBeGreaterThan(10);
  });
});
