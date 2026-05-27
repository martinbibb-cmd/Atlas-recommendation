/**
 * Tests for DrawOffPanel.tsx — the draw-off outlet panel component.
 *
 * Validates that the panel:
 *   - Renders one row per outlet using OutletDisplayState
 *   - Shows hot/cold/mixed badge correctly
 *   - Shows open/closed state
 *   - Shows flow (L/min) and temperature (°C) for open outlets
 *   - Shows concurrency warning when isConstrained
 *   - Shows system-level banners for serviceSwitching / cylinder reheat / combi capacity
 *   - Renders nothing when outletStates is empty
 *   - Does NOT infer outlet truth from raw colours — uses OutletDisplayState exclusively
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrawOffPanel } from '../animation/render/DrawOffPanel'
import type { OutletDisplayState } from '../state/outletDisplayState'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOpenMixed(overrides: Partial<OutletDisplayState> = {}): OutletDisplayState {
  return {
    outletId: 'A',
    label: 'Shower A',
    open: true,
    service: 'mixed_hot_running',
    flowLpm: 8.2,
    deliveredTempC: 46,
    isConstrained: false,
    ...overrides,
  }
}

function makeClosed(overrides: Partial<OutletDisplayState> = {}): OutletDisplayState {
  return {
    outletId: 'B',
    label: 'Basin B',
    open: false,
    service: 'off',
    flowLpm: 0,
    isConstrained: false,
    ...overrides,
  }
}

function makeColdTap(overrides: Partial<OutletDisplayState> = {}): OutletDisplayState {
  return {
    outletId: 'C',
    label: 'Cold tap C',
    open: true,
    service: 'cold_only',
    flowLpm: 10,
    deliveredTempC: 10,
    isConstrained: false,
    coldSource: 'mains',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DrawOffPanel — basic rendering', () => {
  it('renders nothing when outletStates is empty', () => {
    const { container } = render(<DrawOffPanel outletStates={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the panel header', () => {
    render(<DrawOffPanel outletStates={[makeOpenMixed()]} />)
    expect(screen.getByText('Draw-off')).toBeTruthy()
  })

  it('renders one row per outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed(), makeClosed(), makeColdTap()]}
      />,
    )
    expect(screen.getByText('Shower A')).toBeTruthy()
    expect(screen.getByText('Basin B')).toBeTruthy()
    expect(screen.getByText('Cold tap C')).toBeTruthy()
  })
})

describe('DrawOffPanel — service classification badges', () => {
  it('shows "Mixed" badge for mixed_hot_running outlet', () => {
    render(<DrawOffPanel outletStates={[makeOpenMixed({ service: 'mixed_hot_running' })]} />)
    expect(screen.getByText('Mixed')).toBeTruthy()
  })

  it('shows "Mixed — cold" badge for mixed_cold_running outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ service: 'mixed_cold_running' })]}
      />,
    )
    expect(screen.getByText('Mixed — cold')).toBeTruthy()
  })

  it('shows "Cold" badge for cold_only outlet', () => {
    render(<DrawOffPanel outletStates={[makeColdTap()]} />)
    expect(screen.getByText('Cold')).toBeTruthy()
  })

  it('shows "Hot" badge for hot_only outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ service: 'hot_only' })]}
      />,
    )
    expect(screen.getByText('Hot')).toBeTruthy()
  })

  it('shows "Closed" badge for a closed outlet', () => {
    render(<DrawOffPanel outletStates={[makeClosed()]} />)
    expect(screen.getByText('Closed')).toBeTruthy()
  })
})

describe('DrawOffPanel — flow and temperature display', () => {
  it('shows flow and temperature for an open mixed outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ flowLpm: 8.2, deliveredTempC: 46 })]}
      />,
    )
    expect(screen.getByText('8.2 L/min')).toBeTruthy()
    expect(screen.getByText('46 °C')).toBeTruthy()
  })

  it('does not show flow for a closed outlet', () => {
    render(<DrawOffPanel outletStates={[makeClosed()]} />)
    expect(screen.queryByText(/L\/min/)).toBeNull()
  })

  it('shows mains-fed supply note for an open cold-only mains outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeColdTap({ coldSource: 'mains', flowLpm: 10 })]}
      />,
    )
    expect(screen.getByText('mains-fed supply')).toBeTruthy()
    // Cold taps also show flow rate
    expect(screen.getByText('10.0 L/min')).toBeTruthy()
  })

  it('shows tank-fed supply note for an open cold-only cws outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeColdTap({ coldSource: 'cws', flowLpm: 6 })]}
      />,
    )
    expect(screen.getByText('tank-fed supply')).toBeTruthy()
    expect(screen.getByText('6.0 L/min')).toBeTruthy()
  })

  it('shows on-demand hot water note for open mixed outlet with hotSource on_demand', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ hotSource: 'on_demand' })]}
      />,
    )
    expect(screen.getByText('on-demand hot water')).toBeTruthy()
  })

  it('shows stored hot water note for open mixed outlet with hotSource stored', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ hotSource: 'stored' })]}
      />,
    )
    expect(screen.getByText('stored hot water')).toBeTruthy()
  })

  it('shows stored hot water note for open hot_only outlet with hotSource stored', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ service: 'hot_only', hotSource: 'stored' })]}
      />,
    )
    expect(screen.getByText('stored hot water')).toBeTruthy()
  })

  it('does not show a hot source note when hotSource is undefined', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ hotSource: undefined })]}
      />,
    )
    expect(screen.queryByText('on-demand hot water')).toBeNull()
    expect(screen.queryByText('stored hot water')).toBeNull()
  })

  it('does not show a hot source note for a cold-only outlet', () => {
    // hotSource should be ignored by the renderer for cold-only outlets even
    // if it is accidentally set on the state object.
    render(
      <DrawOffPanel
        outletStates={[makeColdTap({ hotSource: 'on_demand' })]}
      />,
    )
    expect(screen.queryByText('on-demand hot water')).toBeNull()
  })
})

describe('DrawOffPanel — concurrency warnings', () => {
  it('shows constraint warning when outlet is constrained', () => {
    render(
      <DrawOffPanel
        outletStates={[
          makeOpenMixed({
            isConstrained: true,
            constraintReason: 'Low mains flow: 12.0 L/min shared across 2 outlets',
          }),
        ]}
      />,
    )
    const warning = screen.getByRole('status')
    expect(warning.textContent).toContain('Flow reduced by concurrent demand')
    expect(warning.textContent).toContain('12.0 L/min')
  })

  it('shows temperature-falling note for mixed_cold_running open outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ service: 'mixed_cold_running' })]}
      />,
    )
    const warnings = screen.getAllByRole('status')
    const texts = warnings.map(el => el.textContent ?? '')
    expect(texts.some(t => t.includes('Delivered temperature falling'))).toBe(true)
  })

  it('does not show a warning for a normal open mixed outlet', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed({ service: 'mixed_hot_running', isConstrained: false })]}
      />,
    )
    // Only system banners would trigger role="status"; none expected here.
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('DrawOffPanel — system-level banners', () => {
  it('shows combi service switching banner when active', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed()]}
        serviceSwitchingActive={true}
      />,
    )
    const banners = screen.getAllByRole('status')
    const texts = banners.map(el => el.textContent ?? '')
    expect(texts.some(t => t.includes('On-demand hot water active'))).toBe(true)
  })

  it('shows stored hot water reheat banner for cylinder during dhw_reheat', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed()]}
        systemMode="dhw_reheat"
        isCylinder={true}
      />,
    )
    const banners = screen.getAllByRole('status')
    const texts = banners.map(el => el.textContent ?? '')
    expect(texts.some(t => t.includes('Stored hot water buffering peak demand'))).toBe(true)
  })

  it('does not show cylinder reheat banner for combi systems', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed()]}
        systemMode="dhw_draw"
        isCylinder={false}
      />,
    )
    // No cylinder → no buffering banner.
    const statuses = screen.queryAllByRole('status')
    const texts = statuses.map(el => el.textContent ?? '')
    expect(texts.some(t => t.includes('Stored hot water buffering'))).toBe(false)
  })

  it('shows combi at capacity banner when combiAtCapacity is true', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed()]}
        combiAtCapacity={true}
      />,
    )
    const banners = screen.getAllByRole('status')
    const texts = banners.map(el => el.textContent ?? '')
    expect(texts.some(t => t.includes('On-demand hot water at capacity'))).toBe(true)
  })

  it('shows no banners when all system state is normal', () => {
    render(
      <DrawOffPanel
        outletStates={[makeOpenMixed()]}
        systemMode="dhw_draw"
        isCylinder={false}
        serviceSwitchingActive={false}
        combiAtCapacity={false}
      />,
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
