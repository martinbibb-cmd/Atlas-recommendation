import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildPersistedAtlasVisitV2,
  saveVisitAtomically,
  readPersistedAtlasVisitV2,
} from '../persistedAtlasVisitV2';
import type { PersistedAtlasVisitV2 } from '../persistedAtlasVisitV2';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { createEmptyGeneratedOutputs } from '../visitReviewLifecycle';

function makeVisit(visitId = 'visit_test_1'): PersistedAtlasVisitV2 {
  return buildPersistedAtlasVisitV2({
    visitId,
    visitReference: visitId.slice(-8).toUpperCase(),
    updatedAt: '2026-05-08T10:00:00.000Z',
    survey: {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 2,
      buildingMass: 'medium',
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      radiatorCount: 10,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      bathroomCount: 1,
      occupancySignature: 'professional',
      highOccupancy: false,
      preferCombi: true,
    },
    lifecycleState: 'survey_in_progress',
    generatedOutputs: createEmptyGeneratedOutputs(),
  });
}

describe('persistedAtlasVisitV2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('visit survives reload after survey completion (save then read)', () => {
    const visit = makeVisit('visit_reload_ok');
    saveVisitAtomically(visit);

    const restored = readPersistedAtlasVisitV2('visit_reload_ok');
    expect(restored.visit?.visitId).toBe('visit_reload_ok');
    expect(restored.restoredFromTemp).toBe(false);
    expect(restored.schemaMismatch).toBe(false);
  });

  it('recovers a valid *_tmp envelope on boot and promotes it to main key', () => {
    const visit = makeVisit('visit_tmp_recover');
    localStorage.setItem('atlas_visit_visit_tmp_recover_tmp', JSON.stringify(visit));

    const restored = readPersistedAtlasVisitV2('visit_tmp_recover');
    expect(restored.visit?.visitId).toBe('visit_tmp_recover');
    expect(restored.restoredFromTemp).toBe(true);
    expect(localStorage.getItem('atlas_visit_visit_tmp_recover')).not.toBeNull();
    expect(localStorage.getItem('atlas_visit_visit_tmp_recover_tmp')).toBeNull();
  });

  it('flags schema mismatch instead of silently discarding', () => {
    localStorage.setItem(
      'atlas_visit_visit_schema_warn',
      JSON.stringify({ schemaVersion: 1, visitId: 'visit_schema_warn', updatedAt: '2026-05-08', survey: {} }),
    );

    const restored = readPersistedAtlasVisitV2('visit_schema_warn');
    expect(restored.visit).toBeNull();
    expect(restored.schemaMismatch).toBe(true);
  });

  it('persists lifecycle state and generated outputs registry', () => {
    const visit = makeVisit('visit_outputs');
    const now = '2026-05-10T10:00:00.000Z';
    visit.lifecycleState = 'presentation_ready';
    visit.generatedOutputs = {
      ...createEmptyGeneratedOutputs(),
      portal: {
        generated: true,
        generatedAt: now,
        url: 'https://atlas.test/portal/demo?token=abc',
        version: '1.0',
        renderer: 'library_customer_portal',
      },
      pdf: {
        generated: true,
        generatedAt: now,
        documentId: 'pdf_demo_1',
        version: '1.0',
      },
    };
    saveVisitAtomically(visit);

    const restored = readPersistedAtlasVisitV2('visit_outputs');
    expect(restored.visit?.lifecycleState).toBe('presentation_ready');
    expect(restored.visit?.generatedOutputs?.portal.generated).toBe(true);
    expect(restored.visit?.generatedOutputs?.portal.renderer).toBe('library_customer_portal');
    expect(restored.visit?.generatedOutputs?.pdf.generated).toBe(true);
  });

  it('normalizes missing lifecycle/output fields from legacy schemaVersion 2 payloads', () => {
    localStorage.setItem(
      'atlas_visit_visit_legacy_fields',
      JSON.stringify({
        schemaVersion: 2,
        visitId: 'visit_legacy_fields',
        updatedAt: '2026-05-08T10:00:00.000Z',
        survey: { postcode: 'SW1A 1AA' },
      }),
    );
    const restored = readPersistedAtlasVisitV2('visit_legacy_fields');
    expect(restored.visit?.lifecycleState).toBe('survey_in_progress');
    expect(restored.visit?.generatedOutputs?.portal.generated).toBe(false);
    expect(restored.visit?.generatedOutputs?.pdf.generated).toBe(false);
  });

  it('restores engineInputSnapshot from canonical when absent in flat fields', () => {
    const canonicalEngineInput = {
      postcode: 'EC1A 1BB',
      bathroomCount: 2,
      occupancyCount: 4,
    } as unknown as EngineInputV2_3;

    // Payload has a valid canonical.engineInputSnapshot but no top-level engineInputSnapshot.
    const rawPayload = {
      schemaVersion: 2,
      visitId: 'visit_ei_canonical',
      updatedAt: '2026-05-12T09:00:00.000Z',
      survey: { postcode: 'EC1A 1BB' },
      canonical: {
        schemaVersion: '1.0',
        visitIdentity: { visitId: 'visit_ei_canonical', updatedAt: '2026-05-12T09:00:00.000Z' },
        surveyDraftInput: { postcode: 'EC1A 1BB' },
        engineInputSnapshot: canonicalEngineInput,
      },
    };

    localStorage.setItem('atlas_visit_visit_ei_canonical', JSON.stringify(rawPayload));
    const restored = readPersistedAtlasVisitV2('visit_ei_canonical');
    expect(restored.visit).not.toBeNull();
    const restoredInput = restored.visit?.engineInputSnapshot as { occupancyCount?: number; bathroomCount?: number } | undefined;
    expect(restoredInput?.occupancyCount).toBe(4);
    expect(restoredInput?.bathroomCount).toBe(2);
  });

  it('restores generatedOutputs and portalVisitContext from canonical when absent in flat fields', () => {
    const now = '2026-05-12T10:00:00.000Z';

    // Payload omits flat generatedOutputs and portalVisitContext; values live only in canonical.
    const rawPayload = {
      schemaVersion: 2,
      visitId: 'visit_portal_canonical',
      updatedAt: now,
      survey: { postcode: 'W1A 0AX' },
      canonical: {
        schemaVersion: '1.0',
        visitIdentity: { visitId: 'visit_portal_canonical', updatedAt: now },
        surveyDraftInput: { postcode: 'W1A 0AX' },
        presentationHandoff: {
          lifecycleState: 'outputs_generated',
          generatedOutputs: {
            portal: {
              generated: true,
              generatedAt: now,
              url: 'https://atlas.test/portal/demo?token=canonical',
              version: '1.0',
              renderer: 'library_customer_portal',
            },
            pdf: { generated: false },
          },
          portalVisitContext: {
            addressSummary: '1 Canonical Road',
            personalDataMode: 'customer_safe',
          },
        },
      },
    };

    localStorage.setItem('atlas_visit_visit_portal_canonical', JSON.stringify(rawPayload));
    const restored = readPersistedAtlasVisitV2('visit_portal_canonical');
    expect(restored.visit).not.toBeNull();
    expect(restored.visit?.generatedOutputs?.portal.generated).toBe(true);
    expect(restored.visit?.generatedOutputs?.portal.url).toBe('https://atlas.test/portal/demo?token=canonical');
    expect(restored.visit?.generatedOutputs?.portal.renderer).toBe('library_customer_portal');
    expect(restored.visit?.portalVisitContext?.addressSummary).toBe('1 Canonical Road');
    expect(restored.visit?.lifecycleState).toBe('presentation_ready');
  });

  it('persists canonical payload slices for visit identity, survey, recommendation, and handoff', () => {
    const visit = buildPersistedAtlasVisitV2({
      visitId: 'visit_canonical_1',
      visitReference: 'CANON001',
      updatedAt: '2026-05-12T08:30:00.000Z',
      survey: { postcode: 'SW1A 1AA' },
      engineInputSnapshot: {
        postcode: 'SW1A 1AA',
        bathroomCount: 1,
        occupancyCount: 3,
      } as unknown as EngineInputV2_3,
      acceptedScenarioId: 'scenario_mixergy_upgrade',
      lifecycleState: 'presentation_ready',
      generatedOutputs: {
        ...createEmptyGeneratedOutputs(),
        portal: {
          generated: true,
          generatedAt: '2026-05-12T08:30:00.000Z',
          url: 'https://atlas.test/portal/demo',
          renderer: 'library_customer_portal',
        },
      },
      portalVisitContext: {
        addressSummary: '1 Test Street',
        personalDataMode: 'customer_safe',
      },
    });

    saveVisitAtomically(visit);
    const restored = readPersistedAtlasVisitV2('visit_canonical_1');

    expect(restored.visit?.engineInputSnapshot?.occupancyCount).toBe(3);
    expect(restored.visit?.canonical?.visitIdentity.visitId).toBe('visit_canonical_1');
    expect(restored.visit?.canonical?.surveyDraftInput.postcode).toBe('SW1A 1AA');
    expect(restored.visit?.canonical?.recommendationResult?.selectedRecommendationId).toBe('scenario_mixergy_upgrade');
    expect(restored.visit?.canonical?.presentationHandoff?.portalVisitContext?.addressSummary).toBe('1 Test Street');
    expect(restored.visit?.canonical?.saveExportStatus?.lastSavedAt).toBe('2026-05-12T08:30:00.000Z');
  });
});
