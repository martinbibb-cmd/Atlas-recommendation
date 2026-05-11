import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InsightPackDeck from '../InsightPackDeck';
import type { InsightPack } from '../insightPack.types';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

const pack: InsightPack = {
  quotes: [{
    quote: { id: 'quote-a', label: 'Quote A', systemType: 'combi', includedUpgrades: [] },
    dailyUse: [{ statement: 'Daily-use fallback', scenario: 'general' }],
    limitations: [],
    improvements: [],
    rating: {
      hotWaterPerformance: { rating: 'Good', reason: 'r', physics: 'p' },
      heatingPerformance: { rating: 'Good', reason: 'r', physics: 'p' },
      efficiency: { rating: 'Good', reason: 'r', physics: 'p' },
      reliability: { rating: 'Good', reason: 'r', physics: 'p' },
      suitability: { rating: 'Good', reason: 'r', physics: 'p' },
    },
  }],
  bestAdvice: { recommendation: 'Recommended', because: ['because'], avoids: [], recommendedQuoteId: 'quote-a' },
  savingsPlan: { behaviour: [], settings: [], futureUpgrades: [] },
  homeProfile: [],
  reasonChain: [],
  nextSteps: { chosenOptionLabel: 'Quote A', included: [], optional: [], furtherImprovements: [] },
};

const customerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Stored hot water is the right fit.',
  plainEnglishDecision: 'Decision summary.',
  whyThisWins: [],
  whatThisAvoids: [],
  includedNow: [],
  requiredChecks: [],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: [],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'Decision summary.',
};

const atlasDecision: AtlasDecisionV1 = {
  recommendedScenarioId: 'system_unvented',
  headline: customerSummary.headline,
  summary: customerSummary.fitNarrative,
  keyReasons: [],
  avoidedRisks: [],
  dayToDayOutcomes: [],
  requiredWorks: [],
  compatibilityWarnings: [],
  includedItems: [],
  quoteScope: [],
  futureUpgradePaths: [],
  supportingFacts: [],
  lifecycle: {
    currentSystem: { type: 'combi', ageYears: 12, condition: 'worn' },
    expectedLifespan: { typicalRangeYears: [10, 15], adjustedRangeYears: [10, 14] },
    influencingFactors: { waterQuality: 'unknown', scaleRisk: 'low', usageIntensity: 'medium', maintenanceLevel: 'unknown' },
    riskIndicators: [],
    summary: 'Lifecycle summary.',
  },
};

const scenarios: ScenarioResult[] = [{
  scenarioId: 'system_unvented',
  system: { type: 'system', summary: 'Stored hot water' },
  performance: { hotWater: 'very_good', heating: 'very_good', efficiency: 'good', reliability: 'very_good' },
  keyBenefits: [],
  keyConstraints: [],
  dayToDayOutcomes: [],
  requiredWorks: [],
  upgradePaths: [],
  physicsFlags: {},
}];

describe('InsightPackDeck library section integration', () => {
  it('renders the CON_C02 pressure-vs-storage section in live daily-use when stored hot water is recommended', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{ customerSummary, atlasDecision, scenarios, bathroomCount: 2 }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0);
  });

  it('falls back to legacy daily-use copy when CON_C02 does not apply', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{ customerSummary, atlasDecision, scenarios, bathroomCount: 1 }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.queryAllByTestId('pvsp-section')).toHaveLength(0);
    expect(screen.getAllByText('Daily-use fallback').length).toBeGreaterThan(0);
  });

  it('renders the composite OpenVentedInsightSection (all 3 concepts) when open_vented tag is present', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{
          customerSummary,
          atlasDecision,
          scenarios,
          bathroomCount: 2,
          userConcernTags: ['open_vented', 'sealed_system_conversion'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.getAllByTestId('open-vented-insight-section').length).toBeGreaterThan(0);
    // All three section test IDs must be present
    expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('ovsp-section').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('uvsp-section').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('lwspj-section').length).toBeGreaterThan(0);
  });

  it('does NOT show OpenVentedInsightSection when open_vented tag is absent', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{ customerSummary, atlasDecision, scenarios, bathroomCount: 2 }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.queryAllByTestId('open-vented-insight-section')).toHaveLength(0);
    // Still shows standard pressure-vs-storage section
    expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0);
  });

  it('does NOT show OpenVentedInsightSection on non-regular/system stored-hot-water paths', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{
          customerSummary: {
            ...customerSummary,
            recommendedScenarioId: 'heat_pump_unvented',
          },
          atlasDecision,
          scenarios,
          bathroomCount: 2,
          userConcernTags: ['open_vented'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.queryAllByTestId('open-vented-insight-section')).toHaveLength(0);
    expect(screen.getAllByTestId('pvsp-section').length).toBeGreaterThan(0);
  });

  it('shows OpenVentedInsightSection for regular_unvented stored-hot-water path', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{
          customerSummary: {
            ...customerSummary,
            recommendedScenarioId: 'regular_unvented',
          },
          atlasDecision,
          scenarios,
          bathroomCount: 2,
          userConcernTags: ['open_vented'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.getAllByTestId('open-vented-insight-section').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('lwspj-section').length).toBeGreaterThan(0);
  });

  it('renders heat-pump living journey section for heat-pump recommendation paths', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{
          customerSummary: {
            ...customerSummary,
            recommendedScenarioId: 'ashp_cylinder',
            recommendedSystemLabel: 'Air source heat pump with cylinder',
          },
          atlasDecision,
          scenarios,
          bathroomCount: 2,
          userConcernTags: ['heat_pump', 'low_flow_temperature'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.getAllByTestId('hplj-section').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('pvsp-section')).toHaveLength(0);
  });
});
