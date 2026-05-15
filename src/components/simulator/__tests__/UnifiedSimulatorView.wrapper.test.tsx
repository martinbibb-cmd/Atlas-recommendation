import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

const mockSimulatorDashboard = vi.fn();
const mockBuildResimulationFromSurvey = vi.fn();
const mockAdaptFullSurveyToSimulatorInputs = vi.fn();
const mockBuildCompareSeedFromSurvey = vi.fn();

vi.mock('../../../explainers/lego/simulator/SimulatorDashboard', () => ({
  default: (props: unknown) => {
    mockSimulatorDashboard(props);
    return <div data-testid="simulator-dashboard-stub" />;
  },
}));

vi.mock('../../../lib/simulator/buildResimulationFromSurvey', () => ({
  buildResimulationFromSurvey: (...args: unknown[]) => mockBuildResimulationFromSurvey(...args),
}));

vi.mock('../../../explainers/lego/simulator/adaptFullSurveyToSimulatorInputs', () => ({
  adaptFullSurveyToSimulatorInputs: (...args: unknown[]) => mockAdaptFullSurveyToSimulatorInputs(...args),
}));

vi.mock('../../../lib/simulator/buildCompareSeedFromSurvey', () => ({
  buildCompareSeedFromSurvey: (...args: unknown[]) => mockBuildCompareSeedFromSurvey(...args),
}));

vi.mock('../../../lib/advice/buildAdviceFromCompare', () => ({
  buildAdviceFromCompare: () => ({ summary: 'advice' }),
}));

vi.mock('../../../lib/floorplan/adaptFloorplanToAtlasInputs', () => ({
  adaptFloorplanToAtlasInputs: () => ({ isReliable: false }),
}));

vi.mock('../../../lib/dhw/buildStoredHotWaterContextFromSurvey', () => ({
  buildStoredHotWaterContextFromSurvey: () => ({ cwsHeadMetres: undefined }),
}));

vi.mock('../../../engine/modules/StoredDhwModule', async () => {
  const actual = await vi.importActual('../../../engine/modules/StoredDhwModule');
  return {
    ...actual,
    computeDrawOff: () => ({ flowStability: 'marginal' }),
  };
});

vi.mock('../../advice/PrintableRecommendationPage', () => ({
  default: () => <div data-testid="printable-page-stub" />,
}));

vi.mock('../../advice/AdvicePanel', () => ({
  default: () => <div data-testid="advice-panel-stub" />,
}));

vi.mock('../../outcomes/PerformanceOutcomesPanel', () => ({
  default: () => <div data-testid="performance-outcomes-panel-stub" />,
}));

vi.mock('../SystemUpgradeComparisonPanel', () => ({
  default: () => <div data-testid="system-upgrade-comparison-stub" />,
}));

vi.mock('../../../features/reports/adapters/buildCanonicalReportPayload', () => ({
  buildCanonicalReportPayload: () => ({ payload: true }),
}));

vi.mock('../../../lib/reports/reportApi', () => ({
  saveReport: vi.fn(),
}));

vi.mock('../../../lib/reports/generateReportTitle', () => ({
  generateReportTitle: () => 'Report title',
}));

import UnifiedSimulatorView from '../UnifiedSimulatorView';

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    typedRequirements: {
      mustHave: [],
      likelyUpgrades: [],
      niceToHave: [],
    },
    heat: { status: 'ok', headline: 'Heat ok', bullets: [] },
    dhw: { status: 'ok', headline: 'DHW ok', bullets: [] },
    engineering: { status: 'ok', headline: 'Engineering ok', bullets: [] },
    sensitivities: [],
  };
}

const ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'On-demand hot water' },
  explainers: [],
  options: [makeOption('combi', 'viable')],
  verdict: {
    title: 'Good match',
    status: 'good',
    reasons: ['Matches the home'],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
    primaryReason: 'Demand stays light enough for on-demand hot water',
  },
};

function makeSurvey(): FullSurveyModelV1 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.3,
    mainsDynamicFlowLpm: 14,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    bathroomCount: 1,
    occupancyCount: 3,
    peakConcurrentOutlets: 2,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    occupancySignature: 'professional',
    buildingMass: 'medium',
    highOccupancy: false,
    preferCombi: true,
    currentHeatSourceType: 'combi',
    dhwStorageType: 'none',
  } as FullSurveyModelV1;
}

