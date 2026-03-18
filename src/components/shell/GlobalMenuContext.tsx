/**
 * GlobalMenuContext
 *
 * Provides shared state for the global hamburger/explainers menu trigger so
 * that any page rendered inside GlobalMenuShell can register context-specific
 * explainer IDs without owning a per-page trigger.
 *
 * Usage:
 *   // Inside a page component rendered within GlobalMenuShell:
 *   const { setContextExplainerIds } = useGlobalMenu();
 *   useEffect(() => {
 *     setContextExplainerIds(['on_demand_vs_stored', 'standard_vs_mixergy']);
 *     return () => setContextExplainerIds([]);
 *   }, [setContextExplainerIds]);
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalMenuContextValue {
  /** Explainer IDs currently registered by the active page. */
  contextExplainerIds: string[];
  /** Called by the active page to register its context-specific explainer IDs. */
  setContextExplainerIds: (ids: string[]) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GlobalMenuContext = createContext<GlobalMenuContextValue>({
  contextExplainerIds: [],
  setContextExplainerIds: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GlobalMenuProvider({ children }: { children: ReactNode }) {
  const [contextExplainerIds, setContextExplainerIdsState] = useState<string[]>([]);

  const setContextExplainerIds = useCallback((ids: string[]) => {
    setContextExplainerIdsState(ids);
  }, []);

  return (
    <GlobalMenuContext.Provider value={{ contextExplainerIds, setContextExplainerIds }}>
      {children}
    </GlobalMenuContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the global menu context.
 * Returns a no-op setter when called outside GlobalMenuShell so components
 * remain safe to render in isolation (e.g., in tests or standalone pages).
 */
export function useGlobalMenu(): GlobalMenuContextValue {
  return useContext(GlobalMenuContext);
}
