import { describe, expect, it } from 'vitest';
import { buildCanonicalVisitPackage, parseCanonicalVisitPackage, serialiseCanonicalVisitPackage } from '../../visitPackage';
import type { CanonicalVisitPackageV1 } from '../../visitPackage';
import { mergeScanReturnIntoCanonicalVisitPackage, parseScanReturnPayload } from '..';

function makeBasePackage(): CanonicalVisitPackageV1 {
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-merge-001',
        visitReference: 'REF-MERGE-001',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
        brandId: 'atlas-default',
      },
      customerPropertyDetails: {},
      surveyDraft: {
        postcode: 'SW1A 1AA',
        occupancyCount: 3,
        fullSurvey: {
          compareMixergy: false,
        },
      } as never,
      scanEvidenceRefs: {
        schema: 'atlas.scan-evidence-refs',
        version: '1.0',
        photoRefs: ['photo-a'],
        voiceNoteRefs: ['voice-a'],
        roomGeometry: [
          {
            roomId: 'kitchen',
            label: 'Kitchen old',
            areaM2: 12,
            _meta: {
              updatedAt: '2026-05-20T09:00:00.000Z',
              source: 'atlas_scan',
              sessionId: 'sess-old',
            },
          },
        ],
        objectPlacements: [],
        measurements: [],
        captureMetadata: {
          scannerBuild: '1.0.0',
        },
        captureMetadataAttribution: {
          scannerBuild: {
            updatedAt: '2026-05-20T09:00:00.000Z',
            source: 'atlas_scan',
            sessionId: 'sess-old',
          },
        },
        attribution: {
          lastMergedAt: '2026-05-20T09:00:00.000Z',
          lastMergedFrom: 'atlas_scan',
          mergeCount: 1,
          sources: ['atlas_scan'],
        },
      },
      proposalTruth: {
        selectedScenarioId: 'system_unvented_cylinder',
        visitEnvelope: {
          version: '1',
          identity: {
            version: '1',
            envelopeVersion: '1',
            visitId: 'visit-merge-001',
            brandId: 'atlas-default',
            createdAt: '2026-05-20T10:00:00.000Z',
          },
          workspace: {
            workspaceId: 'workspace-1',
            brandId: 'atlas-default',
          },
        },
      } as never,
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: true },
          pdf: { generated: true },
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      } as never,
      importExportMetadata: {
        exportedAt: '2026-05-20T10:05:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
      },
    },
  });
}

