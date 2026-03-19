/**
 * GlobalMenuShell
 *
 * Shared app chrome that renders the hamburger/explainers menu trigger once
 * across the survey, simulator, and advice/presentation routes.
 *
 * Architecture:
 *   - Provides GlobalMenuContext so child pages can register context-specific
 *     explainer IDs without owning a per-page trigger.
 *   - Renders a single ExplainersOverlay trigger at a fixed position so it is
 *     always visible regardless of scroll state or active route.
 *   - Page content is rendered via the children prop.
 *
 * Usage (App.tsx):
 *   <GlobalMenuShell>
 *     <FullSurveyStepper ... />
 *   </GlobalMenuShell>
 */

import { type ReactNode } from 'react';
import { GlobalMenuProvider, useGlobalMenu } from './GlobalMenuContext';
import ExplainersOverlay from '../../explainers/ExplainersOverlay';
import './GlobalMenuShell.css';

// ─── Inner trigger (reads from context) ──────────────────────────────────────

function GlobalMenuTrigger() {
  const { contextExplainerIds, contextMenuSections } = useGlobalMenu();
  return (
    <div className="global-menu-shell__trigger" data-testid="global-menu-trigger">
      <ExplainersOverlay
        contextExplainerIds={contextExplainerIds}
        contextMenuSections={contextMenuSections}
      />
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
}

/**
 * GlobalMenuShell — wraps a major route to provide consistent app chrome.
 *
 * Place around any top-level page that should show the global hamburger trigger.
 */
export default function GlobalMenuShell({ children }: Props) {
  return (
    <GlobalMenuProvider>
      <GlobalMenuTrigger />
      {children}
    </GlobalMenuProvider>
  );
}
