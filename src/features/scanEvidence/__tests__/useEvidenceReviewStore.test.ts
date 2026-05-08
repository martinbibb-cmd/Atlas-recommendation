import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEvidenceReviewStore } from '../useEvidenceReviewStore';

const STORAGE_KEY = 'atlas:evidence-review:v1';

describe('useEvidenceReviewStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises with an empty decisions map when no stored data exists', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));
    expect(result.current.decisions).toEqual({});
  });

  it('stores a confirmed decision and makes it retrievable', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'confirmed', 'Verified on site');
    });

    const decision = result.current.getDecision('pin-001');
    expect(decision?.status).toBe('confirmed');
    expect(decision?.kind).toBe('object_pin');
    expect(decision?.engineerNote).toBe('Verified on site');
    expect(decision?.itemId).toBe('pin-001');
    expect(decision?.decidedAt).toBeTruthy();
  });

  it('stores a rejected decision', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('photo-007', 'photo', 'rejected');
    });

    expect(result.current.getDecision('photo-007')?.status).toBe('rejected');
  });

  it('stores a needs_review decision', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-002', 'object_pin', 'needs_review', 'Check manufacturer label');
    });

    const decision = result.current.getDecision('pin-002');
    expect(decision?.status).toBe('needs_review');
    expect(decision?.engineerNote).toBe('Check manufacturer label');
  });

  it('overwrites an existing decision when setDecision is called again', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'needs_review');
    });
    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'confirmed', 'All good');
    });

    const decision = result.current.getDecision('pin-001');
    expect(decision?.status).toBe('confirmed');
    expect(decision?.engineerNote).toBe('All good');
  });

  it('clears a decision with clearDecision', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'confirmed');
    });
    act(() => {
      result.current.clearDecision('pin-001');
    });

    expect(result.current.getDecision('pin-001')).toBeUndefined();
  });

  it('persists decisions to localStorage', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'confirmed', 'Checked');
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!) as {
      reviewsByVisitId: Record<string, Record<string, { status: string }>>;
    };
    expect(stored.reviewsByVisitId['visit-001']['pin-001'].status).toBe('confirmed');
  });

  it('scopes decisions to visitId — different visits do not interfere', () => {
    const { result: resultA } = renderHook(() => useEvidenceReviewStore('visit-A'));
    const { result: resultB } = renderHook(() => useEvidenceReviewStore('visit-B'));

    act(() => {
      resultA.current.setDecision('pin-001', 'object_pin', 'confirmed');
    });
    act(() => {
      resultB.current.setDecision('pin-001', 'object_pin', 'rejected');
    });

    expect(resultA.current.getDecision('pin-001')?.status).toBe('confirmed');
    expect(resultB.current.getDecision('pin-001')?.status).toBe('rejected');
  });

  it('returns undefined for getDecision on an unreviewed item', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));
    expect(result.current.getDecision('nonexistent-item')).toBeUndefined();
  });

  it('strips empty engineer notes (trims to undefined)', () => {
    const { result } = renderHook(() => useEvidenceReviewStore('visit-001'));

    act(() => {
      result.current.setDecision('pin-001', 'object_pin', 'confirmed', '  ');
    });

    expect(result.current.getDecision('pin-001')?.engineerNote).toBeUndefined();
  });
});
