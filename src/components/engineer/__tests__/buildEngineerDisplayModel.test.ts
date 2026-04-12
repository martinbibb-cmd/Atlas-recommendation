/**
 * buildEngineerDisplayModel.test.ts
 *
 * PR11 — Unit tests for the engineer display model selector.
 *
 * Coverage:
 *   - Returns null when no engine output is present
 *   - Builds a complete model from a canonical payload
 *   - Derives current system label from atlasProperty.currentSystem.family
 *   - Derives recommended system label from engine output viable option
 *   - captureSummary reflects atlasProperty evidence counts
 *   - keyComponents are extracted from building.systemComponents
 *   - knowledgeSummary reflects field value confidence
 *   - requiredWork is derived from engine option constraints + install constraints
 *   - warnings.missingCritical contains entries when currentSystem is unknown
 *   - evidence counts reflect EvidenceModelV1 arrays
 *   - Gracefully handles missing atlasProperty (legacy payload fallback)
 */

import { describe, it, expect } from 'vitest';
import { buildEngineerDisplayModel } from '../selectors/buildEngineerDisplayModel';
import type { VisitMeta } from '../../../lib/visits/visitApi';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVisitMeta(overrides: Partial<VisitMeta> = {}): VisitMeta {
  return {
    id:              'visit-abc',
    created_at:      '2024-01-01T00:00:00Z',
    updated_at:      '2024-01-02T00:00:00Z',
    status:          'recommendation_ready',
    customer_name:   'Test Customer',
    address_line_1:  '12 Test Street',
    postcode:        'SW1A 1AA',
    current_step:    'complete',
    visit_reference: 'JOB-001',
    ...overrides,
  };
}

function makeMinimalEngineOutput() {
  return {
    options: [
      { id: 'stored_unvented', status: 'viable', constraints: [] },
      { id: 'combi', status: 'not_viable', constraints: [] },
    ],
  };
}

function makeCanonicalPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '2.0',
    atlasProperty: {
      version:    '1.0',
      propertyId: 'prop-1',
      visitId:    'visit-abc',
      createdAt:  '2024-01-01T00:00:00Z',
      updatedAt:  '2024-01-02T00:00:00Z',
      status:     'report_ready',
      sourceApps: ['atlas_mind'],
      property: {
        address1: '12 Test Street',
        town:     'London',
        postcode: 'SW1A 1AA',
      },
      capture: {},
      building: {
        floors:           [],
        rooms:            [{ roomId: 'r1', floorId: 'f1', label: 'Kitchen' }],
        zones:            [],
        boundaries:       [],
        openings:         [],
        emitters:         [],
        systemComponents: [
          { componentId: 'c1', category: 'boiler', label: 'Worcester 30i', roomId: 'r1' },
          { componentId: 'c2', category: 'flue',   label: 'Flue terminal' },
        ],
        pipeRoutes: [],
      },
      household: {
        composition: {
          adultCount: { value: 2, confidence: 'high', source: 'engineer' },
        },
        occupancyPattern: { value: 'occupied_daytime', confidence: 'medium', source: 'customer' },
      },
      currentSystem: {
        family:    { value: 'combi', confidence: 'high', source: 'engineer' },
        heatSource: {
          ratedOutputKw: { value: 30, confidence: 'high', source: 'engineer' },
          installYear:   { value: 2015, confidence: 'medium', source: 'engineer' },
        },
      },
      evidence: {
        photos:     [{ photoId: 'p1', capturedAt: '2024-01-01T10:00:00Z' }],
        voiceNotes: [{ voiceNoteId: 'vn1', capturedAt: '2024-01-01T10:00:00Z', durationSeconds: 15 }],
        textNotes:  [],
        qaFlags:    [],
        events:     [{ eventId: 'ev1', occurredAt: '2024-01-01T09:00:00Z', type: 'session_started' }],
      },
    },
    engineRun: {
      engineOutput: makeMinimalEngineOutput(),
    },
    presentationState: null,
    decisionSynthesis:  null,
    ...overrides,
  };
}

function makeLegacyPayload() {
  return {
    engineOutput: makeMinimalEngineOutput(),
    surveyData: {
      postcode:      'SW1A 1AA',
      bathroomCount: 1,
      occupancyCount: 3,
    },
  };
}

// ─── null when no engine output ────────────────────────────────────────────────

