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
} from '../buildQuoteScopeFromInstallationPlan';
import type {
  QuoteInstallationPlanV1,
  QuotePlanLocationV1,
  QuotePlanPipeworkRouteV1,
  InstallationSpecificationSystemV1,
  HeatSourceKindV1,
  HotWaterKindV1,
  PrimaryCircuitKindV1,
  ExistingWetHeatingKindV1,
} from '../../model/QuoteInstallationPlanV1';
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

// ─── Layered model (proposedSpec / currentSpec) scope generation ──────────────

/**
 * Helpers for the spec-based tests.
 */
function makeSpec(
  heatSource: HeatSourceKindV1,
  hotWater: HotWaterKindV1,
  options?: {
    primaryCircuit?: PrimaryCircuitKindV1;
    hasExistingWetHeating?: ExistingWetHeatingKindV1;
  },
): InstallationSpecificationSystemV1 {
  return {
    hasExistingWetHeating: options?.hasExistingWetHeating,
    heatSource: { kind: heatSource },
    hotWater:   { kind: hotWater },
    primaryCircuit: options?.primaryCircuit
      ? { kind: options.primaryCircuit }
      : undefined,
  };
}

function makePlanWithSpec(
  currentSpec: InstallationSpecificationSystemV1,
  proposedSpec: InstallationSpecificationSystemV1,
  overrides?: Partial<QuoteInstallationPlanV1>,
): QuoteInstallationPlanV1 {
  return {
    planId:           'test-spec-plan',
    createdAt:        '2026-05-04T00:00:00.000Z',
    currentSystem:    { family: 'unknown' },
    proposedSystem:   { family: 'unknown' },
    locations:        [],
    routes:           [],
    flueRoutes:       [],
    pipeworkRoutes:   [],
    jobClassification: { jobType: 'needs_review', rationale: 'spec-based' },
    generatedScope:   [],
    currentSpec,
    proposedSpec,
    ...overrides,
  };
}

