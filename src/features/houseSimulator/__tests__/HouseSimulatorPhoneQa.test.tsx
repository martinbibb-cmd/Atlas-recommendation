import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HouseSimulatorPage from '../HouseSimulatorPage';
import { ReadingPreferencesProvider } from '../../../accessibility/readingPreferences/ReadingPreferencesProvider';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { PHONE_QA_SAFE_AREA_TOKENS, PHONE_QA_VIEWPORTS } from '../../../dev/phoneQa/phoneQaConfig';

const PHONE_QA_FIXTURE: EngineInputV2_3 = {
  postcode: 'M1 1AA',
  dynamicMainsPressure: 2.4,
  mainsDynamicFlowLpm: 16,
  primaryPipeDiameter: 22,
  heatLossWatts: 8200,
  radiatorCount: 10,
  bathroomCount: 2,
  occupancyCount: 3,
  peakConcurrentOutlets: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'steady_home',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'system',
  dhwStorageType: 'unvented',
  currentSystem: { boiler: { type: 'system', ageYears: 11 } },
};

function renderSimulator(width: number) {
  return render(
    <div style={{ width }}>
      <ReadingPreferencesProvider>
        <HouseSimulatorPage onBack={() => undefined} surveyData={PHONE_QA_FIXTURE} />
      </ReadingPreferencesProvider>
    </div>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('HouseSimulatorPage phone QA', () => {
  it.each(PHONE_QA_VIEWPORTS)('renders canvas and controls for %s smoke viewport', (viewport) => {
    renderSimulator(viewport.width);

    const root = screen.getByTestId('house-simulator-root');
    const stage = screen.getByTestId('house-simulator-stage');
    const canvas = screen.getByTestId('house-simulator-canvas');
    const bottomSheet = screen.getByTestId('house-simulator-bottom-sheet');

    expect(root).toBeInTheDocument();
    expect(canvas).toBeInTheDocument();
    expect(bottomSheet).toBeInTheDocument();
    expect(Boolean(stage.compareDocumentPosition(bottomSheet) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('keeps the house canvas mounted when engineering warnings open', () => {
    renderSimulator(PHONE_QA_VIEWPORTS[1].width);

    fireEvent.click(screen.getByRole('button', { name: /open engineering and warnings menu/i }));

    expect(screen.getByTestId('house-simulator-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('house-simulator-engineering-drawer')).toBeInTheDocument();
  });

  it('keeps reading preferences attached to the simulator surface', () => {
    renderSimulator(PHONE_QA_VIEWPORTS[0].width);

    fireEvent.click(screen.getByRole('button', { name: /reading preferences/i }));

    expect(screen.getByTestId('reading-preferences-launcher')).toBeInTheDocument();
    expect(screen.getByLabelText('Reading preferences')).toBeInTheDocument();
    expect(screen.getByTestId('reading-preferences-launcher').classList.contains('rp-launcher--fixed')).toBe(false);
    expect(screen.getByTestId('house-simulator-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('house-simulator-bottom-sheet')).toBeInTheDocument();
  });

  it('keeps safe-area tokens wired through app, simulator, and reading-preferences CSS', () => {
    const appCss = readFileSync(new URL('../../../App.css', import.meta.url), 'utf8');
    const simulatorCss = readFileSync(new URL('../houseSimulator.css', import.meta.url), 'utf8');
    const readingCss = readFileSync(
      new URL('../../../accessibility/readingPreferences/readingPreferences.css', import.meta.url),
      'utf8',
    );

    PHONE_QA_SAFE_AREA_TOKENS.forEach((token) => {
      expect(appCss).toContain(token);
    });
    expect(simulatorCss).toContain('var(--customer-safe-top)');
    expect(simulatorCss).toContain('var(--customer-safe-bottom)');
    expect(readingCss).toContain('.hs-header .rp-panel');
    expect(readingCss).toContain('position: absolute;');
  });
});
