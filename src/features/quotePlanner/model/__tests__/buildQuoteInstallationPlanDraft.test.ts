/**
 * buildQuoteInstallationPlanDraft.test.ts
 *
 * Unit tests for buildQuoteInstallationPlanDraft.
 *
 * Acceptance criteria from the problem statement:
 *   - Empty data builds a valid draft with unknowns.
 *   - Recommendation seeds proposedSystem.
 *   - Scan candidate location imports with confidence preserved.
 *   - Inferred scan data remains inferred/needs_verification.
 *   - Existing payload without quotePlannerEvidence still builds.
 */

import { describe, it, expect } from 'vitest';
import { buildQuoteInstallationPlanDraft } from '../buildQuoteInstallationPlanDraft';
import type { BuildQuoteInstallationPlanDraftInput } from '../buildQuoteInstallationPlanDraft';
import type { EngineInputV2_3Contract } from '../../../../contracts/EngineInputV2_3';
import type { ScenarioResult } from '../../../../contracts/ScenarioResult';
import type { SessionCaptureV2 } from '../../../scanImport/contracts/sessionCaptureV2';
import type {
  QuotePlannerCandidateLocationV1,
  QuotePlannerCandidateRouteV1,
  QuotePlannerCandidateFlueRouteV1,
} from '../../../scanImport/contracts/sessionCaptureV2';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function baseSurveyInput(
  boilerType?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown',
): EngineInputV2_3Contract {
  return {
    infrastructure: { primaryPipeSizeMm: 22 },
    property:       { peakHeatLossKw: 7 },
    occupancy:      { signature: 'professional', peakConcurrentOutlets: 1 },
    dhw:            { architecture: 'on_demand' },
    currentSystem:  boilerType ? { boiler: { type: boilerType } } : undefined,
  };
}

function baseScenarioResult(
  type: ScenarioResult['system']['type'],
): ScenarioResult {
  return {
    scenarioId:    `sc-${type}`,
    system:        { type, summary: `${type} system` },
    performance:   { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
    keyBenefits:   [],
    keyConstraints: [],
    dayToDayOutcomes: [],
    requiredWorks:  [],
    upgradePaths:   [],
    physicsFlags:   {},
  };
}

function baseCapture(
  overrides: Partial<SessionCaptureV2> = {},
): SessionCaptureV2 {
  return {
    version:            '2.0',
    sessionId:          'sc-test',
    capturedAt:         '2026-05-01T09:00:00Z',
    exportedAt:         '2026-05-01T11:00:00Z',
    deviceModel:        'iPhone 15 Pro',
    roomScans:          [],
    photos:             [],
    voiceNotes:         [],
    objectPins:         [],
    floorPlanSnapshots: [],
    qaFlags:            [],
    ...overrides,
  };
}

const inferredLocation: QuotePlannerCandidateLocationV1 = {
  locationId: 'loc-1',
  kind:       'proposed_boiler',
  provenance: 'scan_inferred',
  confidence: 'needs_verification',
  roomId:     'r1',
  linkedPinId: 'pin-boiler',
  linkedPhotoIds: ['photo-1'],
  notes:      'Detected by LiDAR',
};

const confirmedLocation: QuotePlannerCandidateLocationV1 = {
  locationId: 'loc-2',
  kind:       'gas_meter',
  provenance: 'scan_confirmed',
  confidence: 'high',
  linkedPinId: 'pin-gas',
};

const candidateRoute: QuotePlannerCandidateRouteV1 = {
  routeId:    'route-1',
  routeType:  'gas_supply',
  confidence: 'estimated',
  linkedPinIds: ['pin-pipe-1'],
};

const candidateFlueRoute: QuotePlannerCandidateFlueRouteV1 = {
  flueRouteId: 'flue-1',
  confidence:  'estimated',
  linkedPinIds: ['pin-flue-1'],
};

// ─── Empty input ──────────────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — empty input', () => {
  it('returns a valid draft with both system families as unknown', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.currentSystem.family).toBe('unknown');
    expect(plan.proposedSystem.family).toBe('unknown');
  });

  it('produces empty locations, routes, and flueRoutes', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.locations).toEqual([]);
    expect(plan.routes).toEqual([]);
    expect(plan.flueRoutes).toEqual([]);
  });

  it('classifies the job as needs_review when both systems are unknown', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.jobClassification.jobType).toBe('needs_review');
  });

  it('returns an empty generatedScope', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.generatedScope).toEqual([]);
  });

  it('generates a planId when none is supplied', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(typeof plan.planId).toBe('string');
    expect(plan.planId.length).toBeGreaterThan(0);
  });

  it('sets visitId to undefined when not supplied', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.visitId).toBeUndefined();
  });

  it('sets createdAt to a non-empty ISO string', () => {
    const plan = buildQuoteInstallationPlanDraft();
    expect(plan.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── planId / visitId ─────────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — identifiers', () => {
  it('uses the supplied planId when provided', () => {
    const plan = buildQuoteInstallationPlanDraft({ planId: 'plan-abc-123' });
    expect(plan.planId).toBe('plan-abc-123');
  });

  it('uses the supplied visitId when provided', () => {
    const plan = buildQuoteInstallationPlanDraft({ visitId: 'visit-xyz' });
    expect(plan.visitId).toBe('visit-xyz');
  });
});

// ─── Current system derivation ────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — currentSystem from survey', () => {
  it('maps combi boiler type to combi family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput('combi'),
    });
    expect(plan.currentSystem.family).toBe('combi');
  });

  it('maps system boiler type to system_stored family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput('system'),
    });
    expect(plan.currentSystem.family).toBe('system_stored');
  });

  it('maps regular boiler type to regular_stored family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput('regular'),
    });
    expect(plan.currentSystem.family).toBe('regular_stored');
  });

  it('maps back_boiler to regular_stored family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput('back_boiler'),
    });
    expect(plan.currentSystem.family).toBe('regular_stored');
  });

  it('maps unknown boiler type to unknown family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput('unknown'),
    });
    expect(plan.currentSystem.family).toBe('unknown');
  });

  it('falls back to unknown when surveyInput is absent', () => {
    const plan = buildQuoteInstallationPlanDraft({ surveyInput: undefined });
    expect(plan.currentSystem.family).toBe('unknown');
  });

  it('falls back to unknown when currentSystem is absent in survey', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput: baseSurveyInput(undefined),
    });
    expect(plan.currentSystem.family).toBe('unknown');
  });
});

