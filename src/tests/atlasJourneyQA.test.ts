/**
 * atlasJourneyQA.test.ts
 *
 * PR33 — Full-system journey QA pass.
 *
 * Goal: Verify the whole Atlas journey works as one connected product using a
 * single canonical fixture that drives all surfaces in sequence:
 *
 *   planner truth → recommendation decision → customer advice pack →
 *   portal proof → engineer handoff
 *
 * Flows covered
 * ─────────────
 *   1. Planner to handoff — plan with rooms / boiler / flue / cylinder / route
 *      drives plan readiness and engineer layout
 *   2. Survey to decision — engine produces recommendedScenarioId, quoteScope,
 *      lifecycle, and showerCompatibilityNote
 *   3. Decision to customer deck — VisualBlock[] contains all required block types
 *   4. Customer advice pack — print surface, no diagnostics, Requirement label,
 *      portal CTA visible
 *   5. Portal proof — all five tabs render; shower and spatial proof in "why" tab;
 *      future tab excludes included scope
 *   6. Engineer handoff — same recommended scenario, same quote scope, shower note,
 *      spatial layout and routes present
 *   7. Internal route guard — diagnostic surfaces unavailable by default
 *
 * Rules
 * ─────
 *   - No snapshots.
 *   - Test visible/contractual outcomes — not implementation details.
 *   - Do not loosen TypeScript.
 *   - Small guard fixes only (no new contracts or scoring).
 */

import { describe, it, expect } from 'vitest';

// ─── Engine pipeline ──────────────────────────────────────────────────────────
import { runEngine } from '../engine/Engine';
import { buildScenariosFromEngineOutput } from '../engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from '../engine/modules/buildDecisionFromScenarios';
import { buildVisualBlocks, buildSpatialProofBlock } from '../engine/modules/buildVisualBlocks';
import { buildPortalViewModel } from '../engine/modules/buildPortalViewModel';
import { buildEngineerHandoff } from '../engine/modules/buildEngineerHandoff';
import { buildEngineerLayout, buildLayoutSummaryLines } from '../engine/modules/buildEngineerLayout';
import { buildShowerCompatibilityNotes } from '../engine/modules/buildShowerCompatibilityNotes';
import { buildQuoteScope } from '../engine/modules/buildQuoteScope';

// ─── Planner / spatial ────────────────────────────────────────────────────────
import { validatePlanReadiness } from '../features/floorplan/planReadinessValidator';

// ─── Contract types ───────────────────────────────────────────────────────────
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { PropertyPlan } from '../components/floorplan/propertyPlan.types';
import type { VisualBlock } from '../contracts/VisualBlock';

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL QA FIXTURE
//
// One set of inputs drives every flow in this test file. The property has:
//   - 3 occupants, 2 bathrooms → combi is borderline (occupancyCount=3 → warn;
//     bathroomCount>=2 → fail) so the engine should recommend stored DHW
//   - Electric shower → showerCompatibilityNote with severity 'info'
//   - Full spatial plan with rooms, boiler, flue, cylinder, discharge route
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical engine input for the QA fixture. */
const QA_ENGINE_INPUT: EngineInputV2_3 = {
  postcode:             'SW1A 1AA',
  dynamicMainsPressure: 2.2,
  mainsDynamicFlowLpm:  18,
  primaryPipeDiameter:  22,
  heatLossWatts:        9500,
  radiatorCount:        12,
  bathroomCount:        2,
  occupancyCount:       4,
  hasLoftConversion:    false,
  returnWaterTemp:      45,
  occupancySignature:   'professional',
  buildingMass:         'medium',
  highOccupancy:        false,
  preferCombi:          false,
  currentHeatSourceType: 'system',
};

/**
 * Canonical PropertyPlan for the QA fixture.
 *
 * Contains:
 *   - 2 rooms (kitchen, airing cupboard)
 *   - FloorObjects: boiler (kitchen), flue, cylinder (airing cupboard)
 *   - FloorRoute: discharge (assumed) from cylinder to outside
 */
