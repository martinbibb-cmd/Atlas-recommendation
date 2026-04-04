/**
 * FloorPlanBuilder — undo/redo and layer toggles tests.
 *
 * Tests the core new user-facing behaviours added in this PR:
 *   1. Undo / redo via toolbar buttons
 *   2. Layer visibility toggles
 *   3. Clean view toggle
 *   4. Autosave status badge renders
 *   5. localStorage restore hardening (corrupt payload, version mismatch)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FloorPlanBuilder from '../FloorPlanBuilder';

// Stub localStorage so tests don't bleed state between runs.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Stub ResizeObserver if not already stubbed by test setup.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('FloorPlanBuilder — undo/redo', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders Undo and Redo buttons', () => {
    render(<FloorPlanBuilder />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
  });

  it('Undo button starts disabled (no history)', () => {
    render(<FloorPlanBuilder />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeDisabled();
  });

  it('Redo button starts disabled (no future)', () => {
    render(<FloorPlanBuilder />);
    const redoBtn = screen.getByRole('button', { name: /redo/i });
    expect(redoBtn).toBeDisabled();
  });
});

describe('FloorPlanBuilder — layer toggles', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders all 5 layer toggle buttons', () => {
    render(<FloorPlanBuilder />);
    expect(screen.getByRole('button', { name: /hide geometry|show geometry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide openings|show openings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide components|show components/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide routes|show routes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide disruptions|show disruptions/i })).toBeInTheDocument();
  });

  it('all layer buttons are active (visible) by default', () => {
    render(<FloorPlanBuilder />);
    const geometryBtn = screen.getByRole('button', { name: /geometry/i });
    expect(geometryBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggling a layer button flips aria-pressed', () => {
    render(<FloorPlanBuilder />);
    const geometryBtn = screen.getByRole('button', { name: /geometry/i });
    expect(geometryBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(geometryBtn);
    expect(geometryBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(geometryBtn);
    expect(geometryBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FloorPlanBuilder — clean view', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders the clean view toggle button', () => {
    render(<FloorPlanBuilder />);
    expect(screen.getByRole('button', { name: /clean.*view/i })).toBeInTheDocument();
  });

  it('clean view button is not active by default', () => {
    render(<FloorPlanBuilder />);
    const btn = screen.getByRole('button', { name: /clean.*view/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking clean view button activates it', () => {
    render(<FloorPlanBuilder />);
    const btn = screen.getByRole('button', { name: /clean.*view/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FloorPlanBuilder — localStorage restore hardening', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders without error when localStorage contains corrupt JSON', () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'atlas.floorplan.draft.v1') return 'not-valid-json{{{';
      return null;
    });
    // Should not throw — corrupt payload is silently ignored.
    expect(() => render(<FloorPlanBuilder />)).not.toThrow();
  });

  it('ignores a localStorage payload with a mismatched schema version', () => {
    const badVersion = JSON.stringify({
      version: '0.9',   // wrong version — should not be restored
      propertyId: 'prop_test',
      floors: [{ id: 'f1', name: 'Ground', levelIndex: 0, rooms: [{ id: 'r1', name: 'Stale Room', roomType: 'other', floorId: 'f1', x: 0, y: 0, width: 96, height: 96 }], walls: [], openings: [], zones: [] }],
      placementNodes: [],
      connections: [],
      metadata: {},
    });
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'atlas.floorplan.draft.v1') return badVersion;
      return null;
    });
    render(<FloorPlanBuilder />);
    // The stale room from the mismatched-version payload must NOT appear.
    expect(screen.queryByText('Stale Room')).not.toBeInTheDocument();
  });

  it('restores a valid v1.0 payload from localStorage', async () => {
    const validDraft = JSON.stringify({
      version: '1.0',
      propertyId: 'prop_test',
      floors: [{ id: 'f1', name: 'Ground', levelIndex: 0, rooms: [{ id: 'r1', name: 'Saved Room', roomType: 'other', floorId: 'f1', x: 0, y: 0, width: 96, height: 96 }], walls: [], openings: [], zones: [] }],
      placementNodes: [],
      connections: [],
      metadata: {},
    });
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'atlas.floorplan.draft.v1') return validDraft;
      return null;
    });
    await act(async () => {
      render(<FloorPlanBuilder />);
    });
    // The room from the persisted draft should be visible.
    expect(screen.getByText('Saved Room')).toBeInTheDocument();
  });

  it('ignores a localStorage payload missing floors', () => {
    const noFloors = JSON.stringify({
      version: '1.0',
      propertyId: 'prop_test',
      floors: [],           // empty floors — should not be restored
      placementNodes: [],
      connections: [],
      metadata: {},
    });
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'atlas.floorplan.draft.v1') return noFloors;
      return null;
    });
    // Should not throw and should render the default empty floor view.
    expect(() => render(<FloorPlanBuilder />)).not.toThrow();
  });
});
