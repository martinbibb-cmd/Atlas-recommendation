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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerAdvicePrintPack } from '../CustomerAdvicePrintPack';
import type { CustomerAdvicePrintPackProps } from '../CustomerAdvicePrintPack';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { VisualBlock, WarningBlock, IncludedScopeBlock } from '../../../contracts/VisualBlock';
import type { QuoteScopeItem } from '../../../contracts/QuoteScope';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';

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
    // "Heat pump ready" may appear in both the future_upgrade block and the AI context block
    expect(screen.getAllByText('Heat pump ready').length).toBeGreaterThan(0);
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

  it('AI handoff contains the recommended system headline when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('system boiler');
  });

  it('AI handoff contains "Want to understand this in more detail?" header', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByText('Want to understand this in more detail?')).toBeTruthy();
  });

  it('AI handoff does not use white-on-white hidden text (has visible text content)', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent?.trim().length).toBeGreaterThan(50);
  });

  // ── Acceptance criteria: evidence-aware handoff (require printFullAiHandoff) ─

  it('AI handoff includes a clear assistant introduction when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('Atlas has helped me understand your home');
    expect(handoff.textContent).toContain('Instructions for the AI assistant');
  });

  it('AI handoff warns that AI systems can make mistakes when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('AI systems can make mistakes');
  });

  it('AI handoff instructs the assistant to validate using trusted sources when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('Trusted source categories');
    expect(handoff.textContent).toContain('Manufacturer installation manuals');
    expect(handoff.textContent).toContain('Ofgem');
  });

  it('AI handoff preserves Atlas as the case-specific source when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('supplied Atlas payload as the primary case-specific source');
    expect(handoff.textContent).toContain('Case-specific Atlas data');
  });

  it('AI handoff includes source use rules when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('Source use rules');
    expect(handoff.textContent).toContain('Never override site-specific Atlas facts');
  });

  it('AI handoff instructs assistant not to invent missing facts when full text is printed', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('Do not invent missing facts');
  });
});

describe('CustomerAdvicePrintPack — options considered (AI handoff)', () => {

  it('AI handoff uses "Options considered" heading, not "Rejected alternatives"', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).not.toContain('Rejected alternatives');
  });

  it('empty included scope shows the advisor fallback message', () => {
    const emptyScope: IncludedScopeBlock = {
      id: 'included-scope',
      type: 'included_scope',
      title: 'What is included',
      outcome: 'Everything covered in the proposed scope of work.',
      items: [],
      complianceItems: [],
      recommendedItems: [],
      futureItems: [],
      visualKey: 'included_scope_system_boiler_mixergy',
    };
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: [emptyScope] })} />);
    expect(screen.getByTestId('capp-scope-empty')).toBeTruthy();
    expect(screen.getByText('Scope not fully captured yet — confirm quote inclusions before presenting this pack.')).toBeTruthy();
  });
});

// ─── Problem block suppression ────────────────────────────────────────────────

describe('CustomerAdvicePrintPack — ProblemBlock suppression', () => {

  function makeProblemBlock(): VisualBlock {
    return {
      id: 'problem-block',
      type: 'problem',
      title: 'Why your home needs stored hot water',
      outcome: 'On-demand combi cannot sustain simultaneous demand.',
      supportingPoints: ['24 kW at 10 L/min', 'ΔT 35°C'],
      visualKey: 'combi_concurrency_problem',
    } as VisualBlock;
  }

  it('does NOT render a problem block by default (showRejectedOptionProof=false)', () => {
    const blocks = [...makeBlocks(), makeProblemBlock()];
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.queryByTestId('capp-block-problem')).toBeNull();
  });

  it('renders a problem block when showRejectedOptionProof=true', () => {
    const blocks = [...makeBlocks(), makeProblemBlock()];
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks, showRejectedOptionProof: true })} />);
    expect(screen.getByTestId('capp-block-problem')).toBeTruthy();
  });

  it('does NOT render combi maths prose in default print pack', () => {
    const blocks = [...makeBlocks(), makeProblemBlock()];
    render(<CustomerAdvicePrintPack {...makeProps({ visualBlocks: blocks })} />);
    expect(screen.queryByText('On-demand combi cannot sustain simultaneous demand.')).toBeNull();
  });
});

// ─── Compact AI handoff ───────────────────────────────────────────────────────

