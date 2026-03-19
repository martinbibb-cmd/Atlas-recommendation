/**
 * ExplainersOverlay
 *
 * Persistent on-demand explainer library for the advice page.
 *
 * Renders a launcher button (☰ Explainers) that opens a two-level overlay:
 *   1. Menu — list of explainers split into "For this recommendation" and
 *      "More explainers" sections.
 *   2. Viewer — full content for a selected explainer, with back/close actions.
 *
 * State model:
 *   menuOpen: boolean        — whether the overlay is visible
 *   activeExplainerId: string | null — which explainer content is shown
 *
 * UX rules:
 *   - Opening the overlay does not change route state.
 *   - Closing returns to the same scroll position (overlay is non-navigating).
 *   - ESC dismisses the overlay from either view.
 *   - Focus is trapped inside the overlay while open.
 *   - On close, focus returns to the launcher button.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EDUCATIONAL_EXPLAINERS } from './educational/content';
import type { EducationalExplainer } from './educational/types';
import type { GlobalMenuSection } from '../components/shell/GlobalMenuContext';
import './ExplainersOverlay.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * IDs from EDUCATIONAL_EXPLAINERS that are relevant to the current
   * recommendation. These are shown first under "For this recommendation".
   * All other explainers appear under "More explainers".
   */
  contextExplainerIds: ReadonlyArray<string>;
  /**
   * Secondary panel sections registered by the active page.
   * Shown under "Explore further" in the menu. Clicking a section renders
   * its content inside the overlay panel.
   */
  contextMenuSections?: ReadonlyArray<GlobalMenuSection>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns explainers matching the given IDs, preserving order. */
function pickExplainers(ids: ReadonlyArray<string>): EducationalExplainer[] {
  return ids
    .map(id => EDUCATIONAL_EXPLAINERS.find(e => e.id === id))
    .filter((e): e is EducationalExplainer => e != null);
}

// ─── Sub-component: SectionPanel ─────────────────────────────────────────────

interface SectionPanelProps {
  section: GlobalMenuSection;
  onBack: () => void;
  onClose: () => void;
}

function SectionPanel({ section, onBack, onClose }: SectionPanelProps) {
  return (
    <div
      className="eo-section-panel"
      role="document"
      aria-label={section.label}
      data-testid={`explainers-section-panel-${section.id}`}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="eo-viewer__toolbar">
        <button
          className="eo-viewer__back-btn"
          onClick={onBack}
          aria-label="Back to explainer list"
          data-testid="explainers-section-back"
        >
          ← Back
        </button>
        <button
          className="eo-viewer__close-btn"
          onClick={onClose}
          aria-label="Close explainers"
          data-testid="explainers-section-close"
        >
          ✕
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="eo-section-panel__content">
        {section.content}
      </div>
    </div>
  );
}

// ─── Sub-component: ExplainerViewer ──────────────────────────────────────────

interface ViewerProps {
  explainer: EducationalExplainer;
  onBack: () => void;
  onClose: () => void;
}

function ExplainerViewer({ explainer, onBack, onClose }: ViewerProps) {
  return (
    <div
      className="eo-viewer"
      role="document"
      aria-label={explainer.title}
      data-testid="explainers-modal"
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="eo-viewer__toolbar">
        <button
          className="eo-viewer__back-btn"
          onClick={onBack}
          aria-label="Back to explainer list"
          data-testid="explainers-modal-back"
        >
          ← Back
        </button>
        <button
          className="eo-viewer__close-btn"
          onClick={onClose}
          aria-label="Close explainers"
          data-testid="explainers-modal-close"
        >
          ✕
        </button>
      </div>

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <h2 className="eo-viewer__title">{explainer.title}</h2>

      {/* ── Core point ──────────────────────────────────────────────────── */}
      <p className="eo-viewer__point">{explainer.point}</p>

      {/* ── Bullets ─────────────────────────────────────────────────────── */}
      <ul className="eo-viewer__bullets" aria-label="Key facts">
        {explainer.bullets.map((bullet, i) => (
          <li key={i} className="eo-viewer__bullet">{bullet}</li>
        ))}
      </ul>

      {/* ── Simulator reference (optional) ──────────────────────────────── */}
      {explainer.simulatorLabel != null && (
        <p className="eo-viewer__sim-ref">
          <span aria-hidden="true">💡</span>{' '}See also:{' '}
          <strong>{explainer.simulatorLabel}</strong> in the simulator
        </p>
      )}
    </div>
  );
}

// ─── Sub-component: ExplainerMenu ─────────────────────────────────────────────

interface MenuProps {
  contextExplainers: EducationalExplainer[];
  libraryExplainers: EducationalExplainer[];
  contextMenuSections: ReadonlyArray<GlobalMenuSection>;
  onSelect: (id: string) => void;
  onSelectSection: (id: string) => void;
  onClose: () => void;
}

