/**
 * PresentationVisualSlot.tsx
 *
 * Shared wrapper used by canonical presentation pages to render:
 *   - an inline physics visual (displayMode = 'inline')
 *   - a short script: title, one-sentence summary, takeaway
 *   - an optional "Open explainer" CTA
 *
 * Tapping "Open explainer" opens the same visual in focus mode inside a
 * modal panel, where focusCopy is also shown. This keeps pages short while
 * providing a deeper explanation on demand.
 *
 * Usage:
 *   <PresentationVisualSlot
 *     visualId="heat_particles"
 *     visualData={{ wallType: 'solid_masonry' }}
 *   />
 *
 * The component inherits reduced-motion preference automatically from the OS.
 * All copy comes from physicsVisualScripts — no copy is hardcoded here.
 */

import { useState, useEffect, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { PhysicsVisualId } from '../physics-visuals/physicsVisualTypes';
import PhysicsVisual from '../physics-visuals/PhysicsVisual';
import type { PhysicsVisualDataMap } from '../physics-visuals/PhysicsVisual';
import { getVisualScript } from '../physics-visuals/physicsVisualScripts';
import './PresentationVisualSlot.css';

// ─── Reduced-motion hook ──────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PresentationVisualSlotProps<T extends PhysicsVisualId> {
  /** Visual to render. Drives both the animation and the script copy. */
  visualId: T;
  /** Domain-specific data for the chosen visual. */
  visualData?: PhysicsVisualDataMap[T];
  /**
   * When true the "Open explainer" CTA is hidden.
   * Defaults to false — explainer is shown by default.
   */
  hideExplainer?: boolean;
}

// ─── Focus panel ──────────────────────────────────────────────────────────────

interface FocusPanelProps<T extends PhysicsVisualId> {
  visualId: T;
  visualData?: PhysicsVisualDataMap[T];
  reducedMotion: boolean;
  onClose: () => void;
}

function FocusPanel<T extends PhysicsVisualId>({
  visualId,
  visualData,
  reducedMotion,
  onClose,
}: FocusPanelProps<T>) {
  const script = getVisualScript(visualId);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleBackdropClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="pvs__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={script.title}
      onClick={handleBackdropClick}
    >
      <div className="pvs__panel">
        <div className="pvs__panel-header">
          <h3 className="pvs__panel-title">{script.title}</h3>
          <button
            type="button"
            className="pvs__close"
            aria-label="Close explainer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="pvs__panel-visual">
          <PhysicsVisual
            id={visualId}
            data={visualData}
            displayMode="focus"
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="pvs__panel-body">
          <p className="pvs__focus-summary">{script.summary}</p>
          {script.bullets && script.bullets.length > 0 && (
            <ul className="pvs__focus-bullets">
              {script.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {script.takeaway && (
            <p className="pvs__focus-takeaway">
              <strong>Key point: </strong>{script.takeaway}
            </p>
          )}
          {script.focusCopy && (
            <p className="pvs__focus-copy">{script.focusCopy}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PresentationVisualSlot<T extends PhysicsVisualId>({
  visualId,
  visualData,
  hideExplainer = false,
}: PresentationVisualSlotProps<T>) {
  const reducedMotion = useReducedMotion();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const script = getVisualScript(visualId);

  const openExplainer = useCallback(() => setExplainerOpen(true), []);
  const closeExplainer = useCallback(() => setExplainerOpen(false), []);

  const hasFocusCopy = Boolean(script.focusCopy);

  return (
    <div className="pvs" data-testid={`pvs-${visualId}`}>

      {/* ── Inline visual ───────────────────────────────────────── */}
      <div className="pvs__visual">
        <PhysicsVisual
          id={visualId}
          data={visualData}
          displayMode="inline"
          reducedMotion={reducedMotion}
        />
      </div>

      {/* ── Script copy ─────────────────────────────────────────── */}
      <div className="pvs__script">
        <p className="pvs__title">{script.title}</p>
        <p className="pvs__summary">{script.summary}</p>
        {script.takeaway && (
          <p className="pvs__takeaway">{script.takeaway}</p>
        )}
      </div>

      {/* ── Explainer CTA ───────────────────────────────────────── */}
      {!hideExplainer && hasFocusCopy && (
        <button
          type="button"
          className="pvs__cta"
          onClick={openExplainer}
          aria-expanded={explainerOpen}
          aria-label={`Open explainer: ${script.title}`}
        >
          <span className="pvs__cta-icon" aria-hidden="true">↗</span>
          Open explainer
        </button>
      )}

      {/* ── Focus panel ─────────────────────────────────────────── */}
      {explainerOpen && (
        <FocusPanel
          visualId={visualId}
          visualData={visualData}
          reducedMotion={reducedMotion}
          onClose={closeExplainer}
        />
      )}
    </div>
  );
}
