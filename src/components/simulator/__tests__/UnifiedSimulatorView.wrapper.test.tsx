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
    recommendedSystemLabel: 'On-demand hot water',
    fitSummary: 'Current values are passed straight into the simulator.',
    upgradePackage: { systemType: 'combi', upgrades: [] },
    resimulation: {
      systemType: 'combi',
      simpleInstallSpec: {
        systemType: 'combi',
        peakHotWaterCapacityLpm: 11.8,
      },
      bestFitSpec: {
        systemType: 'combi',
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

    expect(mockSimulatorDashboard).toHaveBeenCalled();
    const props = mockSimulatorDashboard.mock.calls.at(-1)?.[0] as Record<string, unknown>;
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
});
