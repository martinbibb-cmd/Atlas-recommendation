/**
 * WhatIfVisualFrame.tsx
 *
 * Standardised container for What-If animated visuals.
 *
 * Responsibilities:
 *  - Renders optional before/after context labels.
 *  - Adds a CSS modifier class when the user prefers reduced motion so that
 *    all child animations are paused via the stylesheet.
 *  - Provides a consistent layout and spacing shell for every visual.
 *
 * No engine calculations are performed here — display only.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './WhatIfVisualFrame.css';

export interface WhatIfVisualFrameProps {
  /** Short label describing the "before" state (optional). */
  beforeLabel?: string;
  /** Short label describing the "after" state (optional). */
  afterLabel?: string;
  /** The animated (or static) visual component to render. */
  children: ReactNode;
}

/**
 * Returns true if the user's OS/browser has requested reduced motion.
 * Falls back to false in environments where matchMedia is unavailable
 * (SSR, jsdom test environment).
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export default function WhatIfVisualFrame({
  beforeLabel,
  afterLabel,
  children,
}: WhatIfVisualFrameProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={`wivf${reducedMotion ? ' wivf--reduced-motion' : ''}`}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
    >
      {(beforeLabel || afterLabel) && (
        <div className="wivf__labels" aria-hidden="true">
          {beforeLabel && (
            <span className="wivf__label wivf__label--before">
              Before: <strong>{beforeLabel}</strong>
            </span>
          )}
          {afterLabel && (
            <span className="wivf__label wivf__label--after">
              After: <strong>{afterLabel}</strong>
            </span>
          )}
        </div>
      )}

      <div className="wivf__content">{children}</div>

      {reducedMotion && (
        <p className="wivf__motion-notice" role="note">
          Animations paused — motion reduced per your system preference.
        </p>
      )}
    </div>
  );
}
