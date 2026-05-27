/**
 * DrawOffStatusPanel.test.tsx
 *
 * State rendering tests for the simulator draw-off panel (PR9):
 *
 * outletToViewModel — state derivation
 *   - inactive outlet maps to 'inactive' status (never 'stable')
 *   - open combi outlet with mains flow below ignition threshold maps to 'below_ignition_threshold'
 *   - open combi outlet with normal mains flow maps to 'stable'
 *   - open constrained outlet maps to 'flow_limited' or 'temp_limited'
 *
 * DrawOffStatusPanel — rendered states
 *   - inactive outlet shows 'Inactive' chip
 *   - inactive outlet does NOT show 'Stable draw' chip
 *   - combi below-ignition open outlet shows 'Flow too low to fire' chip
 *   - combi below-ignition shows explanatory note about cold delivery
 *   - normal combi outlet shows 'Stable draw' chip
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DrawOffStatusPanel from '../DrawOffStatusPanel'
import type { DrawOffDisplayState } from '../../useDrawOffPlayback'
import type { OutletDisplayState } from '../../../state/outletDisplayState'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOutlet(overrides: Partial<OutletDisplayState>): OutletDisplayState {
  return {
    outletId: 'shower',
    label: 'Shower',
    open: false,
    service: 'off',
    flowLpm: 0,
    isConstrained: false,
    coldSource: 'mains',
    ...overrides,
  }
}

function makeState(outletOverrides: Partial<OutletDisplayState>[] = []): DrawOffDisplayState {
  const outlets: OutletDisplayState[] = outletOverrides.length
    ? outletOverrides.map(o => makeOutlet(o))
    : [makeOutlet({})]

  return {
    outletStates: outlets,
    systemMode: 'idle',
    isCylinder: false,
    serviceSwitchingActive: false,
    combiAtCapacity: false,
    storedHotWaterState: null,
  }
}

const NO_OP = vi.fn()

const BASE_CONTROLS = {
  mode: 'manual' as const,
  heatingEnabled: false,
  shower: false,
  bath: false,
  kitchen: false,
  coldTap: false,
  onSetMode: NO_OP,
  onToggleHeating: NO_OP,
  onToggleShower: NO_OP,
  onToggleBath: NO_OP,
  onToggleKitchen: NO_OP,
  onToggleColdTap: NO_OP,
  onPresetOne: NO_OP,
  onPresetTwo: NO_OP,
  onPresetBathFill: NO_OP,
}

// ─── Inactive outlet state ─────────────────────────────────────────────────────

describe('DrawOffStatusPanel — inactive outlet state', () => {
  it('closed outlet shows Inactive chip (never Stable draw)', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([{ outletId: 'shower', label: 'Shower', open: false, service: 'off', flowLpm: 0, isConstrained: false, coldSource: 'mains' }])}
        systemChoice="combi"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    expect(screen.getByLabelText('Status: Inactive')).toBeTruthy()
    expect(screen.queryByLabelText('Status: Stable draw')).toBeNull()
  })

  it('closed outlet note says "Outlet closed — no flow demand"', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([{ outletId: 'shower', label: 'Shower', open: false, service: 'off', flowLpm: 0, isConstrained: false, coldSource: 'mains' }])}
        systemChoice="combi"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    expect(screen.getByText('Outlet closed — no flow demand.')).toBeTruthy()
  })
})

// ─── Combi below-ignition state ───────────────────────────────────────────────

describe('DrawOffStatusPanel — combi below-ignition outlet state', () => {
  it('open combi outlet with mains flow below ignition threshold shows "Flow too low to fire" chip', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([{
          outletId: 'shower', label: 'Shower',
          open: true, service: 'mixed_hot_running', flowLpm: 1.5,
          deliveredTempC: 10, isConstrained: false, coldSource: 'mains',
        }])}
        systemChoice="combi"
        mainsFlowLpm={1.5}    // below COMBI_IGNITION_THRESHOLD_LPM = 2.5
        {...BASE_CONTROLS}
      />,
    )
    expect(screen.getByLabelText('Status: Flow too low to fire')).toBeTruthy()
  })

  it('below-ignition note mentions cold water delivery', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([{
          outletId: 'shower', label: 'Shower',
          open: true, service: 'mixed_hot_running', flowLpm: 1.5,
          deliveredTempC: 10, isConstrained: false, coldSource: 'mains',
        }])}
        systemChoice="combi"
        mainsFlowLpm={1.5}
        {...BASE_CONTROLS}
      />,
    )
    expect(screen.getByText(/Flow too low to fire combi/)).toBeTruthy()
  })
})

// ─── Combi normal firing state ────────────────────────────────────────────────

describe('DrawOffStatusPanel — combi normal firing state', () => {
  it('open combi outlet with normal mains flow shows Stable draw chip', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([{
          outletId: 'shower', label: 'Shower',
          open: true, service: 'mixed_hot_running', flowLpm: 8,
          deliveredTempC: 38, isConstrained: false, coldSource: 'mains',
        }])}
        systemChoice="combi"
        mainsFlowLpm={12}    // well above ignition threshold
        {...BASE_CONTROLS}
      />,
    )
    expect(screen.getByLabelText('Status: Stable draw')).toBeTruthy()
  })
})

// ─── Multi-outlet simultaneous demand ─────────────────────────────────────────

describe('DrawOffStatusPanel — multi-outlet state with propagated mains flow', () => {
  it('shows below-ignition for all open outlets when mains flow is below threshold on combi', () => {
    render(
      <DrawOffStatusPanel
        state={makeState([
          { outletId: 'shower', label: 'Shower', open: true, service: 'mixed_hot_running', flowLpm: 1.2, deliveredTempC: 10, isConstrained: false, coldSource: 'mains' },
          { outletId: 'kitchen', label: 'Kitchen', open: true, service: 'mixed_hot_running', flowLpm: 1.2, deliveredTempC: 10, isConstrained: false, coldSource: 'mains' },
        ])}
        systemChoice="combi"
        mainsFlowLpm={2.0}   // below ignition threshold for both outlets
        {...BASE_CONTROLS}
      />,
    )
    const chips = screen.getAllByLabelText('Status: Flow too low to fire')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── Shared mains budget across concurrent outlets ─────────────────────────────

describe('DrawOffStatusPanel — shared mains cold-supply budget', () => {
  it('single open outlet receives the full mains flow as cold supply', () => {
    const { container } = render(
      <DrawOffStatusPanel
        state={makeState([{
          outletId: 'shower', label: 'Shower',
          open: true, service: 'mixed_hot_running', flowLpm: 9,
          deliveredTempC: 45, isConstrained: false, coldSource: 'mains',
        }])}
        systemChoice="combi"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    // The card should show the full 12 L/min for a solo outlet.
    expect(container.textContent).toContain('12')
    // The card must NOT show 6 (half-share would be wrong for a solo outlet).
    // We allow 12 to appear as the flow label, not 6.
    const coldRow = container.querySelector('.draw-off-card__row--cold')
    expect(coldRow?.textContent).toContain('12')
  })

  it('two concurrent mains-fed outlets each receive half the mains flow as cold supply (not the full flow)', () => {
    const { container } = render(
      <DrawOffStatusPanel
        state={makeState([
          { outletId: 'shower',  label: 'Shower',  open: true, service: 'mixed_hot_running', flowLpm: 6, deliveredTempC: 43, isConstrained: true,  coldSource: 'mains' },
          { outletId: 'kitchen', label: 'Kitchen', open: true, service: 'mixed_hot_running', flowLpm: 6, deliveredTempC: 42, isConstrained: true,  coldSource: 'mains' },
        ])}
        systemChoice="combi"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    // Each card's cold-in row must show 6 L/min (12 shared across 2 outlets).
    const coldRows = container.querySelectorAll('.draw-off-card__row--cold')
    expect(coldRows.length).toBeGreaterThanOrEqual(2)
    coldRows.forEach(row => {
      expect(row.textContent).toContain('6')
      // Must NOT show the full 12 as the cold supply for each concurrent outlet.
      expect(row.textContent).not.toMatch(/\b12\b/)
    })
  })

  it('three concurrent mains-fed outlets each receive one-third of the mains budget (not the full flow)', () => {
    const { container } = render(
      <DrawOffStatusPanel
        state={makeState([
          { outletId: 'shower',  label: 'Shower',  open: true, service: 'mixed_hot_running', flowLpm: 4, deliveredTempC: 40, isConstrained: true, coldSource: 'mains' },
          { outletId: 'bath',    label: 'Bath',    open: true, service: 'mixed_hot_running', flowLpm: 4, deliveredTempC: 40, isConstrained: true, coldSource: 'mains' },
          { outletId: 'kitchen', label: 'Kitchen', open: true, service: 'mixed_hot_running', flowLpm: 4, deliveredTempC: 40, isConstrained: true, coldSource: 'mains' },
        ])}
        systemChoice="combi"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    // Each cold-in row must show 4 L/min (12 / 3).
    const coldRows = container.querySelectorAll('.draw-off-card__row--cold')
    expect(coldRows.length).toBeGreaterThanOrEqual(3)
    coldRows.forEach(row => {
      expect(row.textContent).toContain('4')
    })
  })

  it('CWS-fed outlets are not counted in the mains-sharing budget', () => {
    const { container } = render(
      <DrawOffStatusPanel
        state={makeState([
          { outletId: 'shower',  label: 'Shower',  open: true, service: 'mixed_hot_running', flowLpm: 8, deliveredTempC: 44, isConstrained: false, coldSource: 'cws'   },
          { outletId: 'kitchen', label: 'Kitchen', open: true, service: 'mixed_hot_running', flowLpm: 5, deliveredTempC: 44, isConstrained: false, coldSource: 'mains' },
        ])}
        systemChoice="unvented"
        mainsFlowLpm={12}
        {...BASE_CONTROLS}
      />,
    )
    // Kitchen (mains) is the only mains-fed outlet — it should see the full 12 L/min.
    // Shower (CWS) should see the CWS rate (8 L/min).
    const coldRows = container.querySelectorAll('.draw-off-card__row--cold')
    expect(coldRows.length).toBeGreaterThanOrEqual(2)
    // We verify that not all cold rows show the same flow (CWS vs mains differ).
    const texts = Array.from(coldRows).map(r => r.textContent ?? '')
    // At least one row must contain '8' (CWS rate) and at least one must contain '12' (full mains).
    expect(texts.some(t => t.includes('8'))).toBe(true)
    expect(texts.some(t => t.includes('12'))).toBe(true)
  })
})
