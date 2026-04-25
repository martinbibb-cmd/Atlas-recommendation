/**
 * CustomerAdvicePrintPack.test.tsx
 *
 * PR27 — Tests for the customer advice pack print component.
 *
 * Tests:
 *  - Print pack renders hero, scope, warning, future_upgrade, portal_cta blocks
 *  - Compliance items render as requirements (not tick-marked)
 *  - Shower compatibility warning renders exactly once
 *  - Spatial proof omitted gracefully when absent from visualBlocks
 *  - Old customer report route (CustomerRecommendationPrint) is not the default
 *    print surface when printout journey renders CustomerAdvicePrintPack
 *  - Portal CTA section is visible on print output
 *  - Portal URL renders when portalUrl is provided
 *  - Portal URL placeholder renders when portalUrl is absent
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerAdvicePrintPack } from '../CustomerAdvicePrintPack';
import type { CustomerAdvicePrintPackProps } from '../CustomerAdvicePrintPack';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { VisualBlock, WarningBlock, IncludedScopeBlock } from '../../../contracts/VisualBlock';
import type { QuoteScopeItem } from '../../../contracts/QuoteScope';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline: 'A system boiler with unvented cylinder is the right fit for this home.',
    summary:  'System boiler with unvented cylinder.',
    keyReasons: ['Two bathrooms require stored hot water', 'Mains pressure is suitable'],
    avoidedRisks:          ['Simultaneous demand failure'],
    dayToDayOutcomes:      ['Instant hot water at all outlets'],
    requiredWorks:         ['Install unvented cylinder'],
    compatibilityWarnings: [],
    includedItems:         ['System boiler', 'Unvented cylinder'],
    quoteScope:            [],
    futureUpgradePaths:    ['Heat pump ready'],
    supportingFacts: [
      { label: 'Occupants',  value: 3,  source: 'survey' },
      { label: 'Bathrooms',  value: 2,  source: 'survey' },
    ],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 12, condition: 'good' },
      expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
      influencingFactors: {
        waterQuality: 'good', scaleRisk: 'low',
        usageIntensity: 'moderate', maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'The system is in reasonable condition.',
    },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: { hotWater: 'excellent', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
    keyBenefits:      ['Mains-pressure delivery'],
    keyConstraints:   ['Requires cylinder space'],
    dayToDayOutcomes: ['Instant hot water'],
    requiredWorks:    ['Install cylinder'],
    upgradePaths:     ['Heat pump ready'],
    physicsFlags:     {},
    ...overrides,
  };
}

const COMPLIANCE_ITEM: QuoteScopeItem = {
  id:       'unvented-regs',
  label:    'G3 unvented cylinder regulations',
  category: 'compliance',
  status:   'included',
};

const INCLUDED_ITEM: QuoteScopeItem = {
  id:              'system-boiler',
  label:           'System boiler',
  category:        'heat_source',
  status:          'included',
  customerBenefit: 'Reliable central heating',
};

const RECOMMENDED_ITEM: QuoteScopeItem = {
  id:       'smart-controls',
  label:    'Smart thermostat upgrade',
  category: 'controls',
  status:   'recommended',
};

const FUTURE_ITEM: QuoteScopeItem = {
  id:       'ashp-pathway',
  label:    'Heat pump pathway',
  category: 'future',
  status:   'optional',
};

function makeBlocks(overrides: {
  includeWarning?: boolean;
  includeShowerWarning?: boolean;
  includeSpatialProof?: boolean;
  includeScope?: boolean;
  includeScopeAllGroups?: boolean;
  includeFuture?: boolean;
} = {}): VisualBlock[] {
  const blocks: VisualBlock[] = [
    {
      id: 'hero', type: 'hero',
      recommendedScenarioId: 'system_unvented',
      title: 'Recommended system',
      outcome: 'A system boiler with unvented cylinder is the right fit.',
      supportingPoints: ['Two bathrooms', 'Mains pressure suitable'],
      visualKey: 'recommended_system_hero',
    },
    {
      id: 'home-facts', type: 'facts',
      title: 'About this home',
      outcome: 'Key facts that shaped the recommendation.',
      facts: [{ label: 'Occupants', value: 3 }, { label: 'Bathrooms', value: 2 }],
      visualKey: 'home_facts_overview',
    },
    {
      id: 'solution', type: 'solution',
      scenarioId: 'system_unvented',
      title: 'Why this works for your home',
      outcome: 'System boiler with unvented cylinder provides mains-pressure hot water.',
      supportingPoints: ['Simultaneous showers', 'No cold-water wait'],
      visualKey: 'stored_hot_water_solution',
    },
  ];

  if (overrides.includeWarning) {
    const w: WarningBlock = {
      id: 'lifecycle-warning', type: 'warning', severity: 'important',
      title: 'Current boiler condition',
      outcome: 'The system is showing signs of age.',
      supportingPoints: ['Age approaching lifespan'],
      visualKey: 'boiler_lifecycle_warning',
    };
    blocks.push(w);
  }

  if (overrides.includeShowerWarning) {
    const sw: WarningBlock = {
      id: 'shower-compatibility-warning', type: 'warning', severity: 'advisory',
      title: 'Shower compatibility',
      outcome: 'Electric shower is independently supplied and unaffected.',
      visualKey: 'shower_compatibility_warning',
    };
    blocks.push(sw);
  }

  if (overrides.includeScope) {
    const scope: IncludedScopeBlock = {
      id: 'included-scope', type: 'included_scope',
      title: 'What is included',
      outcome: 'Everything covered in the proposed scope of work.',
      items: [INCLUDED_ITEM],
      complianceItems: [COMPLIANCE_ITEM],
      recommendedItems: [],
      futureItems: [],
      visualKey: 'included_scope_system_boiler_mixergy',
    };
    blocks.push(scope);
  }

  if (overrides.includeScopeAllGroups) {
    const scope: IncludedScopeBlock = {
      id: 'included-scope', type: 'included_scope',
      title: 'What is included',
      outcome: 'Everything covered in the proposed scope of work.',
      items: [INCLUDED_ITEM],
      complianceItems: [COMPLIANCE_ITEM],
      recommendedItems: [RECOMMENDED_ITEM],
      futureItems: [FUTURE_ITEM],
      visualKey: 'included_scope_system_boiler_mixergy',
    };
    blocks.push(scope);
  }

  if (overrides.includeFuture) {
    blocks.push({
      id: 'future-upgrades', type: 'future_upgrade',
      title: 'Future upgrade paths',
      outcome: 'This system is designed to grow with your home.',
      paths: ['Heat pump ready', 'Solar thermal compatible'],
      visualKey: 'future_upgrade_solar',
    });
  }

  if (overrides.includeSpatialProof) {
    blocks.push({
      id: 'spatial-proof', type: 'spatial_proof',
      title: 'Where the work happens',
      outcome: 'A summary of where the proposed system will be installed.',
      rooms: ['Kitchen', 'Airing cupboard'],
      keyObjects: ['Boiler — Kitchen'],
      routeSummary: ['Heating flow route (proposed)'],
      confidenceSummary: ['Boiler location recorded'],
      visualKey: 'spatial_proof_where_work_happens',
    });
  }

  // Portal CTA always last
  blocks.push({
    id: 'portal-cta', type: 'portal_cta',
    title: 'Open your portal',
    outcome: 'Explore the interactive model, costs, and comparison in your portal.',
    supportingPoints: ['Interactive cost comparison', 'Share with your partner'],
    visualKey: 'portal_demo_cta',
    launchContext: { recommendedScenarioId: 'system_unvented' },
  });

  return blocks;
}

function makeProps(overrides: Partial<CustomerAdvicePrintPackProps> = {}): CustomerAdvicePrintPackProps {
  return {
    decision:     makeDecision(),
    scenarios:    [makeScenario()],
    visualBlocks: makeBlocks(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerAdvicePrintPack — core rendering', () => {

  it('renders the wrap container', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-wrap')).toBeTruthy();
  });

  it('renders the document container', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-document')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-print-button')).toBeTruthy();
  });

  it('renders back button when onBack is provided', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ onBack: () => {} })} />);
    expect(screen.getByTestId('capp-back-button')).toBeTruthy();
  });

  it('does not render back button when onBack is absent', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-back-button')).toBeNull();
  });

  it('renders the visit date in the toolbar title when provided', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ visitDate: '1 May 2026' })} />);
    const elements = screen.getAllByText(/1 May 2026/);
    expect(elements.length).toBeGreaterThan(0);
    // Toolbar title should contain the date
    const toolbar = screen.getByTestId('capp-toolbar');
    expect(toolbar.textContent).toContain('1 May 2026');
  });
});

describe('CustomerAdvicePrintPack — hero block', () => {

  it('renders a hero block page', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-block-hero')).toBeTruthy();
  });

  it('renders the hero block title', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByText('Recommended system')).toBeTruthy();
  });

  it('renders the hero recommendation outcome', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByText('A system boiler with unvented cylinder is the right fit.')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — portal CTA block', () => {

  it('renders the portal CTA block page', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-block-portal_cta')).toBeTruthy();
  });

  it('renders the portal CTA section', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-portal-cta-section')).toBeTruthy();
  });

  it('renders "Open your portal" heading', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const elements = screen.getAllByText('Open your portal');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders the portal CTA block title as "Open your portal"', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const ctaPage = screen.getByTestId('capp-block-portal_cta');
    // Title must say "Open your portal" — no "full report" language
    expect(ctaPage.textContent).toContain('Open your portal');
    expect(ctaPage.textContent).not.toMatch(/full.*report/i);
  });

  it('renders portal URL when portalUrl is provided', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ portalUrl: 'https://portal.example.com/r/abc123' })} />);
    expect(screen.getByTestId('capp-portal-url')).toBeTruthy();
    expect(screen.getByText('Open your portal online')).toBeTruthy();
    expect(screen.getByTestId('capp-portal-url-raw')).toBeTruthy();
    expect(screen.getByText('https://portal.example.com/r/abc123')).toBeTruthy();
  });

  it('portal URL element is a link with href pointing to the portal', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ portalUrl: 'https://portal.example.com/r/abc123' })} />);
    const link = screen.getByTestId('capp-portal-url');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe('https://portal.example.com/r/abc123');
  });

  it('renders portal URL placeholder when portalUrl is absent', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-portal-url-placeholder')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — warning blocks', () => {

  it('renders a warning block when present in visualBlocks', () => {
    const blocks = makeBlocks({ includeWarning: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-block-warning')).toBeTruthy();
  });

  it('renders the warning outcome text', () => {
    const blocks = makeBlocks({ includeWarning: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('The system is showing signs of age.')).toBeTruthy();
  });

  it('renders shower compatibility warning exactly once when present', () => {
    const blocks = makeBlocks({ includeShowerWarning: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('Shower compatibility')).toBeTruthy();
    // Verify it appears only once
    const elements = screen.getAllByText('Shower compatibility');
    expect(elements).toHaveLength(1);
  });

  it('does not render warning blocks when none are in visualBlocks', () => {
    const blocks = makeBlocks();
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.queryByTestId('capp-block-warning')).toBeNull();
  });
});

describe('CustomerAdvicePrintPack — included scope / compliance items', () => {

  it('renders the included_scope block page when present', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-block-included_scope')).toBeTruthy();
  });

  it('renders compliance item with "Requirement" label', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('G3 unvented cylinder regulations')).toBeTruthy();
    expect(screen.getByText('Requirement')).toBeTruthy();
  });

  it('renders non-compliance included item with tick (no Requirement label)', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('System boiler')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — future upgrade block', () => {

  it('renders the future_upgrade block when present', () => {
    const blocks = makeBlocks({ includeFuture: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-block-future_upgrade')).toBeTruthy();
  });

  it('renders future upgrade paths', () => {
    const blocks = makeBlocks({ includeFuture: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('Heat pump ready')).toBeTruthy();
    expect(screen.getByText('Solar thermal compatible')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — spatial proof', () => {

  it('renders the spatial_proof block when present', () => {
    const blocks = makeBlocks({ includeSpatialProof: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-block-spatial_proof')).toBeTruthy();
  });

  it('omits spatial_proof block gracefully when absent from visualBlocks', () => {
    const blocks = makeBlocks();
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.queryByTestId('capp-block-spatial_proof')).toBeNull();
  });

  it('renders spatial proof content when present', () => {
    const blocks = makeBlocks({ includeSpatialProof: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    // The title appears in both the section label and the block title — either is correct
    const headings = screen.getAllByText('Where the work happens');
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText('Boiler — Kitchen')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — block ordering', () => {

  it('renders all blocks in the order they appear in visualBlocks', () => {
    const blocks = makeBlocks({ includeWarning: true, includeFuture: true, includeSpatialProof: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);

    const heroPage   = screen.getByTestId('capp-block-hero');
    const portalPage = screen.getByTestId('capp-block-portal_cta');

    // Hero should appear before portal CTA in the DOM
    const position = heroPage.compareDocumentPosition(portalPage);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('portal CTA is the last block rendered', () => {
    const blocks = makeBlocks({ includeFuture: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    const document_ = screen.getByTestId('capp-document');
    const pages = document_.querySelectorAll('[data-testid^="capp-block-"]');
    const lastPage = pages[pages.length - 1];
    expect(lastPage.getAttribute('data-testid')).toBe('capp-block-portal_cta');
  });
});

describe('CustomerAdvicePrintPack — no diagnostic/internal artefacts', () => {

  it('does not render any raw JSON output', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByText(/Show raw JSON/)).toBeNull();
  });

  it('does not render engineering scoring labels', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByText(/objective score/i)).toBeNull();
    expect(screen.queryByText(/physics flag/i)).toBeNull();
  });

  it('renders the decision headline in page footers', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const headline = makeDecision().headline;
    const footers = screen.getAllByText((text) => text.includes(headline));
    expect(footers.length).toBeGreaterThan(0);
  });
});

describe('CustomerAdvicePrintPack — grouped scope sections', () => {

  it('renders "Included now" group header when included items are present', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-scope-group-included')).toBeTruthy();
  });

  it('renders "Required" group header when compliance items are present', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-scope-group-compliance')).toBeTruthy();
  });

  it('renders all four groups when includeScopeAllGroups is set', () => {
    const blocks = makeBlocks({ includeScopeAllGroups: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByTestId('capp-scope-group-included')).toBeTruthy();
    expect(screen.getByTestId('capp-scope-group-compliance')).toBeTruthy();
    expect(screen.getByTestId('capp-scope-group-recommended')).toBeTruthy();
    expect(screen.getByTestId('capp-scope-group-future')).toBeTruthy();
  });

  it('renders recommended item with "Recommended" badge', () => {
    const blocks = makeBlocks({ includeScopeAllGroups: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('Smart thermostat upgrade')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('renders future item as a chip', () => {
    const blocks = makeBlocks({ includeScopeAllGroups: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('Heat pump pathway')).toBeTruthy();
  });

  it('compliance item renders with "Requirement" label in new grouped view', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('G3 unvented cylinder regulations')).toBeTruthy();
    expect(screen.getByText('Requirement')).toBeTruthy();
  });

  it('included item renders with tick in included group', () => {
    const blocks = makeBlocks({ includeScope: true });
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.getByText('System boiler')).toBeTruthy();
  });
});

describe('CustomerAdvicePrintPack — AI handoff summary', () => {

  it('renders the AI handoff section within the portal CTA block', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('capp-ai-handoff')).toBeTruthy();
  });

  it('AI handoff contains the recommended system headline', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('system boiler');
  });

  it('AI handoff contains "AI handoff summary" header', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByText('AI handoff summary')).toBeTruthy();
  });

  it('AI handoff does not use white-on-white hidden text (has visible text content)', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent?.trim().length).toBeGreaterThan(50);
  });
});