function ExplainerMenu({ contextExplainers, libraryExplainers, contextMenuSections, onSelect, onSelectSection, onClose }: MenuProps) {
  return (
    <div
      className="eo-menu"
      role="document"
      aria-label="Explainer list"
      data-testid="explainers-menu"
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="eo-menu__toolbar">
        <h2 className="eo-menu__title">Explainers</h2>
        <button
          className="eo-menu__close-btn"
          onClick={onClose}
          aria-label="Close explainers"
          data-testid="explainers-menu-close"
        >
          ✕
        </button>
      </div>

      {/* ── Explore further (registered panel sections) ──────────────────── */}
      {contextMenuSections.length > 0 && (
        <section
          className="eo-menu__section"
          aria-label="Explore further"
          data-testid="explainers-sections-section"
        >
          <h3 className="eo-menu__section-heading">Explore further</h3>
          <ul className="eo-menu__list" role="list">
            {contextMenuSections.map(s => (
              <li key={s.id} role="listitem">
                <button
                  className="eo-menu__item eo-menu__item--section"
                  onClick={() => onSelectSection(s.id)}
                  aria-label={`Open ${s.label}`}
                  data-testid={`explainers-section-item-${s.id}`}
                >
                  <span className="eo-menu__item-title">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── For this recommendation ──────────────────────────────────────── */}
      {contextExplainers.length > 0 && (
        <section
          className="eo-menu__section"
          aria-label="For this recommendation"
          data-testid="explainers-context-section"
        >
          <h3 className="eo-menu__section-heading">For this recommendation</h3>
          <ul className="eo-menu__list" role="list">
            {contextExplainers.map(e => (
              <li key={e.id} role="listitem">
                <button
                  className="eo-menu__item eo-menu__item--context"
                  onClick={() => onSelect(e.id)}
                  aria-label={`Open explainer: ${e.title}`}
                  data-testid={`explainers-menu-item-${e.id}`}
                >
                  <span className="eo-menu__item-title">{e.title}</span>
                  <span className="eo-menu__item-point">{e.point}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── More explainers ──────────────────────────────────────────────── */}
      {libraryExplainers.length > 0 && (
        <section
          className="eo-menu__section"
          aria-label="More explainers"
          data-testid="explainers-library-section"
        >
          <h3 className="eo-menu__section-heading">More explainers</h3>
          <ul className="eo-menu__list" role="list">
            {libraryExplainers.map(e => (
              <li key={e.id} role="listitem">
                <button
                  className="eo-menu__item"
                  onClick={() => onSelect(e.id)}
                  aria-label={`Open explainer: ${e.title}`}
                  data-testid={`explainers-menu-item-${e.id}`}
                >
                  <span className="eo-menu__item-title">{e.title}</span>
                  <span className="eo-menu__item-point">{e.point}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// ── Focusable selector constants ──────────────────────────────────────────────
const FIRST_FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const TRAP_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ExplainersOverlay({ contextExplainerIds, contextMenuSections = [] }: Props) {
  const [menuOpen, setMenuOpen]                       = useState(false);
  const [activeExplainerId, setActiveExplainerId]     = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId]         = useState<string | null>(null);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────────
  const contextExplainers = pickExplainers(contextExplainerIds);
  const contextIdSet       = new Set(contextExplainerIds);
  const libraryExplainers  = EDUCATIONAL_EXPLAINERS.filter(e => !contextIdSet.has(e.id));

  const activeExplainer = activeExplainerId != null
    ? EDUCATIONAL_EXPLAINERS.find(e => e.id === activeExplainerId) ?? null
    : null;

  const activeSection = activeSectionId != null
    ? contextMenuSections.find(s => s.id === activeSectionId) ?? null
    : null;

  // ── Open / close ────────────────────────────────────────────────────────────
  const openMenu = useCallback(() => {
    setMenuOpen(true);
    setActiveExplainerId(null);
    setActiveSectionId(null);
  }, []);

  const closeOverlay = useCallback(() => {
    setMenuOpen(false);
    setActiveExplainerId(null);
    setActiveSectionId(null);
    // Restore focus to launcher when overlay is dismissed.
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  const selectExplainer = useCallback((id: string) => {
    setActiveExplainerId(id);
    setActiveSectionId(null);
  }, []);

  const selectSection = useCallback((id: string) => {
    setActiveSectionId(id);
    setActiveExplainerId(null);
  }, []);

  const backToMenu = useCallback(() => {
    setActiveExplainerId(null);
    setActiveSectionId(null);
  }, []);

  // ── Keyboard handling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, closeOverlay]);

  // ── Focus management ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (menuOpen && overlayRef.current) {
      const firstFocusable = overlayRef.current.querySelector<HTMLElement>(
        FIRST_FOCUSABLE_SELECTOR,
      );
      firstFocusable?.focus();
    }
  }, [menuOpen, activeExplainerId, activeSectionId]);

  // ── Focus trap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen || !overlayRef.current) return;

    const el = overlayRef.current;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(TRAP_FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, [menuOpen, activeExplainerId, activeSectionId]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Launcher button ───────────────────────────────────────────────── */}
      <button
        ref={launcherRef}
        className="eo-launcher"
        onClick={openMenu}
        aria-label="Open explainers"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        data-testid="explainers-launcher"
      >
        ☰ Explainers
      </button>

      {/* ── Overlay ────────────────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="eo-backdrop"
            onClick={closeOverlay}
            aria-hidden="true"
            data-testid="explainers-backdrop"
          />

          {/* Panel */}
          <div
            ref={overlayRef}
            className={`eo-panel${activeSection != null ? ' eo-panel--wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              activeExplainer != null
                ? activeExplainer.title
                : activeSection != null
                  ? activeSection.label
                  : 'Explainers'
            }
            data-testid="explainers-overlay"
          >
            {activeExplainer != null
              ? (
                <ExplainerViewer
                  explainer={activeExplainer}
                  onBack={backToMenu}
                  onClose={closeOverlay}
                />
              )
              : activeSection != null
                ? (
                  <SectionPanel
                    section={activeSection}
                    onBack={backToMenu}
                    onClose={closeOverlay}
                  />
                )
                : (
                  <ExplainerMenu
                    contextExplainers={contextExplainers}
                    libraryExplainers={libraryExplainers}
                    contextMenuSections={contextMenuSections}
                    onSelect={selectExplainer}
                    onSelectSection={selectSection}
                    onClose={closeOverlay}
                  />
                )
            }
          </div>
        </>
      )}
    </>
  );
}
