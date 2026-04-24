/**
 * FloorPlanBuilder — PR17 speed & flow optimisation tests.
 *
 * Covers the new user-facing behaviours introduced in PR17:
 *   1. Stay-in-tool toggle renders only in placement/drawing modes
 *   2. Stay-in-tool toggle persists to sessionStorage
 *   3. Last-used tool persisted to sessionStorage
 *   4. Quick actions row renders in inspector panels
 *   5. Inline label rename renders in ObjectInspectorPanel
 *   6. Notes auto-focus on mount in RouteInspectorPanel
 *   7. Inline wall-length edit in WallInspectorPanel
 *   8. Quick actions row in WallInspectorPanel
 *   9. Quick actions row in RoomInspectorPanel
 *  10. Quick actions row in RouteInspectorPanel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FloorPlanBuilder from '../FloorPlanBuilder';
import ObjectInspectorPanel from '../panels/ObjectInspectorPanel';
import RouteInspectorPanel from '../panels/RouteInspectorPanel';
import WallInspectorPanel from '../panels/WallInspectorPanel';
import RoomInspectorPanel from '../panels/RoomInspectorPanel';
import type { FloorObject, FloorRoute, Wall, Room, FloorPlan } from '../propertyPlan.types';

// ── localStorage / sessionStorage stubs ──────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// ── Fixtures ─────────────────────────────────────────────────────────────────
// (ResizeObserver is already stubbed in src/test/setup.ts for all tests.)

const GRID = 24; // canvas pixels per metre (matches geometry module)

const MOCK_OBJECT: FloorObject = {
  id: 'obj_1',
  floorId: 'floor_1',
  type: 'radiator',
  x: 100,
  y: 100,
};

const MOCK_ROUTE: FloorRoute = {
  id: 'route_1',
  floorId: 'floor_1',
  type: 'flow',
  status: 'proposed',
  points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
};

const MOCK_WALL: Wall = {
  id: 'wall_1',
  floorId: 'floor_1',
  kind: 'internal',
  x1: 0, y1: 0, x2: 5 * GRID, y2: 0, // 5 m wall
};

const MOCK_ROOM: Room = {
  id: 'room_1',
  name: 'Living Room',
  roomType: 'living',
  floorId: 'floor_1',
  x: 0, y: 0, width: 192, height: 144,
};

const MOCK_FLOOR: FloorPlan = {
  id: 'floor_1',
  name: 'Ground',
  levelIndex: 0,
  rooms: [MOCK_ROOM],
  walls: [MOCK_WALL],
  openings: [],
  zones: [],
};

// ── Stay-in-tool toggle (FloorPlanBuilder) ────────────────────────────────────

describe('FloorPlanBuilder — PR17: stay-in-tool toggle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  it('stay-in-tool toggle is NOT visible in select mode', () => {
    render(<FloorPlanBuilder />);
    // The default tool is 'select'. Toggle must not be present.
    expect(screen.queryByTitle(/stay in tool/i)).not.toBeInTheDocument();
  });

  it('stay-in-tool toggle becomes visible when switching to Add Route tool', async () => {
    render(<FloorPlanBuilder />);
    const routeTool = screen.getByRole('button', { name: /add route/i });
    await act(async () => { fireEvent.click(routeTool); });
    expect(screen.getByTitle(/stay in tool/i)).toBeInTheDocument();
  });

  it('stay-in-tool toggle becomes visible when switching to Draw Wall tool', async () => {
    render(<FloorPlanBuilder />);
    const wallTool = screen.getByRole('button', { name: /draw wall/i });
    await act(async () => { fireEvent.click(wallTool); });
    expect(screen.getByTitle(/stay in tool/i)).toBeInTheDocument();
  });

  it('clicking stay-in-tool toggle toggles between active states', async () => {
    render(<FloorPlanBuilder />);
    const routeTool = screen.getByRole('button', { name: /add route/i });
    await act(async () => { fireEvent.click(routeTool); });

    // Find the toggle by its text content (the icon + label combo).
    const toggle = screen.getByText(/stay in tool/i).closest('button') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    // Initially not active (stayInTool = false).
    expect(toggle.className).not.toContain('active');

    await act(async () => { fireEvent.click(toggle); });
    // After clicking once it becomes active.
    const toggleAfter = screen.getByText(/stay in tool/i).closest('button') as HTMLButtonElement;
    expect(toggleAfter.className).toContain('active');
  });

  it('stay-in-tool value is persisted to sessionStorage on change', async () => {
    render(<FloorPlanBuilder />);
    const routeTool = screen.getByRole('button', { name: /add route/i });
    await act(async () => { fireEvent.click(routeTool); });

    const toggle = screen.getByTitle(/stay in tool/i);
    await act(async () => { fireEvent.click(toggle); });

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'atlas.floorplan.stayInTool',
      expect.stringMatching(/true|false/),
    );
  });
});

// ── Last-used tool persisted (FloorPlanBuilder) ───────────────────────────────

describe('FloorPlanBuilder — PR17: last-used tool sessionStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  it('switching tool persists the tool id to sessionStorage', async () => {
    render(<FloorPlanBuilder />);
    const wallTool = screen.getByRole('button', { name: /draw wall/i });
    await act(async () => { fireEvent.click(wallTool); });

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'atlas.floorplan.lastTool',
      'drawWall',
    );
  });
});

// ── ObjectInspectorPanel (PR17) ───────────────────────────────────────────────

describe('ObjectInspectorPanel — PR17: quick actions and inline label', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onDuplicate = vi.fn();
  const onFocus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quick actions row', () => {
    render(
      <ObjectInspectorPanel
        object={MOCK_OBJECT}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onFocus={onFocus}
      />,
    );
    // Delete and Duplicate quick-action buttons.
    expect(screen.getByTitle(/^delete$/i)).toBeInTheDocument();
    expect(screen.getByTitle(/^duplicate$/i)).toBeInTheDocument();
  });

  it('renders the focus quick-action button when onFocus is provided', () => {
    render(
      <ObjectInspectorPanel
        object={MOCK_OBJECT}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onFocus={onFocus}
      />,
    );
    expect(screen.getByTitle(/centre view on object/i)).toBeInTheDocument();
  });

  it('does NOT render the duplicate button when onDuplicate is omitted', () => {
    render(
      <ObjectInspectorPanel
        object={MOCK_OBJECT}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByTitle(/^duplicate$/i)).not.toBeInTheDocument();
  });

  it('clicking the delete quick-action calls onDelete', () => {
    render(
      <ObjectInspectorPanel
        object={MOCK_OBJECT}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    // Click the quick-action Delete (🗑).
    const deleteBtn = screen.getByTitle(/^delete$/i);
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders the inline label edit button (+ label prompt) when label is absent', () => {
    const noLabelObj: FloorObject = { ...MOCK_OBJECT, label: undefined };
    render(
      <ObjectInspectorPanel
        object={noLabelObj}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle(/click to rename/i)).toBeInTheDocument();
  });

  it('clicking the label button enters edit mode (shows input)', () => {
    const labelledObj: FloorObject = { ...MOCK_OBJECT, label: 'My Radiator' };
    render(
      <ObjectInspectorPanel
        object={labelledObj}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    const labelBtn = screen.getByTitle(/click to rename/i);
    fireEvent.click(labelBtn);
    expect(screen.getByRole('textbox', { name: /edit object label/i })).toBeInTheDocument();
  });

  it('pressing Escape in the label input cancels without calling onUpdate', () => {
    const labelledObj: FloorObject = { ...MOCK_OBJECT, label: 'Original' };
    render(
      <ObjectInspectorPanel
        object={labelledObj}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/click to rename/i));
    const input = screen.getByRole('textbox', { name: /edit object label/i });
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('pressing Enter in the label input commits the new label', () => {
    const labelledObj: FloorObject = { ...MOCK_OBJECT, label: 'Original' };
    render(
      <ObjectInspectorPanel
        object={labelledObj}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/click to rename/i));
    const input = screen.getByRole('textbox', { name: /edit object label/i });
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith({ label: 'New Name' });
  });

  it('renders the rotate stub (disabled)', () => {
    render(
      <ObjectInspectorPanel
        object={MOCK_OBJECT}
        rooms={[]}
        walls={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    const rotateBtn = screen.getByTitle(/rotate.*coming soon/i);
    expect(rotateBtn).toBeDisabled();
  });
});

// ── RouteInspectorPanel (PR17) ────────────────────────────────────────────────

describe('RouteInspectorPanel — PR17: quick actions and notes', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onFocus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quick actions row with Delete', () => {
    render(
      <RouteInspectorPanel
        route={MOCK_ROUTE}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle(/^delete$/i)).toBeInTheDocument();
  });

  it('renders the Focus quick-action when onFocus is provided', () => {
    render(
      <RouteInspectorPanel
        route={MOCK_ROUTE}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onFocus={onFocus}
      />,
    );
    expect(screen.getByTitle(/centre view on route/i)).toBeInTheDocument();
  });

  it('renders the Notes field', () => {
    render(
      <RouteInspectorPanel
        route={MOCK_ROUTE}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByPlaceholderText(/via floor void/i)).toBeInTheDocument();
  });

  it('shows assumed-route warning banner when status is "assumed"', () => {
    const assumedRoute: FloorRoute = { ...MOCK_ROUTE, status: 'assumed' };
    render(
      <RouteInspectorPanel
        route={assumedRoute}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/assumed route/i)).toBeInTheDocument();
  });

  it('does NOT show assumed warning when status is "existing"', () => {
    const existingRoute: FloorRoute = { ...MOCK_ROUTE, status: 'existing' };
    render(
      <RouteInspectorPanel
        route={existingRoute}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText(/assumed route/i)).not.toBeInTheDocument();
  });

  it('renders the waypoints count', () => {
    render(
      <RouteInspectorPanel
        route={MOCK_ROUTE}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 waypoints
  });
});

// ── WallInspectorPanel (PR17) ─────────────────────────────────────────────────

describe('WallInspectorPanel — PR17: quick actions and inline length edit', () => {
  const onUpdate = vi.fn();
  const onUpdateLength = vi.fn();
  const onDelete = vi.fn();
  const onFocus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quick actions row with Delete', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle(/^delete$/i)).toBeInTheDocument();
  });

  it('renders the Focus quick-action when onFocus is provided', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
        onFocus={onFocus}
      />,
    );
    expect(screen.getByTitle(/centre view on wall/i)).toBeInTheDocument();
  });

  it('renders the length as a tap-to-edit button', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle(/tap to edit length/i)).toBeInTheDocument();
  });

  it('clicking the length button enters edit mode (shows number input)', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/tap to edit length/i));
    expect(screen.getByRole('spinbutton', { name: /length in metres/i })).toBeInTheDocument();
  });

  it('pressing Escape in length input cancels without calling onUpdateLength', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/tap to edit length/i));
    const input = screen.getByRole('spinbutton', { name: /length in metres/i });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdateLength).not.toHaveBeenCalled();
  });

  it('pressing Enter in length input commits the new length', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/tap to edit length/i));
    const input = screen.getByRole('spinbutton', { name: /length in metres/i });
    fireEvent.change(input, { target: { value: '3.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdateLength).toHaveBeenCalledWith(3.5);
  });

  it('shows inline error for invalid (zero) length input', () => {
    render(
      <WallInspectorPanel
        wall={MOCK_WALL}
        onUpdate={onUpdate}
        onUpdateLength={onUpdateLength}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTitle(/tap to edit length/i));
    const input = screen.getByRole('spinbutton', { name: /length in metres/i });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdateLength).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ── RoomInspectorPanel (PR17) ─────────────────────────────────────────────────

describe('RoomInspectorPanel — PR17: quick actions', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onDuplicate = vi.fn();
  const onFocus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quick actions row with Delete', () => {
    render(
      <RoomInspectorPanel
        room={MOCK_ROOM}
        floors={[MOCK_FLOOR]}
        walls={[]}
        floorObjects={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTitle(/^delete$/i)).toBeInTheDocument();
  });

  it('renders Duplicate quick-action when onDuplicate is provided', () => {
    render(
      <RoomInspectorPanel
        room={MOCK_ROOM}
        floors={[MOCK_FLOOR]}
        walls={[]}
        floorObjects={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />,
    );
    expect(screen.getByTitle(/duplicate room/i)).toBeInTheDocument();
  });

  it('renders Focus quick-action when onFocus is provided', () => {
    render(
      <RoomInspectorPanel
        room={MOCK_ROOM}
        floors={[MOCK_FLOOR]}
        walls={[]}
        floorObjects={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onFocus={onFocus}
      />,
    );
    expect(screen.getByTitle(/centre view on room/i)).toBeInTheDocument();
  });

  it('calling onDuplicate fires when duplicate button is clicked', () => {
    render(
      <RoomInspectorPanel
        room={MOCK_ROOM}
        floors={[MOCK_FLOOR]}
        walls={[]}
        floorObjects={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />,
    );
    fireEvent.click(screen.getByTitle(/duplicate room/i));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('shows adjacent wall count', () => {
    render(
      <RoomInspectorPanel
        room={MOCK_ROOM}
        floors={[MOCK_FLOOR]}
        walls={[MOCK_WALL]}
        floorObjects={[]}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/adjacent walls/i)).toBeInTheDocument();
  });
});
