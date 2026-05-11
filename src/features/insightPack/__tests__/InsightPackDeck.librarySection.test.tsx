import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InsightPackDeck from '../InsightPackDeck';
import type { InsightPack } from '../insightPack.types';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';

vi.mock('../LibraryPortalSectionRenderer', () => ({
  LibraryPortalSectionRenderer: () => <div data-testid="library-portal-section">Library section</div>,
}));

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
  it('renders the library-composed day-to-day section in the live insight deck', () => {
    render(
      <InsightPackDeck
        pack={pack}
        librarySectionData={{ customerSummary, atlasDecision, scenarios }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Day to Day/i }));
    expect(screen.getAllByTestId('library-portal-section').length).toBeGreaterThan(0);
  });
});
