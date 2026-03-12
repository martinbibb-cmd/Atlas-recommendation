import { useState, useEffect } from 'react';
import WhatIfLab from '../explainers/WhatIfLab';
import LabHomeLink from './LabHomeLink';
import LabConfidenceStrip from './LabConfidenceStrip';
import DrawOffWorkbench from './DrawOffWorkbench';
import CondensingIndicator from './CondensingIndicator';
import ConfidenceScoreBar from './ConfidenceScoreBar';
import PerformanceEnablersPanel from '../performance/PerformanceEnablersPanel';
import FloorPlanBuilder from '../floorplan/FloorPlanBuilder';
import AtlasTour from '../tour/AtlasTour';
import {
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabTab = 'summary' | 'whatif' | 'visual' | 'floorplan';

/** PR 2 — Engineer / Customer mode. */
type UiMode = 'engineer' | 'customer';

interface Props {
  onHome: () => void;
}

// ─── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab({ uiMode }: { uiMode: UiMode }) {
  return (
    <div className="lab-summary">
      <div className="lab-summary__grid">
        {CANDIDATE_SYSTEMS.map(system => (
          <div key={system.id} className="lab-summary__card">
            <div className="lab-summary__card-title">{system.label}</div>
            <dl className="lab-summary__dl">
              {COMPARISON_HEADINGS.map(h => (
                <div key={h.key} className="lab-summary__row">
                  <dt className="lab-summary__dt">{h.label}</dt>
                  <dd className="lab-summary__dd">{system.rows[h.key]}</dd>
                </div>
              ))}
            </dl>
            {/* PR 2 — Customer mode shows explanatory blocks; engineer mode hides them. */}
            {uiMode === 'customer' && (
              <div className="lab-summary__explanation">
                <div className="lab-summary__explanation-block lab-summary__explanation-block--suits">
                  <span className="lab-summary__explanation-label">Why it suits</span>
                  <p className="lab-summary__explanation-text">{system.explanation.suits}</p>
                  {system.explanation.suitsHint && (
                    <p className="lab-summary__explanation-hint">{system.explanation.suitsHint}</p>
                  )}
                </div>
                <div className="lab-summary__explanation-block lab-summary__explanation-block--struggles">
                  <span className="lab-summary__explanation-label">Why it struggles</span>
                  <p className="lab-summary__explanation-text">{system.explanation.struggles}</p>
                  {system.explanation.strugglesHint && (
                    <p className="lab-summary__explanation-hint">{system.explanation.strugglesHint}</p>
                  )}
                </div>
                <div className="lab-summary__explanation-block lab-summary__explanation-block--changes">
                  <span className="lab-summary__explanation-label">What would need to change</span>
                  <p className="lab-summary__explanation-text">{system.explanation.changes}</p>
                  {system.explanation.changesHint && (
                    <p className="lab-summary__explanation-hint">{system.explanation.changesHint}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PR 4 — Performance Enablers Panel */}
      <div className="lab-summary__enablers">
        <PerformanceEnablersPanel />
      </div>
    </div>
  );
}

// ─── Visual tab ───────────────────────────────────────────────────────────────

/** PR 6 — Auto Demo Run storage key. */
const VISUAL_DEMO_KEY = 'atlasVisualDemoSeen';

/**
 * VisualTab
 *
 * Wraps DrawOffWorkbench.  On first open (PR 6 — Auto Demo Run) shows a brief
 * intro banner that auto-dismisses after 3 s, giving users an instant
 * understanding of the simulation before they interact.
 */
function VisualTab() {
  const [showIntro, setShowIntro] = useState(
    () => localStorage.getItem(VISUAL_DEMO_KEY) !== 'true',
  );

  useEffect(() => {
    if (!showIntro) return;
    const timer = setTimeout(() => {
      localStorage.setItem(VISUAL_DEMO_KEY, 'true');
      setShowIntro(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showIntro]);

  return (
    <div className="lab-visual-tab">
      {showIntro && (
        <div className="lab-visual-tab__intro" role="status" aria-live="polite">
          <span className="lab-visual-tab__intro-icon" aria-hidden="true">▶</span>
          <span>
            <strong>Auto Demo</strong> — tap a regime to watch heat and water behaviour.
            Cylinder cools → boiler fires → hot water ready.
          </span>
          <button
            className="lab-visual-tab__intro-dismiss"
            onClick={() => {
              localStorage.setItem(VISUAL_DEMO_KEY, 'true');
              setShowIntro(false);
            }}
            aria-label="Dismiss auto demo intro"
          >
            ×
          </button>
        </div>
      )}
      <DrawOffWorkbench />
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function LabShell({ onHome }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('summary');
  /** PR 2 — Engineer/Customer mode toggle. */
  const [uiMode, setUiMode] = useState<UiMode>('engineer');

  const TAB_LABELS: Record<LabTab, string> = {
    summary:   'Summary',
    whatif:    'What if…?',
    visual:    'Visual',
    floorplan: 'Floor Plan',
  };

  /** PR 2 — Tab IDs mapped from tab key to DOM id required by the tour. */
  const TAB_IDS: Record<LabTab, string | undefined> = {
    summary:   'system-lab-tab',
    whatif:    'what-if-tab',
    visual:    'visual-tab',
    floorplan: undefined,
  };

  return (
    <div className="lab-wrap">

      {/* PR 1 — First-run tour: lab phase (steps 3–6) */}
      <AtlasTour context="lab" />

      {/* ── Branded header ─────────────────────────────────────────────────── */}
      <header className="lab-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-title">
          <div className="lab-brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lab-h1">System Lab</h1>
          <p className="lab-subtitle">Compare heating systems using real operating constraints.</p>
        </div>

        {/* PR 2 — Engineer / Customer mode toggle */}
        <div className="lab-mode-toggle" role="group" aria-label="UI mode">
          <span className="lab-mode-toggle__label">Mode</span>
          <button
            className={`lab-mode-toggle__btn${uiMode === 'engineer' ? ' lab-mode-toggle__btn--active' : ''}`}
            onClick={() => setUiMode('engineer')}
            aria-pressed={uiMode === 'engineer'}
          >
            Engineer
          </button>
          <button
            className={`lab-mode-toggle__btn${uiMode === 'customer' ? ' lab-mode-toggle__btn--active' : ''}`}
            onClick={() => setUiMode('customer')}
            aria-pressed={uiMode === 'customer'}
          >
            Customer
          </button>
        </div>

        {/* PR 5 — Condensing efficiency indicator */}
        <CondensingIndicator returnTempC={45} />
      </header>

      {/* ── Context row ────────────────────────────────────────────────────── */}
      <div className="lab-context-row" aria-label="Comparison context">
        <span className="lab-context-label">Current:</span>
        <span className="lab-context-chip lab-context-chip--current">{PLACEHOLDER_CURRENT_SYSTEM}</span>
        <span className="lab-context-label">Comparing:</span>
        {CANDIDATE_SYSTEMS.map(s => (
          <span key={s.id} className="lab-context-chip">{s.label}</span>
        ))}
        {/* PR 8 — Replace plain confidence badge with visual score bar */}
        <ConfidenceScoreBar data={PLACEHOLDER_CONFIDENCE_STRIP} />
      </div>

      {/* ── Headline verdict strip ─────────────────────────────────────────── */}
      <div className="lab-verdict-strip" role="status" aria-label="Headline verdict">
        <span className="lab-verdict-strip__label">Best overall fit:</span>
        <span className="lab-verdict-strip__value">{PLACEHOLDER_VERDICT.system}</span>
        <span className="lab-verdict-strip__note">
          {PLACEHOLDER_VERDICT.note}
        </span>
      </div>

      {/* ── Confidence + assumptions strip ─────────────────────────────────── */}
      <LabConfidenceStrip data={PLACEHOLDER_CONFIDENCE_STRIP} />

      {/* PR 1 — Export buttons (tour target #export-buttons) */}
      {/* ── Print views ────────────────────────────────────────────────────── */}
      <div id="export-buttons" className="lab-print-nav" aria-label="Print views">
        <span className="lab-print-nav__label">Print / export:</span>
        <a
          className="lab-print-nav__link"
          href="?print=customer"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open customer summary print view"
        >
          Customer Summary
        </a>
        <a
          className="lab-print-nav__link"
          href="?print=technical"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open technical specification print view"
        >
          Tech Spec
        </a>
        <a
          className="lab-print-nav__link"
          href="?print=comparison"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open comparison sheet print view"
        >
          Comparison
        </a>
      </div>

      {/* ── Top-level tabs ─────────────────────────────────────────────────── */}
      <div className="lab-tabs" role="tablist" aria-label="Lab views">
        {(Object.keys(TAB_LABELS) as LabTab[]).map(tab => (
          <button
            key={tab}
            id={TAB_IDS[tab]}
            role="tab"
            aria-selected={activeTab === tab}
            className={`lab-tab${activeTab === tab ? ' lab-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="lab-tab-content" role="tabpanel">
        {activeTab === 'summary'   && <SummaryTab uiMode={uiMode} />}
        {activeTab === 'whatif'    && <WhatIfLab />}
        {activeTab === 'visual'    && <VisualTab />}
        {activeTab === 'floorplan' && <FloorPlanBuilder />}
      </div>

    </div>
  );
}
