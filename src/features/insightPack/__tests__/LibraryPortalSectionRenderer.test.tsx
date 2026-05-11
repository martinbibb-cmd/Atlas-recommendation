import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LibraryPortalSectionRenderer } from '../LibraryPortalSectionRenderer';
import type { QuoteInsight } from '../insightPack.types';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import { buildCalmWelcomePackFromAtlasDecision } from '../../../library/packRenderer/buildCalmWelcomePackFromAtlasDecision';

vi.mock('../../../library/packRenderer/buildCalmWelcomePackFromAtlasDecision', () => ({
  buildCalmWelcomePackFromAtlasDecision: vi.fn(),
}));

vi.mock('../../../library/diagrams/DiagramRenderer', () => ({
  DiagramRenderer: ({ diagramId }: { diagramId: string }) => <div data-testid={`diagram-${diagramId}`}>{diagramId}</div>,
}));

const mockedBuilder = vi.mocked(buildCalmWelcomePackFromAtlasDecision);

const customerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Stored hot water is the right fit for this home.',
  plainEnglishDecision: 'Stored hot water gives more consistent demand coverage.',
  whyThisWins: ['Stored hot water supports concurrent demand.'],
  whatThisAvoids: ['Avoids on-demand flow drops during concurrent use.'],
  includedNow: [],
  requiredChecks: [],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: [],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'Stored hot water gives the best fit for this demand profile.',
};

const atlasDecision: AtlasDecisionV1 = {
  recommendedScenarioId: 'system_unvented',
  headline: customerSummary.headline,
  summary: customerSummary.fitNarrative,
  keyReasons: [...customerSummary.whyThisWins],
  avoidedRisks: [...customerSummary.whatThisAvoids],
  dayToDayOutcomes: ['Stable supply at busy times'],
  requiredWorks: [],
  compatibilityWarnings: [],
  includedItems: [],
  quoteScope: [],
  futureUpgradePaths: [],
  supportingFacts: [],
  lifecycle: {
    currentSystem: { type: 'combi', ageYears: 10, condition: 'worn' },
    expectedLifespan: { typicalRangeYears: [10, 15], adjustedRangeYears: [9, 14] },
    influencingFactors: { waterQuality: 'unknown', scaleRisk: 'low', usageIntensity: 'medium', maintenanceLevel: 'unknown' },
    riskIndicators: [],
    summary: 'Lifecycle data available.',
  },
};

const scenarios: ScenarioResult[] = [{
  scenarioId: 'system_unvented',
  system: { type: 'system', summary: 'System boiler with stored hot water' },
  performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
  keyBenefits: ['Stored hot water delivery'],
  keyConstraints: [],
  dayToDayOutcomes: ['Stable showers'],
  requiredWorks: [],
  upgradePaths: [],
  physicsFlags: {},
}];

const fallbackQuotes: QuoteInsight[] = [{
  quote: { id: 'q1', label: 'Quote A', systemType: 'combi', includedUpgrades: [] },
  dailyUse: [{ statement: 'Fallback daily-use statement', scenario: 'general' }],
  limitations: [],
  improvements: [],
  rating: {
    hotWaterPerformance: { rating: 'Good', reason: 'r', physics: 'p' },
    heatingPerformance: { rating: 'Good', reason: 'r', physics: 'p' },
    efficiency: { rating: 'Good', reason: 'r', physics: 'p' },
    reliability: { rating: 'Good', reason: 'r', physics: 'p' },
    suitability: { rating: 'Good', reason: 'r', physics: 'p' },
  },
}];

