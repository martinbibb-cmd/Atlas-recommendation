/**
 * DrawOffWorkbench.test.tsx
 *
 * Validates that DrawOffWorkbench, DrawOffCard, and CylinderStatusCard:
 *
 * DrawOffWorkbench
 *   - Renders the workbench container
 *   - Shows the regime selector with all three options
 *   - Renders four draw-off outlet cards on initial load (boiler_cylinder default)
 *   - Renders the cylinder status card on initial load
 *   - Switches to combi data when "Combi" regime button is clicked
 *   - Switches to heat pump cylinder data when the button is clicked
 *
 * DrawOffCard
 *   - Renders outlet label, icon, and status chip
 *   - Renders cold / hot / delivered rows
 *   - Renders the behavioural note
 *   - Status chip has correct accessible label
 *
 * CylinderStatusCard
 *   - Renders the card title ("Cylinder status" for cylinder regimes)
 *   - Shows "Hot water source status" for combi
 *   - Renders storage regime, recovery source, and recovery tendency rows
 *   - Shows cylinder graphic only for cylinder-based regimes
 *   - Renders recovery and store notes
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawOffWorkbench from '../DrawOffWorkbench';
import DrawOffCard from '../DrawOffCard';
import CylinderStatusCard from '../CylinderStatusCard';
import type { DrawOffViewModel, CylinderStatusViewModel } from '../drawOffTypes';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const STABLE_OUTLET: DrawOffViewModel = {
  id: 'test-shower',
  label: 'Shower',
  icon: '🚿',
  status: 'stable',
  coldSupplyTempC: 10,
  coldSupplyFlowLpm: 12,
  hotSupplyTempC: 60,
  hotSupplyAvailableFlowLpm: 14,
  deliveredTempC: 38,
  deliveredFlowLpm: 11,
  note: 'Test note for the shower outlet.',
}

const BOILER_CYLINDER: CylinderStatusViewModel = {
  storageRegime: 'boiler_cylinder',
  topTempC: 60,
  bulkTempC: 55,
  nominalVolumeL: 150,
  usableVolumeFactor: 0.78,
  recoverySource: 'Boiler',
  recoveryPowerTendency: 'High — rapid recovery',
  state: 'recovering',
  recoveryNote: 'Boiler firing on DHW zone.',
  storeNote: 'Thermocline holding upper zone.',
}

const COMBI_SOURCE: CylinderStatusViewModel = {
  storageRegime: 'on_demand_combi',
  recoverySource: 'None (on-demand hot water)',
  recoveryPowerTendency: 'N/A — no stored volume',
  state: 'idle',
  recoveryNote: 'On-demand supply.',
  storeNote: 'No cylinder storage.',
}

const HP_CYLINDER: CylinderStatusViewModel = {
  storageRegime: 'heat_pump_cylinder',
  topTempC: 52,
  bulkTempC: 46,
  nominalVolumeL: 200,
  usableVolumeFactor: 0.45,
  recoverySource: 'Heat pump',
  recoveryPowerTendency: 'Moderate — slower reheat',
  state: 'recovering',
  recoveryNote: 'Heat pump recovering cylinder.',
  storeNote: 'Thermocline falling.',
}

const MIXERGY_CYLINDER: CylinderStatusViewModel = {
  storageRegime: 'mixergy_cylinder',
  topTempC: 60,
  heatedVolumeL: 128,
  heatedFractionPct: 85,
  nominalVolumeL: 150,
  usableVolumeFactor: 0.88,
  recoverySource: 'Boiler (Mixergy)',
  recoveryPowerTendency: 'High — demand mirroring reduces reheat cycling',
  state: 'recovering',
  recoveryNote: 'Boiler firing via Mixergy controller.',
  storeNote: 'Mixergy maintains a defined heated layer. Once that layer is exhausted, hot delivery drops more abruptly than in a conventional cylinder.',
}

// ─── DrawOffWorkbench ────────────────────────────────────────────────────────

describe('DrawOffWorkbench — structure', () => {
  it('renders the workbench container', () => {
    render(<DrawOffWorkbench />);
    expect(screen.getByTestId('draw-off-workbench')).toBeTruthy();
  });

  it('renders the regime selector group', () => {
    render(<DrawOffWorkbench />);
    expect(screen.getByRole('group', { name: 'System regime' })).toBeTruthy();
  });

  it('renders all four regime buttons', () => {
    render(<DrawOffWorkbench />);
    expect(screen.getByRole('button', { name: 'Combi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Boiler cylinder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heat pump cylinder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mixergy cylinder' })).toBeTruthy();
  });

  it('renders four outlet cards on initial load', () => {
    render(<DrawOffWorkbench />);
    expect(screen.getByTestId('draw-off-card-kitchen')).toBeTruthy();
    expect(screen.getByTestId('draw-off-card-basin')).toBeTruthy();
    expect(screen.getByTestId('draw-off-card-shower')).toBeTruthy();
    expect(screen.getByTestId('draw-off-card-bath')).toBeTruthy();
  });

  it('renders the cylinder status card on initial load', () => {
    render(<DrawOffWorkbench />);
    expect(screen.getByTestId('cylinder-status-card')).toBeTruthy();
  });
});

describe('DrawOffWorkbench — regime switching', () => {
  it('initially selects "Boiler cylinder" regime (aria-pressed)', () => {
    render(<DrawOffWorkbench />);
    const btn = screen.getByRole('button', { name: 'Boiler cylinder' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to combi data when "Combi" is clicked', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Combi' }));
    // Combi cylinder card title should be "Hot water source status"
    expect(screen.getByLabelText('Hot water source status')).toBeTruthy();
  });

  it('switches to heat pump cylinder data when that regime is selected', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Heat pump cylinder' }));
    expect(screen.getByRole('button', { name: 'Heat pump cylinder' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('combi regime shows "Combi" button as active', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Combi' }));
    expect(screen.getByRole('button', { name: 'Combi' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to Mixergy cylinder data when "Mixergy cylinder" is clicked', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Mixergy cylinder' }));
    expect(screen.getByRole('button', { name: 'Mixergy cylinder' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Mixergy regime shows "Mixergy cylinder" storage regime label', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Mixergy cylinder' }));
    // "Mixergy cylinder" appears in both the button and the regime label row — check at least 2 occurrences
    expect(screen.getAllByText('Mixergy cylinder').length).toBeGreaterThanOrEqual(2);
  });

  it('Mixergy regime shows cylinder graphic with cool-reserve schematic', () => {
    render(<DrawOffWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Mixergy cylinder' }));
    expect(screen.getByRole('img', { name: /Cylinder schematic/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /cool reserve/ })).toBeTruthy();
  });
});

// ─── DrawOffCard ─────────────────────────────────────────────────────────────

describe('DrawOffCard — structure', () => {
  it('renders the outlet label', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('Shower')).toBeTruthy();
  });

  it('renders the outlet icon', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('🚿')).toBeTruthy();
  });

  it('renders the status chip with correct text', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('Stable')).toBeTruthy();
  });

  it('status chip has accessible aria-label', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByLabelText('Status: Stable')).toBeTruthy();
  });

  it('renders all three supply row labels', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('Cold in')).toBeTruthy();
    expect(screen.getByText('Hot in')).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('renders cold supply temperature', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('10°C')).toBeTruthy();
  });

  it('renders delivered temperature', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('38°C')).toBeTruthy();
  });

  it('renders the behavioural note', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByText('Test note for the shower outlet.')).toBeTruthy();
  });

  it('has a data-testid attribute', () => {
    render(<DrawOffCard data={STABLE_OUTLET} />);
    expect(screen.getByTestId('draw-off-card-test-shower')).toBeTruthy();
  });
});

describe('DrawOffCard — status chip variants', () => {
  it('renders "Flow-limited" chip correctly', () => {
    render(<DrawOffCard data={{ ...STABLE_OUTLET, status: 'flow_limited' }} />);
    expect(screen.getByText('Flow-limited')).toBeTruthy();
  });

  it('renders "Temp-limited" chip correctly', () => {
    render(<DrawOffCard data={{ ...STABLE_OUTLET, status: 'temp_limited' }} />);
    expect(screen.getByText('Temp-limited')).toBeTruthy();
  });

  it('renders "Starved" chip correctly', () => {
    render(<DrawOffCard data={{ ...STABLE_OUTLET, status: 'starved' }} />);
    expect(screen.getByText('Starved')).toBeTruthy();
  });
});

// ─── CylinderStatusCard ──────────────────────────────────────────────────────

describe('CylinderStatusCard — boiler cylinder', () => {
  it('renders "Cylinder status" as the panel title', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Cylinder status')).toBeTruthy();
  });

  it('has accessible aria-label "Cylinder status"', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByLabelText('Cylinder status')).toBeTruthy();
  });

  it('renders the state chip', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByLabelText('State: Recovering')).toBeTruthy();
  });

  it('renders "Boiler cylinder" as the storage regime', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Boiler cylinder')).toBeTruthy();
  });

  it('renders top temperature', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    // 60°C appears in both the cylinder graphic zone label and the data row
    expect(screen.getAllByText('60°C').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nominal volume', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('150 L')).toBeTruthy();
  });

  it('renders usable volume as a percentage', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('78%')).toBeTruthy();
  });

  it('renders recovery source', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Boiler')).toBeTruthy();
  });

  it('renders recovery note', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Boiler firing on DHW zone.')).toBeTruthy();
  });

  it('renders store note', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Thermocline holding upper zone.')).toBeTruthy();
  });

  it('renders the cylinder graphic', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByRole('img', { name: /Cylinder schematic/ })).toBeTruthy();
  });
});

describe('CylinderStatusCard — combi (instantaneous)', () => {
  it('renders "Hot water source status" as panel title', () => {
    render(<CylinderStatusCard data={COMBI_SOURCE} />);
    expect(screen.getByText('Hot water source status')).toBeTruthy();
  });

  it('has accessible aria-label "Hot water source status"', () => {
    render(<CylinderStatusCard data={COMBI_SOURCE} />);
    expect(screen.getByLabelText('Hot water source status')).toBeTruthy();
  });

  it('renders "On-demand (combi)" storage regime label', () => {
    render(<CylinderStatusCard data={COMBI_SOURCE} />);
    expect(screen.getByText('On-demand (combi)')).toBeTruthy();
  });

  it('does NOT render a cylinder graphic for combi', () => {
    render(<CylinderStatusCard data={COMBI_SOURCE} />);
    expect(screen.queryByRole('img', { name: /Cylinder schematic/ })).toBeNull();
  });
});

describe('CylinderStatusCard — heat pump cylinder', () => {
  it('renders "Cylinder status" as panel title', () => {
    render(<CylinderStatusCard data={HP_CYLINDER} />);
    expect(screen.getByText('Cylinder status')).toBeTruthy();
  });

  it('renders "Heat pump cylinder" regime label', () => {
    render(<CylinderStatusCard data={HP_CYLINDER} />);
    expect(screen.getByText('Heat pump cylinder')).toBeTruthy();
  });

  it('renders usable volume as 45%', () => {
    render(<CylinderStatusCard data={HP_CYLINDER} />);
    expect(screen.getByText('45%')).toBeTruthy();
  });

  it('renders recovery note for heat pump', () => {
    render(<CylinderStatusCard data={HP_CYLINDER} />);
    expect(screen.getByText('Heat pump recovering cylinder.')).toBeTruthy();
  });
});

// ─── CylinderStatusCard — Mixergy ────────────────────────────────────────────

describe('CylinderStatusCard — Mixergy cylinder', () => {
  it('renders "Cylinder status" as panel title', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('Cylinder status')).toBeTruthy();
  });

  it('renders "Mixergy cylinder" regime label', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('Mixergy cylinder')).toBeTruthy();
  });

  it('renders heated volume in litres', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('128 L')).toBeTruthy();
  });

  it('renders heated fraction as a percentage', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('does NOT render a "Bulk temp" row for Mixergy', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.queryByText('Bulk temp')).toBeNull();
  });

  it('does NOT render a "Usable volume" row for Mixergy', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.queryByText('Usable volume')).toBeNull();
  });

  it('renders "Heated volume" label for Mixergy', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('Heated volume')).toBeTruthy();
  });

  it('renders "Heated fraction" label for Mixergy', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('Heated fraction')).toBeTruthy();
  });

  it('renders nominal volume', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('150 L')).toBeTruthy();
  });

  it('renders the cylinder graphic with Mixergy aria-label', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByRole('img', { name: /Cylinder schematic/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /cool reserve/ })).toBeTruthy();
  });

  it('cylinder graphic does NOT mention bulk temperature', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    const graphic = screen.getByRole('img', { name: /Cylinder schematic/ });
    expect(graphic.getAttribute('aria-label')).not.toContain('bulk');
  });

  it('renders recovery note for Mixergy', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText('Boiler firing via Mixergy controller.')).toBeTruthy();
  });

  it('renders store note describing defined heated layer behaviour', () => {
    render(<CylinderStatusCard data={MIXERGY_CYLINDER} />);
    expect(screen.getByText(/defined heated layer/)).toBeTruthy();
  });
});

describe('CylinderStatusCard — boiler cylinder retains bulk-temp model', () => {
  it('renders "Bulk temp" row for a standard boiler cylinder', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Bulk temp')).toBeTruthy();
  });

  it('renders "Usable volume" row for a standard boiler cylinder', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.getByText('Usable volume')).toBeTruthy();
  });

  it('does NOT render "Heated volume" row for a boiler cylinder', () => {
    render(<CylinderStatusCard data={BOILER_CYLINDER} />);
    expect(screen.queryByText('Heated volume')).toBeNull();
  });
});
