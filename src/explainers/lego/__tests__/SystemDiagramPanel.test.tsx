/**
 * Tests for SystemDiagramPanel — the live animated system schematic.
 *
 * Validates that the panel:
 *   - Renders in static/idle mode when no state is provided
 *   - Shows CH flow pipes as active during 'heating' mode
 *   - Shows CH pipes as faded (not hidden) when serviceSwitchingActive is true
 *   - Shows combi DHW path active during 'dhw_draw' mode
 *   - Shows stored hot-draw path active when hotDrawActive is true (stored only)
 *   - Shows primary reheat path active during 'dhw_reheat' / 'heating_and_reheat'
 *   - Shows stored hot-draw pipe only for stored systems (not combi)
 *   - Shows "CH paused" callout badge when serviceSwitchingActive
 *   - Shows "Cylinder reheat" callout badge when primaryReheat active
 *   - Combi label says "Plate HEX" and stored label says "Cylinder"
 *   - Boiler sublabel reflects live boilerOutputKw prop (not hardcoded)
 *
 * These tests use data-testid attributes on critical pipe polylines so the
 * assertions are stable regardless of CSS class naming changes.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SystemDiagramPanel from '../simulator/panels/SystemDiagramPanel'
import type { SystemDiagramDisplayState } from '../simulator/useSystemDiagramPlayback'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'

// ─── State factories ──────────────────────────────────────────────────────────

function combiIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
  }
}

function combiHeating(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'heating',
  }
}

function combiDhwDraw(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    serviceSwitchingActive: true,
    hotDrawActive: true,
  }
}

function combiDhwDrawNoHeating(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    serviceSwitchingActive: false, // no CH was active
    hotDrawActive: true,
  }
}

function storedIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    cylinderFillPct: 0.7,
  }
}

function storedHeating(): SystemDiagramDisplayState {
  return { ...storedIdle(), systemMode: 'heating' }
}

function storedHotDraw(): SystemDiagramDisplayState {
  return { ...storedIdle(), systemMode: 'heating', hotDrawActive: true, cylinderFillPct: 0.5 }
}

function storedReheat(): SystemDiagramDisplayState {
  return { ...storedIdle(), systemMode: 'dhw_reheat' }
}

function storedHeatingAndReheat(): SystemDiagramDisplayState {
  return { ...storedIdle(), systemMode: 'heating_and_reheat' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPipeClass(testId: string, container: Element): string {
  const el = container.querySelector(`[data-testid="${testId}"]`)
  return el?.getAttribute('class') ?? ''
}

// ─── Static render ────────────────────────────────────────────────────────────

describe('SystemDiagramPanel — static (no state)', () => {
  it('renders the SVG with the aria-label', () => {
    render(<SystemDiagramPanel />)
    expect(screen.getByRole('img', { name: /Heating system schematic/i })).toBeTruthy()
  })

  it('renders without crashing when state is undefined', () => {
    const { container } = render(<SystemDiagramPanel />)
    expect(container.querySelector('.system-diagram')).toBeTruthy()
  })

  it('all pipes are inactive when no state is provided', () => {
    const { container } = render(<SystemDiagramPanel />)
    const activePipes = container.querySelectorAll('.sd-pipe--active')
    expect(activePipes.length).toBe(0)
  })
})

// ─── Combi system ─────────────────────────────────────────────────────────────

describe('SystemDiagramPanel — combi heating', () => {
  it('marks CH flow pipe as active during heating mode', () => {
    const { container } = render(<SystemDiagramPanel state={combiHeating()} />)
    const cls = getPipeClass('pipe-ch-flow-boiler-tee', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('marks CH return pipe as active during heating mode', () => {
    const { container } = render(<SystemDiagramPanel state={combiHeating()} />)
    const cls = getPipeClass('pipe-ch-return', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('marks combi DHW pipe as inactive during heating-only mode', () => {
    const { container } = render(<SystemDiagramPanel state={combiHeating()} />)
    const cls = getPipeClass('pipe-primary-dhw', container)
    expect(cls).not.toContain('sd-pipe--active')
  })
})

describe('SystemDiagramPanel — combi DHW draw (CH was active)', () => {
  it('marks CH flow pipe as faded when serviceSwitchingActive', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const cls = getPipeClass('pipe-ch-flow-boiler-tee', container)
    expect(cls).toContain('sd-pipe--faded')
    expect(cls).not.toContain('sd-pipe--active')
  })

  it('marks combi DHW pipe as active during dhw_draw', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const cls = getPipeClass('pipe-primary-dhw', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('marks DHW shower outlet pipe as active during dhw_draw', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const cls = getPipeClass('pipe-dhw-shower', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('marks cold supply pipe as active during dhw_draw', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const cls = getPipeClass('pipe-cold-supply', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('shows "CH paused" callout badge when serviceSwitchingActive', () => {
    render(<SystemDiagramPanel state={combiDhwDraw()} />)
    expect(screen.getByText('CH paused')).toBeTruthy()
  })

  it('shows "On-demand hot water" callout badge during dhw_draw', () => {
    render(<SystemDiagramPanel state={combiDhwDraw()} />)
    expect(screen.getByText('On-demand hot water')).toBeTruthy()
  })
})

describe('SystemDiagramPanel — combi DHW draw (no CH call)', () => {
  it('CH pipe is inactive (not faded) when serviceSwitchingActive is false', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDrawNoHeating()} />)
    const cls = getPipeClass('pipe-ch-flow-boiler-tee', container)
    expect(cls).not.toContain('sd-pipe--faded')
    expect(cls).not.toContain('sd-pipe--active')
    expect(cls).toContain('sd-pipe--inactive')
  })
})

describe('SystemDiagramPanel — combi labels', () => {
  it('shows "Plate HEX" label for combi system', () => {
    render(<SystemDiagramPanel state={combiIdle()} />)
    expect(screen.getByText('⇌ Plate HEX')).toBeTruthy()
  })

  it('does not render the stored hot-draw pipe for combi', () => {
    const { container } = render(<SystemDiagramPanel state={combiIdle()} />)
    expect(container.querySelector('[data-testid="pipe-stored-hot-draw"]')).toBeNull()
  })
})

// ─── Stored system ────────────────────────────────────────────────────────────

describe('SystemDiagramPanel — stored heating', () => {
  it('marks CH flow pipe as active during stored heating mode', () => {
    const { container } = render(<SystemDiagramPanel state={storedHeating()} />)
    const cls = getPipeClass('pipe-ch-flow-pump-rads', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('stored hot-draw pipe is inactive when hotDrawActive is false', () => {
    const { container } = render(<SystemDiagramPanel state={storedHeating()} />)
    const cls = getPipeClass('pipe-stored-hot-draw', container)
    expect(cls).not.toContain('sd-pipe--active')
  })
})

describe('SystemDiagramPanel — stored hot draw', () => {
  it('marks stored hot-draw pipe as active when hotDrawActive is true', () => {
    const { container } = render(<SystemDiagramPanel state={storedHotDraw()} />)
    const cls = getPipeClass('pipe-stored-hot-draw', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('marks DHW shower pipe active during stored hot draw', () => {
    const { container } = render(<SystemDiagramPanel state={storedHotDraw()} />)
    const cls = getPipeClass('pipe-dhw-shower', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('combi DHW (primary) pipe is not active during stored draw — draw comes from cylinder', () => {
    const { container } = render(<SystemDiagramPanel state={storedHotDraw()} />)
    const cls = getPipeClass('pipe-primary-dhw', container)
    expect(cls).not.toContain('sd-pipe--active')
  })
})

describe('SystemDiagramPanel — stored cylinder reheat', () => {
  it('marks primary reheat pipe active during dhw_reheat', () => {
    const { container } = render(<SystemDiagramPanel state={storedReheat()} />)
    const cls = getPipeClass('pipe-primary-dhw', container)
    expect(cls).toContain('sd-pipe--active')
  })

  it('shows "Cylinder reheat" callout badge during dhw_reheat', () => {
    render(<SystemDiagramPanel state={storedReheat()} />)
    expect(screen.getByText('Cylinder reheat')).toBeTruthy()
  })

  it('stored hot-draw pipe is not active during dhw_reheat (no draw — just refilling)', () => {
    const { container } = render(<SystemDiagramPanel state={storedReheat()} />)
    const cls = getPipeClass('pipe-stored-hot-draw', container)
    expect(cls).not.toContain('sd-pipe--active')
  })
})

describe('SystemDiagramPanel — stored S-plan simultaneous CH + reheat', () => {
  it('CH flow and primary reheat both active during heating_and_reheat', () => {
    const { container } = render(<SystemDiagramPanel state={storedHeatingAndReheat()} />)
    const chCls    = getPipeClass('pipe-ch-flow-boiler-tee', container)
    const reheatCls = getPipeClass('pipe-primary-dhw', container)
    expect(chCls).toContain('sd-pipe--active')
    expect(reheatCls).toContain('sd-pipe--active')
  })

  it('stored hot-draw pipe remains inactive when only reheat is happening (no user draw)', () => {
    const { container } = render(<SystemDiagramPanel state={storedHeatingAndReheat()} />)
    const cls = getPipeClass('pipe-stored-hot-draw', container)
    expect(cls).not.toContain('sd-pipe--active')
  })
})

describe('SystemDiagramPanel — stored labels', () => {
  it('shows "Cylinder" label for stored system', () => {
    render(<SystemDiagramPanel state={storedIdle()} />)
    expect(screen.getByText('🛢 Cylinder')).toBeTruthy()
  })

  it('renders the stored hot-draw pipe for stored systems', () => {
    const { container } = render(<SystemDiagramPanel state={storedIdle()} />)
    expect(container.querySelector('[data-testid="pipe-stored-hot-draw"]')).not.toBeNull()
  })
})

// ─── Component highlighting ───────────────────────────────────────────────────

describe('SystemDiagramPanel — component highlighting (limiter glow)', () => {
  it('adds sd-node--highlighted to boiler node when "boiler" is highlighted', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={['boiler']} />
    )
    const boilerNode = container.querySelector('[data-testid="node-boiler"]')
    expect(boilerNode?.getAttribute('class')).toContain('sd-node--highlighted')
  })

  it('adds sd-node--highlighted to plate-hex node when "plate_hex" is highlighted', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={['plate_hex']} />
    )
    const hexNode = container.querySelector('[data-testid="node-plate-hex"]')
    expect(hexNode?.getAttribute('class')).toContain('sd-node--highlighted')
  })

  it('adds sd-node--highlighted to mains node when "mains" is highlighted', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={['mains']} />
    )
    const mainsNode = container.querySelector('[data-testid="node-mains"]')
    expect(mainsNode?.getAttribute('class')).toContain('sd-node--highlighted')
  })

  it('adds sd-node--highlighted to cylinder node on stored system when "cylinder" is highlighted', () => {
    const { container } = render(
      <SystemDiagramPanel state={storedIdle()} highlightedComponents={['cylinder']} />
    )
    const cylinderNode = container.querySelector('[data-testid="node-cylinder"]')
    expect(cylinderNode?.getAttribute('class')).toContain('sd-node--highlighted')
  })

  it('does not add sd-node--highlighted to boiler when no components highlighted', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={[]} />
    )
    const boilerNode = container.querySelector('[data-testid="node-boiler"]')
    expect(boilerNode?.getAttribute('class')).not.toContain('sd-node--highlighted')
  })

  it('does not add sd-node--highlighted to boiler when highlightedComponents prop is absent', () => {
    const { container } = render(<SystemDiagramPanel state={combiIdle()} />)
    const boilerNode = container.querySelector('[data-testid="node-boiler"]')
    expect(boilerNode?.getAttribute('class')).not.toContain('sd-node--highlighted')
  })

  it('highlights boiler in stored system schematic', () => {
    const { container } = render(
      <SystemDiagramPanel state={storedIdle()} highlightedComponents={['boiler']} />
    )
    const boilerNode = container.querySelector('[data-testid="node-boiler"]')
    expect(boilerNode?.getAttribute('class')).toContain('sd-node--highlighted')
  })
})

// ─── Lane pipe highlighting (PR14) ───────────────────────────────────────────

describe('SystemDiagramPanel — lane pipe highlighting', () => {
  it('combi: pipe-dhw-hot lane gains sd-pipe--highlighted when "pipe-dhw-hot" is in highlightedComponents', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={['pipe-dhw-hot']} />
    )
    const lane = container.querySelector('[data-testid="pipe-dhw-hot"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--highlighted')
  })

  it('combi: pipe-cold-feed lane gains sd-pipe--highlighted when "pipe-cold-feed" is in highlightedComponents', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={['pipe-cold-feed']} />
    )
    const lane = container.querySelector('[data-testid="pipe-cold-feed"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--highlighted')
  })

  it('stored: pipe-stored-hot lane gains sd-pipe--highlighted when "pipe-stored-hot" is in highlightedComponents', () => {
    const { container } = render(
      <SystemDiagramPanel state={storedIdle()} highlightedComponents={['pipe-stored-hot']} />
    )
    const lane = container.querySelector('[data-testid="pipe-stored-hot"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--highlighted')
  })

  it('stored: pipe-cold-feed lane gains sd-pipe--highlighted when "pipe-cold-feed" is in highlightedComponents', () => {
    const { container } = render(
      <SystemDiagramPanel state={storedIdle()} highlightedComponents={['pipe-cold-feed']} />
    )
    const lane = container.querySelector('[data-testid="pipe-cold-feed"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--highlighted')
  })

  it('combi: pipe-dhw-hot lane has no highlight class when not in highlightedComponents', () => {
    const { container } = render(
      <SystemDiagramPanel state={combiIdle()} highlightedComponents={[]} />
    )
    const lane = container.querySelector('[data-testid="pipe-dhw-hot"]')
    expect(lane?.getAttribute('class')).not.toContain('sd-pipe--highlighted')
  })

  it('combi: pipe-dhw-hot lane exists in combi schematic', () => {
    const { container } = render(<SystemDiagramPanel state={combiIdle()} />)
    expect(container.querySelector('[data-testid="pipe-dhw-hot"]')).not.toBeNull()
  })

  it('combi: pipe-cold-feed lane exists in combi schematic', () => {
    const { container } = render(<SystemDiagramPanel state={combiIdle()} />)
    expect(container.querySelector('[data-testid="pipe-cold-feed"]')).not.toBeNull()
  })

  it('stored: pipe-stored-hot lane exists in stored schematic', () => {
    const { container } = render(<SystemDiagramPanel state={storedIdle()} />)
    expect(container.querySelector('[data-testid="pipe-stored-hot"]')).not.toBeNull()
  })

  it('stored: pipe-cold-feed lane exists in stored schematic', () => {
    const { container } = render(<SystemDiagramPanel state={storedIdle()} />)
    expect(container.querySelector('[data-testid="pipe-cold-feed"]')).not.toBeNull()
  })

  it('pipe-stored-hot lane is active when stored hot draw is active', () => {
    const { container } = render(<SystemDiagramPanel state={storedHotDraw()} />)
    const lane = container.querySelector('[data-testid="pipe-stored-hot"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--active')
  })

  it('pipe-dhw-hot lane is active when combi DHW draw is active', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const lane = container.querySelector('[data-testid="pipe-dhw-hot"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--active')
  })

  it('pipe-cold-feed lane is active when cold supply is active (combi DHW draw)', () => {
    const { container } = render(<SystemDiagramPanel state={combiDhwDraw()} />)
    const lane = container.querySelector('[data-testid="pipe-cold-feed"]')
    expect(lane?.getAttribute('class')).toContain('sd-pipe--active')
  })
})

// ─── Boiler label (live boilerOutputKw prop) ──────────────────────────────────

describe('SystemDiagramPanel — live boiler label', () => {
  it('combi: shows default "30 kW boiler" when boilerOutputKw prop is absent', () => {
    render(<SystemDiagramPanel state={combiIdle()} />)
    expect(screen.getByText('30 kW boiler')).toBeTruthy()
  })

  it('combi: shows live kW value when boilerOutputKw prop is provided', () => {
    render(<SystemDiagramPanel state={combiIdle()} boilerOutputKw={20} />)
    expect(screen.getByText('20 kW boiler')).toBeTruthy()
    expect(screen.queryByText('30 kW boiler')).toBeNull()
  })

  it('stored (S-plan): shows default "24 kW boiler" when boilerOutputKw prop is absent', () => {
    render(<SystemDiagramPanel state={storedIdle()} />)
    expect(screen.getByText('24 kW boiler')).toBeTruthy()
  })

  it('stored (S-plan): shows live kW value when boilerOutputKw prop is provided', () => {
    render(<SystemDiagramPanel state={storedIdle()} boilerOutputKw={18} />)
    expect(screen.getByText('18 kW boiler')).toBeTruthy()
    expect(screen.queryByText('24 kW boiler')).toBeNull()
  })

  it('open-vented (Y-plan): shows live kW value when boilerOutputKw prop is provided', () => {
    const ventedState: SystemDiagramDisplayState = {
      systemMode: 'idle',
      systemType: 'vented_cylinder',
      heatSourceType: 'system_boiler',
      serviceSwitchingActive: false,
      supplyOrigins: supplyOriginsForSystemType('vented_cylinder'),
      hotDrawActive: false,
    }
    render(<SystemDiagramPanel state={ventedState} boilerOutputKw={15} />)
    expect(screen.getByText('15 kW boiler')).toBeTruthy()
    expect(screen.queryByText('24 kW boiler')).toBeNull()
  })

  it('combi: label updates when boilerOutputKw changes to a different value', () => {
    const { rerender } = render(<SystemDiagramPanel state={combiIdle()} boilerOutputKw={30} />)
    expect(screen.getByText('30 kW boiler')).toBeTruthy()

    rerender(<SystemDiagramPanel state={combiIdle()} boilerOutputKw={14} />)
    expect(screen.getByText('14 kW boiler')).toBeTruthy()
    expect(screen.queryByText('30 kW boiler')).toBeNull()
  })
})
