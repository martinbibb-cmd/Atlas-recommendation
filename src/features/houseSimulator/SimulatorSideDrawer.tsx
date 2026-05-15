/**
 * SimulatorSideDrawer — slide-over panel for the House Simulator.
 *
 * Used for both the left setup drawer and the right engineering/efficiency
 * drawer.  Renders as an overlay slide-over when open; a null node when closed.
 *
 * Consumers supply the drawer content as children.  The drawer itself handles
 * the header (title + close button) and slide-over layout.
 */

import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimulatorSideDrawerProps {
  /** Which edge the drawer slides in from. */
  side: 'left' | 'right';
  /** Drawer heading text. */
  title: string;
  /** Whether the drawer is currently visible. */
  open: boolean;
  /** Called when the user closes the drawer. */
  onClose: () => void;
  /** Drawer body content. */
  children: ReactNode;
  /** HTML id applied to the drawer container — used for aria-controls on the trigger button. */
  id?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimulatorSideDrawer({
  side,
  title,
  open,
  onClose,
  children,
  id,
}: SimulatorSideDrawerProps) {
  if (!open) return null;

  return (
    <aside
      id={id}
      className={`hs-drawer hs-drawer--${side}`}
      role="region"
      aria-label={title}
    >
      <div className="hs-drawer__header">
        <h2 className="hs-drawer__title">{title}</h2>
        <button
          className="hs-action-btn"
          onClick={onClose}
          aria-label={`Close ${title} panel`}
        >
          ✕
        </button>
      </div>
      <div className="hs-drawer__body">
        {children}
      </div>
    </aside>
  );
}
