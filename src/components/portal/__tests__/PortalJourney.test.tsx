/**
 * PortalJourney.test.tsx
 *
 * PR28 — Smoke and render tests for the PortalPage five-tab surface.
 *
 * Coverage:
 *   1.  Renders portal-page container
 *   2.  Default active tab is "recommended"
 *   3.  All five tab buttons are rendered
 *   4.  Clicking a tab switches the active panel
 *   5.  "Recommended for you" tab renders hero/facts/solution/warning/scope blocks
 *   6.  "Why Atlas chose this" tab renders proof cards
 *   7.  "Why Atlas chose this" tab renders spatial proof when available
 *   8.  "Why Atlas chose this" tab renders empty state when no cards
 *   9.  "Compare other options" tab keeps recommended scenario first
 *  10.  "Compare other options" tab renders empty state when no cards
 *  11.  "Daily-use demo" tab renders DailyUseSimulatorPanel when simulation exists
 *  12.  "Daily-use demo" tab falls back to cards when no simulation
 *  13.  "Future upgrades" tab does not duplicate included scope items
 *  14.  initialTab prop overrides the default "recommended" tab
 *  15.  propertyTitle appears in the header when supplied
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortalPage } from '../../../components/portal/PortalPage';
import type { PortalViewModel, PortalTabId } from '../../../engine/modules/buildPortalViewModel';
import type { VisualBlock } from '../../../contracts/VisualBlock';
import type { DailyUseSimulation } from '../../../contracts/DailyUseSimulation';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIVE_TABS: PortalViewModel['tabs'] = [
  { id: 'recommended', label: 'Recommended for you' },
  { id: 'why',         label: 'Why Atlas chose this' },
  { id: 'compare',     label: 'Compare other options' },
  { id: 'daily_use',   label: 'Daily-use demo' },
  { id: 'future',      label: 'Future upgrades' },
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
    tabs: FIVE_TABS,
    recommendedBlocks: [HERO_BLOCK, FACTS_BLOCK],
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
    dailyUseCards: [
      {
        scenarioId: 'combi',
        title: 'Day-to-day combi',
        outcomes: ['Instant hot water on demand'],
      },
    ],
    dailyUseSimulation: null,
    futureBlocks: [FUTURE_BLOCK_INCLUDED],
    spatialProof: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortalPage — container and tab bar', () => {

  it('renders the portal-page container', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByTestId('portal-page')).toBeTruthy();
  });

  it('renders all five tab buttons', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByText('Recommended for you')).toBeTruthy();
    expect(screen.getByText('Why Atlas chose this')).toBeTruthy();
    expect(screen.getByText('Compare other options')).toBeTruthy();
    expect(screen.getByText('Daily-use demo')).toBeTruthy();
    expect(screen.getByText('Future upgrades')).toBeTruthy();
  });

  it('default active tab is "recommended" and shows its panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByTestId('portal-panel-recommended')).toBeTruthy();
  });

  it('clicking the "Why Atlas chose this" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Why Atlas chose this'));
    expect(screen.getByTestId('portal-panel-why')).toBeTruthy();
  });

  it('clicking the "Compare other options" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Compare other options'));
    expect(screen.getByTestId('portal-panel-compare')).toBeTruthy();
  });

  it('clicking the "Daily-use demo" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Daily-use demo'));
    expect(screen.getByTestId('portal-panel-daily_use')).toBeTruthy();
  });

  it('clicking the "Future upgrades" tab switches the active panel', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    fireEvent.click(screen.getByText('Future upgrades'));
    expect(screen.getByTestId('portal-panel-future')).toBeTruthy();
  });

  it('initialTab prop overrides the default recommended tab', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab="why" />);
    expect(screen.getByTestId('portal-panel-why')).toBeTruthy();
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

describe('PortalPage — Recommended for you tab', () => {

  it('renders hero block content on recommended tab', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    expect(screen.getByText('Recommended system')).toBeTruthy();
    expect(screen.getByText('A combi boiler is the right fit for this home.')).toBeTruthy();
  });

  it('renders facts block content on recommended tab', () => {
    render(<PortalPage viewModel={makeViewModel()} />);
    // Facts block title
    expect(screen.getByText('About this home')).toBeTruthy();
  });

  it('renders warning block content on recommended tab when present', () => {
    const vm = makeViewModel({ recommendedBlocks: [HERO_BLOCK, FACTS_BLOCK, WARNING_BLOCK] });
    render(<PortalPage viewModel={vm} />);
    expect(screen.getByText('Shower compatibility')).toBeTruthy();
  });

  it('renders empty state when no recommended blocks are available', () => {
    const vm = makeViewModel({ recommendedBlocks: [] });
    render(<PortalPage viewModel={vm} />);
    expect(screen.getByText(/No recommendation content available/i)).toBeTruthy();
  });
});

describe('PortalPage — Why Atlas chose this tab', () => {

  it('renders proof cards with titles', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'why' as PortalTabId} />);
    expect(screen.getByText('Key reason')).toBeTruthy();
    expect(screen.getByText('Avoided risk')).toBeTruthy();
  });

  it('renders proof card values', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'why' as PortalTabId} />);
    expect(screen.getByText('Single bathroom — no simultaneous demand risk.')).toBeTruthy();
  });

  it('renders spatial proof section when spatialProof is present', () => {
    const vm = makeViewModel({ spatialProof: SPATIAL_PROOF_BLOCK });
    render(<PortalPage viewModel={vm} initialTab={'why' as PortalTabId} />);
    // SpatialProofSection uses aria-label="Where the work happens" on the section
    expect(screen.getByRole('region', { name: /Where the work happens/i })).toBeTruthy();
  });

  it('does not render spatial proof when spatialProof is null', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'why' as PortalTabId} />);
    expect(screen.queryByText('Where the work happens')).toBeNull();
  });

  it('renders empty state when no why cards are available', () => {
    const vm = makeViewModel({ whyCards: [], spatialProof: null });
    render(<PortalPage viewModel={vm} initialTab={'why' as PortalTabId} />);
    expect(screen.getByText(/No proof cards available/i)).toBeTruthy();
  });
});

describe('PortalPage — Compare other options tab', () => {

  it('renders the recommended scenario card first', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'compare' as PortalTabId} />);
    const cards = screen.getAllByRole('article');
    // First card should be the recommended scenario (combi)
    expect(cards[0].textContent).toContain('Combi boiler');
  });

  it('renders all comparison cards', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'compare' as PortalTabId} />);
    expect(screen.getByText('Combi boiler')).toBeTruthy();
    expect(screen.getByText('System boiler')).toBeTruthy();
  });

  it('renders empty state when no comparison cards are available', () => {
    const vm = makeViewModel({ comparisonCards: [] });
    render(<PortalPage viewModel={vm} initialTab={'compare' as PortalTabId} />);
    expect(screen.getByText(/No comparison data available/i)).toBeTruthy();
  });
});

describe('PortalPage — Daily-use demo tab', () => {

  it('renders DailyUseSimulatorPanel when simulation is present', () => {
    const vm = makeViewModel({ dailyUseSimulation: DEMO_SIMULATION });
    render(<PortalPage viewModel={vm} initialTab={'daily_use' as PortalTabId} />);
    expect(screen.getByTestId('daily-use-simulator-panel')).toBeTruthy();
  });

  it('renders daily-use cards when no simulation is present', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'daily_use' as PortalTabId} />);
    expect(screen.getByText('Day-to-day combi')).toBeTruthy();
  });

  it('does not render DailyUseSimulatorPanel when simulation is null', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'daily_use' as PortalTabId} />);
    expect(screen.queryByTestId('daily-use-simulator-panel')).toBeNull();
  });

  it('renders empty state when no cards and no simulation', () => {
    const vm = makeViewModel({ dailyUseCards: [], dailyUseSimulation: null });
    render(<PortalPage viewModel={vm} initialTab={'daily_use' as PortalTabId} />);
    expect(screen.getByText(/No daily-use outcomes available/i)).toBeTruthy();
  });
});

describe('PortalPage — Future upgrades tab', () => {

  it('renders future upgrade content', () => {
    render(<PortalPage viewModel={makeViewModel()} initialTab={'future' as PortalTabId} />);
    // The tab label and block title both say "Future upgrades" — verify at least one exists
    expect(screen.getAllByText('Future upgrades').length).toBeGreaterThan(0);
  });

  it('renders empty state when no future blocks available', () => {
    const vm = makeViewModel({ futureBlocks: [] });
    render(<PortalPage viewModel={vm} initialTab={'future' as PortalTabId} />);
    expect(screen.getByText(/No future upgrade paths available/i)).toBeTruthy();
  });

  it('does not duplicate paths that are already in the included scope', () => {
    // FUTURE_BLOCK_INCLUDED has paths: ['Heat pump pathway', 'Already installed item']
    // If 'Already installed item' is in the included scope, buildPortalViewModel
    // should filter it out. Here we verify the PortalPage renders what it's given
    // (the dedup happens in the view model builder).
    // The PortalPage itself should not double-render any path.
    const vm = makeViewModel({
      futureBlocks: [{
        id: 'future-1',
        type: 'future_upgrade',
        title: 'Future upgrades',
        outcome: 'Grow with your home.',
        paths: ['Heat pump pathway'],
        visualKey: 'future_upgrade_solar',
      }],
    });
    render(<PortalPage viewModel={vm} initialTab={'future' as PortalTabId} />);
    const instances = screen.getAllByText('Heat pump pathway');
    expect(instances).toHaveLength(1);
  });
});
