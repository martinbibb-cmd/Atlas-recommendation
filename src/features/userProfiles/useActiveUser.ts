/**
 * src/features/userProfiles/useActiveUser.ts
 *
 * Hook for consuming the ActiveUserContext.
 *
 * Must be called inside a component tree wrapped with <ActiveUserProvider>.
 * Throws a descriptive error if used outside the provider to aid debugging.
 */

import { useContext } from 'react';
import { ActiveUserContext } from './ActiveUserProvider';
import type { ActiveUserContextValue } from './ActiveUserProvider';

/**
 * Returns the current active-user context value.
 *
 * @throws When called outside an <ActiveUserProvider>.
 */
export function useActiveUser(): ActiveUserContextValue {
  const ctx = useContext(ActiveUserContext);
  if (ctx === null) {
    throw new Error('[Atlas] useActiveUser must be used inside <ActiveUserProvider>');
  }
  return ctx;
}
