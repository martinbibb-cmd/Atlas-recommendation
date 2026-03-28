/**
 * QuadrantDashboardPage.test.tsx
 *
 * Validates the interactive behaviour of the 2×2 quadrant dashboard:
 *
 *   - Each quadrant is tappable and expands its detail panel on click.
 *   - Expanding one quadrant collapses the previously-expanded one.
 *   - Clicking the same quadrant again collapses it (toggle).
 *   - Expanded state is properly conveyed to assistive technology via
 *     aria-expanded.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuadrantDashboardPage from '../QuadrantDashboardPage';
import type { HouseSignal, HomeSignal, CurrentSystemSignal } from '../buildCanonicalPresentation';
import type { PrioritiesState } from '../../../features/survey/priorities/prioritiesTypes';

// ─── Minimal stub data ────────────────────────────────────────────────────────

const HOUSE: HouseSignal = {
  heatLossLabel:    'Moderate heat loss',
  heatLossBand:     'Standard',
  pipeworkLabel:    '22 mm primary pipework',
  waterSupplyLabel: 'Mains-fed supply',
  pvPotentialLabel: 'Good solar potential',
  wallTypeLabel:    'Cavity — uninsulated',
  insulationLabel:  'Partial loft insulation',
  wallTypeKey:      'cavity_uninsulated',
  notes:            [],
};

const HOME: HomeSignal = {
  demandProfileLabel:    '4-person household',
  dailyHotWaterLitres:   160,
  dailyHotWaterLabel:    '~160 litres/day',
  peakSimultaneousOutlets: 2,
  peakOutletsLabel:      '2 outlets simultaneously',
  bathUseIntensityLabel: 'Moderate bath use',
  occupancyTimingLabel:  'Home most of the day',
  storageBenefitLabel:   'Strong storage benefit',
  narrativeSignals:      [],
};

const CURRENT_SYSTEM: CurrentSystemSignal = {
  systemTypeLabel:  'Combi boiler',
  ageLabel:         '9 years old',
  ageContext:       'Approaching mid-life',
  makeModelText:    undefined,
  outputLabel:      undefined,
  drivingStyleMode: 'combi',
  dhwStorageType:   'none',
  dhwArchitecture:  'on_demand',
};

const PRIORITIES: PrioritiesState = {
  selected: ['lower_bills', 'reliability'],
};

function renderDashboard(prioritiesState?: PrioritiesState) {
  return render(
    <QuadrantDashboardPage
      house={HOUSE}
      home={HOME}
      currentSystem={CURRENT_SYSTEM}
      prioritiesState={prioritiesState}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuadrantDashboardPage — expand / collapse', () => {
  it('renders all four quadrant buttons', () => {
    renderDashboard();
    expect(screen.getByLabelText('Your House — tap to expand')).toBeTruthy();
    expect(screen.getByLabelText('Your Home — tap to expand')).toBeTruthy();
    expect(screen.getByLabelText('Your System — tap to expand')).toBeTruthy();
    expect(screen.getByLabelText('Your Priorities — tap to expand')).toBeTruthy();
  });

  it('all quadrants start collapsed (aria-expanded=false)', () => {
    renderDashboard();
    const quadrantLabels = [
      'Your House — tap to expand',
      'Your Home — tap to expand',
      'Your System — tap to expand',
      'Your Priorities — tap to expand',
    ];
    for (const label of quadrantLabels) {
      const btn = screen.getByLabelText(label);
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('clicking Your House expands it and shows house detail', () => {
    renderDashboard();
    const houseBtn = screen.getByLabelText('Your House — tap to expand');
    fireEvent.click(houseBtn);
    expect(houseBtn.getAttribute('aria-expanded')).toBe('true');
    // Expanded detail is rendered
    expect(screen.getByRole('region', { name: 'House details' })).toBeTruthy();
  });

  it('clicking Your Home expands it and shows home detail', () => {
    renderDashboard();
    fireEvent.click(screen.getByLabelText('Your Home — tap to expand'));
    expect(screen.getByRole('region', { name: 'Home details' })).toBeTruthy();
  });

  it('clicking Your System expands it and shows system detail', () => {
    renderDashboard();
    fireEvent.click(screen.getByLabelText('Your System — tap to expand'));
    expect(screen.getByRole('region', { name: 'System details' })).toBeTruthy();
  });

  it('clicking Your Priorities expands it and shows priority detail', () => {
    renderDashboard(PRIORITIES);
    fireEvent.click(screen.getByLabelText('Your Priorities — tap to expand'));
    expect(screen.getByRole('region', { name: 'Priority details' })).toBeTruthy();
  });

  it('expanding House collapses it again when clicked a second time', () => {
    renderDashboard();
    const houseBtn = screen.getByLabelText('Your House — tap to expand');
    fireEvent.click(houseBtn);
    expect(houseBtn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(houseBtn);
    expect(houseBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('expanding a second quadrant collapses the first one', () => {
    renderDashboard();
    const houseBtn  = screen.getByLabelText('Your House — tap to expand');
    const systemBtn = screen.getByLabelText('Your System — tap to expand');

    // Open House
    fireEvent.click(houseBtn);
    expect(houseBtn.getAttribute('aria-expanded')).toBe('true');
    expect(systemBtn.getAttribute('aria-expanded')).toBe('false');

    // Open System — House should close
    fireEvent.click(systemBtn);
    expect(houseBtn.getAttribute('aria-expanded')).toBe('false');
    expect(systemBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('only one quadrant is expanded at a time after cycling through all four', () => {
    renderDashboard(PRIORITIES);
    const labels = [
      'Your House — tap to expand',
      'Your Home — tap to expand',
      'Your System — tap to expand',
      'Your Priorities — tap to expand',
    ];

    for (const label of labels) {
      fireEvent.click(screen.getByLabelText(label));
      const allBtns = labels.map(l => screen.getByLabelText(l));
      const expanded = allBtns.filter(b => b.getAttribute('aria-expanded') === 'true');
      expect(expanded).toHaveLength(1);
      expect(expanded[0]).toBe(screen.getByLabelText(label));
    }
  });
});