beforeEach(() => {
  mockSimulatorDashboard.mockReset();
  mockBuildResimulationFromSurvey.mockReset();
  mockAdaptFullSurveyToSimulatorInputs.mockReset();
  mockBuildCompareSeedFromSurvey.mockReset();

  mockAdaptFullSurveyToSimulatorInputs.mockReturnValue({
    systemChoice: 'combi',
    systemInputs: {
      mainsPressureBar: 2.3,
      mainsFlowLpm: 14,
      combiPowerKw: 30,
      heatLossKw: 8,
      boilerOutputKw: 24,
      primaryPipeSize: '22mm',
      emitterType: 'radiators',
      controlStrategy: 'combi',
      systemCondition: 'clean',
    },
  });

  mockBuildCompareSeedFromSurvey.mockReturnValue({
    left: {
      systemChoice: 'combi',
      systemInputs: {
        mainsPressureBar: 2.3,
        mainsFlowLpm: 14,
      },
    },
    right: {
      systemChoice: 'heat_pump',
      systemInputs: {
        mainsPressureBar: 2.3,
        mainsFlowLpm: 14,
        cylinderSizeLitres: 210,
        heatLossKw: 8,
        boilerOutputKw: 12,
        primaryPipeSize: '28mm',
        emitterType: 'radiators',
        controlStrategy: 'heat_pump',
        systemCondition: 'clean',
      },
    },
    compareMode: 'current_vs_proposed',
    comparisonLabel: 'Current vs proposed',
  });

  mockBuildResimulationFromSurvey.mockReturnValue({
    recommendedSystemLabel: 'Heat pump with stored hot water',
    fitSummary: 'Current values are passed straight into the simulator.',
    upgradePackage: { systemType: 'heat_pump', upgrades: [] },
    resimulation: {
      systemType: 'heat_pump',
      simpleInstallSpec: {
        systemType: 'heat_pump',
        peakHotWaterCapacityLpm: 11.8,
      },
      bestFitSpec: {
        systemType: 'heat_pump',
      },
      simpleInstall: {
        systemLabel: 'Current system',
        events: [
          {
            eventId: 'shower_0',
            type: 'shower',
            startMinute: 420,
            durationMinutes: 8,
            result: 'successful',
            reason: 'Shower remains stable',
            tags: [],
          },
          {
            eventId: 'kitchen_0',
            type: 'kitchen_draw',
            startMinute: 510,
            durationMinutes: 4,
            result: 'reduced',
            reason: 'Kitchen tap slows slightly',
            tags: [],
          },
          {
            eventId: 'tap_0',
            type: 'tap_draw',
            startMinute: 660,
            durationMinutes: 2,
            result: 'successful',
            reason: 'Short tap draw stays stable',
            tags: [],
          },
        ],
        hotWater: {
          totalDraws: 3,
          successful: 2,
          reduced: 1,
          conflict: 0,
          simultaneousEventCount: 0,
          averageBathFillTimeMinutes: null,
        },
        heating: {
          totalHeatingEvents: 0,
          successful: 0,
          reduced: 0,
          conflict: 0,
          outsideTargetEventCount: 0,
        },
      },
      bestFitInstall: {
        systemLabel: 'Best fit',
        events: [],
        hotWater: {
          totalDraws: 0,
          successful: 0,
          reduced: 0,
          conflict: 0,
          simultaneousEventCount: 0,
          averageBathFillTimeMinutes: null,
        },
        heating: {
          totalHeatingEvents: 0,
          successful: 0,
          reduced: 0,
          conflict: 0,
          outsideTargetEventCount: 0,
        },
      },
      comparison: {
        hotWater: {
          successfulDelta: 0,
          reducedDelta: 1,
          conflictDelta: 0,
          averageBathFillTimeDeltaMinutes: null,
        },
        heating: {
          successfulDelta: 0,
          reducedDelta: 0,
          conflictDelta: 0,
          outsideTargetEventCountDelta: 0,
        },
        headlineImprovements: ['1 fewer reduced draw in the best-fit path'],
      },
    },
  });
});