describe('CustomerAdvicePrintPack — compact AI handoff (printFullAiHandoff=false)', () => {

  it('does NOT render the full AI text <pre> block by default', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-ai-handoff-text')).toBeNull();
  });

  it('renders the AI handoff heading even without full text', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByText('Want to understand this in more detail?')).toBeTruthy();
  });

  it('renders the compact copy prompt directing to portal link', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const handoff = screen.getByTestId('capp-ai-handoff');
    expect(handoff.textContent).toContain('installer can share a full AI summary via your portal link');
    expect(handoff.textContent).toContain('machine-readable AI summary inside this PDF as an optional export');
  });

  it('renders the full AI text when printFullAiHandoff=true', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    expect(screen.getByTestId('capp-ai-handoff-text')).toBeTruthy();
  });

  it('full AI text contains the assistant intro when printFullAiHandoff=true', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ printFullAiHandoff: true })} />);
    const text = screen.getByTestId('capp-ai-handoff-text');
    expect(text.textContent).toContain('Atlas has helped me understand your home');
  });
});

// ─── CustomerSummaryV1 trust boundary ─────────────────────────────────────────

describe('CustomerAdvicePrintPack — CustomerSummaryV1 trust boundary', () => {

  // ── Fixtures ──────────────────────────────────────────────────────────────

  function makeAshpDecision(): AtlasDecisionV1 {
    return {
      recommendedScenarioId: 'ashp',
      headline: 'An air source heat pump is the right fit for this home.',
      summary:  'Air source heat pump with low-temperature radiators.',
      keyReasons: ['Low heat loss at modern fabric standard', 'Compatible flow temperature'],
      avoidedRisks: ['Gas dependency', 'Inefficient combi operation at low load'],
      dayToDayOutcomes: ['Steady background warmth', 'Silent outdoor unit operation'],
      requiredWorks: ['Radiator upsizing', 'Low-loss header installation'],
      compatibilityWarnings: [],
      includedItems: ['Air source heat pump', 'Cylinder'],
      quoteScope: [],
      futureUpgradePaths: ['Solar PV ready'],
      supportingFacts: [
        { label: 'Occupants', value: 2, source: 'survey' },
        { label: 'Bathrooms', value: 1, source: 'survey' },
      ],
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 14, condition: 'worn' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 13] },
        influencingFactors: {
          waterQuality: 'good', scaleRisk: 'low',
          usageIntensity: 'low', maintenanceLevel: 'average',
        },
        riskIndicators: [],
        summary: 'The system is approaching end of lifespan.',
      },
    };
  }

  function makeAshpScenario(): ScenarioResult {
    return {
      scenarioId: 'ashp',
      system: { type: 'ashp', summary: 'Air source heat pump' },
      performance: { hotWater: 'good', heating: 'very_good', efficiency: 'excellent', reliability: 'very_good' },
      keyBenefits: ['High efficiency', 'Low running cost'],
      keyConstraints: [],
      dayToDayOutcomes: ['Steady warmth'],
      requiredWorks: ['Radiator upsizing'],
      upgradePaths: ['Solar PV ready'],
      physicsFlags: {},
    };
  }

  function makeCombiScenario(): ScenarioResult {
    return {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler replacement' },
      performance: { hotWater: 'adequate', heating: 'good', efficiency: 'good', reliability: 'good' },
      keyBenefits: ['Simple installation'],
      keyConstraints: ["Not suitable for this home's heat loss profile"],
      dayToDayOutcomes: ['Instant hot water'],
      requiredWorks: [],
      upgradePaths: [],
      physicsFlags: {},
    };
  }

  function makeAshpBlocks(): VisualBlock[] {
    return [
      {
        id: 'hero', type: 'hero',
        recommendedScenarioId: 'ashp',
        title: 'Recommended system',
        outcome: 'An air source heat pump is the right fit.',
        supportingPoints: ['Low heat loss home', 'Compatible flow temperature'],
        visualKey: 'recommended_system_hero',
      },
      {
        id: 'portal-cta', type: 'portal_cta',
        title: 'Open your portal',
        outcome: 'Explore the interactive model.',
        supportingPoints: [],
        visualKey: 'portal_demo_cta',
        launchContext: { recommendedScenarioId: 'ashp' },
      },
    ];
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  it('builds CustomerSummaryV1 internally when no lockedSummary prop is passed', () => {
    // When no lockedSummary is supplied, the component derives it from decision + scenarios.
    // We verify this by checking that AI handoff text contains the system label from
    // buildCustomerSummary (which maps scenario system type to a human label).
    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario()]}
        visualBlocks={makeAshpBlocks()}
        printFullAiHandoff
      />
    );
    const handoff = screen.getByTestId('capp-ai-handoff-text');
    expect(handoff.textContent).toContain('Air source heat pump');
  });

  it('renders the selected ASHP summary when ASHP is selected and combi is rejected', () => {
    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario(), makeCombiScenario()]}
        visualBlocks={makeAshpBlocks()}
        printFullAiHandoff
      />
    );
    const handoff = screen.getByTestId('capp-ai-handoff-text');
    expect(handoff.textContent).toContain('Air source heat pump');
    expect(handoff.textContent).toContain('An air source heat pump is the right fit for this home.');
  });

  it('does not render rejected combi as advice in the AI handoff', () => {
    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario(), makeCombiScenario()]}
        visualBlocks={makeAshpBlocks()}
        printFullAiHandoff
      />
    );
    const handoff = screen.getByTestId('capp-ai-handoff-text');
    // Combi should not appear as a recommendation or scope item
    // (it may appear in whatThisAvoids but not as "Recommended:")
    const text = handoff.textContent ?? '';
    const recommendedLine = text.split('\n').find((l) => l.startsWith('Recommended:'));
    expect(recommendedLine).not.toContain('combi');
    expect(recommendedLine).not.toContain('Combi');
  });

  it('AI handoff text is generated from CustomerSummaryV1 when lockedSummary is passed', () => {
    const lockedSummary: CustomerSummaryV1 = {
      recommendedScenarioId: 'ashp',
      recommendedSystemLabel: 'Air source heat pump',
      headline: 'Locked summary headline for ASHP.',
      plainEnglishDecision: 'This is the locked plain English decision.',
      fitNarrative: 'This is the locked plain English decision.',
      whyThisWins: ['Physics reason A'],
      whatThisAvoids: ['Combi risk'],
      hardConstraints: [],
      performancePenalties: [],
      includedNow: ['Heat pump unit'],
      requiredChecks: ['Radiator survey'],
      optionalUpgrades: ['Smart controls'],
      futureReady: ['Solar PV pathway'],
      confidenceNotes: [],
    };

    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario()]}
        visualBlocks={makeAshpBlocks()}
        lockedSummary={lockedSummary}
        printFullAiHandoff
      />
    );
    const handoff = screen.getByTestId('capp-ai-handoff-text');
    expect(handoff.textContent).toContain('Locked summary headline for ASHP.');
    expect(handoff.textContent).toContain('This is the locked plain English decision.');
    expect(handoff.textContent).toContain('Physics reason A');
    expect(handoff.textContent).toContain('Heat pump unit');
    expect(handoff.textContent).toContain('Radiator survey');
    expect(handoff.textContent).toContain('Smart controls');
    expect(handoff.textContent).toContain('Solar PV pathway');
  });

  it('lockedSummary overrides internally built CustomerSummaryV1', () => {
    // Decision headline is 'An air source heat pump is the right fit for this home.'
    // but lockedSummary has a different headline — lockedSummary must win.
    const lockedSummary: CustomerSummaryV1 = {
      recommendedScenarioId: 'ashp',
      recommendedSystemLabel: 'Air source heat pump',
      headline: 'OVERRIDE: this headline must appear, not the decision headline.',
      plainEnglishDecision: '',
      fitNarrative: '',
      whyThisWins: [],
      whatThisAvoids: [],
      hardConstraints: [],
      performancePenalties: [],
      includedNow: [],
      requiredChecks: [],
      optionalUpgrades: [],
      futureReady: [],
      confidenceNotes: [],
    };

    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario()]}
        visualBlocks={makeAshpBlocks()}
        lockedSummary={lockedSummary}
        printFullAiHandoff
      />
    );
    const handoff = screen.getByTestId('capp-ai-handoff-text');
    expect(handoff.textContent).toContain('OVERRIDE: this headline must appear');
    expect(handoff.textContent).not.toContain('An air source heat pump is the right fit for this home.');
  });

  it('buildAiHandoffText(decision, scenarios) is not called by CustomerAdvicePrintPack', async () => {
    // Spy on the module to confirm buildAiHandoffText is never invoked.
    const mod = await import('../../../engine/modules/buildAiHandoffPayload');
    const spy = vi.spyOn(mod, 'buildAiHandoffText');

    render(
      <CustomerAdvicePrintPack
        decision={makeAshpDecision()}
        scenarios={[makeAshpScenario()]}
        visualBlocks={makeAshpBlocks()}
        printFullAiHandoff
      />
    );

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── Pillar 1: At-a-Glance panel enhancements ─────────────────────────────────

describe('CustomerAdvicePrintPack — At-a-Glance panel enhancements', () => {

  it('shows cylinder volume when present in supportingFacts', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 5, source: 'survey' },
        { label: 'Bathrooms', value: 2, source: 'survey' },
        { label: 'Cylinder volume', value: 112, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByText('Cylinder volume')).toBeTruthy();
    expect(screen.getByText('112')).toBeTruthy();
  });

  it('shows condition badge when lifecycle condition is at_risk', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'System is at risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const badge = screen.getByTestId('capp-at-a-glance-condition');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('at risk');
  });

  it('shows condition badge when lifecycle condition is worn', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 14, condition: 'worn' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'moderate', scaleRisk: 'medium', usageIntensity: 'moderate', maintenanceLevel: 'average' },
        riskIndicators: [],
        summary: 'System is worn.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const badge = screen.getByTestId('capp-at-a-glance-condition');
    expect(badge.textContent).toContain('worn');
  });

  it('does not show condition badge when condition is good', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-at-a-glance-condition')).toBeNull();
  });

  it('shows volume gap advisory when occupants >= 4 and cylinder <= 150L', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 5, source: 'survey' },
        { label: 'Bathrooms', value: 2, source: 'survey' },
        { label: 'Cylinder volume', value: 112, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const gap = screen.getByTestId('capp-at-a-glance-volume-gap');
    expect(gap).toBeTruthy();
    expect(gap.textContent).toContain('Volume gap');
    expect(gap.textContent).toContain('200 L');
  });

  it('does not show volume gap advisory when cylinder is large enough', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 5, source: 'survey' },
        { label: 'Cylinder volume', value: 210, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.queryByTestId('capp-at-a-glance-volume-gap')).toBeNull();
  });

  it('does not show volume gap advisory when occupants < 4', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 3, source: 'survey' },
        { label: 'Cylinder volume', value: 112, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.queryByTestId('capp-at-a-glance-volume-gap')).toBeNull();
  });
});

