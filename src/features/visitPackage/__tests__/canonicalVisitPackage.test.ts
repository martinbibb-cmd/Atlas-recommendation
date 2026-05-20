import { describe, expect, it } from 'vitest';
import {
  CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM,
  CANONICAL_VISIT_PACKAGE_SCHEMA,
  CANONICAL_VISIT_PACKAGE_VERSION,
  buildCanonicalVisitPackage,
  parseCanonicalVisitPackage,
  serialiseCanonicalVisitPackage,
  validateCanonicalVisitPackage,
} from '..';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

function makePackage() {
  const customerJourneyPack = buildCustomerJourneyPack({
    selectedSectionIds: [],
    recommendationSummary: 'System boiler with cylinder: Best fit for this home',
    customerFacts: ['3-person household', '2 bathrooms'],
    journeyType: 'open_vented',
  });
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-001',
        visitReference: 'REF-001',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
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
        photoRefs: ['photo-1.jpg'],
      },
      engineInputSnapshot: {
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
          portal: { generated: true, generatedAt: '2026-05-20T10:01:00.000Z' },
          pdf: { generated: false },
          customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
            customerJourneyPack,
            generatedAt: '2026-05-20T10:01:00.000Z',
          }),
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
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

describe('CanonicalVisitPackageV1', () => {
  it('builds package with canonical schema and version', () => {
    const pkg = makePackage();
    expect(pkg.schema).toBe(CANONICAL_VISIT_PACKAGE_SCHEMA);
    expect(pkg.version).toBe(CANONICAL_VISIT_PACKAGE_VERSION);
    expect(pkg.packageIntegrity?.algorithm).toBe(CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM);
    expect(pkg.packageIntegrity?.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('roundtrips through save/load JSON parse', () => {
    const original = makePackage();
    const json = serialiseCanonicalVisitPackage(original);
    const parsed = parseCanonicalVisitPackage(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.pkg).toEqual(original);
    expect(parsed.integrity.status).toBe('verified');
  });

  it('validates a pre-parsed package object', () => {
    const pkg = makePackage();
    const validated = validateCanonicalVisitPackage(pkg);

    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.integrity.status).toBe('verified');
  });

  it('preserves customer journey pack metadata in generated outputs', () => {
    const pkg = makePackage();
    expect(pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.generated).toBe(true);
    expect(pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.schema).toBe('atlas.customer-journey-pack');
    expect(pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.version).toBe('1.0');
    expect(pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.status).toBe('packaged');
  });

  it('rejects invalid schema', () => {
    const pkg = makePackage();
    const invalid = {
      ...pkg,
      schema: 'atlas.invalid-package',
    };

    const validated = validateCanonicalVisitPackage(invalid);
    expect(validated.ok).toBe(false);
  });

  it('rejects missing visit identity fields', () => {
    const pkg = makePackage();
    const invalid = {
      ...pkg,
      visitIdentity: {},
    };

    const validated = validateCanonicalVisitPackage(invalid);
    expect(validated.ok).toBe(false);
  });

  it('rejects malformed JSON input', () => {
    const parsed = parseCanonicalVisitPackage('{invalid json');
    expect(parsed.ok).toBe(false);
  });

  it('warns when package contents change after export', () => {
    const pkg = makePackage();
    const tampered = {
      ...pkg,
      surveyDraft: {
        ...pkg.surveyDraft,
        occupancyCount: 4,
      },
    };

    const validated = validateCanonicalVisitPackage(tampered);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.integrity.status).toBe('modified');
    expect(validated.integrity.warnings[0]).toMatch(/changed after export/i);
  });

  it('treats missing integrity metadata as legacy and unverified', () => {
    const pkg = makePackage();
    const legacyPackage = { ...pkg };
    delete (legacyPackage as { packageIntegrity?: unknown }).packageIntegrity;

    const validated = validateCanonicalVisitPackage(legacyPackage);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.integrity.status).toBe('unverified');
    expect(validated.integrity.warnings[0]).toMatch(/legacy\/unverified/i);
  });
});
