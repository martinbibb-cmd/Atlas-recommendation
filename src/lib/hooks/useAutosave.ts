/**
 * useAutosave — generic debounced autosave hook.
 *
 * Accepts an async save function and returns a trigger, retry handler, and
 * status badge state. Designed to be dropped into any feature that needs
 * idle / saving / saved / failed / retrying tracking without re-implementing
 * the debounce + retry + reset logic from scratch.
 *
 * Usage:
 *   const { status, save, retry, hasPendingSave } = useAutosave(myAsyncSaveFn);
 *
 *   // Trigger a debounced save (e.g. on every state change)
 *   save(myData);
 *
 *   // Trigger an immediate save (e.g. on blur / pointer-up)
 *   save(myData, { immediate: true });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Visible states for the save-status badge. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'retrying';

export interface UseAutosaveOptions {
  /** Debounce delay in ms. Default: 600 ms. */
  debounceMs?: number;
  /** How long to keep "saved" status visible before reverting to idle. Default: 4000 ms. */
  savedResetMs?: number;
}

export interface UseAutosaveResult<T> {
  /** Current save-status visible to the UI. */
  status: AutosaveStatus;
  /**
   * Schedule a debounced save for the given data.
   * Pass `{ immediate: true }` to skip the debounce (e.g. on blur or drag-end).
   */
  save: (data: T, opts?: { immediate?: boolean }) => void;
  /** Manually retry the last failed save. No-op if not in `failed` state. */
  retry: () => void;
  /** True while a debounced save is queued but has not yet been dispatched. */
  hasPendingSave: boolean;
}

/**
 * Hook: useAutosave<T>
 *
 * @param saveFn  Async function that persists data. Receives the latest data
 *                snapshot at the time of execution (not the closure value at
 *                schedule time) — ensuring retries always use current data.
 * @param options Optional debounce / reset timing.
 */
export function useAutosave<T>(
  saveFn: (data: T) => Promise<void>,
  options: UseAutosaveOptions = {},
): UseAutosaveResult<T> {
  const { debounceMs = 600, savedResetMs = 4000 } = options;

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [hasPendingSave, setHasPendingSave] = useState(false);

  // Always holds the most recent data so retries use the latest snapshot.
  const latestDataRef = useRef<T | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of status in a ref so retry/callbacks read fresh state.
  const statusRef = useRef<AutosaveStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Cleanup timers on unmount to avoid memory leaks / setState-after-unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const executesSave = useCallback(() => {
    const data = latestDataRef.current;
    if (data === null) {
      setStatus('failed');
      statusRef.current = 'failed';
      setHasPendingSave(false);
      return;
    }

    setHasPendingSave(false);

    saveFn(data)
      .then(() => {
        setStatus('saved');
        statusRef.current = 'saved';
        if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
          statusRef.current = 'idle';
        }, savedResetMs);
      })
      .catch(() => {
        setStatus('failed');
        statusRef.current = 'failed';
      });
  }, [saveFn, savedResetMs]);

  const save = useCallback(
    (data: T, opts: { immediate?: boolean } = {}) => {
      latestDataRef.current = data;

      // Clear any existing debounce timer.
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);

      setStatus('saving');
      statusRef.current = 'saving';

      if (opts.immediate) {
        setHasPendingSave(false);
        executesSave();
      } else {
        setHasPendingSave(true);
        debounceTimerRef.current = setTimeout(() => {
          executesSave();
        }, debounceMs);
      }
    },
    [executesSave, debounceMs],
  );

  const retry = useCallback(() => {
    if (statusRef.current === 'saving' || statusRef.current === 'retrying') return;
    if (statusRef.current !== 'failed') return;
    setStatus('retrying');
    statusRef.current = 'retrying';
    executesSave();
  }, [executesSave]);

  return { status, save, retry, hasPendingSave };
}