// ─── Proposed system from recommendation ─────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — proposedSystem from recommendation', () => {
  it('maps combi scenario to combi family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      recommendation: baseScenarioResult('combi'),
    });
    expect(plan.proposedSystem.family).toBe('combi');
  });

  it('maps system scenario to system_stored family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      recommendation: baseScenarioResult('system'),
    });
    expect(plan.proposedSystem.family).toBe('system_stored');
  });

  it('maps regular scenario to regular_stored family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      recommendation: baseScenarioResult('regular'),
    });
    expect(plan.proposedSystem.family).toBe('regular_stored');
  });

  it('maps ashp scenario to heat_pump family', () => {
    const plan = buildQuoteInstallationPlanDraft({
      recommendation: baseScenarioResult('ashp'),
    });
    expect(plan.proposedSystem.family).toBe('heat_pump');
  });

  it('falls back to unknown when no recommendation is provided', () => {
    const plan = buildQuoteInstallationPlanDraft({ recommendation: undefined });
    expect(plan.proposedSystem.family).toBe('unknown');
  });
});

// ─── Job classification ───────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — jobClassification', () => {
  it('classifies combi → combi as needs_review (no location data)', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput:    baseSurveyInput('combi'),
      recommendation: baseScenarioResult('combi'),
    });
    // Same family, but no location data → needs_review
    expect(plan.jobClassification.jobType).toBe('needs_review');
  });

  it('classifies combi → system as stored_hot_water_upgrade', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput:    baseSurveyInput('combi'),
      recommendation: baseScenarioResult('system'),
    });
    expect(plan.jobClassification.jobType).toBe('stored_hot_water_upgrade');
  });

  it('classifies any → ashp as low_carbon_conversion', () => {
    const plan = buildQuoteInstallationPlanDraft({
      surveyInput:    baseSurveyInput('combi'),
      recommendation: baseScenarioResult('ashp'),
    });
    expect(plan.jobClassification.jobType).toBe('low_carbon_conversion');
  });
});

