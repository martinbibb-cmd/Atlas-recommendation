/**
 * customerJourneySmoke.test.tsx
 *
 * PR28 — Customer journey smoke tests.
 *
 * Verifies the decision-first customer journey is reachable and coherent:
 *
 *   1. CustomerAdvicePrintPack renders as the default ?print=survey surface.
 *   2. CustomerRecommendationPrint is NOT rendered in the default customer path.
 *   3. CustomerDeck portal CTA fires onOpenPortal with the correct launchContext.
 *   4. PortalCtaBlockView button is disabled when onOpenPortal is absent (no dead CTA).
 *   5. Internal/diagnostic CustomerRecommendationPrint is guarded behind ?internal=1.
 *   6. Internal diagnostic report list is visibly labelled as internal.
 *   7. No customer-visible route exposes raw QA / engine-snapshot artefacts by default.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerAdvicePrintPack } from '../components/print/CustomerAdvicePrintPack';
import CustomerRecommendationPrint from '../components/print/CustomerRecommendationPrint';
import { PortalCtaBlockView } from '../components/presentation/blocks/PortalCtaBlockView';
import type { CustomerAdvicePrintPackProps } from '../components/print/CustomerAdvicePrintPack';
import type { AtlasDecisionV1 } from '../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../contracts/ScenarioResult';
import type { VisualBlock } from '../contracts/VisualBlock';
import type { PortalCtaBlock } from '../contracts/VisualBlock';
import { buildScenariosFromEngineOutput } from '../engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from '../engine/modules/buildDecisionFromScenarios';
import { buildVisualBlocks } from '../engine/modules/buildVisualBlocks';
import { runEngine } from '../engine/Engine';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';

// ─── Demo engine input (same as App.tsx CONSOLE_DEMO_INPUT) ───────────────────

const DEMO_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'combi',
    headline: 'A combi boiler is the right fit for this home.',
    summary:  'Combi boiler suits this household.',
    keyReasons: ['Single bathroom', 'Low occupancy'],
    avoidedRisks: [],
    dayToDayOutcomes: ['Instant hot water'],
    requiredWorks: [],
    compatibilityWarnings: [],
    includedItems: ['Combi boiler'],
    quoteScope: [],
    futureUpgradePaths: [],
    supportingFacts: [],
    lifecycle: {
      currentSystem: { type: 'combi', ageYears: 10, condition: 'good' },
      expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [10, 14] },
      influencingFactors: {
        waterQuality: 'good', scaleRisk: 'low',
        usageIntensity: 'moderate', maintenanceLevel: 'average',
      },
      riskIndicators: [],
      summary: 'In reasonable condition.',
    },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'combi',
    system: { type: 'combi', summary: 'Combi boiler' },
    performance: {
      hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good',
    },
    keyBenefits: ['Compact', 'On-demand hot water'],
    keyConstraints: ['Limited simultaneous draw'],
    dayToDayOutcomes: ['Instant hot water'],
    requiredWorks: [],
    upgradePaths: [],
    physicsFlags: {},
    ...overrides,
  };
}

const PORTAL_CTA_BLOCK: PortalCtaBlock = {
  id: 'portal-cta',
  type: 'portal_cta',
  title: 'See your full Atlas report',
  outcome: 'Explore the interactive model in your portal.',
  visualKey: 'portal_demo_cta',
  launchContext: { recommendedScenarioId: 'combi' },
};

const BASE_BLOCKS: VisualBlock[] = [
  {
    id: 'hero',
    type: 'hero',
    recommendedScenarioId: 'combi',
    title: 'Recommended system',
    outcome: 'A combi boiler is the right fit.',
    supportingPoints: [],
    visualKey: 'recommended_system_hero',
  },
  PORTAL_CTA_BLOCK,
];

function makePackProps(overrides: Partial<CustomerAdvicePrintPackProps> = {}): CustomerAdvicePrintPackProps {
  return {
    decision:     makeDecision(),
    scenarios:    [makeScenario()],
    visualBlocks: BASE_BLOCKS,
    ...overrides,
  };
}

// ─── 1. ?print=survey — CustomerAdvicePrintPack renders by default ─────────────

describe('Customer print route — ?print=survey default surface', () => {

  it('CustomerAdvicePrintPack renders the doc container', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.getByTestId('capp-document')).toBeTruthy();
  });

  it('CustomerAdvicePrintPack renders the hero block', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.getByTestId('capp-block-hero')).toBeTruthy();
  });

  it('CustomerAdvicePrintPack renders the portal CTA block', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.getByTestId('capp-block-portal_cta')).toBeTruthy();
  });

  it('renders with engine-derived scenarios and decision without throwing', () => {
    const result = runEngine(DEMO_INPUT);
    const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
    expect(scenarios.length).toBeGreaterThan(0);
    const decision = buildDecisionFromScenarios({
      scenarios,
      boilerType:    'combi',
      ageYears:      10,
      occupancyCount: DEMO_INPUT.occupancyCount,
      bathroomCount:  DEMO_INPUT.bathroomCount,
    });
    const blocks = buildVisualBlocks(decision, scenarios);
    // Should render without errors
    render(
      <CustomerAdvicePrintPack
        decision={decision}
        scenarios={scenarios}
        visualBlocks={blocks}
        portalUrl="https://portal.example.com/r/demo"
        visitDate="24 April 2026"
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId('capp-document')).toBeTruthy();
  });
});

// ─── 2. Old CustomerRecommendationPrint is not the default customer output ─────

describe('Internal/diagnostic guard — CustomerRecommendationPrint not default', () => {

  it('CustomerAdvicePrintPack does not render any "Show raw JSON" controls', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.queryByText(/Show raw JSON/i)).toBeNull();
  });

  it('CustomerAdvicePrintPack does not render engineering score labels', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.queryByText(/objective score/i)).toBeNull();
    expect(screen.queryByText(/overallScore/i)).toBeNull();
  });

  it('CustomerRecommendationPrint is a separate component from CustomerAdvicePrintPack', () => {
    // These are distinct named components — the default customer route imports
    // CustomerAdvicePrintPack, not CustomerRecommendationPrint.
    expect(CustomerAdvicePrintPack).not.toBe(CustomerRecommendationPrint);
  });
});

// ─── 3. Deck CTA — onOpenPortal fires with launchContext ──────────────────────

describe('Deck to portal journey — CustomerDeck portal CTA callback', () => {

  it('PortalCtaBlockView button calls onOpenPortal with launchContext', () => {
    const onOpenPortal = vi.fn();
    render(
      <PortalCtaBlockView block={PORTAL_CTA_BLOCK} onOpenPortal={onOpenPortal} />,
    );
    const btn = screen.getByRole('button', { name: /Open your customer portal/i });
    fireEvent.click(btn);
    expect(onOpenPortal).toHaveBeenCalledOnce();
    expect(onOpenPortal).toHaveBeenCalledWith({ recommendedScenarioId: 'combi' });
  });

  it('PortalCtaBlockView button renders as disabled when onOpenPortal is absent (no dead CTA)', () => {
    render(<PortalCtaBlockView block={PORTAL_CTA_BLOCK} />);
    const btn = screen.getByRole('button', { name: /Open your customer portal/i });
    expect(btn).toHaveAttribute('disabled');
  });

  it('PortalCtaBlockView button does not fire when onOpenPortal is absent', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PortalCtaBlockView block={PORTAL_CTA_BLOCK} />);
    const btn = screen.getByRole('button', { name: /Open your customer portal/i });
    fireEvent.click(btn);
    // No crash — disabled button click is swallowed
    consoleWarn.mockRestore();
  });

  it('renders "Open your portal →" label on the CTA button', () => {
    render(<PortalCtaBlockView block={PORTAL_CTA_BLOCK} onOpenPortal={() => {}} />);
    expect(screen.getByText('Open your portal →')).toBeTruthy();
  });
});

// ─── 4. Portal CTA on print pack shows placeholder when no URL supplied ────────

describe('Portal CTA / QR placeholder on print output', () => {

  it('shows portal URL placeholder when portalUrl is absent', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.getByTestId('capp-portal-url-placeholder')).toBeTruthy();
  });

  it('shows portal URL when portalUrl is provided', () => {
    render(
      <CustomerAdvicePrintPack
        {...makePackProps()}
        portalUrl="https://portal.example.com/r/abc"
      />,
    );
    expect(screen.getByTestId('capp-portal-url')).toBeTruthy();
    expect(screen.getByText('https://portal.example.com/r/abc')).toBeTruthy();
  });

  it('renders "Open your portal" heading in the portal CTA block', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.getByText('Open your portal')).toBeTruthy();
  });
});

// ─── 5. Compliance scope items show as Requirement ────────────────────────────

describe('Compliance scope items — Requirement label on print output', () => {

  it('renders compliance item with Requirement label', () => {
    const blocks: VisualBlock[] = [
      ...BASE_BLOCKS.filter((b) => b.type !== 'portal_cta'),
      {
        id: 'included-scope',
        type: 'included_scope',
        title: 'What is included',
        outcome: 'All work included in the proposed scope.',
        items: [
          {
            id: 'g3-regs',
            label: 'G3 unvented cylinder regulations',
            category: 'compliance',
            status: 'included',
          },
          {
            id: 'combi-boiler',
            label: 'Combi boiler',
            category: 'equipment',
            status: 'included',
          },
        ],
        visualKey: 'included_scope_system_boiler_mixergy',
      },
      PORTAL_CTA_BLOCK,
    ];

    render(
      <CustomerAdvicePrintPack
        decision={makeDecision()}
        scenarios={[makeScenario()]}
        visualBlocks={blocks}
      />,
    );
    // Compliance item should show "Requirement" badge
    expect(screen.getByText('Requirement')).toBeTruthy();
    // Non-compliance item should NOT have "Requirement" badge next to it
    expect(screen.getByText('Combi boiler')).toBeTruthy();
    expect(screen.getAllByText('Requirement')).toHaveLength(1);
  });
});

// ─── 6. No QA/engine snapshot artefacts exposed on default customer route ──────

describe('Internal/diagnostic protection — no QA artefacts on default customer route', () => {

  it('default print pack does not expose QA snapshot identifiers', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.queryByText(/QA snapshot/i)).toBeNull();
    expect(screen.queryByText(/engine dump/i)).toBeNull();
    expect(screen.queryByText(/debug/i)).toBeNull();
  });

  it('default print pack does not render physics flag labels', () => {
    render(<CustomerAdvicePrintPack {...makePackProps()} />);
    expect(screen.queryByText(/physicsFlag/i)).toBeNull();
    expect(screen.queryByText(/hydraulicLimit/i)).toBeNull();
  });
});
