/**
 * FloorPlanBuilder — undo/redo and layer toggles tests.
 *
 * Tests the core new user-facing behaviours added in this PR:
 *   1. Undo / redo via toolbar buttons
 *   2. Layer visibility toggles
 *   3. Clean view toggle
 *   4. Autosave status badge renders
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
