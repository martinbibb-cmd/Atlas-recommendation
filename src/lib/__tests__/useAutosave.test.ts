import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../hooks/useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAutosave(saveFn));
    expect(result.current.status).toBe('idle');
    expect(result.current.hasPendingSave).toBe(false);
  });

  it('transitions to saving then saved on successful debounced save', async () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAutosave(saveFn, { debounceMs: 200 }));

    act(() => {
      result.current.save('some data');
    });

    expect(result.current.status).toBe('saving');
    expect(result.current.hasPendingSave).toBe(true);
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('saved');
    expect(result.current.hasPendingSave).toBe(false);
  });

  it('resets to idle after savedResetMs', async () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() =>
      useAutosave(saveFn, { debounceMs: 100, savedResetMs: 500 }),
    );

    await act(async () => {
      result.current.save('data');
      vi.advanceTimersByTime(100);
    });

    expect(result.current.status).toBe('saved');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('idle');
  });

  it('transitions to failed when saveFn rejects', async () => {
    const saveFn = vi.fn(() => Promise.reject(new Error('network error')));
    const { result } = renderHook(() => useAutosave(saveFn, { debounceMs: 50 }));

    await act(async () => {
      result.current.save('bad data');
      vi.advanceTimersByTime(50);
    });

    expect(result.current.status).toBe('failed');
  });

  it('immediate:true skips debounce and saves synchronously', async () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAutosave(saveFn, { debounceMs: 600 }));

    await act(async () => {
      result.current.save('data', { immediate: true });
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.hasPendingSave).toBe(false);
  });

  it('debounces multiple rapid saves — only last wins', async () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAutosave(saveFn, { debounceMs: 300 }));

    act(() => {
      result.current.save('v1');
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.save('v2');
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.save('v3');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveFn).toHaveBeenCalledOnce();
    // The latest data ('v3') is what was saved.
    expect(saveFn).toHaveBeenCalledWith('v3');
  });

  it('retry re-runs the save after failure', async () => {
    let attempts = 0;
    const saveFn = vi.fn(() => {
      attempts++;
      if (attempts === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve();
    });

    const { result } = renderHook(() => useAutosave(saveFn, { debounceMs: 50 }));

    // First save: fails
    await act(async () => {
      result.current.save('data');
      vi.advanceTimersByTime(50);
    });

    expect(result.current.status).toBe('failed');

    // Retry: succeeds
    await act(async () => {
      result.current.retry();
    });

    expect(result.current.status).toBe('saved');
    expect(saveFn).toHaveBeenCalledTimes(2);
  });

  it('retry is a no-op when status is not failed', async () => {
    const saveFn = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAutosave(saveFn));

    act(() => {
      result.current.retry(); // idle → no-op
    });

    expect(saveFn).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});
