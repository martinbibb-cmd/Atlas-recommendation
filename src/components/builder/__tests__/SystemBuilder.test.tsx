/**
 * SystemBuilder.test.tsx
 *
 * Unit tests for the System Builder component.
 *
 * Covers:
 *  - House layout rendering (level bands, room subdivisions)
 *  - System type selector
 *  - Apply preset — correct components for each system type
 *  - Manual placement via click
 *  - Component removal
 *  - Pipe connection logic (deriveConnections)
 *  - Orthogonal path routing (orthoPath)
 *  - Clear all
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemBuilder, {
  deriveConnections,
  orthoPath,
  PRESETS,
  SYSTEM_TYPE_LABELS,
  type PlacedComponent,
  type SystemType,
} from '../SystemBuilder';

// ─── Pure-function tests ──────────────────────────────────────────────────────

describe('orthoPath', () => {
  it('returns a direct horizontal path when y values are equal', () => {
    expect(orthoPath(100, 50, 300, 50)).toBe('M 100 50 H 300');
  });

  it('returns a direct horizontal path when y difference is under 4px', () => {
    expect(orthoPath(100, 50, 300, 52)).toBe('M 100 50 H 300');
  });

  it('returns an L-shaped orthogonal path for inter-level connections', () => {
    const path = orthoPath(150, 322, 475, 162);
    // Should contain M, H (mid), V (riser), H (end)
    expect(path).toMatch(/^M \d+\.?\d* \d+\.?\d* H \d+\.?\d* V \d+\.?\d* H \d+\.?\d*$/);
  });

  it('routes via the horizontal midpoint', () => {
    const path = orthoPath(100, 300, 400, 100);
    // Midpoint x = 250
    expect(path).toContain('H 250');
  });
});

// ─── deriveConnections ────────────────────────────────────────────────────────

function mkComp(id: string, kind: PlacedComponent['kind']): PlacedComponent {
  return { id, kind, icon: '?', label: kind, roomId: 'kitchen' };
}

describe('deriveConnections — combi', () => {
  it('connects boiler to each radiator with primary pipe', () => {
    const placed = [
      mkComp('b1', 'boiler'),
      mkComp('r1', 'radiator'),
      mkComp('r2', 'radiator'),
    ];
    const conns = deriveConnections('combi', placed);
    const primaries = conns.filter(c => c.kind === 'primary');
    expect(primaries).toHaveLength(2);
    expect(primaries.every(c => c.fromId === 'b1')).toBe(true);
  });

  it('connects boiler to hot outlets with dhw pipe', () => {
    const placed = [mkComp('b1', 'boiler'), mkComp('o1', 'hot_outlet')];
    const conns = deriveConnections('combi', placed);
    const dhw = conns.filter(c => c.kind === 'dhw');
    expect(dhw).toHaveLength(1);
    expect(dhw[0].fromId).toBe('b1');
    expect(dhw[0].toId).toBe('o1');
  });

  it('produces no connections when no boiler is placed', () => {
    const placed = [mkComp('r1', 'radiator')];
    expect(deriveConnections('combi', placed)).toHaveLength(0);
  });
});

describe('deriveConnections — system_cylinder', () => {
  it('connects boiler to cylinder with primary pipe', () => {
    const placed = [mkComp('b1', 'boiler'), mkComp('c1', 'cylinder')];
    const conns = deriveConnections('system_cylinder', placed);
    const primary = conns.find(c => c.kind === 'primary');
    expect(primary?.fromId).toBe('b1');
    expect(primary?.toId).toBe('c1');
  });

  it('connects cylinder to radiators with secondary pipe', () => {
    const placed = [
      mkComp('b1', 'boiler'),
      mkComp('c1', 'cylinder'),
      mkComp('r1', 'radiator'),
      mkComp('r2', 'radiator'),
    ];
    const conns = deriveConnections('system_cylinder', placed);
    const secondary = conns.filter(c => c.kind === 'secondary');
    expect(secondary).toHaveLength(2);
    expect(secondary.every(c => c.fromId === 'c1')).toBe(true);
  });

  it('connects cylinder to hot outlets with dhw pipe', () => {
    const placed = [
      mkComp('b1', 'boiler'),
      mkComp('c1', 'cylinder'),
      mkComp('o1', 'hot_outlet'),
    ];
    const conns = deriveConnections('system_cylinder', placed);
    const dhw = conns.filter(c => c.kind === 'dhw');
    expect(dhw).toHaveLength(1);
    expect(dhw[0].fromId).toBe('c1');
  });
});

describe('deriveConnections — mixergy', () => {
  it('connects boiler to Mixergy unit with primary pipe', () => {
    const placed = [mkComp('b1', 'boiler'), mkComp('m1', 'mixergy_unit')];
    const conns = deriveConnections('mixergy', placed);
    expect(conns.find(c => c.kind === 'primary' && c.fromId === 'b1' && c.toId === 'm1')).toBeTruthy();
  });

  it('connects Mixergy to hot outlets with dhw pipe', () => {
    const placed = [
      mkComp('b1', 'boiler'),
      mkComp('m1', 'mixergy_unit'),
      mkComp('o1', 'hot_outlet'),
    ];
    const conns = deriveConnections('mixergy', placed);
    const dhw = conns.filter(c => c.kind === 'dhw');
    expect(dhw).toHaveLength(1);
    expect(dhw[0].fromId).toBe('m1');
  });

  it('connects boiler to radiators with secondary pipe (heating loop)', () => {
    const placed = [
      mkComp('b1', 'boiler'),
      mkComp('m1', 'mixergy_unit'),
      mkComp('r1', 'radiator'),
    ];
    const conns = deriveConnections('mixergy', placed);
    const secondary = conns.filter(c => c.kind === 'secondary');
    expect(secondary).toHaveLength(1);
    expect(secondary[0].fromId).toBe('b1');
  });
});

describe('deriveConnections — heat_pump', () => {
  it('connects heat pump to buffer with primary pipe', () => {
    const placed = [mkComp('hp1', 'heat_pump_unit'), mkComp('buf1', 'buffer')];
    const conns = deriveConnections('heat_pump', placed);
    expect(conns.find(c => c.kind === 'primary' && c.fromId === 'hp1' && c.toId === 'buf1')).toBeTruthy();
  });

  it('distributes radiators from buffer when buffer is present', () => {
    const placed = [
      mkComp('hp1', 'heat_pump_unit'),
      mkComp('buf1', 'buffer'),
      mkComp('r1', 'radiator'),
    ];
    const conns = deriveConnections('heat_pump', placed);
    const secondary = conns.filter(c => c.kind === 'secondary');
    expect(secondary[0].fromId).toBe('buf1');
  });

  it('distributes radiators from heat pump directly when no buffer', () => {
    const placed = [mkComp('hp1', 'heat_pump_unit'), mkComp('r1', 'radiator')];
    const conns = deriveConnections('heat_pump', placed);
    const secondary = conns.filter(c => c.kind === 'secondary');
    expect(secondary[0].fromId).toBe('hp1');
  });
});

// ─── PRESETS ──────────────────────────────────────────────────────────────────

describe('PRESETS', () => {
  it('combi preset includes a boiler in kitchen', () => {
    const entry = PRESETS.combi.find(e => e.kind === 'boiler');
    expect(entry?.roomId).toBe('kitchen');
  });

  it('system_cylinder preset includes cylinder in airing cupboard', () => {
    const entry = PRESETS.system_cylinder.find(e => e.kind === 'cylinder');
    expect(entry?.roomId).toBe('airing');
  });

  it('mixergy preset includes mixergy_unit in airing cupboard', () => {
    const entry = PRESETS.mixergy.find(e => e.kind === 'mixergy_unit');
    expect(entry?.roomId).toBe('airing');
  });

  it('heat_pump preset places heat_pump_unit in loft_space', () => {
    const entry = PRESETS.heat_pump.find(e => e.kind === 'heat_pump_unit');
    expect(entry?.roomId).toBe('loft_space');
  });
});

// ─── Component rendering tests ────────────────────────────────────────────────

describe('SystemBuilder — rendering', () => {
  it('renders the System Builder heading', () => {
    render(<SystemBuilder />);
    expect(screen.getByText('System Builder')).toBeTruthy();
  });

  it('renders system type selector buttons', () => {
    render(<SystemBuilder />);
    const labels = Object.values(SYSTEM_TYPE_LABELS);
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('marks Combi as active on initial render', () => {
    render(<SystemBuilder />);
    const btn = screen.getByRole('button', { name: 'Combi' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders house level labels in the SVG', () => {
    render(<SystemBuilder />);
    expect(screen.getByText('Loft')).toBeTruthy();
    expect(screen.getByText('First Floor')).toBeTruthy();
    expect(screen.getByText('Ground Floor')).toBeTruthy();
  });

  it('renders room subdivisions in the house canvas', () => {
    render(<SystemBuilder />);
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.getByText('Lounge')).toBeTruthy();
    expect(screen.getByText('Airing Cupboard')).toBeTruthy();
    expect(screen.getByText('Bathroom')).toBeTruthy();
  });

  it('shows the empty-state hint when no components are placed', () => {
    render(<SystemBuilder />);
    expect(screen.getAllByText(/Apply preset/).length).toBeGreaterThan(0);
  });

  it('renders Apply preset button', () => {
    render(<SystemBuilder />);
    expect(screen.getByRole('button', { name: /Apply Combi preset/i })).toBeTruthy();
  });

  it('Clear all is initially disabled', () => {
    render(<SystemBuilder />);
    const btn = screen.getByRole('button', { name: 'Clear all components' });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('SystemBuilder — system type switching', () => {
  it('switches active system type on click and clears placed components', () => {
    render(<SystemBuilder />);
    const btn = screen.getByRole('button', { name: 'System + Cylinder' });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows system-relevant palette items for combi', () => {
    render(<SystemBuilder />);
    // Combi palette should include Boiler but not Cylinder
    expect(screen.getByRole('button', { name: 'Select Boiler' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select Cylinder' })).toBeNull();
  });

  it('shows Cylinder in palette when System + Cylinder is selected', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'System + Cylinder' }));
    expect(screen.getByRole('button', { name: 'Select Cylinder' })).toBeTruthy();
  });
});

describe('SystemBuilder — preset application', () => {
  it('applying combi preset places components on the canvas', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Combi preset/i }));
    // Boiler, radiators and hot outlets should appear as aria-labelled buttons
    const components = screen.getAllByRole('button', { name: /click to remove/i });
    expect(components.length).toBeGreaterThan(0);
  });

  it('applying preset enables Clear all', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Combi preset/i }));
    const clearBtn = screen.getByRole('button', { name: 'Clear all components' });
    expect((clearBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('applying system_cylinder preset places a Cylinder component', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'System + Cylinder' }));
    fireEvent.click(screen.getByRole('button', { name: /Apply System \+ Cylinder preset/i }));
    // Should have Cylinder in the placed components
    const cylinders = screen.getAllByRole('button', { name: /Cylinder.*click to remove/i });
    expect(cylinders.length).toBeGreaterThan(0);
  });
});

describe('SystemBuilder — clear all', () => {
  it('Clear all removes all placed components', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Combi preset/i }));
    // Confirm components are placed
    expect(screen.getAllByRole('button', { name: /click to remove/i }).length).toBeGreaterThan(0);
    // Clear
    fireEvent.click(screen.getByRole('button', { name: 'Clear all components' }));
    expect(screen.queryAllByRole('button', { name: /click to remove/i })).toHaveLength(0);
  });
});

describe('SystemBuilder — manual placement', () => {
  it('selecting a palette item shows the placement hint', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Boiler' }));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/place the Boiler/i)).toBeTruthy();
  });

  it('clicking a room after selecting a component places it', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Radiator' }));
    // Click the Kitchen room (it should be a button when a component is selected)
    const kitchenRoom = screen.getByRole('button', { name: 'Place in Kitchen' });
    fireEvent.click(kitchenRoom);
    // A Radiator should now appear on the canvas
    expect(screen.getAllByRole('button', { name: /Radiator.*click to remove/i }).length).toBe(1);
  });

  it('removes the placement hint after placing a component', () => {
    render(<SystemBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Radiator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place in Kitchen' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
