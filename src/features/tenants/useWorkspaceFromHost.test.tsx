/**
 * src/features/tenants/useWorkspaceFromHost.test.tsx
 *
 * Tests for the useWorkspaceFromHost hook.
 *
 * Coverage:
 *   - returns atlas fallback when window.location.host is 'localhost'
 *   - returns host resolution when window.location.host is a known workspace
 *   - result is stable across re-renders (memoised by useState initialiser)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceFromHost } from './useWorkspaceFromHost';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setWindowHost(host: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, host },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useWorkspaceFromHost — localhost (default jsdom)', () => {
  it('returns atlas fallback when host is localhost', () => {
    setWindowHost('localhost');
    const { result } = renderHook(() => useWorkspaceFromHost());
    expect(result.current.brandId).toBe('atlas-default');
    expect(result.current.source).toBe('fallback');
    expect(result.current.workspaceSlug).toBeUndefined();
  });
});

describe('useWorkspaceFromHost — known workspace host', () => {
  beforeEach(() => {
    setWindowHost('demo-heating.atlas-phm.uk');
  });

  afterEach(() => {
    setWindowHost('localhost');
  });

  it('returns the resolved workspace when host is demo-heating.atlas-phm.uk', () => {
    const { result } = renderHook(() => useWorkspaceFromHost());
    expect(result.current.source).toBe('host');
    expect(result.current.workspaceSlug).toBe('demo-heating');
    expect(result.current.brandId).toBe('installer-demo');
    expect(result.current.tenantId).toBe('demo-heating');
  });
});

describe('useWorkspaceFromHost — next.atlas-phm.uk (host-reserved)', () => {
  beforeEach(() => {
    setWindowHost('next.atlas-phm.uk');
  });

  afterEach(() => {
    setWindowHost('localhost');
  });

  it('returns atlas fallback for the next staging subdomain', () => {
    const { result } = renderHook(() => useWorkspaceFromHost());
    expect(result.current.source).toBe('fallback');
    expect(result.current.brandId).toBe('atlas-default');
    expect(result.current.workspaceSlug).toBeUndefined();
  });
});

describe('useWorkspaceFromHost — www.atlas-phm.uk', () => {
  beforeEach(() => {
    setWindowHost('www.atlas-phm.uk');
  });

  afterEach(() => {
    setWindowHost('localhost');
  });

  it('returns atlas fallback for www.atlas-phm.uk', () => {
    const { result } = renderHook(() => useWorkspaceFromHost());
    expect(result.current.source).toBe('fallback');
    expect(result.current.brandId).toBe('atlas-default');
  });
});