describe('Scan return package merge', () => {
  it('merges scan evidence refs using safe append/update semantics', () => {
    const pkg = makeBasePackage();
    const parsedPayload = parseScanReturnPayload({
      schema: 'atlas.scan-return-payload',
      version: '1.0',
      visitIdentity: {
        visitId: 'visit-merge-001',
      },
      returnedAt: '2026-05-20T11:00:00.000Z',
      source: {
        surface: 'atlas_scan',
        sessionId: 'sess-new',
      },
      updates: {
        scanEvidence: {
          photoRefs: ['photo-b'],
          voiceNoteRefs: ['voice-b'],
          captureMetadata: {
            scannerBuild: '1.1.0',
            scanOperator: 'engineer-1',
          },
        },
      },
    });
    expect(parsedPayload.ok).toBe(true);
    if (!parsedPayload.ok) return;

    const merged = mergeScanReturnIntoCanonicalVisitPackage(pkg, parsedPayload.payload);
    const evidence = merged.pkg.scanEvidenceRefs as Record<string, unknown>;
    expect(evidence['photoRefs']).toEqual(['photo-a', 'photo-b']);
    expect(evidence['voiceNoteRefs']).toEqual(['voice-a', 'voice-b']);
    expect((evidence['captureMetadata'] as Record<string, unknown>)['scannerBuild']).toBe('1.1.0');
    expect((evidence['captureMetadata'] as Record<string, unknown>)['scanOperator']).toBe('engineer-1');
  });

  it('updates room geometry from scan return when incoming data is newer', () => {
    const pkg = makeBasePackage();
    const payload = parseScanReturnPayload({
      schema: 'atlas.scan-return-payload',
      version: '1.0',
      visitIdentity: {
        visitId: 'visit-merge-001',
      },
      returnedAt: '2026-05-20T11:00:00.000Z',
      source: {
        surface: 'atlas_scan',
        sessionId: 'sess-new',
      },
      updates: {
        scanEvidence: {
          roomGeometry: [
            {
              roomId: 'kitchen',
              label: 'Kitchen refreshed',
              areaM2: 14.1,
            },
          ],
          objectPlacements: [
            {
              placementId: 'object-1',
              objectType: 'boiler',
              roomId: 'kitchen',
              x: 1.5,
              y: 2.2,
              z: 0.4,
            },
          ],
          measurements: [
            {
              measurementId: 'm-1',
              roomId: 'kitchen',
              label: 'Flue clearance',
              value: 300,
              unit: 'mm',
            },
          ],
        },
      },
    });
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;

    const merged = mergeScanReturnIntoCanonicalVisitPackage(pkg, payload.payload);
    const evidence = merged.pkg.scanEvidenceRefs as Record<string, unknown>;
    const rooms = evidence['roomGeometry'] as Array<Record<string, unknown>>;
    const kitchen = rooms.find((entry) => entry.roomId === 'kitchen');
    expect(kitchen?.label).toBe('Kitchen refreshed');
    expect(kitchen?._meta).toMatchObject({
      updatedAt: '2026-05-20T11:00:00.000Z',
      source: 'atlas_scan',
      sessionId: 'sess-new',
    });
    expect((evidence['objectPlacements'] as unknown[]).length).toBe(1);
    expect((evidence['measurements'] as unknown[]).length).toBe(1);
  });

  it('keeps canonical recommendation truth and generated outputs untouched', () => {
    const pkg = makeBasePackage();
    const payload = parseScanReturnPayload({
      schema: 'atlas.scan-return-payload',
      version: '1.0',
      visitIdentity: {
        visitReference: 'REF-MERGE-001',
      },
      returnedAt: '2026-05-20T11:00:00.000Z',
      source: {
        surface: 'atlas_scan',
      },
      updates: {
        surveyObservations: {
          topLevel: {
            bathroomCount: 2,
          },
          fullSurvey: {
            compareMixergy: true,
          },
        },
      },
    });
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;

    const merged = mergeScanReturnIntoCanonicalVisitPackage(pkg, payload.payload);
    expect(merged.pkg.proposalTruth).toEqual(pkg.proposalTruth);
    expect(merged.pkg.generatedOutputStatus).toEqual(pkg.generatedOutputStatus);
    expect((merged.pkg.surveyDraft as Record<string, unknown>)['bathroomCount']).toBe(2);
    const fullSurvey = (merged.pkg.surveyDraft as Record<string, unknown>)['fullSurvey'] as Record<string, unknown>;
    expect(fullSurvey['compareMixergy']).toBe(true);
  });

  it('records conflicts and preserves newer canonical geometry entries', () => {
    const pkg = makeBasePackage();
    const payload = parseScanReturnPayload({
      schema: 'atlas.scan-return-payload',
      version: '1.0',
      visitIdentity: {
        visitId: 'visit-merge-001',
      },
      returnedAt: '2026-05-20T08:00:00.000Z',
      source: {
        surface: 'atlas_scan',
      },
      updates: {
        scanEvidence: {
          roomGeometry: [
            {
              roomId: 'kitchen',
              label: 'Should not replace',
              areaM2: 99,
            },
          ],
        },
      },
    });
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;

    const merged = mergeScanReturnIntoCanonicalVisitPackage(pkg, payload.payload);
    expect(merged.conflicts.length).toBeGreaterThan(0);
    const evidence = merged.pkg.scanEvidenceRefs as Record<string, unknown>;
    const rooms = evidence['roomGeometry'] as Array<Record<string, unknown>>;
    const kitchen = rooms.find((entry) => entry.roomId === 'kitchen');
    expect(kitchen?.label).toBe('Kitchen old');
  });

  it('keeps package roundtrip valid after scan return merge', () => {
    const pkg = makeBasePackage();
    const payload = parseScanReturnPayload({
      schema: 'atlas.scan-return-payload',
      version: '1.0',
      visitIdentity: {
        visitId: 'visit-merge-001',
      },
      returnedAt: '2026-05-20T11:30:00.000Z',
      source: {
        surface: 'atlas_scan',
        sessionId: 'sess-roundtrip',
      },
      updates: {
        scanEvidence: {
          photoRefs: ['photo-roundtrip'],
          roomGeometry: [{ roomId: 'hall', label: 'Hallway', areaM2: 4 }],
        },
      },
    });
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;

    const merged = mergeScanReturnIntoCanonicalVisitPackage(pkg, payload.payload);
    const serialised = serialiseCanonicalVisitPackage(merged.pkg);
    const parsed = parseCanonicalVisitPackage(serialised);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const evidence = parsed.pkg.scanEvidenceRefs as Record<string, unknown>;
    expect(evidence['photoRefs']).toEqual(['photo-a', 'photo-roundtrip']);
  });
});