describe('buildQuoteScopeFromInstallationPlan — layered model: test 1', () => {
  // regular_boiler + vented_cylinder → combi_boiler + instantaneous_from_combi
  const plan = makePlanWithSpec(
    makeSpec('regular_boiler', 'vented_cylinder'),
    makeSpec('combi_boiler',   'instantaneous_from_combi'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('removes existing heat source', () => {
    expect(labels.some((l) => l.includes('remove existing heat source'))).toBe(true);
  });

  it('includes cylinder removal or cap decision for vented cylinder', () => {
    expect(labels.some((l) => l.includes('remove or cap existing vented cylinder'))).toBe(true);
  });

  it('fits new combi boiler', () => {
    expect(labels.some((l) => l.includes('fit new combi boiler'))).toBe(true);
  });

  it('requires flue route', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
  });

  it('requires condensate route', () => {
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
  });

  it('requires gas route', () => {
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });

  it('does NOT include unvented discharge scope', () => {
    expect(labels.some((l) => l.includes('discharge') && !l.includes('cap off'))).toBe(false);
  });

  it('does NOT invent a cylinder location item (no new cylinder)', () => {
    expect(labels.some((l) => l.includes('specify cylinder location'))).toBe(false);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 2', () => {
  // regular_boiler + unvented_cylinder → combi_boiler + instantaneous_from_combi
  const plan = makePlanWithSpec(
    makeSpec('regular_boiler', 'unvented_cylinder'),
    makeSpec('combi_boiler',   'instantaneous_from_combi'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('includes unvented cylinder removal', () => {
    expect(labels.some((l) => l.includes('remove or cap existing unvented cylinder'))).toBe(true);
  });

  it('includes discharge pipe cap-off (unvented-specific)', () => {
    expect(labels.some((l) => l.includes('cap off existing discharge pipe'))).toBe(true);
  });

  it('does NOT assume the cylinder was vented', () => {
    // "remove or cap existing vented cylinder" must not appear — it was unvented.
    expect(labels.some((l) => l.includes('remove or cap existing vented cylinder'))).toBe(false);
  });

  it('requires flue, condensate, and gas routes', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 3', () => {
  // system_boiler + vented_cylinder → system_boiler + existing_retained
  const plan = makePlanWithSpec(
    makeSpec('system_boiler', 'vented_cylinder'),
    makeSpec('system_boiler', 'existing_retained'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('includes boiler replacement scope', () => {
    expect(labels.some((l) => l.includes('remove existing heat source'))).toBe(true);
    expect(labels.some((l) => l.includes('fit new system boiler'))).toBe(true);
  });

  it('does NOT include cylinder install scope (retained)', () => {
    expect(labels.some((l) => l.includes('fit new')  && l.includes('cylinder'))).toBe(false);
  });

  it('does NOT include cylinder location item', () => {
    expect(labels.some((l) => l.includes('specify cylinder location'))).toBe(false);
  });

  it('does NOT invent unvented discharge scope', () => {
    expect(labels.some((l) => l.includes('add discharge route'))).toBe(false);
  });

  it('does NOT generate cylinder removal (cylinder is being retained)', () => {
    expect(labels.some((l) => l.includes('remove or cap existing'))).toBe(false);
  });

  it('requires flue, condensate, gas routes', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 4', () => {
  // system_boiler + unvented_cylinder → system_boiler + existing_retained
  const plan = makePlanWithSpec(
    makeSpec('system_boiler', 'unvented_cylinder'),
    makeSpec('system_boiler', 'existing_retained'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('includes boiler swap scope', () => {
    expect(labels.some((l) => l.includes('remove existing heat source'))).toBe(true);
    expect(labels.some((l) => l.includes('fit new system boiler'))).toBe(true);
  });

  it('does NOT generate cylinder removal (unvented cylinder retained)', () => {
    expect(labels.some((l) => l.includes('remove or cap existing'))).toBe(false);
  });

  it('does NOT generate new discharge route (discharge exists, not replacing)', () => {
    expect(labels.some((l) => l.includes('add discharge route'))).toBe(false);
  });

  it('requires flue, condensate, gas routes', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 5', () => {
  // combi_boiler + instantaneous_from_combi → system_boiler + unvented_cylinder
  const plan = makePlanWithSpec(
    makeSpec('combi_boiler', 'instantaneous_from_combi'),
    makeSpec('system_boiler', 'unvented_cylinder'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('removes existing heat source', () => {
    expect(labels.some((l) => l.includes('remove existing heat source'))).toBe(true);
  });

  it('fits new system boiler', () => {
    expect(labels.some((l) => l.includes('fit new system boiler'))).toBe(true);
  });

  it('fits new unvented cylinder (stored hot-water upgrade)', () => {
    expect(labels.some((l) => l.includes('fit new unvented cylinder'))).toBe(true);
  });

  it('requires cylinder location to be specified', () => {
    expect(labels.some((l) => l.includes('specify cylinder location'))).toBe(true);
  });

  it('includes hot and cold water connections', () => {
    expect(labels.some((l) => l.includes('hot and cold water connections'))).toBe(true);
  });

  it('requires discharge route (unvented)', () => {
    expect(labels.some((l) => l.includes('add discharge route'))).toBe(true);
  });

  it('requires flue, condensate, gas routes', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });

  it('does NOT include cylinder removal (no previous cylinder)', () => {
    expect(labels.some((l) => l.includes('remove or cap existing'))).toBe(false);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 6', () => {
  // combi_boiler + instantaneous_from_combi → heat_pump + heat_pump_cylinder
  const plan = makePlanWithSpec(
    makeSpec('combi_boiler', 'instantaneous_from_combi'),
    makeSpec('heat_pump',    'heat_pump_cylinder'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('includes outdoor unit scope', () => {
    expect(labels.some((l) => l.includes('outdoor unit'))).toBe(true);
  });

  it('fits heat pump cylinder', () => {
    expect(labels.some((l) => l.includes('fit new heat pump cylinder'))).toBe(true);
  });

  it('specifies cylinder location', () => {
    expect(labels.some((l) => l.includes('specify cylinder location'))).toBe(true);
  });

  it('includes hydraulic and electrical routes', () => {
    expect(labels.some((l) => l.includes('hydraulic connection route'))).toBe(true);
    expect(labels.some((l) => l.includes('electrical supply route'))).toBe(true);
  });

  it('does NOT generate gas route', () => {
    expect(labels.some((l) => l.includes('gas route required'))).toBe(false);
  });

  it('does NOT generate flue route', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(false);
  });

  it('does NOT generate boiler condensate route', () => {
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(false);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 7', () => {
  // no existing wet heating → heat_pump + heat_pump_cylinder
  const plan = makePlanWithSpec(
    makeSpec('none', 'none', { hasExistingWetHeating: 'no' }),
    makeSpec('heat_pump', 'heat_pump_cylinder'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('does NOT generate any removal scope', () => {
    expect(items.filter((i) => i.category === 'existing_removal')).toHaveLength(0);
  });

  it('includes outdoor unit scope', () => {
    expect(labels.some((l) => l.includes('outdoor unit'))).toBe(true);
  });

  it('fits heat pump cylinder', () => {
    expect(labels.some((l) => l.includes('fit new heat pump cylinder'))).toBe(true);
  });

  it('does NOT generate gas route', () => {
    expect(labels.some((l) => l.includes('gas route required'))).toBe(false);
  });

  it('does NOT generate flue route', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(false);
  });

  it('does NOT generate boiler condensate route', () => {
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(false);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 8', () => {
  // heat_pump + heat_pump_cylinder → heat_pump + existing_retained
  const plan = makePlanWithSpec(
    makeSpec('heat_pump', 'heat_pump_cylinder'),
    makeSpec('heat_pump', 'existing_retained'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('removes existing heat pump', () => {
    expect(labels.some((l) => l.includes('remove existing heat source'))).toBe(true);
  });

  it('includes outdoor unit scope', () => {
    expect(labels.some((l) => l.includes('outdoor unit'))).toBe(true);
  });

  it('does NOT fit a new cylinder (existing retained)', () => {
    expect(labels.some((l) => l.includes('fit new') && l.includes('cylinder'))).toBe(false);
  });

  it('does NOT generate gas route', () => {
    expect(labels.some((l) => l.includes('gas route required'))).toBe(false);
  });

  it('does NOT generate flue route', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(false);
  });

  it('does NOT generate boiler condensate route', () => {
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(false);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 9', () => {
  // heat_pump → gas boiler (exceptional path — technical review required)
  const plan = makePlanWithSpec(
    makeSpec('heat_pump',    'heat_pump_cylinder'),
    makeSpec('combi_boiler', 'instantaneous_from_combi'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('generates a technical review item', () => {
    expect(labels.some((l) => l.includes('technical review required'))).toBe(true);
  });

  it('requires a surveyor note', () => {
    expect(labels.some((l) => l.includes('surveyor note required'))).toBe(true);
  });

  it('does NOT generate normal gas boiler scope', () => {
    expect(labels.some((l) => l.includes('fit new'))).toBe(false);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(false);
    expect(labels.some((l) => l.includes('flue route required'))).toBe(false);
  });

  it('returns only the technical review items (not a full scope list)', () => {
    expect(items).toHaveLength(2);
  });
});

describe('buildQuoteScopeFromInstallationPlan — layered model: test 10', () => {
  // → system_boiler + mixergy_or_stratified
  const plan = makePlanWithSpec(
    makeSpec('combi_boiler', 'instantaneous_from_combi'),
    makeSpec('system_boiler', 'mixergy_or_stratified'),
  );
  const items = buildQuoteScopeFromInstallationPlan(plan);
  const labels = items.map((i) => i.label.toLowerCase());

  it('labels the cylinder as Mixergy / stratified (not generic unvented)', () => {
    expect(labels.some((l) => l.includes('mixergy') || l.includes('stratified'))).toBe(true);
  });

  it('does NOT label the cylinder as unvented cylinder', () => {
    expect(labels.some((l) => l.includes('fit new unvented cylinder'))).toBe(false);
  });

  it('requires discharge route (Mixergy has pressure relief)', () => {
    expect(labels.some((l) => l.includes('add discharge route'))).toBe(true);
  });

  it('specifies cylinder location', () => {
    expect(labels.some((l) => l.includes('specify cylinder location'))).toBe(true);
  });

  it('requires flue, condensate, gas routes (system boiler is gas condensing)', () => {
    expect(labels.some((l) => l.includes('flue route required'))).toBe(true);
    expect(labels.some((l) => l.includes('condensate route required'))).toBe(true);
    expect(labels.some((l) => l.includes('gas route required'))).toBe(true);
  });
});