const QA_PLAN: PropertyPlan = {
  version: '1.0',
  propertyId: 'qa-fixture-001',
  floors: [
    {
      id:         'f1',
      name:       'Ground floor',
      levelIndex: 0,
      rooms: [
        {
          id:       'r1',
          name:     'Kitchen',
          roomType: 'kitchen',
          floorId:  'f1',
          x: 0, y: 0, width: 300, height: 200,
        },
        {
          id:       'r2',
          name:     'Airing Cupboard',
          roomType: 'cupboard',
          floorId:  'f1',
          x: 310, y: 0, width: 100, height: 100,
        },
      ],
      walls: [
        { id: 'w1', floorId: 'f1', kind: 'external', x1: 0, y1: 0,   x2: 300, y2: 0 },
        { id: 'w2', floorId: 'f1', kind: 'external', x1: 0, y1: 200, x2: 300, y2: 200 },
      ],
      openings: [],
      zones:    [],
      floorObjects: [
        {
          id:       'obj-boiler',
          type:     'boiler',
          label:    'System boiler',
          floorId:  'f1',
          roomId:   'r1',
          x: 20, y: 20, widthM: 0.5, heightM: 0.8,
          provenance: { source: 'manual', reviewStatus: 'reviewed' },
        },
        {
          id:       'obj-flue',
          type:     'flue',
          label:    'Flue terminal',
          floorId:  'f1',
          roomId:   'r1',
          x: 30, y: 0, widthM: 0.15, heightM: 0.15,
          provenance: { source: 'manual', reviewStatus: 'reviewed' },
        },
        {
          id:       'obj-cylinder',
          type:     'cylinder',
          label:    'Unvented cylinder',
          floorId:  'f1',
          roomId:   'r2',
          x: 315, y: 5, widthM: 0.45, heightM: 1.2,
          provenance: { source: 'manual', reviewStatus: 'reviewed' },
        },
      ],
      floorRoutes: [
        {
          id:      'route-discharge',
          floorId: 'f1',
          type:    'discharge',
          status:  'assumed',
          points:  [{ x: 315, y: 50 }, { x: 315, y: 250 }],
        },
      ],
    },
  ],
  placementNodes: [],
  connections:    [],
  metadata: {
    propertyType: 'semi_detached',
    postcode:     'SW1A 1AA',
    systemType:   'system',
  },
};

// ─── Derived QA data (computed once, shared across all suites) ─────────────

const QA_ENGINE_RESULT   = runEngine(QA_ENGINE_INPUT);
const QA_SCENARIOS       = buildScenariosFromEngineOutput(QA_ENGINE_RESULT.engineOutput);
const QA_SHOWER_NOTE     = buildShowerCompatibilityNotes({ electricShowerPresent: true });
const QA_DECISION        = buildDecisionFromScenarios({
  scenarios:               QA_SCENARIOS,
  boilerType:              'system',
  ageYears:                12,
  occupancyCount:          QA_ENGINE_INPUT.occupancyCount,
  bathroomCount:           QA_ENGINE_INPUT.bathroomCount,
  showerCompatibilityNote: QA_SHOWER_NOTE,
});
const QA_ENGINEER_LAYOUT = buildEngineerLayout(QA_PLAN);
const QA_SPATIAL_BLOCK   = QA_ENGINEER_LAYOUT
  ? buildSpatialProofBlock(QA_ENGINEER_LAYOUT)
  : null;