describe('buildEngineerDisplayModel — null cases', () => {
  it('returns null when payload is null', () => {
    expect(buildEngineerDisplayModel(null, makeVisitMeta(), 'v1')).toBeNull();
  });

  it('returns null when payload has no engine output', () => {
    const payload = { schemaVersion: '2.0', atlasProperty: {}, engineRun: {} };
    expect(buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1')).toBeNull();
  });
});

// ─── canonical payload ────────────────────────────────────────────────────────

describe('buildEngineerDisplayModel — canonical payload', () => {
  it('builds a display model from a canonical payload', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model).not.toBeNull();
    expect(model!.visitId).toBe('visit-abc');
  });

  it('derives title from atlasProperty.property address', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.title).toContain('12 Test Street');
  });

  it('includes visitReference from VisitMeta', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.visitReference).toBe('JOB-001');
  });

  it('derives statusLabel from VisitMeta.status', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.statusLabel).toBe('Recommendation ready');
  });

  it('derives currentSystem label from atlasProperty.currentSystem.family', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.currentSystem).toBe('Combi boiler');
  });

  it('derives recommendedSystem label from engine output viable option', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    // stored_unvented maps to the system registry label
    expect(model!.recommendedSystem).toMatch(/stored|unvented|mains/i);
  });

  it('captureSummary.roomCount reflects building.rooms', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.captureSummary.roomCount).toBe(1);
  });

  it('captureSummary.photoCount reflects evidence.photos', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.captureSummary.photoCount).toBe(1);
  });

  it('captureSummary.voiceNoteCount reflects evidence.voiceNotes', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.captureSummary.voiceNoteCount).toBe(1);
  });

  it('captureSummary.objectCount reflects building.systemComponents', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.captureSummary.objectCount).toBe(2);
  });

  it('keyComponents includes boiler from systemComponents', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    const boiler = model!.keyComponents.find(c => c.type === 'boiler');
    expect(boiler).toBeDefined();
    expect(boiler!.label).toBe('Worcester 30i');
  });

  it('keyComponent roomLabel is resolved from rooms array', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    const boiler = model!.keyComponents.find(c => c.type === 'boiler');
    expect(boiler!.roomLabel).toBe('Kitchen');
  });

  it('flue component appears in keyComponents', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    const flue = model!.keyComponents.find(c => c.type === 'flue');
    expect(flue).toBeDefined();
  });

  it('knowledgeSummary.currentSystem is confirmed when family has high confidence', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.knowledgeSummary.currentSystem).toBe('confirmed');
  });

  it('knowledgeSummary.household is confirmed when adultCount has high confidence', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.knowledgeSummary.household).toBe('confirmed');
  });

  it('evidence counts match atlasProperty.evidence arrays', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    expect(model!.evidence.photos).toBe(1);
    expect(model!.evidence.voiceNotes).toBe(1);
    expect(model!.evidence.textNotes).toBe(0);
    expect(model!.evidence.qaFlags).toBe(0);
    expect(model!.evidence.timelineEvents).toBe(1);
  });
});

// ─── missing evidence ─────────────────────────────────────────────────────────

describe('buildEngineerDisplayModel — missing / incomplete data', () => {
  it('knowledgeSummary.currentSystem is missing when family is absent', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        currentSystem: { family: { value: null } },
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    expect(model!.knowledgeSummary.currentSystem).toBe('missing');
  });

  it('knowledgeSummary.currentSystem is review when family is "unknown"', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        currentSystem: { family: { value: 'unknown', confidence: 'high', source: 'engineer' } },
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    expect(model!.knowledgeSummary.currentSystem).toBe('review');
  });

  it('warnings.missingCritical contains entry when currentSystem is missing', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        currentSystem: { family: { value: null } },
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    expect(model!.warnings.missingCritical.length).toBeGreaterThan(0);
  });

  it('captureSummary zeros when atlasProperty has no evidence', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        evidence: { photos: [], voiceNotes: [], textNotes: [], qaFlags: [], events: [] },
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    expect(model!.captureSummary.photoCount).toBe(0);
    expect(model!.captureSummary.voiceNoteCount).toBe(0);
  });

  it('title falls back to visitReference when no canonical address', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        property: {},
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta({ visit_reference: 'JOB-999' }), 'v1');
    expect(model!.title).toBe('JOB-999');
  });
});

// ─── required work derivation ─────────────────────────────────────────────────

describe('buildEngineerDisplayModel — requiredWork derivation', () => {
  it('requiredWork includes Install item from engine viable option', () => {
    const model = buildEngineerDisplayModel(makeCanonicalPayload(), makeVisitMeta(), 'visit-abc');
    const installItem = model!.requiredWork.find(w => w.reason.includes('Primary recommendation'));
    expect(installItem).toBeDefined();
    expect(installItem!.severity).toBe('required');
  });

  it('requiredWork includes engine constraint items when present', () => {
    const payload = makeCanonicalPayload();
    // Add constraint to viable option
    (payload.engineRun.engineOutput.options[0] as Record<string, unknown>).constraints = [
      { id: 'c1', label: 'Pipework upgrade required', severity: 'warn' },
    ];
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    const constraintItem = model!.requiredWork.find(w => w.title === 'Pipework upgrade required');
    expect(constraintItem).toBeDefined();
    expect(constraintItem!.severity).toBe('recommended');
  });

  it('requiredWork includes canonical install constraints', () => {
    const payload = makeCanonicalPayload({
      atlasProperty: {
        ...(makeCanonicalPayload().atlasProperty as object),
        currentSystem: {
          family: { value: 'combi', confidence: 'high', source: 'engineer' },
          constraints: [
            { code: 'IC001', description: 'Access restricted — scaffolding required', severity: 'significant' },
          ],
        },
      },
    });
    const model = buildEngineerDisplayModel(payload, makeVisitMeta(), 'v1');
    const constraint = model!.requiredWork.find(w => w.title.includes('scaffolding'));
    expect(constraint).toBeDefined();
    expect(constraint!.severity).toBe('recommended');
  });
});

// ─── legacy payload fallback ──────────────────────────────────────────────────

describe('buildEngineerDisplayModel — legacy payload', () => {
  it('builds a model from a legacy payload using engine output', () => {
    const model = buildEngineerDisplayModel(makeLegacyPayload(), makeVisitMeta(), 'v1');
    expect(model).not.toBeNull();
    expect(model!.visitId).toBe('v1');
  });

  it('legacy model recommendedSystem is derived from engine options', () => {
    const model = buildEngineerDisplayModel(makeLegacyPayload(), makeVisitMeta(), 'v1');
    expect(model!.recommendedSystem).toBeDefined();
  });
});
