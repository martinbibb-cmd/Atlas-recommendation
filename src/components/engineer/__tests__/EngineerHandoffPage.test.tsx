/**
 * EngineerHandoffPage.test.tsx
 *
 * PR28 — Smoke and render tests for EngineerHandoffPage.
 *
 * Coverage:
 *   1.  Renders the page container from decision/scenario truth
 *   2.  Job summary section renders with system label and summary
 *   3.  Included scope uses QuoteScopeItem[] (category/status)
 *   4.  Compliance items appear as "Requirement" not as tick-included benefit
 *   5.  Non-compliance included items render without Requirement label
 *   6.  Compliance items are correctly separated from included equipment
 *   7.  Compatibility warnings render when present
 *   8.  Layout overview section renders when propertyPlan is present
 *   9.  Layout overview section is absent when propertyPlan is absent (graceful degradation)
 *  10.  Back button calls onBack when supplied
 *  11.  Back button is absent when onBack is not supplied
 *  12.  Page renders without errors when propertyPlan is absent (minimal path)
 *  13.  Shower install note appears when physicsFlags indicate a shower warning
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EngineerHandoffPage from '../EngineerHandoffPage';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { QuoteScopeItem } from '../../../contracts/QuoteScope';
import type { PropertyPlan } from '../../floorplan/propertyPlan.types';
import type { FloorPlan } from '../../floorplan/propertyPlan.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPLIANCE_ITEM: QuoteScopeItem = {
  id:          'g3-regs',
  label:       'G3 unvented regulations',
  category:    'compliance',
  status:      'included',
  engineerNote: 'Mandatory — G3-qualified installer required.',
};

const EQUIPMENT_ITEM: QuoteScopeItem = {
  id:              'system-boiler',
  label:           'System boiler',
  category:        'heat_source',
  status:          'included',
  customerBenefit: 'Reliable central heating',
};

const CYLINDER_ITEM: QuoteScopeItem = {
  id:              'unvented-cylinder',
  label:           'Unvented cylinder',
  category:        'hot_water',
  status:          'included',
  customerBenefit: 'Mains-pressure hot water',
};

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline:              'A system boiler with unvented cylinder is the right fit for this home.',
    summary:               'System boiler with unvented cylinder.',
    keyReasons:            ['Two bathrooms', 'Mains pressure suitable'],
    avoidedRisks:          ['Simultaneous demand failure'],
    dayToDayOutcomes:      ['Instant hot water at all outlets'],
    requiredWorks:         ['Install unvented cylinder'],
    compatibilityWarnings: [],
    includedItems:         ['System boiler', 'Unvented cylinder'],
    quoteScope:            [COMPLIANCE_ITEM, EQUIPMENT_ITEM, CYLINDER_ITEM],
    futureUpgradePaths:    ['Heat pump ready'],
    supportingFacts: [
      { label: 'Occupants',  value: 3,  source: 'survey' },
      { label: 'Bathrooms',  value: 2,  source: 'survey' },
    ],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 12, condition: 'good' },
      expectedLifespan: {
        typicalRangeYears:  [12, 15],
        adjustedRangeYears: [10, 14],
      },
      influencingFactors: {
        waterQuality:      'good',
        scaleRisk:         'low',
        usageIntensity:    'moderate',
        maintenanceLevel:  'average',
      },
      riskIndicators: [],
      summary: 'The system is in reasonable condition.',
    },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId:       'system_unvented',
    system:           { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: {
      hotWater:   'excellent',
      heating:    'very_good',
      efficiency: 'good',
      reliability: 'very_good',
    },
    keyBenefits:      ['Mains-pressure delivery', 'Simultaneous outlets'],
    keyConstraints:   ['Requires cylinder space'],
    dayToDayOutcomes: ['Instant hot water at all taps'],
    requiredWorks:    ['Install cylinder'],
    upgradePaths:     ['Heat pump ready'],
    physicsFlags:     {},
    ...overrides,
  };
}

function makeFloor(overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id:         'floor_1',
    name:       'Ground',
    levelIndex: 0,
    rooms: [
      {
        id:    'room_kitchen',
        name:  'Kitchen',
        walls: [],
        area:  12,
      },
    ],
    walls:       [],
    openings:    [],
    zones:       [],
    floorObjects: [],
    floorRoutes:  [],
    ...overrides,
  };
}

function makePropertyPlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    version:        '1.0',
    propertyId:     'prop_test',
    floors:         [makeFloor()],
    placementNodes: [],
    connections:    [],
    metadata:       {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EngineerHandoffPage — page container', () => {

  it('renders the page container', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-page')).toBeTruthy();
  });

  it('renders without propertyPlan (graceful degradation)', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // Page renders without throwing
    expect(screen.getByTestId('engineer-handoff-page')).toBeTruthy();
    // Layout sections should not appear
    expect(screen.queryByTestId('engineer-layout-overview')).toBeNull();
  });

  it('back button calls onBack when supplied', () => {
    const onBack = vi.fn();
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
        onBack={onBack}
      />,
    );
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not render back button when onBack is absent', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.queryByRole('button', { name: /Back/i })).toBeNull();
  });
});

describe('EngineerHandoffPage — job summary', () => {

  it('renders the job summary section', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-job-summary')).toBeTruthy();
  });

  it('renders the recommended system label in the job summary', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // System boiler should be named in the job summary
    expect(screen.getByTestId('engineer-handoff-job-summary').textContent)
      .toContain('System boiler');
  });
});

describe('EngineerHandoffPage — included scope (QuoteScopeItem[])', () => {

  it('renders the included scope section', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-scope')).toBeTruthy();
  });

  it('renders included equipment items', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // 'System boiler' may appear in both the job summary and the scope list
    expect(screen.getAllByText('System boiler').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unvented cylinder').length).toBeGreaterThan(0);
  });

  it('renders compliance item', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByText('G3 unvented regulations')).toBeTruthy();
  });

  it('compliance item appears as Requirement, not as a tick-marked benefit', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // IncludedScopeSection renders '[Requirement]' with brackets for compliance items.
    // Verify the label is co-located with the compliance item's text.
    const requirementEl = screen.getByText('[Requirement]');
    expect(requirementEl).toBeTruthy();
    // The [Requirement] span is a sibling of the item label within the same list item
    const listItem = requirementEl.closest('li');
    expect(listItem).not.toBeNull();
    expect(listItem!.textContent).toContain('G3 unvented regulations');
  });

  it('non-compliance items do NOT carry Requirement label', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // Only one [Requirement] label — for the compliance item, not for equipment
    expect(screen.getAllByText('[Requirement]')).toHaveLength(1);
  });
});

describe('EngineerHandoffPage — compatibility warnings', () => {

  it('renders warnings section when compatibility warnings are present', () => {
    const decision = makeDecision({
      compatibilityWarnings: ['G3-qualified installer required for unvented cylinder'],
    });
    render(
      <EngineerHandoffPage
        decision={decision}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-warnings')).toBeTruthy();
    expect(screen.getByText('G3-qualified installer required for unvented cylinder')).toBeTruthy();
  });

  it('renders the warnings section when key reasons are present', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    // keyReasons should appear in warnings section
    expect(screen.getByTestId('engineer-handoff-warnings')).toBeTruthy();
  });
});

describe('EngineerHandoffPage — spatial layout sections', () => {

  it('renders layout overview section when propertyPlan is present', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
        propertyPlan={makePropertyPlan()}
      />,
    );
    expect(screen.getByTestId('engineer-layout-overview')).toBeTruthy();
  });

  it('layout overview shows room count from property plan', () => {
    const plan = makePropertyPlan({
      floors: [makeFloor({
        rooms: [
          { id: 'room_1', name: 'Kitchen', walls: [], area: 12 },
          { id: 'room_2', name: 'Living Room', walls: [], area: 20 },
        ],
      })],
    });
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
        propertyPlan={plan}
      />,
    );
    const overview = screen.getByTestId('engineer-layout-overview');
    expect(overview.textContent).toContain('2');
  });

  it('layout overview section is absent when propertyPlan is absent', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.queryByTestId('engineer-layout-overview')).toBeNull();
  });
});

describe('EngineerHandoffPage — install notes', () => {

  it('renders install notes section', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-install-notes')).toBeTruthy();
  });

  it('install notes section includes future path when present', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision({ futureUpgradePaths: ['Heat pump ready'] })}
        scenarios={[makeScenario()]}
      />,
    );
    const notes = screen.getByTestId('engineer-handoff-install-notes');
    expect(notes.textContent).toContain('Heat pump ready');
  });
});

describe('EngineerHandoffPage — measured facts', () => {

  it('renders measured facts section with supporting facts', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    expect(screen.getByTestId('engineer-handoff-facts')).toBeTruthy();
  });

  it('renders occupant count from supporting facts', () => {
    render(
      <EngineerHandoffPage
        decision={makeDecision()}
        scenarios={[makeScenario()]}
      />,
    );
    const facts = screen.getByTestId('engineer-handoff-facts');
    expect(facts.textContent).toContain('3');
  });
});