// ─── Location import ──────────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — location import from sessionCapture', () => {
  it('imports candidate locations with confidence preserved', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [inferredLocation, confirmedLocation],
          candidateRoutes:     [],
          candidateFlueRoutes: [],
        },
      }),
    });

    expect(plan.locations).toHaveLength(2);
  });

  it('preserves scan_inferred provenance — does not promote to confirmed', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [inferredLocation],
          candidateRoutes:     [],
          candidateFlueRoutes: [],
        },
      }),
    });

    const loc = plan.locations[0];
    expect(loc.provenance).toBe('scan_inferred');
    expect(loc.confidence).toBe('needs_verification');
  });

  it('preserves scan_confirmed provenance and high confidence', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [confirmedLocation],
          candidateRoutes:     [],
          candidateFlueRoutes: [],
        },
      }),
    });

    const loc = plan.locations[0];
    expect(loc.provenance).toBe('scan_confirmed');
    expect(loc.confidence).toBe('high');
  });

  it('links pin and photo IDs from the scan evidence', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [inferredLocation],
          candidateRoutes:     [],
          candidateFlueRoutes: [],
        },
      }),
    });

    const loc = plan.locations[0];
    expect(loc.linkedPinId).toBe('pin-boiler');
    expect(loc.linkedPhotoIds).toEqual(['photo-1']);
  });

  it('returns empty locations when quotePlannerEvidence is absent', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture(),
    });
    expect(plan.locations).toEqual([]);
  });
});

// ─── Route import ─────────────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — route import', () => {
  it('imports candidate routes with confidence preserved', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [],
          candidateRoutes:     [candidateRoute],
          candidateFlueRoutes: [],
        },
      }),
    });

    expect(plan.routes).toHaveLength(1);
    expect(plan.routes[0].routeId).toBe('route-1');
    expect(plan.routes[0].confidence).toBe('estimated');
    expect(plan.routes[0].routeType).toBe('gas_supply');
  });

  it('does not synthesise geometry for routes without coordinate data', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [],
          candidateRoutes:     [candidateRoute],
          candidateFlueRoutes: [],
        },
      }),
    });

    expect(plan.routes[0].geometry).toBeUndefined();
  });
});

// ─── Flue route import ────────────────────────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — flue route import', () => {
  it('imports candidate flue routes with confidence preserved', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [],
          candidateRoutes:     [],
          candidateFlueRoutes: [candidateFlueRoute],
        },
      }),
    });

    expect(plan.flueRoutes).toHaveLength(1);
    expect(plan.flueRoutes[0].flueRouteId).toBe('flue-1');
    expect(plan.flueRoutes[0].confidence).toBe('estimated');
  });

  it('marks calculationMode as generic_estimate for all imported flue routes', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [],
          candidateRoutes:     [],
          candidateFlueRoutes: [candidateFlueRoute],
        },
      }),
    });

    expect(plan.flueRoutes[0].calculationMode).toBe('generic_estimate');
  });

  it('does not add a calculation when insufficient segment data exists', () => {
    const plan = buildQuoteInstallationPlanDraft({
      sessionCapture: baseCapture({
        quotePlannerEvidence: {
          candidateLocations:  [],
          candidateRoutes:     [],
          candidateFlueRoutes: [candidateFlueRoute],
        },
      }),
    });

    expect(plan.flueRoutes[0].calculation).toBeUndefined();
    expect(plan.flueRoutes[0].geometry).toBeUndefined();
  });
});

// ─── Session without quotePlannerEvidence ─────────────────────────────────────

describe('buildQuoteInstallationPlanDraft — session without quotePlannerEvidence', () => {
  it('builds a valid plan with empty arrays when quotePlannerEvidence is absent', () => {
    const input: BuildQuoteInstallationPlanDraftInput = {
      surveyInput:    baseSurveyInput('combi'),
      recommendation: baseScenarioResult('system'),
      sessionCapture: baseCapture(), // no quotePlannerEvidence
    };
    const plan = buildQuoteInstallationPlanDraft(input);

    expect(plan.locations).toEqual([]);
    expect(plan.routes).toEqual([]);
    expect(plan.flueRoutes).toEqual([]);
    expect(plan.currentSystem.family).toBe('combi');
    expect(plan.proposedSystem.family).toBe('system_stored');
  });
});
