/**
 * DrawOffFocus.test.tsx
 *
 * Tests for Focus mode shell (PR6.2) and focused tile content (PR6.3):
 *
 * DrawOffWorkbench — Focus mode interaction
 *   - Each draw-off card has a Focus button
 *   - Clicking a Focus button opens the focus overlay
 *   - Focus overlay has aria role="dialog"
 *   - Focus overlay shows the correct outlet label
 *   - Clicking Close dismisses the overlay
 *   - Clicking the backdrop dismisses the overlay
 *   - Background panel gains dimmed class when overlay is open
 *   - Cylinder Focus button opens the cylinder focus panel
 *
 * DrawOffFocusPanel — content
 *   - Renders outlet title and icon
 *   - Renders cold supply, hot supply, and delivered rows
 *   - Renders status chip
 *   - Renders limiting factor
 *   - Renders boiler state for combi outlets
 *   - Boiler state chip shows correct label
 *   - Boiler state reason text is shown
 *   - No boiler state section for non-combi outlets
 *
 * CylinderFocusPanel — content
 *   - Renders panel title
 *   - Renders state chip
 *   - Renders storage regime
 *   - Renders delivery temperature
 *   - Renders usable hot water percentage (non-Mixergy)
 *   - Renders heated layer details (Mixergy)
 *   - Renders behaviour note section
 *   - Renders depletion alert when state is depleted
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DrawOffWorkbench from '../DrawOffWorkbench'
import DrawOffFocusPanel from '../DrawOffFocusPanel'
import CylinderFocusPanel from '../CylinderFocusPanel'
import type { DrawOffViewModel, CylinderStatusViewModel } from '../drawOffTypes'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIRING_OUTLET: DrawOffViewModel = {
  id: 'test-shower',
  label: 'Shower',
  icon: '🚿',
  status: 'stable',
  coldSupplyTempC: 10,
  coldSupplyFlowLpm: 12,
  hotSupplyTempC: 45,
  hotSupplyAvailableFlowLpm: 10,
  deliveredTempC: 38,
  deliveredFlowLpm: 10,
  note: 'Flow within appliance throughput.',
  limitingFactor: 'None',
  boilerState: 'firing',
}

const FAILS_OUTLET: DrawOffViewModel = {
  id: 'test-bath',
  label: 'Bath fill',
  icon: '🛁',
  status: 'starved',
  coldSupplyTempC: 10,
  coldSupplyFlowLpm: 12,
  hotSupplyTempC: 38,
  hotSupplyAvailableFlowLpm: 2,
  deliveredTempC: 28,
  deliveredFlowLpm: 4,
  note: 'Concurrent demand exhausted appliance capacity.',
  limitingFactor: 'Concurrent demand exceeds appliance capacity — insufficient DHW flow to sustain burner',
  boilerState: 'fails_to_fire',
}

const MARGINAL_OUTLET: DrawOffViewModel = {
  id: 'test-kitchen',
  label: 'Kitchen sink',
  icon: '🚰',
  status: 'flow_limited',
  coldSupplyTempC: 10,
  coldSupplyFlowLpm: 12,
  hotSupplyTempC: 42,
  hotSupplyAvailableFlowLpm: 5,
  deliveredTempC: 35,
  deliveredFlowLpm: 6,
  note: 'Flow at lower threshold.',
  limitingFactor: 'Hot-side output constrained — appliance throughput limit reached',
  boilerState: 'marginal',
}

const STORED_OUTLET: DrawOffViewModel = {
  id: 'test-shower-stored',
  label: 'Shower',
  icon: '🚿',
  status: 'stable',
  coldSupplyTempC: 10,
  coldSupplyFlowLpm: 15,
  hotSupplyTempC: 60,
  hotSupplyAvailableFlowLpm: 14,
  deliveredTempC: 38,
  deliveredFlowLpm: 11,
  note: 'Stored supply stable.',
  limitingFactor: 'None — stored supply ample',
  // no boilerState — stored system
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

const MIXERGY_CYLINDER: CylinderStatusViewModel = {
  storageRegime: 'mixergy_cylinder',
  topTempC: 60,
  heatedVolumeL: 128,
  heatedFractionPct: 85,
  nominalVolumeL: 150,
  usableVolumeFactor: 0.88,
  recoverySource: 'Boiler (Mixergy)',
  recoveryPowerTendency: 'Demand-mirrored heating — hot layer maintained; reduced reheat cycling',
  state: 'recovering',
  recoveryNote: 'Boiler firing via Mixergy controller.',
  storeNote: 'Hot water delivered from a defined heated layer.',
}

const DEPLETED_CYLINDER: CylinderStatusViewModel = {
  storageRegime: 'heat_pump_cylinder',
  topTempC: 40,
  bulkTempC: 36,
  nominalVolumeL: 200,
  usableVolumeFactor: 0.1,
  recoverySource: 'Heat pump',
  recoveryPowerTendency: 'Moderate',
  state: 'depleted',
  recoveryNote: 'Heat pump recovering.',
  storeNote: 'Usable volume depleted.',
}

// ─── DrawOffWorkbench — Focus mode interaction ────────────────────────────────

describe('DrawOffWorkbench — Focus mode shell', () => {
  it('each draw-off card has a Focus button', () => {
    render(<DrawOffWorkbench />)
    // Default regime is boiler_cylinder; 4 outlets
    const focusBtns = screen.getAllByRole('button', { name: /^Focus:/ })
    // 4 outlet Focus buttons + 1 cylinder Focus button
    expect(focusBtns.length).toBeGreaterThanOrEqual(4)
  })

  it('clicking a draw-off Focus button opens the focus overlay', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    expect(screen.getByTestId('focus-overlay')).toBeTruthy()
  })

  it('focus overlay has aria role="dialog"', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    expect(screen.getByRole('dialog', { name: 'Focus view' })).toBeTruthy()
  })

  it('focus overlay shows the correct outlet title', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    expect(screen.getByTestId('draw-off-focus-kitchen')).toBeTruthy()
  })

  it('clicking the Close button dismisses the overlay', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Shower' }))
    expect(screen.getByTestId('focus-overlay')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close Focus view' }))
    expect(screen.queryByTestId('focus-overlay')).toBeNull()
  })

  it('clicking the backdrop dismisses the overlay', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Bath fill' }))
    // backdrop has no role, find via aria-hidden
    const backdrop = document.querySelector('.draw-off-focus-overlay__backdrop') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(screen.queryByTestId('focus-overlay')).toBeNull()
  })

  it('background panel gets dimmed class when overlay is open', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    const panel = document.querySelector('.draw-off-workbench__panel') as HTMLElement
    expect(panel.classList.contains('draw-off-workbench__panel--dimmed')).toBe(true)
  })

  it('background panel loses dimmed class after overlay is closed', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close Focus view' }))
    const panel = document.querySelector('.draw-off-workbench__panel') as HTMLElement
    expect(panel.classList.contains('draw-off-workbench__panel--dimmed')).toBe(false)
  })

  it('cylinder Focus button opens the cylinder focus panel', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Cylinder status' }))
    expect(screen.getByTestId('cylinder-focus-panel')).toBeTruthy()
  })

  it('outlet focus overlay title shows outlet name followed by "— Focus"', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Kitchen sink' }))
    expect(screen.getByTestId('focus-overlay-title').textContent).toBe('Kitchen sink — Focus')
  })

  it('outlet focus overlay title updates for different outlets', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Shower' }))
    expect(screen.getByTestId('focus-overlay-title').textContent).toBe('Shower — Focus')
  })

  it('cylinder focus overlay title shows "Cylinder — Focus"', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Cylinder status' }))
    expect(screen.getByTestId('focus-overlay-title').textContent).toBe('Cylinder — Focus')
  })

  it('Focus shows combi boiler state when combi regime is active', () => {
    render(<DrawOffWorkbench />)
    fireEvent.click(screen.getByRole('button', { name: 'Combi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Shower' }))
    expect(screen.getByTestId('focus-boiler-state')).toBeTruthy()
  })

  it('Focus does NOT show boiler state for stored system', () => {
    render(<DrawOffWorkbench />)
    // default is boiler_cylinder
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Shower' }))
    expect(screen.queryByTestId('focus-boiler-state')).toBeNull()
  })
})

// ─── DrawOffFocusPanel — content ──────────────────────────────────────────────

describe('DrawOffFocusPanel — metric rows', () => {
  it('renders outlet icon', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('🚿')).toBeTruthy()
  })

  it('renders outlet title in uppercase', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('SHOWER')).toBeTruthy()
  })

  it('renders status chip', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByLabelText('Status: Stable draw')).toBeTruthy()
  })

  it('renders cold supply row', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('Cold supply')).toBeTruthy()
  })

  it('renders hot supply row', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('Hot supply')).toBeTruthy()
  })

  it('renders delivered row', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('Delivered')).toBeTruthy()
  })

  it('renders cold temperature', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('10°C')).toBeTruthy()
  })

  it('renders delivered temperature', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('38°C')).toBeTruthy()
  })

  it('renders limiting factor text', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('renders "Limiting factor" label', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('Limiting factor')).toBeTruthy()
  })
})

describe('DrawOffFocusPanel — boiler state', () => {
  it('renders boiler state section for combi outlet', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByTestId('focus-boiler-state')).toBeTruthy()
  })

  it('boiler state chip shows "Firing" for firing state', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByLabelText('Boiler state: Firing')).toBeTruthy()
  })

  it('boiler state chip shows "Fails to fire" for fails_to_fire state', () => {
    render(<DrawOffFocusPanel data={FAILS_OUTLET} />)
    expect(screen.getByLabelText('Boiler state: Fails to fire')).toBeTruthy()
  })

  it('boiler state chip shows "Marginal" for marginal state', () => {
    render(<DrawOffFocusPanel data={MARGINAL_OUTLET} />)
    expect(screen.getByLabelText('Boiler state: Marginal')).toBeTruthy()
  })

  it('renders firing reason text', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText(/Flow sustained above ignition threshold/)).toBeTruthy()
  })

  it('renders fails-to-fire reason with precise language', () => {
    render(<DrawOffFocusPanel data={FAILS_OUTLET} />)
    expect(screen.getByText(/Flow below minimum ignition threshold/)).toBeTruthy()
    expect(screen.getByText(/Insufficient DHW flow to sustain burner/)).toBeTruthy()
  })

  it('renders marginal reason text', () => {
    render(<DrawOffFocusPanel data={MARGINAL_OUTLET} />)
    expect(screen.getByText(/Flow near minimum sustained operation threshold/)).toBeTruthy()
  })

  it('does NOT render boiler state section for stored (non-combi) outlet', () => {
    render(<DrawOffFocusPanel data={STORED_OUTLET} />)
    expect(screen.queryByTestId('focus-boiler-state')).toBeNull()
  })

  it('renders boiler state chip test-id is present', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByTestId('boiler-state-chip')).toBeTruthy()
  })

  it('renders "Reason" label separately from boiler state chip', () => {
    render(<DrawOffFocusPanel data={FIRING_OUTLET} />)
    expect(screen.getByText('Reason')).toBeTruthy()
  })

  it('renders "Reason" label for fails_to_fire state', () => {
    render(<DrawOffFocusPanel data={FAILS_OUTLET} />)
    expect(screen.getByText('Reason')).toBeTruthy()
  })

  it('"Boiler state" label and chip are visually distinct from "Reason" label and text', () => {
    render(<DrawOffFocusPanel data={FAILS_OUTLET} />)
    // Both labels present
    expect(screen.getByText('Boiler state')).toBeTruthy()
    expect(screen.getByText('Reason')).toBeTruthy()
    // Chip and reason text both present
    expect(screen.getByLabelText('Boiler state: Fails to fire')).toBeTruthy()
    expect(screen.getByText(/Flow below minimum ignition threshold/)).toBeTruthy()
  })
})

// ─── CylinderFocusPanel — content ────────────────────────────────────────────

describe('CylinderFocusPanel — boiler cylinder', () => {
  it('renders "CYLINDER STATUS" title', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByText('CYLINDER STATUS')).toBeTruthy()
  })

  it('renders state chip for recovering state', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByLabelText('State: Recovering')).toBeTruthy()
  })

  it('renders storage regime', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByText('Boiler cylinder')).toBeTruthy()
  })

  it('renders "Delivery temperature" row', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByText('Delivery temperature')).toBeTruthy()
  })

  it('renders top temperature', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getAllByText('60°C').length).toBeGreaterThanOrEqual(1)
  })

  it('renders "Usable hot water" row with percentage', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByText('Usable hot water')).toBeTruthy()
    expect(screen.getByText('78%')).toBeTruthy()
  })

  it('renders behaviour note section', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getByText('System behaviour')).toBeTruthy()
  })

  it('boiler cylinder behaviour note mentions thermocline', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.getAllByText(/[Tt]hermocline/).length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT render depletion alert when state is recovering', () => {
    render(<CylinderFocusPanel data={BOILER_CYLINDER} />)
    expect(screen.queryByTestId('depletion-alert')).toBeNull()
  })
})

describe('CylinderFocusPanel — Mixergy cylinder', () => {
  it('renders "CYLINDER STATUS" title', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.getByText('CYLINDER STATUS')).toBeTruthy()
  })

  it('renders "Heated layer" row with volume', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.getAllByText('Heated layer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('128 L')).toBeTruthy()
  })

  it('renders heated fraction percentage in sub-text', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.getByText('(85% of nominal)')).toBeTruthy()
  })

  it('Mixergy behaviour note mentions demand mirroring', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.getAllByText(/[Dd]emand-mirrored/i).length).toBeGreaterThanOrEqual(1)
  })

  it('Mixergy behaviour note uses correct terminology', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.getByText(/top-down heating and active stratification/i)).toBeTruthy()
  })

  it('does NOT render "Usable hot water" row for Mixergy', () => {
    render(<CylinderFocusPanel data={MIXERGY_CYLINDER} />)
    expect(screen.queryByText('Usable hot water')).toBeNull()
  })
})

describe('CylinderFocusPanel — depletion state', () => {
  it('renders depletion alert when state is depleted', () => {
    render(<CylinderFocusPanel data={DEPLETED_CYLINDER} />)
    expect(screen.getByTestId('depletion-alert')).toBeTruthy()
  })

  it('depletion alert has role="alert"', () => {
    render(<CylinderFocusPanel data={DEPLETED_CYLINDER} />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('depletion alert mentions recovery', () => {
    render(<CylinderFocusPanel data={DEPLETED_CYLINDER} />)
    expect(screen.getByRole('alert').textContent).toMatch(/[Rr]ecovery/)
  })
})
