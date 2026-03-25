/**
 * FlowSplitVisual.tsx
 *
 * Illustrates how delivered flow weakens as more outlets open simultaneously.
 *
 *   1 outlet — full-width stream, strong indicator
 *   2 outlets — stream splits, each noticeably thinner
 *   3 outlets — three thin streams, visibly weaker delivery
 *
 * Animation: continuous drip/flow from the supply pipe into each active outlet.
 * reducedMotion: motion removed; static stream widths convey the difference.
 */

import type { FlowSplitVisualProps } from '../physicsVisualTypes';
import './FlowSplitVisual.css';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStreamWidthClass(outletsActive: 1 | 2 | 3): string {
  if (outletsActive === 1) return 'fsv__stream--full';
  if (outletsActive === 2) return 'fsv__stream--half';
  return 'fsv__stream--third';
}

function getPressureLabel(outletsActive: 1 | 2 | 3): string {
  if (outletsActive === 1) return 'Full flow';
  if (outletsActive === 2) return 'Shared flow';
  return 'Reduced flow';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FlowSplitVisual({
  outletsActive,
  pressureLevel = 'normal',
  reducedMotion = false,
  emphasis = 'medium',
  displayMode = 'preview',
  caption,
}: FlowSplitVisualProps) {
  const streamClass = getStreamWidthClass(outletsActive);
  const pressureLabel = getPressureLabel(outletsActive);

  return (
    <div
      className={`fsv fsv--outlets-${outletsActive} fsv--pressure-${pressureLevel} fsv--emphasis-${emphasis} fsv--mode-${displayMode}${reducedMotion ? ' fsv--reduced-motion' : ''}`}
      role="img"
      aria-label={`${pressureLabel}: ${outletsActive} outlet${outletsActive === 1 ? '' : 's'} active`}
    >
      {/* Supply header pipe */}
      <div className="fsv__supply" aria-hidden="true">
        <div className="fsv__supply-pipe" />
        <div className={`fsv__supply-flow${pressureLevel === 'high' ? ' fsv__supply-flow--high' : ''}`} />
      </div>

      {/* Outlets */}
      <div className="fsv__outlets" aria-hidden="true">
        {[1, 2, 3].map((n) => {
          const isActive = n <= outletsActive;
          return (
            <div key={n} className={`fsv__outlet${isActive ? ' fsv__outlet--active' : ' fsv__outlet--inactive'}`}>
              {/* Tap icon */}
              <div className="fsv__tap" />
              {/* Stream below tap */}
              {isActive && (
                <div className={`fsv__stream ${streamClass}${reducedMotion ? '' : ' fsv__stream--animated'}`} />
              )}
              <span className="fsv__outlet-label">Outlet {n}</span>
            </div>
          );
        })}
      </div>

      {/* Pressure summary */}
      <div className="fsv__summary">
        <span className={`fsv__pressure-badge fsv__pressure-badge--${outletsActive}`}>
          {pressureLabel}
        </span>
        <span className="fsv__active-count">
          {outletsActive} of 3 active
        </span>
      </div>

      {caption && <p className="fsv__caption">{caption}</p>}
    </div>
  );
}
