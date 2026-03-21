/**
 * GlobalMenuContext
 *
 * Provides shared state for the global hamburger/explainers menu trigger so
 * that any page rendered inside GlobalMenuShell can register context-specific
 * explainer IDs and secondary panel sections without owning a per-page trigger.
 *
 * Usage:
 *   // Inside a page component rendered within GlobalMenuShell:
 *   const { setContextExplainerIds, setContextMenuSections } = useGlobalMenu();
 *   useEffect(() => {
 *     setContextExplainerIds(['on_demand_vs_stored', 'standard_vs_mixergy']);
 *     setContextMenuSections([
 *       { id: 'some-section', label: 'Some section', content: <SomeContent /> },
 *     ]);
 *     return () => {
 *       setContextExplainerIds([]);
 *       setContextMenuSections([]);
 *     };
 *   }, [setContextExplainerIds, setContextMenuSections]);
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A secondary panel section registered by the active page.
 * Rendered in the global menu under "Explore further" when the menu is open.
 */
export interface GlobalMenuSection {
  /** Unique identifier for this section (used as React key). */
  id: string;
  /** Display label shown as the menu item. */
  label: string;
  /** Rich content rendered when the user selects this section from the menu. */
  content: ReactNode;
}

export interface GlobalMenuContextValue {
  /** Explainer IDs currently registered by the active page. */
  contextExplainerIds: string[];
  /** Called by the active page to register its context-specific explainer IDs. */
  setContextExplainerIds: (ids: string[]) => void;
  /** Secondary panel sections registered by the active page. */
  contextMenuSections: GlobalMenuSection[];
  /** Called by the active page to register secondary panel sections. */
  setContextMenuSections: (sections: GlobalMenuSection[]) => void;
  /**
   * Programmatically open the explainers overlay at the specified explainer.
   * Used by inline "Learn why" links to open the overlay from any page context.
   * The overlay clears this once it has acted on the request.
   */
  openExplainerById: (id: string) => void;
  /**
   * The explainer ID requested via openExplainerById, or null when no
   * request is pending.  Read by ExplainersOverlay to action the open request.
   */
  pendingExplainerId: string | null;
  /** Called by ExplainersOverlay once it has opened the requested explainer. */
  clearPendingExplainerId: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GlobalMenuContext = createContext<GlobalMenuContextValue>({
  contextExplainerIds: [],
  setContextExplainerIds: () => {},
  contextMenuSections: [],
  setContextMenuSections: () => {},
  openExplainerById: () => {},
  pendingExplainerId: null,
  clearPendingExplainerId: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GlobalMenuProvider({ children }: { children: ReactNode }) {
  const [contextExplainerIds, setContextExplainerIdsState] = useState<string[]>([]);
  const [contextMenuSections, setContextMenuSectionsState] = useState<GlobalMenuSection[]>([]);
  const [pendingExplainerId, setPendingExplainerIdState] = useState<string | null>(null);

  const setContextExplainerIds = useCallback((ids: string[]) => {
    setContextExplainerIdsState(ids);
  }, []);

  const setContextMenuSections = useCallback((sections: GlobalMenuSection[]) => {
    setContextMenuSectionsState(sections);
  }, []);

  const openExplainerById = useCallback((id: string) => {
    setPendingExplainerIdState(id);
  }, []);

  const clearPendingExplainerId = useCallback(() => {
    setPendingExplainerIdState(null);
  }, []);

  return (
    <GlobalMenuContext.Provider value={{
      contextExplainerIds,
      setContextExplainerIds,
      contextMenuSections,
      setContextMenuSections,
      openExplainerById,
      pendingExplainerId,
      clearPendingExplainerId,
    }}>
      {children}
    </GlobalMenuContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the global menu context.
 * Returns no-op setters when called outside GlobalMenuShell so components
 * remain safe to render in isolation (e.g., in tests or standalone pages).
 */
export function useGlobalMenu(): GlobalMenuContextValue {
  return useContext(GlobalMenuContext);
}
