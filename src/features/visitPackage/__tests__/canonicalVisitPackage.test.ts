import { describe, expect, it } from 'vitest';
import {
  CANONICAL_VISIT_PACKAGE_SCHEMA,
  CANONICAL_VISIT_PACKAGE_VERSION,
  buildCanonicalVisitPackage,
  parseCanonicalVisitPackage,
  serialiseCanonicalVisitPackage,
  validateCanonicalVisitPackage,
} from '..';

function makePackage() {
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
  });

  it('roundtrips through save/load JSON parse', () => {
    const original = makePackage();
    const json = serialiseCanonicalVisitPackage(original);
    const parsed = parseCanonicalVisitPackage(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.pkg).toEqual(original);
  });

  it('validates a pre-parsed package object', () => {
    const pkg = makePackage();
    const validated = validateCanonicalVisitPackage(pkg);

    expect(validated.ok).toBe(true);
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
});
