/**
 * CustomerPackV1View.test.tsx
 *
 * Mind PR 35 — Tests for the CustomerPackV1View render component.
 *
 * Covers:
 *  - All 8 sections render
 *  - Decision headline is engine-derived (verbatim from decision)
 *  - Anti-default evidence is present when hardConstraints exist
 *  - Portal link shows when portalUrl is provided
 *  - Portal placeholder shows when portalUrl is absent
 *  - Brand changes style only, not content
 *  - Print button is present
 *  - Back button shown when onBack is provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerPackV1View } from '../CustomerPackV1View';
import type { CustomerPackV1ViewProps } from '../CustomerPackV1View';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeLifecycle(): AtlasDecisionV1['lifecycle'] {
  return {
    currentSystem: { type: 'combi', ageYears: 12, condition: 'good' },
    expectedLifespan: { typicalRangeYears: [12, 15], adjustedRangeYears: [11, 14] },
    influencingFactors: {
      waterQuality: 'moderate',
      scaleRisk: 'low',
      usageIntensity: 'medium',
      maintenanceLevel: 'average',
    },
    riskIndicators: [],
    summary: 'The system is in reasonable condition.',
  };
}

function makeDecision(overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: 'system_unvented',
    headline: 'A system boiler with unvented cylinder is the right fit for this home.',
    summary:  'System boiler with unvented cylinder provides reliable stored hot water.',
    keyReasons:            ['Two bathrooms require stored hot water', 'Mains pressure suitable'],
    avoidedRisks:          ['Simultaneous demand failure'],
    dayToDayOutcomes:      ['Instant hot water at all outlets', 'Consistent heating'],
    requiredWorks:         ['Install unvented cylinder'],
    compatibilityWarnings: [],
    includedItems:         ['System boiler', 'Unvented cylinder'],
    quoteScope:            [],
    futureUpgradePaths:    ['Heat pump ready'],
    supportingFacts: [
      { label: 'Occupants', value: 3, source: 'survey' },
      { label: 'Bathrooms', value: 2, source: 'survey' },
    ],
    lifecycle: makeLifecycle(),
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: 'system_unvented',
    system: { type: 'system', summary: 'System boiler with unvented cylinder' },
    performance: {
      hotWater: 'excellent',
      heating: 'very_good',
      efficiency: 'good',
      reliability: 'very_good',
    },
    keyBenefits:      ['Mains-pressure delivery'],
    keyConstraints:   ['Requires cylinder space'],
    dayToDayOutcomes: ['Instant hot water'],
    requiredWorks:    ['Install cylinder'],
    upgradePaths:     ['Heat pump ready'],
    physicsFlags:     {},
    ...overrides,
  };
}

function makeProps(overrides: Partial<CustomerPackV1ViewProps> = {}): CustomerPackV1ViewProps {
  return {
    decision:  makeDecision(),
    scenarios: [makeScenario()],
    ...overrides,
  };
}

// ─── Core rendering ───────────────────────────────────────────────────────────

describe('CustomerPackV1View — core rendering', () => {

  it('renders the outer wrap', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-wrap')).toBeTruthy();
  });

  it('renders the document container', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-document')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-print-button')).toBeTruthy();
  });

  it('renders the back button when onBack is provided', () => {
    render(<CustomerPackV1View {...makeProps({ onBack: vi.fn() })} />);
    expect(screen.getByTestId('cpv1-back-button')).toBeTruthy();
  });

  it('does not render the back button when onBack is absent', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.queryByTestId('cpv1-back-button')).toBeNull();
  });

  it('renders the visitDate in the toolbar title', () => {
    render(<CustomerPackV1View {...makeProps({ visitDate: '2 May 2026' })} />);
    const toolbar = screen.getByTestId('cpv1-toolbar-title');
    expect(toolbar.textContent).toContain('2 May 2026');
  });

  it('renders three A4 page cards', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-page-1')).toBeTruthy();
    expect(screen.getByTestId('cpv1-page-2')).toBeTruthy();
    expect(screen.getByTestId('cpv1-page-3')).toBeTruthy();
  });
});

// ─── Section 1 — Decision ─────────────────────────────────────────────────────

describe('CustomerPackV1View — Section 1: decision', () => {

  it('renders the decision section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-decision')).toBeTruthy();
  });

  it('renders the engine-derived headline verbatim', () => {
    const headline = 'A system boiler with unvented cylinder is the right fit for this home.';
    render(<CustomerPackV1View {...makeProps({ decision: makeDecision({ headline }) })} />);
    expect(screen.getByTestId('cpv1-headline').textContent).toBe(headline);
  });

  it('renders the system label', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-system-label').textContent).toContain('System boiler');
  });

  it('renders the summary', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-summary')).toBeTruthy();
  });
});

// ─── Section 2 — Why this works ──────────────────────────────────────────────

describe('CustomerPackV1View — Section 2: why this works', () => {

  it('renders the why-this-works section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-why-this-works')).toBeTruthy();
  });

  it('renders keyReasons from the decision', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByText('Two bathrooms require stored hot water')).toBeTruthy();
  });
});

// ─── Section 3 — Anti-default ─────────────────────────────────────────────────

describe('CustomerPackV1View — Section 3: anti-default', () => {

  it('renders the anti-default section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-anti-default')).toBeTruthy();
  });

  it('renders anti-default narrative', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-anti-default-narrative').textContent?.length).toBeGreaterThan(0);
  });

  it('renders evidence points when hardConstraints are present', () => {
    const decision = makeDecision({
      hardConstraints: ['Combi cannot satisfy simultaneous DHW demand'],
    });
    render(<CustomerPackV1View {...makeProps({ decision })} />);
    expect(screen.getByTestId('cpv1-anti-default-evidence')).toBeTruthy();
    expect(screen.getByText('Combi cannot satisfy simultaneous DHW demand')).toBeTruthy();
  });

  it('does not render evidence list when no hardConstraints or performancePenalties', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.queryByTestId('cpv1-anti-default-evidence')).toBeNull();
  });
});

// ─── Section 4 — Daily benefits ──────────────────────────────────────────────

describe('CustomerPackV1View — Section 4: daily benefits', () => {

  it('renders the daily-benefits section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-daily-benefits')).toBeTruthy();
  });

  it('renders day-to-day outcomes from the decision', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByText('Instant hot water at all outlets')).toBeTruthy();
  });
});

// ─── Section 5 — Full system ──────────────────────────────────────────────────

describe('CustomerPackV1View — Section 5: full system', () => {

  it('renders the full-system section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-full-system')).toBeTruthy();
  });

  it('renders included items', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    // Falls back to decision.includedItems when quoteScope is empty
    expect(screen.getByTestId('cpv1-included-items')).toBeTruthy();
  });

  it('renders required works', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-required-works')).toBeTruthy();
    expect(screen.getByText('Install unvented cylinder')).toBeTruthy();
  });
});

// ─── Section 6 — Daily use ────────────────────────────────────────────────────

describe('CustomerPackV1View — Section 6: daily use', () => {

  it('renders the daily-use section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-daily-use')).toBeTruthy();
  });

  it('renders guidance items for the system type', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    // System boiler guidance must mention cylinder
    const guidance = screen.getByTestId('cpv1-daily-use');
    expect(guidance.textContent?.toLowerCase()).toContain('cylinder');
  });
});

// ─── Section 7 — Future path ──────────────────────────────────────────────────

describe('CustomerPackV1View — Section 7: future path', () => {

  it('renders the future-path section when paths exist', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-future-path')).toBeTruthy();
  });

  it('renders the upgrade path from the decision', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByText('Heat pump ready')).toBeTruthy();
  });
});

// ─── Section 8 — Close ───────────────────────────────────────────────────────

describe('CustomerPackV1View — Section 8: close', () => {

  it('renders the close section', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-close')).toBeTruthy();
  });

  it('renders the portal link when portalUrl is provided', () => {
    render(<CustomerPackV1View {...makeProps({ portalUrl: 'https://portal.example.com/abc' })} />);
    expect(screen.getByTestId('cpv1-portal-link')).toBeTruthy();
    expect(screen.getByTestId('cpv1-portal-link').getAttribute('href')).toBe(
      'https://portal.example.com/abc',
    );
  });

  it('renders portal placeholder when portalUrl is absent', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-portal-placeholder')).toBeTruthy();
  });

  it('renders the next step', () => {
    render(<CustomerPackV1View {...makeProps()} />);
    expect(screen.getByTestId('cpv1-next-step').textContent?.length).toBeGreaterThan(0);
  });
});

// ─── Brand: style only, not content ──────────────────────────────────────────

describe('CustomerPackV1View — brand changes style only, not content', () => {

  it('headline is identical across two different brand IDs', () => {
    const headline = 'A system boiler with unvented cylinder is the right fit for this home.';
    const decision = makeDecision({ headline });

    const { unmount } = render(
      <CustomerPackV1View {...makeProps({ decision, brandId: 'atlas-default' })} />,
    );
    const headlineA = screen.getByTestId('cpv1-headline').textContent;
    unmount();

    render(
      <CustomerPackV1View {...makeProps({ decision, brandId: 'installer-demo' })} />,
    );
    const headlineB = screen.getByTestId('cpv1-headline').textContent;

    expect(headlineA).toBe(headline);
    expect(headlineB).toBe(headline);
    expect(headlineA).toBe(headlineB);
  });

  it('anti-default evidence is identical across brand IDs', () => {
    const decision = makeDecision({
      hardConstraints: ['Combi cannot meet demand'],
    });

    const { unmount } = render(
      <CustomerPackV1View {...makeProps({ decision, brandId: 'atlas-default' })} />,
    );
    const hasEvidenceA = !!screen.queryByTestId('cpv1-anti-default-evidence');
    unmount();

    render(
      <CustomerPackV1View {...makeProps({ decision, brandId: 'installer-demo' })} />,
    );
    const hasEvidenceB = !!screen.queryByTestId('cpv1-anti-default-evidence');

    expect(hasEvidenceA).toBe(true);
    expect(hasEvidenceB).toBe(true);
  });
});
