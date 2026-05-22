import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { runEngine } from '../../../engine/Engine';
import { buildDecisionFromScenarios } from '../../../engine/modules/buildDecisionFromScenarios';
import { buildPortalViewModel } from '../../../engine/modules/buildPortalViewModel';
import { buildScenariosFromEngineOutput } from '../../../engine/modules/buildScenariosFromEngineOutput';
import { buildVisualBlocks } from '../../../engine/modules/buildVisualBlocks';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { buildCustomerJourneyPack } from '../../../library/portal/pdf/buildPortalJourneyPrintModel';
import { CustomerPortalJourneyComposer } from '../CustomerPortalJourneyComposer';

const ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
  dhwStorageType: 'none',
};

describe('CustomerPortalJourneyComposer', () => {
  it('prefers packaged customer journey content when supplied', () => {
    const engineResult = runEngine(ENGINE_INPUT);
    const scenarios = buildScenariosFromEngineOutput(engineResult.engineOutput);
    const decision = buildDecisionFromScenarios({
      scenarios,
      boilerType: 'combi',
      ageYears: ENGINE_INPUT.currentSystem?.boiler?.ageYears ?? 0,
      occupancyCount: ENGINE_INPUT.occupancyCount,
      bathroomCount: ENGINE_INPUT.bathroomCount,
      showerCompatibilityNote: engineResult.engineOutput.showerCompatibilityNote,
    });
    const viewModel = buildPortalViewModel(
      decision,
      scenarios,
      buildVisualBlocks(decision, scenarios, undefined, ENGINE_INPUT),
    );
    const packagedJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Packaged import summary',
      customerFacts: ['2-person household', '1 bathroom'],
      journeyType: 'generic_recommendation_summary',
      liveExperienceExplanations: ['Packaged live experience line'],
    });

    render(
      <CustomerPortalJourneyComposer
        decision={decision}
        scenarios={scenarios}
        viewModel={viewModel}
        engineInput={ENGINE_INPUT}
        engineResult={engineResult}
        propertyTitle="SW1A 1AA"
        customerJourneyPack={packagedJourneyPack}
      />,
    );

    const recommendedSystemCard = screen.getByTestId('customer-portal-recommended-system-card');
    const rebuiltSummary = scenarios[0]?.system.summary ?? decision.summary;
    expect(within(recommendedSystemCard).getByText('Packaged import summary')).toBeInTheDocument();
    expect(within(recommendedSystemCard).queryByText(rebuiltSummary)).toBeNull();
    expect(screen.getByText('Packaged live experience line')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How survey facts shaped the route' })).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-reason-grid')).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-hero-confidence')).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-visual-grammar')).toHaveTextContent(
      'Fact → Why it matters → Atlas chose → What you will notice',
    );
    expect(screen.getByTestId('customer-portal-practical-outcome-cards')).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-next-steps-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('customer-portal-technical-home-pattern')).toBeInTheDocument();
  });

  it('renders recommendation-first section order with technical detail moved later', () => {
    const engineResult = runEngine(ENGINE_INPUT);
    const scenarios = buildScenariosFromEngineOutput(engineResult.engineOutput);
    const decision = buildDecisionFromScenarios({
      scenarios,
      boilerType: 'combi',
      ageYears: ENGINE_INPUT.currentSystem?.boiler?.ageYears ?? 0,
      occupancyCount: ENGINE_INPUT.occupancyCount,
      bathroomCount: ENGINE_INPUT.bathroomCount,
      showerCompatibilityNote: engineResult.engineOutput.showerCompatibilityNote,
    });
    const viewModel = buildPortalViewModel(
      decision,
      scenarios,
      buildVisualBlocks(decision, scenarios, undefined, ENGINE_INPUT),
    );
    const packagedJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Packaged import summary',
      customerFacts: ['2-person household', '1 bathroom'],
      journeyType: 'generic_recommendation_summary',
      liveExperienceExplanations: ['Packaged live experience line'],
    });

    const { container } = render(
      <CustomerPortalJourneyComposer
        decision={decision}
        scenarios={scenarios}
        viewModel={viewModel}
        engineInput={ENGINE_INPUT}
        engineResult={engineResult}
        propertyTitle="SW1A 1AA"
        customerJourneyPack={packagedJourneyPack}
      />,
    );

    const sectionIds = Array.from(container.querySelectorAll('[data-testid^="customer-portal-journey-section-"]'))
      .map((el) => el.getAttribute('data-testid')?.replace('customer-portal-journey-section-', ''));
    expect(sectionIds).toEqual([
      'hero',
      'recommendation-reasons',
      'recommended-route',
      'practical-outcomes',
      'daily-use',
      'next-steps',
      'technical-deep-dive',
    ]);
  });
});