describe('LibraryPortalSectionRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders authored MVP daily-use cards and keeps technical appendix text hidden by default', () => {
    mockedBuilder.mockReturnValue({
      plan: {
        selectedConceptIds: ['pressure_vs_storage', 'HYD-02', 'hot_radiator_expectation', 'MNT-01'],
      } as never,
      calmViewModel: {} as never,
      brandedViewModel: {
        recommendedScenarioId: 'system_unvented',
        customerFacingSections: [{
          sectionId: 'living_with_the_system',
          title: 'Living with your system',
          cards: [{ assetId: 'a1', conceptId: 'system_fit_explanation', title: 'What changes', summary: 'Your day becomes steadier.' }],
        }],
        diagramsBySection: { living_with_the_system: ['pressure_vs_storage'] },
        qrDestinations: [{ assetId: 'a2', destination: 'atlas://educational-library/a2', title: 'Flow temperature deep dive', reason: 'detail' }],
      } as never,
      readiness: { safeForCustomer: true, blockingReasons: [] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
        userConcernTags={['pressure', 'pressure_vs_storage', 'hot_radiator_expectation', 'hydraulic']}
      />,
    );

    expect(screen.getByTestId('library-portal-section')).toBeTruthy();
    expect(screen.getByTestId('library-portal-sequenced-cards')).toBeTruthy();
    expect(screen.getAllByTestId('library-portal-authored-card').length).toBe(4);
    expect(screen.getByText('Pressure vs storage')).toBeTruthy();
    expect(screen.getByText('System pressure and filling loop')).toBeTruthy();
    expect(screen.getByText('Warm radiators')).toBeTruthy();
    expect(screen.getAllByText(/powerflush|flushing/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('library-portal-diagrams')).toBeTruthy();
    expect(screen.getByTestId('diagram-pressure_vs_storage')).toBeTruthy();
    expect(screen.getByTestId('library-portal-qr')).toBeTruthy();
    expect(screen.queryByText('Pressure is a source boundary; volume is a storage boundary.')).toBeNull();
    expect(screen.getByTestId('library-portal-source-label')).toBeTruthy();
  });

  it('falls back to the hardcoded daily-use panel when library output is unsafe', () => {
    mockedBuilder.mockReturnValue({
      plan: { selectedConceptIds: ['pressure_vs_storage'] } as never,
      calmViewModel: {} as never,
      brandedViewModel: { recommendedScenarioId: 'system_unvented', customerFacingSections: [], qrDestinations: [] } as never,
      readiness: { safeForCustomer: false, blockingReasons: ['unsafe'] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
      />,
    );

    expect(screen.getByTestId('library-portal-section-fallback')).toBeTruthy();
    expect(screen.getByText('Fallback daily-use statement')).toBeTruthy();
  });

  it('falls back when authored library cards are missing for selected concepts and tags', () => {
    mockedBuilder.mockReturnValue({
      plan: { selectedConceptIds: ['UNKNOWN-CONCEPT'] } as never,
      calmViewModel: {} as never,
      brandedViewModel: {
        recommendedScenarioId: 'system_unvented',
        customerFacingSections: [{
          sectionId: 'living_with_the_system',
          title: 'Living with your system',
          cards: [{ title: 'Sparse', summary: 'Sparse content' }],
        }],
        qrDestinations: [],
      } as never,
      readiness: { safeForCustomer: true, blockingReasons: [] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
      />,
    );

    expect(screen.getByTestId('library-portal-section-fallback')).toBeTruthy();
    expect(screen.getByText('Fallback daily-use statement')).toBeTruthy();
  });

  it('falls back when composed recommendation identity does not match the locked recommendation', () => {
    mockedBuilder.mockReturnValue({
      plan: { selectedConceptIds: ['pressure_vs_storage'] } as never,
      calmViewModel: {} as never,
      brandedViewModel: {
        recommendedScenarioId: 'combi',
        customerFacingSections: [{
          sectionId: 'living_with_the_system',
          title: 'Living with your system',
          cards: [{ title: 'Mismatch', summary: 'Mismatch content' }],
        }],
        qrDestinations: [],
      } as never,
      readiness: { safeForCustomer: true, blockingReasons: [] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
      />,
    );

    expect(screen.getByTestId('library-portal-section-fallback')).toBeTruthy();
    expect(screen.queryByTestId('library-portal-section')).toBeNull();
  });

  it('does not leak section debug/internal strings into customer-facing cards', () => {
    mockedBuilder.mockReturnValue({
      plan: { selectedConceptIds: ['pressure_vs_storage'] } as never,
      calmViewModel: {} as never,
      brandedViewModel: {
        recommendedScenarioId: 'system_unvented',
        customerFacingSections: [{
          sectionId: 'living_with_the_system',
          title: 'Living with your system',
          cards: [{ title: '[debug] internal-only', summary: 'DEBUG:raw-engine-string' }],
        }],
        qrDestinations: [],
      } as never,
      readiness: { safeForCustomer: true, blockingReasons: [] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
      />,
    );

    expect(screen.queryByText('[debug] internal-only')).toBeNull();
    expect(screen.queryByText('DEBUG:raw-engine-string')).toBeNull();
    expect(screen.getByText('Pressure vs storage')).toBeTruthy();
  });

  it('passes accessibility preferences into library composition and applies reduced-motion rendering', () => {
    mockedBuilder.mockReturnValue({
      plan: { selectedConceptIds: ['pressure_vs_storage'] } as never,
      calmViewModel: {} as never,
      brandedViewModel: {
        recommendedScenarioId: 'system_unvented',
        customerFacingSections: [{
          sectionId: 'living_with_the_system',
          title: 'Living with your system',
          cards: [{ title: 'Card', summary: 'Summary' }],
        }],
        qrDestinations: [],
      } as never,
      readiness: { safeForCustomer: true, blockingReasons: [] },
    });

    render(
      <LibraryPortalSectionRenderer
        fallbackQuotes={fallbackQuotes}
        customerSummary={customerSummary}
        atlasDecision={atlasDecision}
        scenarios={scenarios}
        accessibilityPreferences={{ prefersReducedMotion: true }}
      />,
    );

    expect(mockedBuilder).toHaveBeenCalledWith(expect.objectContaining({
      accessibilityPreferences: expect.objectContaining({ prefersReducedMotion: true }),
    }));
    expect(screen.getByTestId('library-portal-section').className).toContain('library-portal-section--reduced-motion');
  });
});