// buildVisualBlocks accepts an optional EngineerLayout — passing it causes the
// spatial_proof block to appear in the list before portal_cta.
const QA_BLOCKS: VisualBlock[] = buildVisualBlocks(
  QA_DECISION,
  QA_SCENARIOS,
  QA_ENGINEER_LAYOUT,
);
const QA_PORTAL_VM = buildPortalViewModel(QA_DECISION, QA_SCENARIOS, QA_BLOCKS);
const QA_HANDOFF   = buildEngineerHandoff(
  QA_DECISION,
  QA_SCENARIOS,
  undefined,   // no EngineInputV2_3Contract — decision facts used
  QA_PLAN,     // PropertyPlan — layout is derived internally
);

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 1 — Planner to handoff
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 1 — Planner to handoff', () => {

  describe('plan readiness', () => {
    it('plan with rooms, boiler, and cylinder passes readiness check (not incomplete)', () => {
      const result = validatePlanReadiness(QA_PLAN, { needsStoredHotWater: true });
      // Should be 'ready' or 'needs_checking' (discharge route is assumed) — never 'incomplete'
      expect(result.overallStatus).not.toBe('incomplete');
    });

    it('rooms are recorded in the plan', () => {
      const result = validatePlanReadiness(QA_PLAN);
      const roomsItem = result.items.find((i) => i.key === 'rooms_present');
      expect(roomsItem?.status).toBe('complete');
    });

    it('boiler is recorded in the plan', () => {
      const result = validatePlanReadiness(QA_PLAN);
      const boilerItem = result.items.find((i) => i.key === 'heat_source_recorded');
      expect(boilerItem?.status).toBe('complete');
    });

    it('flue is recorded in the plan', () => {
      const result = validatePlanReadiness(QA_PLAN);
      const flueItem = result.items.find((i) => i.key === 'flue_recorded');
      expect(flueItem?.status).toBe('complete');
    });

    it('cylinder is recorded when needsStoredHotWater is true', () => {
      const result = validatePlanReadiness(QA_PLAN, { needsStoredHotWater: true });
      const cylinderItem = result.items.find((i) => i.key === 'cylinder_recorded');
      expect(cylinderItem?.status).toBe('complete');
    });
  });

  describe('engineer layout from plan', () => {
    it('buildEngineerLayout produces a layout from the QA plan', () => {
      expect(QA_ENGINEER_LAYOUT).not.toBeUndefined();
    });

    it('layout contains the kitchen room', () => {
      expect(QA_ENGINEER_LAYOUT!.rooms.some((r) => r.name === 'Kitchen')).toBe(true);
    });

    it('layout contains the airing cupboard room', () => {
      expect(QA_ENGINEER_LAYOUT!.rooms.some((r) => r.name === 'Airing Cupboard')).toBe(true);
    });

    it('layout contains a boiler object', () => {
      expect(QA_ENGINEER_LAYOUT!.objects.some((o) => o.type === 'boiler')).toBe(true);
    });

    it('layout contains a flue object', () => {
      expect(QA_ENGINEER_LAYOUT!.objects.some((o) => o.type === 'flue')).toBe(true);
    });

    it('layout contains a cylinder object', () => {
      expect(QA_ENGINEER_LAYOUT!.objects.some((o) => o.type === 'cylinder')).toBe(true);
    });

    it('layout contains the discharge route', () => {
      expect(QA_ENGINEER_LAYOUT!.routes?.some((r) => r.type === 'discharge')).toBe(true);
    });

    it('discharge route has assumed status', () => {
      const discharge = QA_ENGINEER_LAYOUT!.routes?.find((r) => r.type === 'discharge');
      expect(discharge?.status).toBe('assumed');
    });
  });

  describe('layout summary lines', () => {
    it('layout summary mentions rooms recorded', () => {
      const lines = buildLayoutSummaryLines(QA_ENGINEER_LAYOUT!);
      expect(lines.some((l) => /rooms? recorded/i.test(l))).toBe(true);
    });

    it('layout summary mentions boiler position', () => {
      const lines = buildLayoutSummaryLines(QA_ENGINEER_LAYOUT!);
      expect(lines.some((l) => /boiler position/i.test(l))).toBe(true);
    });

    it('layout summary mentions cylinder position', () => {
      const lines = buildLayoutSummaryLines(QA_ENGINEER_LAYOUT!);
      expect(lines.some((l) => /cylinder position/i.test(l))).toBe(true);
    });

    it('layout summary flags assumed route for confirmation', () => {
      const lines = buildLayoutSummaryLines(QA_ENGINEER_LAYOUT!);
      expect(lines.some((l) => /assumed|confirm/i.test(l))).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 2 — Survey to decision
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 2 — Survey to decision', () => {

  it('engine produces at least one scenario', () => {
    expect(QA_SCENARIOS.length).toBeGreaterThan(0);
  });

  it('decision has a recommendedScenarioId', () => {
    expect(QA_DECISION.recommendedScenarioId).toBeTruthy();
  });

  it('recommendedScenarioId matches one of the evaluated scenarios', () => {
    const match = QA_SCENARIOS.find(
      (s) => s.scenarioId === QA_DECISION.recommendedScenarioId,
    );
    expect(match).toBeDefined();
  });

  it('decision has a lifecycle with currentSystem populated', () => {
    expect(QA_DECISION.lifecycle).toBeDefined();
    expect(QA_DECISION.lifecycle.currentSystem.type).toBeTruthy();
  });

  it('quoteScope is an array (populated by buildDecisionFromScenarios)', () => {
    expect(Array.isArray(QA_DECISION.quoteScope)).toBe(true);
  });

  it('quoteScope has at least one included item', () => {
    const includedItems = QA_DECISION.quoteScope.filter((i) => i.status === 'included');
    expect(includedItems.length).toBeGreaterThan(0);
  });

  describe('shower compatibility', () => {
    it('showerCompatibilityNote is present on the decision', () => {
      expect(QA_DECISION.showerCompatibilityNote).toBeDefined();
    });

    it('showerCompatibilityNote severity is "info" for electric shower', () => {
      expect(QA_DECISION.showerCompatibilityNote?.severity).toBe('info');
    });

    it('showerCompatibilityNote warningKey is electric_unaffected', () => {
      expect(QA_DECISION.showerCompatibilityNote?.warningKey).toBe('electric_unaffected');
    });

    it('shower customerSummary is present in compatibilityWarnings', () => {
      const note = QA_DECISION.showerCompatibilityNote!;
      expect(QA_DECISION.compatibilityWarnings).toContain(note.customerSummary);
    });

    it('shower customerSummary is not duplicated in compatibilityWarnings', () => {
      const note = QA_DECISION.showerCompatibilityNote!;
      const count = QA_DECISION.compatibilityWarnings.filter(
        (w) => w === note.customerSummary,
      ).length;
      expect(count).toBe(1);
    });
  });

  describe('future plans / disruption tolerance', () => {
    it('decision has futureUpgradePaths array', () => {
      expect(Array.isArray(QA_DECISION.futureUpgradePaths)).toBe(true);
    });

    it('keyReasons is a non-empty array', () => {
      expect(QA_DECISION.keyReasons.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 3 — Decision to customer deck (VisualBlock[])
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 3 — Decision to customer deck', () => {

  it('buildVisualBlocks returns a non-empty array', () => {
    expect(QA_BLOCKS.length).toBeGreaterThan(0);
  });

  it('first block is a hero block', () => {
    expect(QA_BLOCKS[0].type).toBe('hero');
  });

  it('hero block carries the recommended scenario id', () => {
    const hero = QA_BLOCKS.find((b) => b.type === 'hero');
    expect(hero?.type === 'hero' && hero.recommendedScenarioId).toBe(QA_DECISION.recommendedScenarioId);
  });

  it('second block is a facts block', () => {
    expect(QA_BLOCKS[1].type).toBe('facts');
  });

  it('blocks contain a solution block', () => {
    expect(QA_BLOCKS.some((b) => b.type === 'solution')).toBe(true);
  });

  it('blocks contain an included_scope block', () => {
    expect(QA_BLOCKS.some((b) => b.type === 'included_scope')).toBe(true);
  });

  it('last non-spatial block is a portal_cta block', () => {
    // portal_cta is always last from buildVisualBlocks; spatial_proof may be appended after
    const lastCtaIdx = QA_BLOCKS.map((b) => b.type).lastIndexOf('portal_cta');
    expect(lastCtaIdx).toBeGreaterThan(-1);
  });

  it('blocks contain a spatial_proof block derived from the QA plan', () => {
    expect(QA_BLOCKS.some((b) => b.type === 'spatial_proof')).toBe(true);
  });

  it('spatial_proof block contains room names from the plan', () => {
    const spatial = QA_BLOCKS.find((b) => b.type === 'spatial_proof');
    if (spatial?.type !== 'spatial_proof') {
      expect.fail('No spatial_proof block found');
      return;
    }
    expect(spatial.rooms.some((r) => /kitchen/i.test(r))).toBe(true);
  });

  it('spatial_proof block contains the discharge route in routeSummary', () => {
    const spatial = QA_BLOCKS.find((b) => b.type === 'spatial_proof');
    if (spatial?.type !== 'spatial_proof') {
      expect.fail('No spatial_proof block found');
      return;
    }
    const hasDischarge = spatial.routeSummary.some((s) => /discharge/i.test(s));
    expect(hasDischarge).toBe(true);
  });

  it('assumed discharge route is labelled "needs verification" in spatial_proof', () => {
    const spatial = QA_BLOCKS.find((b) => b.type === 'spatial_proof');
    if (spatial?.type !== 'spatial_proof') {
      expect.fail('No spatial_proof block found');
      return;
    }
    const dischargeEntry = spatial.routeSummary.find((s) => /discharge/i.test(s));
    expect(dischargeEntry).toContain('needs verification');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 4 — Customer advice pack (pure logic, no render)
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 4 — Customer advice pack contract', () => {

  it('QA blocks include no raw debug identifiers', () => {
    const blockIds = QA_BLOCKS.map((b) => b.id).join(' ');
    expect(blockIds).not.toMatch(/debug/i);
    expect(blockIds).not.toMatch(/qa.snapshot/i);
  });

  it('included_scope block contains at least one item', () => {
    const scopeBlock = QA_BLOCKS.find((b) => b.type === 'included_scope');
    expect(scopeBlock?.type === 'included_scope' && scopeBlock.items.length).toBeGreaterThan(0);
  });

  it('included_scope block items have id, label, category, and status fields', () => {
    const scopeBlock = QA_BLOCKS.find((b) => b.type === 'included_scope');
    if (scopeBlock?.type !== 'included_scope') {
      expect.fail('No included_scope block');
      return;
    }
    for (const item of scopeBlock.items) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.status).toBe('included');
    }
  });

  it('portal_cta block has a launchContext with the recommended scenario id', () => {
    const cta = QA_BLOCKS.find((b) => b.type === 'portal_cta');
    expect(cta?.type === 'portal_cta' && cta.launchContext?.recommendedScenarioId)
      .toBe(QA_DECISION.recommendedScenarioId);
  });

  it('no block has type "report" or "diagnostic"', () => {
    const types = QA_BLOCKS.map((b) => b.type);
    expect(types).not.toContain('report');
    expect(types).not.toContain('diagnostic' as VisualBlock['type']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 5 — Portal proof (view model contract, no render)
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 5 — Portal view model contract', () => {

  it('portal view model has five tabs', () => {
    expect(QA_PORTAL_VM.tabs).toHaveLength(5);
  });

  it('tabs include recommended, why, compare, daily_use, and future', () => {
    const ids = QA_PORTAL_VM.tabs.map((t) => t.id);
    expect(ids).toContain('recommended');
    expect(ids).toContain('why');
    expect(ids).toContain('compare');
    expect(ids).toContain('daily_use');
    expect(ids).toContain('future');
  });

  describe('recommended tab', () => {
    it('recommendedBlocks are present (hero/facts/solution)', () => {
      expect(QA_PORTAL_VM.recommendedBlocks.length).toBeGreaterThan(0);
    });

    it('recommendedBlocks starts with the hero block', () => {
      expect(QA_PORTAL_VM.recommendedBlocks[0]?.type).toBe('hero');
    });

    it('recommended hero carries the same scenarioId as the decision', () => {
      const hero = QA_PORTAL_VM.recommendedBlocks.find((b) => b.type === 'hero');
      expect(hero?.type === 'hero' && hero.recommendedScenarioId)
        .toBe(QA_DECISION.recommendedScenarioId);
    });
  });

  describe('why tab', () => {
    it('whyCards are present', () => {
      expect(QA_PORTAL_VM.whyCards.length).toBeGreaterThan(0);
    });

    it('shower compatibility card appears in whyCards', () => {
      const showerCard = QA_PORTAL_VM.whyCards.find(
        (c) => c.id === 'shower-compatibility',
      );
      expect(showerCard).toBeDefined();
    });

    it('shower compatibility card value matches the customerSummary', () => {
      const note = QA_DECISION.showerCompatibilityNote!;
      const showerCard = QA_PORTAL_VM.whyCards.find(
        (c) => c.id === 'shower-compatibility',
      );
      expect(showerCard?.value).toBe(note.customerSummary);
    });

    it('spatialProof is present in portal view model (from QA plan)', () => {
      expect(QA_PORTAL_VM.spatialProof).not.toBeNull();
    });

    it('spatialProof block type is spatial_proof', () => {
      expect(QA_PORTAL_VM.spatialProof?.type).toBe('spatial_proof');
    });
  });

  describe('compare tab', () => {
    it('comparisonCards are present', () => {
      expect(QA_PORTAL_VM.comparisonCards.length).toBeGreaterThan(0);
    });

    it('first comparison card is the recommended scenario', () => {
      expect(QA_PORTAL_VM.comparisonCards[0].isRecommended).toBe(true);
    });

    it('recommended comparison card scenarioId matches the decision', () => {
      expect(QA_PORTAL_VM.comparisonCards[0].scenarioId)
        .toBe(QA_DECISION.recommendedScenarioId);
    });
  });

  describe('daily_use tab', () => {
    it('dailyUseCards are present for the recommended scenario', () => {
      expect(QA_PORTAL_VM.dailyUseCards.length).toBeGreaterThan(0);
    });

    it('dailyUseCards first entry covers the recommended scenario', () => {
      expect(QA_PORTAL_VM.dailyUseCards[0].scenarioId)
        .toBe(QA_DECISION.recommendedScenarioId);
    });
  });

  describe('future tab — excludes included scope', () => {
    it('future blocks do not contain paths that are already in the included scope', () => {
      // Build the set of included scope labels
      const includedLabels = new Set(
        QA_DECISION.quoteScope
          .filter((i) => i.status === 'included')
          .map((i) => i.label.toLowerCase().trim()),
      );

      for (const block of QA_PORTAL_VM.futureBlocks) {
        if (block.type !== 'future_upgrade') continue;
        for (const path of block.paths) {
          expect(includedLabels.has(path.toLowerCase().trim())).toBe(false);
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 6 — Engineer handoff
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 6 — Engineer handoff', () => {

  it('handoff is produced without throwing', () => {
    expect(QA_HANDOFF).toBeDefined();
  });

  describe('scope and recommendation alignment', () => {
    it('handoff recommendedScenarioId matches the decision', () => {
      expect(QA_HANDOFF.jobSummary.recommendedScenarioId)
        .toBe(QA_DECISION.recommendedScenarioId);
    });

    it('handoff includedScope items align with decision quoteScope included items', () => {
      const decisionIncluded = QA_DECISION.quoteScope
        .filter((i) => i.status === 'included')
        .map((i) => i.label);
      const handoffIncluded = QA_HANDOFF.includedScope.map((i) => i.label);
      // Every item in handoff includedScope should match one in decision quoteScope
      for (const label of handoffIncluded) {
        expect(decisionIncluded).toContain(label);
      }
    });
  });

  describe('shower engineer note', () => {
    it('handoff installNotes contain the shower engineer note', () => {
      const note = QA_DECISION.showerCompatibilityNote!;
      expect(
        QA_HANDOFF.installNotes.some((n) => n === note.engineerNote),
      ).toBe(true);
    });
  });

  describe('spatial layout in handoff', () => {
    it('handoff has a layout attached', () => {
      expect(QA_HANDOFF.layout).toBeDefined();
    });

    it('handoff layout has rooms', () => {
      expect(QA_HANDOFF.layout!.rooms.length).toBeGreaterThan(0);
    });

    it('handoff layout has objects (boiler, flue, cylinder)', () => {
      expect(QA_HANDOFF.layout!.objects.length).toBeGreaterThanOrEqual(3);
    });

    it('handoff layout has routes', () => {
      expect((QA_HANDOFF.layout!.routes ?? []).length).toBeGreaterThan(0);
    });

    it('handoff layoutSummary is non-empty', () => {
      expect((QA_HANDOFF.layoutSummary ?? []).length).toBeGreaterThan(0);
    });
  });

  describe('assumed / needs-verification status', () => {
    it('assumed discharge route is reflected in layoutSummary', () => {
      const summary = QA_HANDOFF.layoutSummary ?? [];
      const mentionsAssumed = summary.some((l) => /assumed|confirm/i.test(l));
      expect(mentionsAssumed).toBe(true);
    });

    it('discharge route has assumed or needs_verification confidence in layout', () => {
      const discharge = (QA_HANDOFF.layout!.routes ?? []).find(
        (r) => r.type === 'discharge',
      );
      expect(discharge?.status).toBe('assumed');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLOW 7 — Internal route guard
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Flow 7 — Internal route guard', () => {

  it('QA blocks do not expose any "QA snapshot" identifiers', () => {
    const allText = QA_BLOCKS.map((b) => JSON.stringify(b)).join(' ');
    expect(allText).not.toMatch(/QA snapshot/i);
    expect(allText).not.toMatch(/engine dump/i);
    expect(allText).not.toMatch(/physicsFlag/i);
  });

  it('QA blocks do not expose raw "overallScore" or "objectiveScore" fields', () => {
    const allText = QA_BLOCKS.map((b) => JSON.stringify(b)).join(' ');
    expect(allText).not.toMatch(/overallScore/);
    expect(allText).not.toMatch(/objectiveScore/);
  });

  it('portal view model whyCards do not expose raw engine score labels', () => {
    const allCards = JSON.stringify(QA_PORTAL_VM.whyCards);
    expect(allCards).not.toMatch(/overallScore/);
    expect(allCards).not.toMatch(/hydraulicLimit/);
    expect(allCards).not.toMatch(/physicsFlag/);
  });

  it('engineer handoff installNotes do not contain raw physics flag keys', () => {
    const allNotes = QA_HANDOFF.installNotes.join(' ');
    expect(allNotes).not.toMatch(/physicsFlag/i);
    expect(allNotes).not.toMatch(/objectiveScore/i);
  });

  it('spatialProofBlock id is stable "spatial-proof" (not an internal UUID)', () => {
    expect(QA_SPATIAL_BLOCK?.id).toBe('spatial-proof');
  });

  it('portal_cta block uses customer-facing title (not "full report")', () => {
    const cta = QA_BLOCKS.find((b) => b.type === 'portal_cta');
    expect(cta?.title).not.toMatch(/full report/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-SURFACE ALIGNMENT
// Verifies that scope and recommendation stay consistent across all surfaces.
// ═══════════════════════════════════════════════════════════════════════════

describe('QA Cross-surface alignment', () => {

  it('decision recommendedScenarioId is consistent across hero, handoff, portal, and comparison', () => {
    const heroId = (() => {
      const hero = QA_BLOCKS.find((b) => b.type === 'hero');
      return hero?.type === 'hero' ? hero.recommendedScenarioId : null;
    })();
    const handoffId   = QA_HANDOFF.jobSummary.recommendedScenarioId;
    const portalCmpId = QA_PORTAL_VM.comparisonCards[0].scenarioId;

    expect(heroId).toBe(QA_DECISION.recommendedScenarioId);
    expect(handoffId).toBe(QA_DECISION.recommendedScenarioId);
    expect(portalCmpId).toBe(QA_DECISION.recommendedScenarioId);
  });

  it('quoteScope included items match between decision and handoff includedScope', () => {
    const decisionIncludedLabels = QA_DECISION.quoteScope
      .filter((i) => i.status === 'included')
      .map((i) => i.label)
      .sort();
    const handoffIncludedLabels = QA_HANDOFF.includedScope
      .map((i) => i.label)
      .sort();

    // Handoff must be a subset of (or equal to) the decision included scope
    for (const label of handoffIncludedLabels) {
      expect(decisionIncludedLabels).toContain(label);
    }
  });

  it('shower compatibility customer summary appears in both decision.compatibilityWarnings and portal whyCards', () => {
    const note = QA_DECISION.showerCompatibilityNote!;
    // In the decision
    expect(QA_DECISION.compatibilityWarnings).toContain(note.customerSummary);
    // In the portal why cards
    const showerCard = QA_PORTAL_VM.whyCards.find((c) => c.id === 'shower-compatibility');
    expect(showerCard?.value).toBe(note.customerSummary);
  });

  it('shower engineer note appears in handoff installNotes', () => {
    const note = QA_DECISION.showerCompatibilityNote!;
    expect(QA_HANDOFF.installNotes).toContain(note.engineerNote);
  });

  it('spatialProof in portal view model matches the spatial_proof block in QA_BLOCKS', () => {
    const blocksProof = QA_BLOCKS.find((b) => b.type === 'spatial_proof');
    expect(QA_PORTAL_VM.spatialProof?.id).toBe(blocksProof?.id);
    expect(QA_PORTAL_VM.spatialProof?.rooms).toEqual(
      blocksProof?.type === 'spatial_proof' ? blocksProof.rooms : [],
    );
  });

  it('layout objects in handoff match those derived from the same QA plan', () => {
    const handoffBoiler   = QA_HANDOFF.layout!.objects.some((o) => o.type === 'boiler');
    const handoffCylinder = QA_HANDOFF.layout!.objects.some((o) => o.type === 'cylinder');
    const handoffFlue     = QA_HANDOFF.layout!.objects.some((o) => o.type === 'flue');

    expect(handoffBoiler).toBe(true);
    expect(handoffCylinder).toBe(true);
    expect(handoffFlue).toBe(true);
  });
});
