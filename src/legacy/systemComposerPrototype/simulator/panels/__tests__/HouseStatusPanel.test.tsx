/**
 * HouseStatusPanel.test.tsx
 *
 * Visual-regression and state-rendering tests for the PR8 house-view redesign.
 *
 * Coverage:
 *   compact view
 *     - renders house-schematic root element
 *     - renders SVG roof element
 *     - renders foundation element
 *     - renders all inside floors (loft, first, ground)
 *     - renders outside zone
 *     - renders room chips with names
 *     - emitter chips are present when room has emitter
 *     - active emitter chips carry aria-label 'Emitter active'
 *     - loading state renders fallback
 *
 *   state tags
 *     - heating_active room gets house-room--heating-active class
 *     - cooling room gets house-room--cooling class
 *     - CH-paused status bar gets house-status-bar--paused class
 *
 *   expanded view
 *     - isExpanded adds house-cutaway--expanded class
 *     - room names are still visible in expanded view
 *
 *   partial / missing data
 *     - renders with floors array containing only ground floor (no loft/first)
 *     - renders when outside floor is absent
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import HouseStatusPanel from '../HouseStatusPanel'
import type { HouseDisplayState } from '../../useHousePlayback'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<HouseDisplayState> = {}): HouseDisplayState {
  return {
    indoorTempC: 19.3,
    statusLabel: 'Warming slowly',
    chPaused: false,
    floors: [
      {
        key: 'loft',
        label: 'Loft',
        className: 'house-floor--loft',
        rooms: [
          { name: 'Loft space', hasEmitter: false, emitterActive: false, state: 'stable' },
        ],
      },
      {
        key: 'first',
        label: 'First floor',
        className: 'house-floor--first',
        rooms: [
          { name: 'Bedroom 1', hasEmitter: true, emitterActive: true,  state: 'heating_active' },
          { name: 'Bedroom 2', hasEmitter: true, emitterActive: false, state: 'warming' },
          { name: 'Bathroom',  hasEmitter: true, emitterActive: false, state: 'stable' },
        ],
      },
      {
        key: 'ground',
        label: 'Ground floor',
        className: 'house-floor--ground',
        rooms: [
          { name: 'Kitchen',       hasEmitter: true,  emitterActive: true,  state: 'heating_active' },
          { name: 'Lounge',        hasEmitter: true,  emitterActive: true,  state: 'heating_active' },
          { name: 'Bathroom / WC', hasEmitter: true,  emitterActive: false, state: 'cooling' },
        ],
      },
      {
        key: 'outside',
        label: 'Outside',
        className: 'house-floor--outside',
        rooms: [
          { name: 'Garden / external', hasEmitter: false, emitterActive: false, state: 'cooling' },
        ],
      },
    ],
    ...overrides,
  }
}

// ─── Loading state ─────────────────────────────────────────────────────────────

describe('HouseStatusPanel — loading state', () => {
  it('renders loading fallback when state is undefined', () => {
    render(<HouseStatusPanel state={undefined} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Loading…')).toBeTruthy()
  })
})

// ─── Compact view structural elements ─────────────────────────────────────────

describe('HouseStatusPanel — compact view structure', () => {
  it('renders house-schematic root', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    expect(container.querySelector('.house-schematic')).not.toBeNull()
  })

  it('renders SVG roof element inside house-schematic__roof', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    const roof = container.querySelector('.house-schematic__roof')
    expect(roof).not.toBeNull()
    expect(roof!.querySelector('svg')).not.toBeNull()
  })

  it('renders foundation slab element', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    expect(container.querySelector('.house-schematic__foundation')).not.toBeNull()
  })

  it('renders all inside floor bands (loft, first floor, ground floor)', () => {
    render(<HouseStatusPanel state={makeState()} />)
    expect(screen.getByText('Loft')).toBeTruthy()
    expect(screen.getByText('First floor')).toBeTruthy()
    expect(screen.getByText('Ground floor')).toBeTruthy()
  })

  it('renders the outside zone below the house body', () => {
    render(<HouseStatusPanel state={makeState()} />)
    expect(screen.getByText('Outside')).toBeTruthy()
  })

  it('renders room chip labels', () => {
    render(<HouseStatusPanel state={makeState()} />)
    expect(screen.getByText('Bedroom 1')).toBeTruthy()
    expect(screen.getByText('Kitchen')).toBeTruthy()
    expect(screen.getByText('Loft space')).toBeTruthy()
    expect(screen.getByText('Garden / external')).toBeTruthy()
  })

  it('renders emitter icons for rooms that have emitters', () => {
    render(<HouseStatusPanel state={makeState()} />)
    // Bedroom 1 emitter is active
    const activeEmitters = screen.getAllByLabelText('Emitter active')
    expect(activeEmitters.length).toBeGreaterThan(0)
    // Bedroom 2 emitter is present but off
    const offEmitters = screen.getAllByLabelText('Emitter off')
    expect(offEmitters.length).toBeGreaterThan(0)
  })

  it('does NOT render emitter icon for rooms without emitters', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    // Find Loft space chip — it has no emitter
    const loftRooms = container.querySelector('.house-floor--loft .house-rooms')
    expect(loftRooms).not.toBeNull()
    expect(within(loftRooms!).queryByLabelText('Emitter active')).toBeNull()
    expect(within(loftRooms!).queryByLabelText('Emitter off')).toBeNull()
  })
})

// ─── Room state tags ───────────────────────────────────────────────────────────

describe('HouseStatusPanel — room heat-state CSS classes', () => {
  it('heating_active room chip carries house-room--heating-active class', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    // Bedroom 1 is heating_active
    const chip = Array.from(container.querySelectorAll('.house-room')).find(
      el => el.textContent?.includes('Bedroom 1'),
    )
    expect(chip).not.toBeUndefined()
    expect(chip!.classList.contains('house-room--heating-active')).toBe(true)
  })

  it('cooling room chip carries house-room--cooling class', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    // Bathroom / WC is cooling
    const chip = Array.from(container.querySelectorAll('.house-room')).find(
      el => el.textContent?.includes('Bathroom / WC'),
    )
    expect(chip).not.toBeUndefined()
    expect(chip!.classList.contains('house-room--cooling')).toBe(true)
  })

  it('warming room chip carries house-room--warming class', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    const chip = Array.from(container.querySelectorAll('.house-room')).find(
      el => el.textContent?.includes('Bedroom 2'),
    )
    expect(chip).not.toBeUndefined()
    expect(chip!.classList.contains('house-room--warming')).toBe(true)
  })
})

// ─── Status bar ───────────────────────────────────────────────────────────────

describe('HouseStatusPanel — status bar', () => {
  it('renders indoor temperature in the status bar', () => {
    render(<HouseStatusPanel state={makeState({ indoorTempC: 18.7 })} />)
    expect(screen.getByText('18.7 °C')).toBeTruthy()
  })

  it('renders status label in the status bar', () => {
    render(<HouseStatusPanel state={makeState({ statusLabel: 'Stable — holding warmth' })} />)
    expect(screen.getByText('Stable — holding warmth')).toBeTruthy()
  })

  it('applies house-status-bar--paused class when CH is paused', () => {
    const { container } = render(<HouseStatusPanel state={makeState({ chPaused: true })} />)
    expect(container.querySelector('.house-status-bar--paused')).not.toBeNull()
  })

  it('does NOT apply paused class when CH is active', () => {
    const { container } = render(<HouseStatusPanel state={makeState({ chPaused: false })} />)
    expect(container.querySelector('.house-status-bar--paused')).toBeNull()
  })
})

// ─── Expanded view ─────────────────────────────────────────────────────────────

describe('HouseStatusPanel — expanded view', () => {
  it('adds house-cutaway--expanded class when isExpanded is true', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} isExpanded />)
    expect(container.querySelector('.house-cutaway--expanded')).not.toBeNull()
  })

  it('does NOT add house-cutaway--expanded when isExpanded is false (default)', () => {
    const { container } = render(<HouseStatusPanel state={makeState()} />)
    expect(container.querySelector('.house-cutaway--expanded')).toBeNull()
  })

  it('still renders room names in expanded view', () => {
    render(<HouseStatusPanel state={makeState()} isExpanded />)
    expect(screen.getByText('Bedroom 1')).toBeTruthy()
    expect(screen.getByText('Kitchen')).toBeTruthy()
  })
})

// ─── Partial / missing room data ───────────────────────────────────────────────

describe('HouseStatusPanel — partial room data', () => {
  it('renders when only ground floor is supplied (no loft or first)', () => {
    const state = makeState({
      floors: [
        {
          key: 'ground',
          label: 'Ground floor',
          className: 'house-floor--ground',
          rooms: [
            { name: 'Kitchen', hasEmitter: true, emitterActive: false, state: 'stable' },
          ],
        },
      ],
    })
    render(<HouseStatusPanel state={state} />)
    expect(screen.getByText('Ground floor')).toBeTruthy()
    expect(screen.getByText('Kitchen')).toBeTruthy()
    // No loft or first floor labels
    expect(screen.queryByText('Loft')).toBeNull()
    expect(screen.queryByText('First floor')).toBeNull()
  })

  it('renders gracefully when outside floor is absent', () => {
    const state = makeState({
      floors: [
        {
          key: 'ground',
          label: 'Ground floor',
          className: 'house-floor--ground',
          rooms: [
            { name: 'Lounge', hasEmitter: true, emitterActive: true, state: 'heating_active' },
          ],
        },
      ],
    })
    render(<HouseStatusPanel state={state} />)
    expect(screen.queryByText('Outside')).toBeNull()
    expect(screen.getByText('Lounge')).toBeTruthy()
  })

  it('renders gracefully when a floor has no rooms', () => {
    const state = makeState({
      floors: [
        {
          key: 'ground',
          label: 'Ground floor',
          className: 'house-floor--ground',
          rooms: [],
        },
      ],
    })
    const { container } = render(<HouseStatusPanel state={state} />)
    expect(container.querySelector('.house-floor--ground')).not.toBeNull()
  })
})
