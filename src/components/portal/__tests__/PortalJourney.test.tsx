/**
 * PortalJourney.test.tsx
 *
 * PR28 (updated for Four Atlas Pillars) — Smoke and render tests for the
 * PortalPage four-tab surface.
 *
 * Coverage:
 *   1.  Renders portal-page container
 *   2.  Default active tab is "identity"
 *   3.  All four tab buttons are rendered (Four Atlas Pillars)
 *   4.  Clicking a tab switches the active panel
 *   5.  "What Matters to You" (identity) tab renders hero/facts/solution/warning/scope blocks
 *   6.  "Verdict & Physics" (verdict) tab renders proof cards
 *   7.  "Verdict & Physics" (verdict) tab renders spatial proof when available
 *   8.  "Verdict & Physics" (verdict) tab renders empty state when no content
 *   9.  "Verdict & Physics" (verdict) tab renders comparison cards (Scenario Explorer)
 *  10.  "Verdict & Physics" (verdict) tab renders empty state when no comparison cards
 *  11.  "Your Day" (experience) tab renders DailyUseSimulatorPanel when simulation exists
 *  12.  "Your Day" (experience) tab falls back to cards when no simulation
 *  13.  "Roadmap" tab does not duplicate included scope items
 *  14.  initialTab prop overrides the default "identity" tab
 *  15.  propertyTitle appears in the header when supplied
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PortalPage } from '../../../components/portal/PortalPage';
import type { PortalViewModel, PortalTabId } from '../../../engine/modules/buildPortalViewModel';
import type { VisualBlock } from '../../../contracts/VisualBlock';
import type { DailyUseSimulation } from '../../../contracts/DailyUseSimulation';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FOUR_TABS: PortalViewModel['tabs'] = [
  { id: 'identity',   label: 'What Matters to You' },
  { id: 'verdict',    label: 'Verdict & Physics' },
  { id: 'experience', label: 'Your Day' },
  { id: 'roadmap',    label: 'Roadmap' },
];

const HERO_BLOCK: VisualBlock = {
  id: 'hero',
  type: 'hero',
  recommendedScenarioId: 'combi',
  title: 'Recommended system',
  outcome: 'A combi boiler is the right fit for this home.',
  supportingPoints: ['Compact', 'On-demand hot water'],
  visualKey: 'recommended_system_hero',
};

const FACTS_BLOCK: VisualBlock = {
  id: 'facts',
  type: 'facts',
  title: 'About this home',
  outcome: 'Key facts that shaped the recommendation.',
  facts: [{ label: 'Occupants', value: 3 }, { label: 'Bathrooms', value: 1 }],
  visualKey: 'home_facts_overview',
};

const WARNING_BLOCK: VisualBlock = {
  id: 'warning',
  type: 'warning',
  severity: 'advisory',
  title: 'Shower compatibility',
  outcome: 'Electric shower is independently supplied.',
  visualKey: 'shower_compatibility_warning',
};

const FUTURE_BLOCK_INCLUDED: VisualBlock = {
  id: 'future-included',
  type: 'future_upgrade',
  title: 'Future upgrades',
  outcome: 'This system can grow with your home.',
  paths: ['Heat pump pathway', 'Already installed item'],
  visualKey: 'future_upgrade_solar',
};

const SPATIAL_PROOF_BLOCK = {
  id: 'spatial-proof',
  type: 'spatial_proof' as const,
  title: 'Where the work happens',
  outcome: 'Proposed installation locations.',
  rooms: ['Kitchen', 'Airing cupboard'],
  keyObjects: ['Boiler — Kitchen'],
  routeSummary: ['Heating flow route'],
  confidenceSummary: ['Boiler location confirmed'],
  visualKey: 'spatial_proof_where_work_happens',
};

const DEMO_SIMULATION: DailyUseSimulation = {
  scenarioId: 'combi',
  title: 'How your combi boiler works day-to-day',
  steps: [
    {
      eventType: 'shower',
      topPanel: {
        heatSourceState: 'hot_water',
        coldMainsStatus: 'strong',
      },
      reactions: [
        {
          title: 'Instant hot water',
          outcome: 'Hot water arrives within 3 seconds.',
          severity: 'good',
        },
      ],
    },
  ],
};

function makeViewModel(overrides: Partial<PortalViewModel> = {}): PortalViewModel {
  return {
    tabs: FOUR_TABS,
    identityBlocks: [HERO_BLOCK, FACTS_BLOCK],
    verdictData: {
      whyCards: [
        {
          id: 'reason-1',
          title: 'Key reason',
          value: 'Single bathroom — no simultaneous demand risk.',
        },
        {
          id: 'risk-1',
          title: 'Avoided risk',
          value: 'Simultaneous demand failure avoided.',
        },
      ],
      comparisonCards: [
        {
          scenarioId: 'combi',
          title: 'Combi boiler',
          isRecommended: true,
          summary: 'Best fit for this property.',
          strengths: ['Compact', 'Efficient'],
          constraints: [],
        },
        {
          scenarioId: 'system_unvented',
          title: 'System boiler',
          isRecommended: false,
          summary: 'Viable but oversized for this property.',
          strengths: ['Stored hot water'],
          constraints: ['Requires cylinder space'],
        },
      ],
      spatialProof: null,
    },
    experienceData: {
      cards: [
        {
          scenarioId: 'combi',
          title: 'Day-to-day combi',
          outcomes: ['Instant hot water on demand'],
        },
      ],
      simulation: null,
    },
    roadmapBlocks: [FUTURE_BLOCK_INCLUDED],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortalPage — container and tab bar', () => {

  it('renders the portal-page container', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByTestId('portal-page')).toBeTruthy();
  });

  it('renders all four tab buttons (Four Atlas Pillars)', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByText('What Matters to You')).toBeTruthy();
    expect(screen.getByText('Verdict & Physics')).toBeTruthy();
    expect(screen.getByText('Your Day')).toBeTruthy();
    expect(screen.getByText('Roadmap')).toBeTruthy();
  });

  it('default active tab is "identity" and shows its panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByTestId('portal-panel-identity')).toBeTruthy();
  });

  it('clicking the "Verdict & Physics" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Verdict & Physics'));
    expect(screen.getByTestId('portal-panel-verdict')).toBeTruthy();
  });

  it('clicking the "Your Day" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Your Day'));
    expect(screen.getByTestId('portal-panel-experience')).toBeTruthy();
  });

  it('clicking the "Roadmap" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Roadmap'));
    expect(screen.getByTestId('portal-panel-roadmap')).toBeTruthy();
  });

  it('initialTab prop overrides the default identity tab', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab="verdict" />);
    expect(screen.getByTestId('portal-panel-verdict')).toBeTruthy();
  });

  it('propertyTitle renders in the header when supplied', () => {
    render(<PortalPage viewModel={makeViewModel()} propertyTitle="SW1A 1AA" />);
    expect(screen.getByText('SW1A 1AA')).toBeTruthy();
  });

  it('does not render a header when propertyTitle is absent', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    // No header banner — the tab bar is the top-level navigation element
    expect(screen.queryByRole('banner')).toBeNull();
    // Tab list (navigation) is still rendered
    expect(screen.getByRole('tablist', { name: 'Portal navigation' })).toBeTruthy();
  });
});

describe('PortalPage — What Matters to You tab (Pillar 1: Identity)', () => {

  it('renders hero block content on identity tab', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByText('Recommended system')).toBeTruthy();
    expect(screen.getByText('A combi boiler is the right fit for this home.')).toBeTruthy();
  });

  it('renders facts block content on identity tab', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    // Facts block title
    expect(screen.getByText('About this home')).toBeTruthy();
  });

  it('renders warning block content on identity tab when present', () => {
    const vm = makeViewModel({ identityBlocks: [HERO_BLOCK, FACTS_BLOCK, WARNING_BLOCK] });
    render(<PortalPage viewModel={vm} />);
    expect(screen.getByText('Shower compatibility')).toBeTruthy();
  });

  it('renders empty state when no identity blocks are available', () => {
    const vm = makeViewModel({ identityBlocks: [] });
    render(<PortalPage viewModel={vm} />);
    expect(screen.getByText(/No recommendation content available/i)).toBeTruthy();
  });
});

describe('PortalPage — Verdict & Physics tab (Pillar 2: Verdict)', () => {

  it('renders proof cards with titles', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'verdict' as PortalTabId} />);
    expect(screen.getByText('Key reason')).toBeTruthy();
    expect(screen.getByText('Avoided risk')).toBeTruthy();
  });

  it('renders proof card values', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'verdict' as PortalTabId} />);
    expect(screen.getByText('Single bathroom — no simultaneous demand risk.')).toBeTruthy();
  });

  it('renders spatial proof section when spatialProof is present', () => {
    const vm = makeViewModel({
      verdictData: { ...makeViewModel().verdictData, spatialProof: SPATIAL_PROOF_BLOCK },
    });
    render(<PortalPage viewModel={vm} initialTab={'verdict' as PortalTabId} />);
    // The spatial proof content itself is present
    expect(screen.getByRole('region', { name: /Where the work happens/i })).toBeTruthy();
  });

  it('does not render spatial proof when spatialProof is null', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'verdict' as PortalTabId} />);
    expect(screen.queryByText('Where the work happens')).toBeNull();
  });

  it('renders empty state when no verdict content is available', () => {
    const vm = makeViewModel({
      verdictData: { whyCards: [], comparisonCards: [], spatialProof: null },
    });
    render(<PortalPage viewModel={vm} initialTab={'verdict' as PortalTabId} />);
    expect(screen.getByText(/No proof cards available/i)).toBeTruthy();
  });

  it('renders the recommended scenario card first in Scenario Explorer', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'verdict' as PortalTabId} />);
    const scenarioSection = screen.getByRole('region', { name: 'Scenario Explorer' });
    const cards = within(scenarioSection).getAllByRole('article');
    // First card should be the recommended scenario (combi)
    expect(cards[0].textContent).toContain('Combi boiler');
  });

  it('renders all comparison cards in Scenario Explorer', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'verdict' as PortalTabId} />);
    const scenarioSection = screen.getByRole('region', { name: 'Scenario Explorer' });
    expect(within(scenarioSection).getByText('Combi boiler')).toBeTruthy();
    expect(within(scenarioSection).getByText('System boiler')).toBeTruthy();
  });

  it('renders empty state when no comparison cards are available', () => {
    const vm = makeViewModel({
      verdictData: { whyCards: [], comparisonCards: [], spatialProof: null },
    });
    render(<PortalPage viewModel={vm} initialTab={'verdict' as PortalTabId} />);
    expect(screen.getByText(/No proof cards available/i)).toBeTruthy();
  });
});

describe('PortalPage — Your Day tab (Pillar 3: Experience)', () => {

  it('renders DailyUseSimulatorPanel when simulation is present', () => {
    const vm = makeViewModel({
      experienceData: { cards: [], simulation: DEMO_SIMULATION },
    });
    render(<PortalPage viewModel={vm} initialTab={'experience' as PortalTabId} />);
    expect(screen.getByTestId('daily-use-simulator-panel')).toBeTruthy();
  });

  it('renders daily-use cards when no simulation is present', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'experience' as PortalTabId} />);
    expect(screen.getByText('Day-to-day combi')).toBeTruthy();
  });

  it('does not render DailyUseSimulatorPanel when simulation is null', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'experience' as PortalTabId} />);
    expect(screen.queryByTestId('daily-use-simulator-panel')).toBeNull();
  });

  it('renders empty state when no cards and no simulation', () => {
    const vm = makeViewModel({ experienceData: { cards: [], simulation: null } });
    render(<PortalPage viewModel={vm} initialTab={'experience' as PortalTabId} />);
    expect(screen.getByText(/No daily-use outcomes available/i)).toBeTruthy();
  });
});

describe('PortalPage — Roadmap tab (Pillar 4: Roadmap)', () => {

  it('renders future upgrade content', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'roadmap' as PortalTabId} />);
    // The tab label says "Roadmap" and block title says "Future upgrades" — verify at least one exists
    expect(screen.getAllByText('Future upgrades').length).toBeGreaterThan(0);
  });

  it('renders empty state when no roadmap blocks available', () => {
    const vm = makeViewModel({ roadmapBlocks: [] });
    render(<PortalPage viewModel={vm} initialTab={'roadmap' as PortalTabId} />);
    expect(screen.getByText(/No future upgrade paths available/i)).toBeTruthy();
  });

  it('does not duplicate paths that are already in the included scope', () => {
    // FUTURE_BLOCK_INCLUDED has paths: ['Heat pump pathway', 'Already installed item']
    // If 'Already installed item' is in the included scope, buildPortalViewModel
    // should filter it out. Here we verify the PortalPage renders what it's given
    // (the dedup happens in the view model builder).
    // The PortalPage itself should not double-render any path.
    const vm = makeViewModel({
      roadmapBlocks: [{
        id: 'future-1',
        type: 'future_upgrade',
        title: 'Future upgrades',
        outcome: 'Grow with your home.',
        paths: ['Heat pump pathway'],
        visualKey: 'future_upgrade_solar',
      }],
    });
    render(<PortalPage viewModel={vm} initialTab={'roadmap' as PortalTabId} />);
    const instances = screen.getAllByText('Heat pump pathway');
    expect(instances).toHaveLength(1);
  });
});

// ─── PortalPage — share strip ──────────────────────────────────────────────────

describe('PortalPage — share strip', () => {

  it('renders the share strip toolbar when portalUrl is provided', () => {
    render(<PortalPage viewModel={makeViewModel()} portalUrl="https://atlas.example.com/portal/ref" />);
    expect(screen.getByRole('toolbar', { name: 'Share and export actions' })).toBeTruthy();
  });

  it('renders the share strip toolbar when aiSummaryText is provided', () => {
    render(<PortalPage viewModel={makeViewModel()} aiSummaryText="=== ATLAS RECOMMENDATION SUMMARY ===" />);
    expect(screen.getByRole('toolbar', { name: 'Share and export actions' })).toBeTruthy();
  });

  it('does not render the share strip when no share props are provided', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.queryByRole('toolbar', { name: 'Share and export actions' })).toBeNull();
  });

  it('share strip includes a copy-link button when portalUrl is provided', () => {
    render(<PortalPage viewModel={makeViewModel()} portalUrl="https://atlas.example.com/portal/ref" />);
    expect(screen.getByTestId('share-copy-link')).toBeTruthy();
  });

  it('share strip includes copy-AI and download-AI buttons when aiSummaryText is provided', () => {
    render(<PortalPage viewModel={makeViewModel()} aiSummaryText="AI summary content" />);
    expect(screen.getByTestId('share-copy-ai')).toBeTruthy();
    expect(screen.getByTestId('share-download-ai')).toBeTruthy();
  });

  it('share strip renders a download link when advicePackUrl is provided', () => {
    render(<PortalPage viewModel={makeViewModel()} advicePackUrl="https://cdn.example.com/pack.pdf" />);
    const link = screen.getByTestId('share-download-pack-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://cdn.example.com/pack.pdf');
  });

  it('share strip renders a callback button when onDownloadAdvicePack is provided and no URL', () => {
    const callback = vi.fn();
    render(<PortalPage viewModel={makeViewModel()} onDownloadAdvicePack={callback} />);
    expect(screen.getByTestId('share-download-pack-btn')).toBeTruthy();
  });
});

// ─── PortalPage — no internal/QA artefacts ────────────────────────────────────

describe('PortalPage — no internal/QA artefacts', () => {

  it('does not render raw JSON output', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.queryByText(/Show raw JSON/i)).toBeNull();
  });

  it('does not render engineering scoring labels', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.queryByText(/objective score/i)).toBeNull();
    expect(screen.queryByText(/physics flag/i)).toBeNull();
  });
});
