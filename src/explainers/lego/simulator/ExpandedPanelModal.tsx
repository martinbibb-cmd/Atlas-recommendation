/**
 * ExpandedPanelModal — full-screen overlay that shows an expanded panel view.
 *
 * Clicking the overlay or the close button dismisses it.
 * PR1: shows the same panel content enlarged.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
}

export default function ExpandedPanelModal({ title, icon, onClose, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the modal container when it mounts so screen readers announce the dialog
  // and keyboard navigation (Escape) works immediately without a click first.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div
      className="sim-modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} expanded view`}
    >
      <div
        className="sim-modal"
        ref={containerRef}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        <div className="sim-modal__header">
          <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>{icon}</span>
          <h2 className="sim-modal__title">{title}</h2>
          <button
            className="sim-modal__close"
            onClick={onClose}
            aria-label="Close expanded view"
          >
            ✕ Close
          </button>
        </div>
        <div className="sim-modal__body">
          {children}
        </div>
      </div>
    </div>
  );
}
