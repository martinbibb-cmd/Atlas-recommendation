/**
 * buildQuoteScopeFromInstallationPlan.test.ts
 *
 * Unit tests for buildQuoteScopeFromInstallationPlan.
 *
 * Acceptance criteria from the problem statement:
 *   - Same-location combi produces basic scope.
 *   - Relocation with different flue terminal produces make-good old flue item.
 *   - Gas route length appears in gas scope item.
 *   - Assumed route produces needsVerification.
 *   - No duplicate scope items.
 *   - Scope generation is deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  buildQuoteScopeFromInstallationPlan,
  type QuoteScopeItemV1,
} from '../buildQuoteScopeFromInstallationPlan';
import type { QuoteInstallationPlanV1, QuotePlanLocationV1, QuotePlanPipeworkRouteV1 } from '../../model/QuoteInstallationPlanV1';
import type { QuoteJobClassificationV1 } from '../../calculators/quotePlannerTypes';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeJobClassification(jobType: QuoteJobClassificationV1['jobType']): QuoteJobClassificationV1 {
  return { jobType, rationale: `Test: ${jobType}` };
}

function makePlan(
  overrides: Partial<QuoteInstallationPlanV1> & { jobType: QuoteJobClassificationV1['jobType'] },
): QuoteInstallationPlanV1 {
  const { jobType, ...rest } = overrides;
  return {
    planId:          'test-plan',
    createdAt:       '2026-05-04T00:00:00.000Z',
    currentSystem:   { family: 'combi' },
    proposedSystem:  { family: 'combi' },
    locations:       [],
    routes:          [],
    flueRoutes:      [],
    pipeworkRoutes:  [],
    jobClassification: makeJobClassification(jobType),
    generatedScope:  [],
    ...rest,
  };
}

function makeLocation(
  kind: QuotePlanLocationV1['kind'],
  confidence: QuotePlanLocationV1['confidence'] = 'high',
): QuotePlanLocationV1 {
  return {
    locationId:  `loc-${kind}`,
    kind,
    provenance:  'engineer_placed',
    confidence,
    rejected:    false,
  };
}

function makePipeworkRoute(
  routeKind: QuotePlanPipeworkRouteV1['routeKind'],
  options: {
    status?: QuotePlanPipeworkRouteV1['status'];
    lengthM?: number | null;
  } = {},
): QuotePlanPipeworkRouteV1 {
  const { status = 'proposed', lengthM = 3.5 } = options;
  return {
    pipeworkRouteId:     `route-${routeKind}`,
    routeKind,
    status,
    installMethod:       'surface',
    points:              [],
    coordinateSpace:     'metres',
    wallPenetrationCount:  0,
    floorPenetrationCount: 0,
    calculation: {
      lengthM,
      lengthConfidence: lengthM !== null ? 'measured_on_plan' : 'needs_scale',
      bendCount:        0,
      wallPenetrationCount:  0,
      floorPenetrationCount: 0,
      complexity:       'low',
      complexityRationale: 'Test route',
    },
  };
}

// ─── Acceptance criteria ──────────────────────────────────────────────────────

describe('buildQuoteScopeFromInstallationPlan — acceptance criteria', () => {
  it('same-location combi produces basic scope items', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      locations: [
        makeLocation('existing_boiler'),
        makeLocation('proposed_boiler'),
      ],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);

    expect(items.length).toBeGreaterThan(0);
    const labels = items.map((i) => i.label);
    expect(labels.some((l) => l.toLowerCase().includes('isolate') || l.toLowerCase().includes('remove'))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes('fit new boiler'))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes('commission'))).toBe(true);
  });

  it('like_for_like scope includes a flue route item', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.category === 'routes' && i.label.toLowerCase().includes('flue'))).toBe(true);
  });

  it('like_for_like scope includes a condensate route item', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('condensate'))).toBe(true);
  });

  it('like_for_like scope includes a gas supply route item', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('gas'))).toBe(true);
  });

  it('relocation with existing flue terminal produces make-good old flue item', () => {
    const plan = makePlan({
      jobType: 'relocation',
      locations: [
        makeLocation('existing_boiler'),
        makeLocation('proposed_boiler'),
        makeLocation('flue_terminal'),
      ],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const makeGoodItem = items.find(
      (i) => i.label.toLowerCase().includes('make good') && i.label.toLowerCase().includes('flue'),
    );
    expect(makeGoodItem).toBeDefined();
    expect(makeGoodItem!.category).toBe('alterations');
  });

  it('relocation without existing flue terminal does not produce a make-good item', () => {
    const plan = makePlan({
      jobType: 'relocation',
      locations: [
        makeLocation('existing_boiler'),
        makeLocation('proposed_boiler'),
        // No flue_terminal location
      ],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const makeGoodItem = items.find(
      (i) => i.label.toLowerCase().includes('make good') && i.label.toLowerCase().includes('flue'),
    );
    expect(makeGoodItem).toBeUndefined();
  });

  it('gas route length appears in gas scope item details', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      pipeworkRoutes: [makePipeworkRoute('gas', { lengthM: 4.5 })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const gasItem = items.find((i) => i.label.toLowerCase().includes('gas'));
    expect(gasItem).toBeDefined();
    expect(gasItem!.details).toContain('4.5 m');
  });

  it('assumed route produces needsVerification: true on the scope item', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      pipeworkRoutes: [makePipeworkRoute('gas', { status: 'assumed' })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const gasItem = items.find((i) => i.label.toLowerCase().includes('gas'));
    expect(gasItem).toBeDefined();
    expect(gasItem!.needsVerification).toBe(true);
  });

  it('non-assumed route has needsVerification: false', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      pipeworkRoutes: [makePipeworkRoute('gas', { status: 'proposed' })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const gasItem = items.find((i) => i.label.toLowerCase().includes('gas'));
    expect(gasItem).toBeDefined();
    expect(gasItem!.needsVerification).toBe(false);
  });

  it('no duplicate scope item IDs are emitted', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const ids = items.map((i) => i.itemId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('no duplicate scope item labels are emitted', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const labels = items.map((i) => i.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('scope generation is deterministic — same input produces same output', () => {
    const plan = makePlan({
      jobType: 'relocation',
      locations: [
        makeLocation('existing_boiler'),
        makeLocation('proposed_boiler'),
        makeLocation('flue_terminal'),
      ],
      pipeworkRoutes: [
        makePipeworkRoute('gas', { lengthM: 3.0 }),
        makePipeworkRoute('condensate', { lengthM: 1.5 }),
      ],
    });

    const first  = buildQuoteScopeFromInstallationPlan(plan);
    const second = buildQuoteScopeFromInstallationPlan(plan);

    expect(first).toEqual(second);
  });
});

// ─── Job type coverage ────────────────────────────────────────────────────────

describe('buildQuoteScopeFromInstallationPlan — job type coverage', () => {
  it('needs_review returns an empty array', () => {
    const plan = makePlan({ jobType: 'needs_review' });
    expect(buildQuoteScopeFromInstallationPlan(plan)).toEqual([]);
  });

  it('conversion scope includes "Remove existing heat source" item', () => {
    const plan = makePlan({ jobType: 'conversion' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('remove existing heat source'))).toBe(true);
  });

  it('stored_hot_water_upgrade scope includes cylinder item', () => {
    const plan = makePlan({ jobType: 'stored_hot_water_upgrade' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('cylinder'))).toBe(true);
  });

  it('stored_hot_water_upgrade scope includes discharge route item', () => {
    const plan = makePlan({ jobType: 'stored_hot_water_upgrade' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('discharge'))).toBe(true);
  });

  it('stored_hot_water_upgrade scope includes controls item when controls route is drawn', () => {
    const plan = makePlan({
      jobType: 'stored_hot_water_upgrade',
      pipeworkRoutes: [makePipeworkRoute('controls', { lengthM: 2.0 })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('controls'))).toBe(true);
  });

  it('stored_hot_water_upgrade scope omits controls item when no controls route is drawn', () => {
    const plan = makePlan({ jobType: 'stored_hot_water_upgrade' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('controls'))).toBe(false);
  });

  it('low_carbon_conversion scope includes outdoor unit placeholder item', () => {
    const plan = makePlan({ jobType: 'low_carbon_conversion' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('outdoor unit'))).toBe(true);
  });

  it('low_carbon_conversion scope includes hydraulic connection item', () => {
    const plan = makePlan({ jobType: 'low_carbon_conversion' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('hydraulic'))).toBe(true);
  });

  it('low_carbon_conversion scope includes electrical supply item', () => {
    const plan = makePlan({ jobType: 'low_carbon_conversion' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    expect(items.some((i) => i.label.toLowerCase().includes('electrical supply'))).toBe(true);
  });
});

// ─── Confidence rules ─────────────────────────────────────────────────────────

describe('buildQuoteScopeFromInstallationPlan — confidence rules', () => {
  it('high-confidence location produces confirmed scope item for removal', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      locations: [makeLocation('existing_boiler', 'high')],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const removalItem = items.find((i) => i.category === 'existing_removal');
    expect(removalItem?.confidence).toBe('confirmed');
  });

  it('needs_verification location produces needs_verification confidence', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      locations: [makeLocation('existing_boiler', 'needs_verification')],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const removalItem = items.find((i) => i.category === 'existing_removal');
    expect(removalItem?.confidence).toBe('needs_verification');
    expect(removalItem?.needsVerification).toBe(true);
  });

  it('needs_scale pipework route produces low confidence', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      pipeworkRoutes: [makePipeworkRoute('gas', { lengthM: null })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const gasItem = items.find((i) => i.label.toLowerCase().includes('gas'));
    expect(gasItem?.confidence).toBe('low');
  });

  it('commissioning item is always confirmed', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const commissionItem = items.find((i) => i.category === 'commissioning');
    expect(commissionItem?.confidence).toBe('confirmed');
    expect(commissionItem?.needsVerification).toBe(false);
  });
});

// ─── Item structure ───────────────────────────────────────────────────────────

describe('buildQuoteScopeFromInstallationPlan — item structure', () => {
  it('every item has itemId, category, label, confidence, and needsVerification', () => {
    const plan = makePlan({ jobType: 'relocation' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    for (const item of items) {
      expect(item.itemId).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(typeof item.confidence).toBe('string');
      expect(typeof item.needsVerification).toBe('boolean');
    }
  });

  it('all itemIds have the expected scope- prefix', () => {
    const plan = makePlan({ jobType: 'conversion' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    for (const item of items) {
      expect(item.itemId).toMatch(/^scope-\d+$/);
    }
  });

  it('route items that have measured lengths include details', () => {
    const plan = makePlan({
      jobType: 'like_for_like',
      pipeworkRoutes: [makePipeworkRoute('condensate', { lengthM: 2.3 })],
    });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const condensateItem = items.find((i) => i.label.toLowerCase().includes('condensate'));
    expect(condensateItem?.details).toContain('2.3 m');
  });

  it('route items without drawn routes have no details', () => {
    const plan = makePlan({ jobType: 'like_for_like' });
    const items = buildQuoteScopeFromInstallationPlan(plan);
    const condensateItem = items.find((i) => i.label.toLowerCase().includes('condensate'));
    expect(condensateItem?.details).toBeUndefined();
  });
});
