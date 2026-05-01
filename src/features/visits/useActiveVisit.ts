/**
 * src/features/visits/useActiveVisit.ts
 *
 * Hook that returns the active visit context value from the nearest
 * VisitProvider.
 *
 * Throws a descriptive error when used outside a VisitProvider so that
 * missing-provider bugs are caught at render time rather than silently
 * returning stale data.
 */

import { useContext } from 'react';
import type { VisitContextValue } from './VisitProvider';
import { VisitContext } from './VisitProvider';

/**
 * Returns the active VisitContextValue: `{ activeVisit, setActiveVisit }`.
 *
 * - `activeVisit` is the current AtlasVisit or null when no visit is active.
 * - `setActiveVisit` starts or clears the visit (null clears sessionStorage).
 *
 * @throws Error if called outside a `<VisitProvider>` tree.
 */
export function useActiveVisit(): VisitContextValue {
  const ctx = useContext(VisitContext);
  if (ctx === null) {
    throw new Error(
      'useActiveVisit must be used inside a <VisitProvider>. ' +
        'Wrap the component (or its ancestor) with <VisitProvider>.',
    );
  }
  return ctx;
}