// ─── Pillar 1: InstallComplexityBadge cleaning note ───────────────────────────

describe('CustomerAdvicePrintPack — InstallComplexityBadge at_risk cleaning note', () => {

  it('appends system cleaning note to description when condition is at_risk', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'System is at risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const badge = screen.getByTestId('capp-complexity');
    expect(badge.textContent).toContain('System cleaning and corrosion protection');
  });

  it('does not append cleaning note when condition is good', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const badge = screen.getByTestId('capp-complexity');
    expect(badge.textContent).not.toContain('System cleaning');
  });
});

// ─── Pillar 2: Mixergy Bridge Panel ───────────────────────────────────────────

describe('CustomerAdvicePrintPack — MixeryBridgePanel', () => {

  it('renders when Mixergy has at least two qualifying physics signals', () => {
    const scenario = makeScenario({
      dhwSubtype: 'mixergy',
      physicsFlags: { pressureConstraint: true, combiFlowRisk: true },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.getByTestId('capp-mixery-bridge')).toBeTruthy();
  });

  it('does not render when pressureConstraint is true but dhwSubtype is not mixergy', () => {
    const scenario = makeScenario({
      physicsFlags: { pressureConstraint: true, combiFlowRisk: true },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.queryByTestId('capp-mixery-bridge')).toBeNull();
  });

  it('does not render when fewer than two qualifying signals are present', () => {
    const scenario = makeScenario({ dhwSubtype: 'mixergy', physicsFlags: { pressureConstraint: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.queryByTestId('capp-mixery-bridge')).toBeNull();
  });

  it('does not render for combi scenarios even with pressureConstraint', () => {
    const scenario = makeScenario({
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler' },
      physicsFlags: { pressureConstraint: true },
    });
    const decision = makeDecision({ recommendedScenarioId: 'combi' });
    render(<CustomerAdvicePrintPack {...makeProps({ decision, scenarios: [scenario] })} />);
    expect(screen.queryByTestId('capp-mixery-bridge')).toBeNull();
  });

  it('contains tank-fed terminology (not "low pressure system")', () => {
    const scenario = makeScenario({
      dhwSubtype: 'mixergy',
      physicsFlags: { pressureConstraint: true, combiFlowRisk: true },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    const panel = screen.getByTestId('capp-mixery-bridge');
    expect(panel.textContent).toContain('tank-fed');
    expect(panel.textContent).not.toMatch(/low pressure system/i);
    expect(panel.textContent).not.toMatch(/gravity system/i);
  });

  it('uses customer-safe stored hot water supply wording', () => {
    const scenario = makeScenario({
      dhwSubtype: 'mixergy',
      physicsFlags: { pressureConstraint: true, combiFlowRisk: true },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.getByTestId('capp-mixery-bridge').textContent).toContain(
      'Stored hot water is the right approach, but the incoming supply still limits peak performance.',
    );
  });
});

// ─── Pillar 2: Radiator Upsell Panel ──────────────────────────────────────────

describe('CustomerAdvicePrintPack — RadiatorUpsellPanel', () => {

  it('renders when highTempRequired flag is set', () => {
    const scenario = makeScenario({ physicsFlags: { highTempRequired: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.getByTestId('capp-radiator-upsell')).toBeTruthy();
  });

  it('renders when hydraulicLimit flag is set', () => {
    const scenario = makeScenario({ physicsFlags: { hydraulicLimit: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    expect(screen.getByTestId('capp-radiator-upsell')).toBeTruthy();
  });

  it('does not render when neither flag is set', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-radiator-upsell')).toBeNull();
  });

  it('hydraulicLimit body uses hedged pipework language', () => {
    const scenario = makeScenario({ physicsFlags: { hydraulicLimit: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    const panel = screen.getByTestId('capp-radiator-upsell');
    expect(panel.textContent).toContain('may need upgrading');
    expect(panel.textContent).toContain('confirm against the selected model');
  });
});

// ─── Pillar 3: Simultaneous Use Panel ─────────────────────────────────────────

describe('CustomerAdvicePrintPack — SimultaneousUsePanel', () => {

  it('renders for stored system with 5 occupants', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 5, source: 'survey' },
        { label: 'Bathrooms', value: 2, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByTestId('capp-simultaneous-use')).toBeTruthy();
    expect(screen.getByText(/Simultaneous use: 5 people/)).toBeTruthy();
  });

  it('renders for stored system with exactly 4 occupants', () => {
    const decision = makeDecision({
      supportingFacts: [
        { label: 'Occupants', value: 4, source: 'survey' },
      ],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByTestId('capp-simultaneous-use')).toBeTruthy();
  });

  it('does not render when occupants is 3', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-simultaneous-use')).toBeNull();
  });

  it('does not render for combi scenarios even with high occupancy', () => {
    const decision = makeDecision({
      recommendedScenarioId: 'combi',
      supportingFacts: [{ label: 'Occupants', value: 5, source: 'survey' }],
    });
    const scenario = makeScenario({
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler' },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision, scenarios: [scenario] })} />);
    expect(screen.queryByTestId('capp-simultaneous-use')).toBeNull();
  });

  it('body uses "stored hot water" terminology (not "unlimited hot water")', () => {
    const decision = makeDecision({
      supportingFacts: [{ label: 'Occupants', value: 5, source: 'survey' }],
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const panel = screen.getByTestId('capp-simultaneous-use');
    expect(panel.textContent).toContain('Stored hot water');
    expect(panel.textContent).not.toMatch(/unlimited hot water/i);
  });
});

// ─── Pillar 3: Mixer Shower Compatibility Section ─────────────────────────────

describe('CustomerAdvicePrintPack — MixerShowerCompatibilitySection', () => {

  it('renders when showerCompatibilityNote.warningKey is mixer_balanced_supply', () => {
    const decision = makeDecision({
      showerCompatibilityNote: {
        warningKey: 'mixer_balanced_supply',
        customerSummary: 'Your mixer shower may require a balanced pressure valve after the upgrade.',
        engineerNote: 'Check TMV balanced supply requirement.',
        severity: 'advisory',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByTestId('capp-mixer-shower-check')).toBeTruthy();
  });

  it('shows "Thermostatic mixer valve (TMV) compatibility check" heading', () => {
    const decision = makeDecision({
      showerCompatibilityNote: {
        warningKey: 'mixer_balanced_supply',
        customerSummary: 'Your mixer shower may require a balanced pressure valve.',
        engineerNote: 'Check TMV balanced supply.',
        severity: 'advisory',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByText('Thermostatic mixer valve (TMV) compatibility check')).toBeTruthy();
  });

  it('renders the customerSummary text', () => {
    const decision = makeDecision({
      showerCompatibilityNote: {
        warningKey: 'mixer_balanced_supply',
        customerSummary: 'Balanced supply check required for your mixer shower.',
        engineerNote: 'Check TMV.',
        severity: 'advisory',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByText('Balanced supply check required for your mixer shower.')).toBeTruthy();
  });

  it('does not render when warningKey is electric_unaffected', () => {
    const decision = makeDecision({
      showerCompatibilityNote: {
        warningKey: 'electric_unaffected',
        customerSummary: 'Electric shower is unaffected.',
        engineerNote: 'No action required.',
        severity: 'info',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.queryByTestId('capp-mixer-shower-check')).toBeNull();
  });

  it('does not render when showerCompatibilityNote is absent', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-mixer-shower-check')).toBeNull();
  });

  it('does not duplicate "Shower compatibility" title from WarningBlock', () => {
    // When the visualBlocks warning has "Shower compatibility" title AND
    // the showerCompatibilityNote has warningKey === 'mixer_balanced_supply',
    // only one element with "Shower compatibility" text should appear
    // (the new section uses a different heading "Thermostatic mixer valve (TMV)...").
    const decision = makeDecision({
      showerCompatibilityNote: {
        warningKey: 'mixer_balanced_supply',
        customerSummary: 'Balanced supply check required.',
        engineerNote: 'Check TMV.',
        severity: 'advisory',
      },
    });
    const blocks = makeBlocks({ includeShowerWarning: true });
    render(<CustomerAdvicePrintPack {...makeProps({ decision, visualBlocks: blocks })} />);
    // The WarningBlock heading "Shower compatibility" appears exactly once
    const showerCompatibilityElements = screen.getAllByText('Shower compatibility');
    expect(showerCompatibilityElements).toHaveLength(1);
    // The new TMV section also renders with its own distinct heading
    expect(screen.getByTestId('capp-mixer-shower-check')).toBeTruthy();
    expect(screen.getByText('Thermostatic mixer valve (TMV) compatibility check')).toBeTruthy();
  });
});

// ─── Pillar 4: Three-Year Roadmap Section ─────────────────────────────────────

describe('CustomerAdvicePrintPack — ThreeYearRoadmapSection', () => {

  it('renders when condition is at_risk and system is stored', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByTestId('capp-three-year-roadmap')).toBeTruthy();
  });

  it('always renders Year 1 with the recommended system summary', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const year1 = screen.getByTestId('capp-roadmap-year-1');
    expect(year1.textContent).toContain('Year 1');
    expect(year1.textContent).toContain('system clean');
  });

  it('renders Year 2 when highTempRequired flag is set', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    const scenario = makeScenario({ physicsFlags: { highTempRequired: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ decision, scenarios: [scenario] })} />);
    expect(screen.getByTestId('capp-roadmap-year-2')).toBeTruthy();
    expect(screen.getByTestId('capp-roadmap-year-2').textContent).toContain('Radiator upgrade');
  });

  it('renders Year 3 when ASHP appears in futureUpgradePaths', () => {
    const decision = makeDecision({
      futureUpgradePaths: ['Heat pump ready'],
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    expect(screen.getByTestId('capp-roadmap-year-3')).toBeTruthy();
    expect(screen.getByTestId('capp-roadmap-year-3').textContent).toContain('air source heat pump');
  });

  it('does not render when condition is good (not at_risk)', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('capp-three-year-roadmap')).toBeNull();
  });

  it('does not render for ASHP recommendations even when at_risk', () => {
    const decision = makeDecision({
      recommendedScenarioId: 'ashp',
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    const scenario = makeScenario({
      scenarioId: 'ashp',
      system: { type: 'ashp', summary: 'Air source heat pump' },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision, scenarios: [scenario] })} />);
    expect(screen.queryByTestId('capp-three-year-roadmap')).toBeNull();
  });
});

// ─── AI Context Block: new fields ─────────────────────────────────────────────

describe('CustomerAdvicePrintPack — AiContextBlock new fields', () => {

  it('contains "Mixergy Bridge" field when Mixergy has at least two qualifying signals', () => {
    const scenario = makeScenario({
      dhwSubtype: 'mixergy',
      physicsFlags: { pressureConstraint: true, combiFlowRisk: true },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    const contexts = screen.getAllByTestId('capp-ai-context');
    const hasField = contexts.some((el) => el.textContent?.includes('Mixergy Bridge'));
    expect(hasField).toBe(true);
  });

  it('contains "Three-Year Roadmap" field when condition is at_risk and system is stored', () => {
    const decision = makeDecision({
      lifecycle: {
        currentSystem: { type: 'combi', ageYears: 25, condition: 'at_risk' },
        expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
        influencingFactors: { waterQuality: 'hard', scaleRisk: 'high', usageIntensity: 'high', maintenanceLevel: 'poor' },
        riskIndicators: [],
        summary: 'At risk.',
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const contexts = screen.getAllByTestId('capp-ai-context');
    const hasField = contexts.some((el) => el.textContent?.includes('Three-Year Roadmap'));
    expect(hasField).toBe(true);
  });

  it('does not contain "Mixergy Bridge" field when only one qualifying signal is present', () => {
    const scenario = makeScenario({ dhwSubtype: 'mixergy', physicsFlags: { pressureConstraint: true } });
    render(<CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario] })} />);
    const contexts = screen.getAllByTestId('capp-ai-context');
    const hasField = contexts.some((el) => el.textContent?.includes('Mixergy Bridge'));
    expect(hasField).toBe(false);
  });
});

// ─── Branding ─────────────────────────────────────────────────────────────────

import type { BrandProfileV1 } from '../../../features/branding/brandProfile';

function makeInstallerDemoProfile(): BrandProfileV1 {
  return {
    version: '1.0',
    brandId: 'installer-demo',
    companyName: 'Demo Heating Co',
    logoUrl: 'https://example.com/demo-logo.png',
    theme: { primaryColor: '#1d4ed8' },
    contact: {
      phone: '01234 567890',
      email: 'hello@demoheating.co.uk',
      website: 'https://demoheating.co.uk',
      address: '1 Demo Lane, London, SW1A 1AA',
    },
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: true,
      tone: 'friendly',
    },
  };
}

describe('CustomerAdvicePrintPack — branding', () => {

  it('renders atlas-default brand company name "Atlas" when no brandId supplied', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    const company = screen.getAllByTestId('branded-header-company');
    expect(company.length).toBeGreaterThan(0);
    expect(company[0].textContent).toBe('Atlas');
  });

  it('renders installer-demo company name when brandId="installer-demo"', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ brandId: 'installer-demo' })} />);
    const company = screen.getAllByTestId('branded-header-company');
    expect(company[0].textContent).toBe('Demo Heating Co');
  });

  it('renders the brand logo when logoUrl is set', () => {
    const profileWithLogo = makeInstallerDemoProfile();
    render(<CustomerAdvicePrintPack {...makeProps({ brandProfile: profileWithLogo })} />);
    const logo = screen.queryByTestId('brand-logo') as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    expect(logo?.src).toContain('example.com/demo-logo.png');
  });

  it('shows installer contact when showInstallerContact is true', () => {
    render(<CustomerAdvicePrintPack {...makeProps({ brandId: 'installer-demo' })} />);
    expect(screen.getByTestId('branded-header-contact')).toBeTruthy();
  });

  it('hides installer contact when showInstallerContact is false (atlas-default)', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.queryByTestId('branded-header-contact')).toBeNull();
  });

  it('renders branded footer', () => {
    render(<CustomerAdvicePrintPack {...makeProps()} />);
    expect(screen.getByTestId('branded-footer')).toBeTruthy();
  });

  it('shows installer address in the branded footer when showInstallerContact true', () => {
    const profileWithAddress = makeInstallerDemoProfile(); // has address
    render(<CustomerAdvicePrintPack {...makeProps({ brandProfile: profileWithAddress })} />);
    expect(screen.getByTestId('branded-footer-address')).toBeTruthy();
  });

  it('hides pricing block when showPricing is false', () => {
    const decisionWithPricing = makeDecision({
      energyMetrics: {
        annualEnergyReductionKwh: 2000,
        baselineKwh: 18000,
        projectedKwh: 16000,
        designDeltaT: 24,
        peakLoadKw: 8,
        priceCapsDate: '2025-01-01',
      },
    });
    const noPricingProfile: BrandProfileV1 = {
      version: '1.0',
      brandId: 'no-pricing',
      companyName: 'No Pricing Co',
      theme: { primaryColor: '#000' },
      contact: {},
      outputSettings: { showPricing: false, showCarbon: true, showInstallerContact: false, tone: 'technical' },
    };
    render(
      <CustomerAdvicePrintPack
        {...makeProps({ decision: decisionWithPricing })}
        brandProfile={noPricingProfile}
      />,
    );
    expect(screen.queryByTestId('capp-energy-pricing')).toBeNull();
  });

  it('shows pricing block when showPricing is true and priceCapsDate is present', () => {
    const decisionWithPricing = makeDecision({
      energyMetrics: {
        annualEnergyReductionKwh: 2000,
        baselineKwh: 18000,
        projectedKwh: 16000,
        designDeltaT: 24,
        peakLoadKw: 8,
        priceCapsDate: '2025-01-01',
      },
    });
    // atlas-default has showPricing: true
    render(<CustomerAdvicePrintPack {...makeProps({ decision: decisionWithPricing })} />);
    expect(screen.getByTestId('capp-energy-pricing')).toBeTruthy();
  });

  it('hides pricing block when priceCapsDate is absent (no financial data)', () => {
    const decisionNoPricing = makeDecision({
      energyMetrics: {
        annualEnergyReductionKwh: 2000,
        baselineKwh: 18000,
        projectedKwh: 16000,
        designDeltaT: 24,
        peakLoadKw: 8,
        // priceCapsDate absent
      },
    });
    render(<CustomerAdvicePrintPack {...makeProps({ decision: decisionNoPricing })} />);
    expect(screen.queryByTestId('capp-energy-pricing')).toBeNull();
  });

  it('hides carbon block when showCarbon is false', () => {
    const decisionWithEnergy = makeDecision({
      energyMetrics: {
        annualEnergyReductionKwh: 2000,
        baselineKwh: 18000,
        projectedKwh: 16000,
        designDeltaT: 24,
        peakLoadKw: 8,
      },
    });
    const noCarbonProfile: BrandProfileV1 = {
      version: '1.0',
      brandId: 'no-carbon',
      companyName: 'No Carbon Co',
      theme: { primaryColor: '#000' },
      contact: {},
      outputSettings: { showPricing: true, showCarbon: false, showInstallerContact: false, tone: 'technical' },
    };
    render(
      <CustomerAdvicePrintPack
        {...makeProps({ decision: decisionWithEnergy })}
        brandProfile={noCarbonProfile}
      />,
    );
    expect(screen.queryByTestId('capp-carbon-block')).toBeNull();
  });

  it('shows carbon block when showCarbon is true and energyMetrics are present', () => {
    const decisionWithEnergy = makeDecision({
      energyMetrics: {
        annualEnergyReductionKwh: 2000,
        baselineKwh: 18000,
        projectedKwh: 16000,
        designDeltaT: 24,
        peakLoadKw: 8,
      },
    });
    // atlas-default has showCarbon: true
    render(<CustomerAdvicePrintPack {...makeProps({ decision: decisionWithEnergy })} />);
    expect(screen.getByTestId('capp-carbon-block')).toBeTruthy();
  });

  it('recommendation headline is unchanged regardless of active brand', () => {
    const decision = makeDecision();
    const expectedHeadline = decision.headline;

    // Render with no brand (atlas-default)
    const { unmount } = render(<CustomerAdvicePrintPack {...makeProps({ decision })} />);
    const headlineEls = screen.getAllByText((text) => text.includes(expectedHeadline));
    expect(headlineEls.length).toBeGreaterThan(0);
    unmount();

    // Render with installer-demo brand
    render(<CustomerAdvicePrintPack {...makeProps({ decision, brandId: 'installer-demo' })} />);
    const headlineEls2 = screen.getAllByText((text) => text.includes(expectedHeadline));
    expect(headlineEls2.length).toBeGreaterThan(0);
  });

  it('scenario ranking is unchanged regardless of active brand', () => {
    // Render comparison section with two scenarios — order must match regardless of brand
    const scenario1 = makeScenario();
    const scenario2: ScenarioResult = {
      scenarioId: 'combi',
      system: { type: 'combi', summary: 'Combi boiler' },
      performance: { hotWater: 'poor', heating: 'good', efficiency: 'good', reliability: 'good' },
      keyBenefits: ['Low cost'],
      keyConstraints: ['Low flow rate'],
      dayToDayOutcomes: [],
      requiredWorks: [],
      upgradePaths: [],
      physicsFlags: {},
    };

    const { container: c1 } = render(
      <CustomerAdvicePrintPack {...makeProps({ scenarios: [scenario1, scenario2] })} />,
    );
    const comparison1 = c1.querySelector('[data-testid="capp-comparison"]')?.textContent ?? '';

    const { container: c2 } = render(
      <CustomerAdvicePrintPack
        {...makeProps({ scenarios: [scenario1, scenario2], brandId: 'installer-demo' })}
      />,
    );
    const comparison2 = c2.querySelector('[data-testid="capp-comparison"]')?.textContent ?? '';

    // Scenario names and order must be identical regardless of brand
    expect(comparison1).toBe(comparison2);
  });
});