describe('UnifiedSimulatorView wrapper', () => {
  it('passes fixture values into SimulatorDashboard unchanged', () => {
    const survey = makeSurvey();

    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={survey} />);

    expect(mockSimulatorDashboard).toHaveBeenCalledTimes(1);
    const props = mockSimulatorDashboard.mock.lastCall?.[0] as Record<string, unknown>;
    expect(props.initialSystemChoice).toBe('combi');
    expect(props.initialSystemInputs).toEqual(mockAdaptFullSurveyToSimulatorInputs.mock.results[0]?.value.systemInputs);
    expect(props.initialProposedSystemChoice).toBe('heat_pump');
    expect(props.initialProposedSystemInputs).toEqual(mockBuildCompareSeedFromSurvey.mock.results[0]?.value.right.systemInputs);
  });

  it('renders the wrapper without mutating simulator input fixtures', () => {
    const survey = makeSurvey();
    const before = structuredClone(survey);

    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={survey} />);

    expect(screen.getByTestId('simulator-visual-wrapper')).toBeTruthy();
    expect(survey).toEqual(before);
  });

  it('renders draw-off chips from the existing modelled draw-offs and switches display-only modes', () => {
    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={makeSurvey()} />);

    expect(screen.getByTestId('simulator-draw-off-chip-shower').textContent).toContain('Shower ×1');
    expect(screen.getByTestId('simulator-draw-off-chip-kitchen_draw').textContent).toContain('Kitchen tap ×1');
    expect(screen.getByTestId('simulator-draw-off-chip-tap_draw').textContent).toContain('Hot tap ×1');
    expect(screen.queryByTestId('simulator-assumptions')).toBeNull();

    fireEvent.click(screen.getByTestId('simulator-display-mode-surveyor'));
    expect(screen.getByTestId('simulator-assumptions').textContent).toContain('2 peak outlets');

    fireEvent.click(screen.getByTestId('simulator-display-mode-engineer'));
    expect(screen.getByTestId('simulator-raw-values').textContent).toContain('Current raw values');
    expect(screen.getByTestId('simulator-raw-values').textContent).toContain('Proposed raw values');
  });

  it('renders the stored hot-water delta for a combi-to-stored fixture', () => {
    const survey = makeSurvey();
    survey.primaryPipeDiameter = 28;
    mockBuildCompareSeedFromSurvey.mockReturnValue({
      left: {
        systemChoice: 'combi',
        systemInputs: {
          mainsPressureBar: 2.3,
          mainsFlowLpm: 14,
        },
      },
      right: {
        systemChoice: 'unvented',
        systemInputs: {
          mainsPressureBar: 2.3,
          mainsFlowLpm: 14,
          cylinderSizeLitres: 210,
        },
      },
      compareMode: 'current_vs_proposed',
      comparisonLabel: 'Current vs proposed',
    });
    mockBuildResimulationFromSurvey.mockReturnValue({
      recommendedSystemLabel: 'System boiler with stored hot water',
      fitSummary: 'Current values are passed straight into the simulator.',
      upgradePackage: { systemType: 'stored_water', upgrades: [] },
      resimulation: {
        systemType: 'stored_water',
        simpleInstallSpec: {
          systemType: 'stored_water',
          peakHotWaterCapacityLpm: 11.8,
        },
        bestFitSpec: {
          systemType: 'stored_water',
        },
        simpleInstall: {
          systemLabel: 'Current system',
          events: [],
          hotWater: {
            totalDraws: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            simultaneousEventCount: 0,
            averageBathFillTimeMinutes: null,
          },
          heating: {
            totalHeatingEvents: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            outsideTargetEventCount: 0,
          },
        },
        bestFitInstall: {
          systemLabel: 'Best fit',
          events: [],
          hotWater: {
            totalDraws: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            simultaneousEventCount: 0,
            averageBathFillTimeMinutes: null,
          },
          heating: {
            totalHeatingEvents: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            outsideTargetEventCount: 0,
          },
        },
        comparison: {
          hotWater: {
            successfulDelta: 0,
            reducedDelta: 0,
            conflictDelta: 0,
            averageBathFillTimeDeltaMinutes: null,
          },
          heating: {
            successfulDelta: 0,
            reducedDelta: 0,
            conflictDelta: 0,
            outsideTargetEventCountDelta: 0,
          },
          headlineImprovements: [],
        },
      },
    });

    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={survey} />);

    const deltaCard = screen.getByTestId('simulator-expectation-delta-stored_hot_water');
    expect(screen.queryByTestId('simulator-expectation-delta-water_constraint')).toBeNull();
    expect(deltaCard.textContent).toContain('Current experience');
    expect(deltaCard.textContent).toContain('Future experience');
    expect(deltaCard.textContent).toContain('What changes');
    expect(deltaCard.textContent).toContain('What stays familiar');
    expect(deltaCard.textContent).toContain('Reassurance');
    expect(deltaCard.textContent).toContain('Hot water and recovery');
    expect(deltaCard.textContent).toContain('Hot water can drop in strength when a second outlet opens.');
    expect(deltaCard.textContent).toContain('Showers and taps feel stronger and more consistent during overlap use.');
  });

  it('renders the heat-pump delta in the heat-pump fixture', () => {
    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={makeSurvey()} />);

    const deltaCard = screen.getByTestId('simulator-expectation-delta-heat_pump');
    expect(deltaCard.textContent).toContain('Radiators and daily routine');
    expect(deltaCard.textContent).toContain('Radiators can feel very hot for shorter bursts.');
    expect(deltaCard.textContent).toContain('Radiators feel warm rather than very hot, with longer steady run periods.');
    expect(deltaCard.textContent).toContain('Short high-temperature bursts are replaced by sustained delivery.');
  });

  it('switches stored hot-water fixtures into the water-constraint delta when pipework is constrained', () => {
    const survey = makeSurvey();
    survey.dynamicMainsPressure = 1.4;
    mockBuildCompareSeedFromSurvey.mockReturnValue({
      left: {
        systemChoice: 'combi',
        systemInputs: {
          mainsPressureBar: 2.3,
          mainsFlowLpm: 14,
        },
      },
      right: {
        systemChoice: 'unvented',
        systemInputs: {
          mainsPressureBar: 2.3,
          mainsFlowLpm: 14,
          cylinderSizeLitres: 210,
        },
      },
      compareMode: 'current_vs_proposed',
      comparisonLabel: 'Current vs proposed',
    });
    mockBuildResimulationFromSurvey.mockReturnValue({
      recommendedSystemLabel: 'System boiler with stored hot water',
      fitSummary: 'Current values are passed straight into the simulator.',
      upgradePackage: { systemType: 'stored_water', upgrades: [] },
      resimulation: {
        systemType: 'stored_water',
        simpleInstallSpec: {
          systemType: 'stored_water',
          peakHotWaterCapacityLpm: 11.8,
        },
        bestFitSpec: {
          systemType: 'stored_water',
        },
        simpleInstall: {
          systemLabel: 'Current system',
          events: [],
          hotWater: {
            totalDraws: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            simultaneousEventCount: 0,
            averageBathFillTimeMinutes: null,
          },
          heating: {
            totalHeatingEvents: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            outsideTargetEventCount: 0,
          },
        },
        bestFitInstall: {
          systemLabel: 'Best fit',
          events: [],
          hotWater: {
            totalDraws: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            simultaneousEventCount: 0,
            averageBathFillTimeMinutes: null,
          },
          heating: {
            totalHeatingEvents: 0,
            successful: 0,
            reduced: 0,
            conflict: 0,
            outsideTargetEventCount: 0,
          },
        },
        comparison: {
          hotWater: {
            successfulDelta: 0,
            reducedDelta: 0,
            conflictDelta: 0,
            averageBathFillTimeDeltaMinutes: null,
          },
          heating: {
            successfulDelta: 0,
            reducedDelta: 0,
            conflictDelta: 0,
            outsideTargetEventCountDelta: 0,
          },
          headlineImprovements: [],
        },
      },
    });

    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={survey} />);

    const deltaCard = screen.getByTestId('simulator-expectation-delta-water_constraint');
    expect(deltaCard.textContent).toContain('Hot water pressure and flow');
    expect(deltaCard.textContent).toContain('What pressure and flow mean in daily use');
  });

  it('keeps customer mode jargon-safe while hiding engineer-only assumptions', () => {
    render(<UnifiedSimulatorView engineOutput={ENGINE_OUTPUT} surveyData={makeSurvey()} />);

    const deltaCard = screen.getByTestId('simulator-expectation-delta-heat_pump');
    expect(deltaCard.textContent).toContain('Radiators and daily routine');
    expect(deltaCard.textContent).toContain('Warm-not-hot radiator feel alone does not indicate a fault.');
    expect(deltaCard.textContent).not.toMatch(/g3|commissioning|heat[- ]exchanger/i);
    expect(screen.queryByTestId('simulator-assumptions')).toBeNull();
    expect(screen.queryByTestId('simulator-raw-values')).toBeNull();
  });
});
