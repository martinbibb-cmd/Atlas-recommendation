/**
 * src/features/visits/VisitProvider.tsx
 *
 * React context provider for the active Atlas visit.
 *
 * Exposes the current AtlasVisit (or null when no visit is active) and
 * a setter so that child components can start or clear a visit without
 * needing to thread callbacks through every layer of the tree.
 *
 * Persistence
 * ───────────
 * Whenever the visit changes, the provider writes to visitStore so that a
 * same-tab reload can restore the session.  On first render the provider
 * attempts to restore from storage unless an initial visit is supplied.
 *
 * Usage
 * ─────
 *   <VisitProvider initialVisit={visit}>
 *     <YourJourneyComponent />
 *   </VisitProvider>
 */

import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AtlasVisit } from './createAtlasVisit';
import { storeActiveVisit, retrieveActiveVisit, clearActiveVisit } from './visitStore';

// ─── Context value type ───────────────────────────────────────────────────────

export interface VisitContextValue {
  /** The currently active visit, or null when no visit is in progress. */
  activeVisit: AtlasVisit | null;
  /**
   * Set (or clear) the active visit.  Passing null clears both context and
   * sessionStorage.
   */
  setActiveVisit: (visit: AtlasVisit | null) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VisitContext = createContext<VisitContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface VisitProviderProps {
  /**
   * Pre-populate the provider with a known visit.  When provided this takes
   * precedence over any value previously stored in sessionStorage.
   */
  initialVisit?: AtlasVisit | null;
  children: ReactNode;
}

/**
 * VisitProvider
 *
 * Wraps a subtree with the active visit context.  Restores from sessionStorage
 * on mount unless `initialVisit` is explicitly supplied.
 *
 * Wrap the visit-journey area of the application:
 *
 *   <VisitProvider initialVisit={activeVisit ? createAtlasVisit(activeVisit) : null}>
 *     <VisitPage ... />
 *   </VisitProvider>
 */
export function VisitProvider({ initialVisit, children }: VisitProviderProps) {
  const [activeVisit, setActiveVisitState] = useState<AtlasVisit | null>(() => {
    // initialVisit=undefined means "restore from storage".
    // initialVisit=null means "explicitly no visit" (clears storage on mount).
    if (initialVisit !== undefined) return initialVisit ?? null;
    return retrieveActiveVisit();
  });

  // Keep sessionStorage in sync whenever the active visit changes.
  useEffect(() => {
    if (activeVisit !== null) {
      storeActiveVisit(activeVisit);
    } else {
      clearActiveVisit();
    }
  }, [activeVisit]);

  function setActiveVisit(visit: AtlasVisit | null) {
    setActiveVisitState(visit);
  }

  return (
    <VisitContext.Provider value={{ activeVisit, setActiveVisit }}>
      {children}
    </VisitContext.Provider>
  );
}

// ─── Internal context export (for useActiveVisit) ────────────────────────────

export { VisitContext };
