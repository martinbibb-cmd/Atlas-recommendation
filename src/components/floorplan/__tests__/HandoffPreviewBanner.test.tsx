/**
 * HandoffPreviewBanner.test.tsx — PR23 tests.
 *
 * Covers:
 *   1. Banner shows correct overall status label for ready / needs_checking / incomplete
 *   2. Missing essentials section rendered and quick-fix button fires onOpenObjectLibrary
 *   3. Assumed / needs-checking section rendered and quick-fix button fires onSelectItem + onExitPreview
 *   4. Default-dimensions quick-fix selects the right floor object
 *   5. Back-to-edit button calls onExitPreview (state preserved implicitly — no reset)
 *   6. Complete section hidden when plan is fully ready
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HandoffPreviewBanner from '../panels/HandoffPreviewBanner';
import type { PlanReadinessResult, PlanChecklistItem } from '../../../features/floorplan/planReadinessValidator';
import type { PropertyPlan, FloorPlan, FloorObject, FloorRoute } from '../propertyPlan.types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeFloor(overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'floor_1',
    name: 'Ground',
    levelIndex: 0,
    rooms: [],
    walls: [],
    openings: [],
    zones: [],
    floorObjects: [],
    floorRoutes: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    version: '1.0',
    propertyId: 'prop_test',
    floors: [makeFloor()],
    placementNodes: [],
    connections: [],
    metadata: {},
    ...overrides,
  };
}

function makeResult(
  overallStatus: PlanReadinessResult['overallStatus'],
  items: PlanChecklistItem[],
): PlanReadinessResult {
  return {
    overallStatus,
    items,
    completeCount:      items.filter((i) => i.status === 'complete').length,
    needsCheckingCount: items.filter((i) => i.status === 'needs_checking').length,
    missingCount:       items.filter((i) => i.status === 'missing').length,
    assumedCount:       items.filter((i) => i.status === 'assumed').length,
  };
}

// ─── Shared mocks ─────────────────────────────────────────────────────────────

function makeHandlers() {
  return {
    onExitPreview:      vi.fn(),
    onOpenObjectLibrary: vi.fn(),
    onSelectItem:       vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HandoffPreviewBanner', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Overall status labels ───────────────────────────────────────────────

  describe('overall status label', () => {
    it('shows "Ready for engineer review" when status is ready', () => {
      const result = makeResult('ready', [
        { key: 'rooms_present', label: 'Rooms recorded', status: 'complete' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      expect(screen.getByText('Ready for engineer review')).toBeTruthy();
    });

    it('shows "Needs route verification" when status is needs_checking', () => {
      const result = makeResult('needs_checking', [
        { key: 'key_routes', label: 'Key routes recorded', status: 'needs_checking', detail: 'Some routes assumed' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      expect(screen.getByText('Needs route verification')).toBeTruthy();
    });

    it('shows "Spatial data incomplete" when status is incomplete', () => {
      const result = makeResult('incomplete', [
        { key: 'rooms_present', label: 'Rooms recorded', status: 'missing', detail: 'No rooms drawn' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      expect(screen.getByText('Spatial data incomplete')).toBeTruthy();
    });
  });

  // ── 2. Missing essentials — library quick-fix ──────────────────────────────

  describe('missing boiler quick-fix', () => {
    it('shows "Place boiler" button and calls onOpenObjectLibrary(boiler)', () => {
      const result = makeResult('incomplete', [
        { key: 'heat_source_recorded', label: 'Boiler location recorded', status: 'missing' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      const btn = screen.getByRole('button', { name: /place boiler/i });
      fireEvent.click(btn);
      expect(handlers.onOpenObjectLibrary).toHaveBeenCalledWith('boiler');
      expect(handlers.onExitPreview).not.toHaveBeenCalled();
    });

    it('shows "Place flue" button and calls onOpenObjectLibrary(flue)', () => {
      const result = makeResult('incomplete', [
        { key: 'flue_recorded', label: 'Flue route recorded', status: 'missing' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      const btn = screen.getByRole('button', { name: /place flue/i });
      fireEvent.click(btn);
      expect(handlers.onOpenObjectLibrary).toHaveBeenCalledWith('flue');
    });

    it('shows "Place cylinder" button and calls onOpenObjectLibrary(cylinder)', () => {
      const result = makeResult('incomplete', [
        { key: 'cylinder_recorded', label: 'Cylinder recorded', status: 'missing' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      const btn = screen.getByRole('button', { name: /place cylinder/i });
      fireEvent.click(btn);
      expect(handlers.onOpenObjectLibrary).toHaveBeenCalledWith('cylinder');
    });
  });

  // ── 3. Assumed route quick-fix → select route + exit preview ──────────────

  describe('assumed route quick-fix', () => {
    it('selects the first assumed key route and exits preview', () => {
      vi.useFakeTimers();

      const assumedRoute: FloorRoute = {
        id: 'route_assumed_1',
        floorId: 'floor_1',
        type: 'flow',
        status: 'assumed',
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      };
      const plan = makePlan({ floors: [makeFloor({ floorRoutes: [assumedRoute] })] });
      const result = makeResult('needs_checking', [
        { key: 'key_routes', label: 'Key routes recorded', status: 'assumed', detail: 'Some routes assumed' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={plan} {...handlers} />);

      const btn = screen.getByRole('button', { name: /select route/i });
      fireEvent.click(btn);

      // onExitPreview is called synchronously
      expect(handlers.onExitPreview).toHaveBeenCalledTimes(1);
      // onSelectItem is deferred via setTimeout
      vi.runAllTimers();
      expect(handlers.onSelectItem).toHaveBeenCalledWith({ kind: 'floor_route', id: 'route_assumed_1' });

      vi.useRealTimers();
    });

    it('selects the assumed discharge route when discharge_route item is assumed', () => {
      vi.useFakeTimers();

      const dischargeRoute: FloorRoute = {
        id: 'route_discharge_1',
        floorId: 'floor_1',
        type: 'discharge',
        status: 'assumed',
        points: [{ x: 0, y: 20 }, { x: 50, y: 20 }],
      };
      const plan = makePlan({ floors: [makeFloor({ floorRoutes: [dischargeRoute] })] });
      const result = makeResult('needs_checking', [
        { key: 'discharge_route', label: 'Assumed discharge route', status: 'assumed', detail: 'Route to check on site' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={plan} {...handlers} />);

      const btn = screen.getByRole('button', { name: /select route/i });
      fireEvent.click(btn);

      expect(handlers.onExitPreview).toHaveBeenCalledTimes(1);
      vi.runAllTimers();
      expect(handlers.onSelectItem).toHaveBeenCalledWith({ kind: 'floor_route', id: 'route_discharge_1' });

      vi.useRealTimers();
    });
  });

  // ── 4. Default-dimensions quick-fix → select object ───────────────────────

  describe('default dimensions quick-fix', () => {
    it('selects the first object without explicit dimensions', () => {
      vi.useFakeTimers();

      const objNoSize: FloorObject = {
        id: 'obj_cylinder_nosize',
        floorId: 'floor_1',
        type: 'cylinder',
        x: 100, y: 50,
        // widthM / heightM / depthM deliberately absent → uses template default
      };
      const plan = makePlan({ floors: [makeFloor({ floorObjects: [objNoSize] })] });
      const result = makeResult('needs_checking', [
        { key: 'default_dimensions', label: 'Default dimensions — verify on site', status: 'needs_checking', detail: 'cylinder' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={plan} {...handlers} />);

      const btn = screen.getByRole('button', { name: /select object/i });
      fireEvent.click(btn);

      expect(handlers.onExitPreview).toHaveBeenCalledTimes(1);
      vi.runAllTimers();
      expect(handlers.onSelectItem).toHaveBeenCalledWith({ kind: 'floor_object', id: 'obj_cylinder_nosize' });

      vi.useRealTimers();
    });
  });

  // ── 5. Back-to-edit button ─────────────────────────────────────────────────

  describe('back-to-edit button', () => {
    it('calls onExitPreview when "Back to edit" is clicked', () => {
      const result = makeResult('ready', [
        { key: 'rooms_present', label: 'Rooms recorded', status: 'complete' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      const btn = screen.getByRole('button', { name: /back to edit/i });
      fireEvent.click(btn);
      expect(handlers.onExitPreview).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onOpenObjectLibrary or onSelectItem when clicking Back to edit', () => {
      const result = makeResult('ready', [
        { key: 'rooms_present', label: 'Rooms recorded', status: 'complete' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      fireEvent.click(screen.getByRole('button', { name: /back to edit/i }));
      expect(handlers.onOpenObjectLibrary).not.toHaveBeenCalled();
      expect(handlers.onSelectItem).not.toHaveBeenCalled();
    });
  });

  // ── 6. Complete section hidden when fully ready ────────────────────────────

  describe('complete section visibility', () => {
    it('does NOT render a "Complete" group heading when plan is fully ready', () => {
      const result = makeResult('ready', [
        { key: 'rooms_present',       label: 'Rooms recorded',        status: 'complete' },
        { key: 'heat_source_recorded', label: 'Boiler location recorded', status: 'complete' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      // The "Complete" group heading should not appear when everything passes
      expect(screen.queryByText('Complete')).toBeNull();
    });

    it('shows "Complete" group heading when some items pass but others do not', () => {
      const result = makeResult('incomplete', [
        { key: 'rooms_present',       label: 'Rooms recorded',          status: 'complete' },
        { key: 'heat_source_recorded', label: 'Boiler location recorded', status: 'missing' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      expect(screen.getByText('Complete')).toBeTruthy();
    });
  });

  // ── 7. No quick-fix rendered for complete items ────────────────────────────

  describe('no quick-fix for complete items', () => {
    it('does not render a quick-fix button next to a complete item', () => {
      const result = makeResult('ready', [
        { key: 'rooms_present', label: 'Rooms recorded', status: 'complete' },
      ]);
      const handlers = makeHandlers();
      render(<HandoffPreviewBanner result={result} plan={makePlan()} {...handlers} />);
      // Only the "Back to edit" button should be present
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toMatch(/back to edit/i);
    });
  });
});
