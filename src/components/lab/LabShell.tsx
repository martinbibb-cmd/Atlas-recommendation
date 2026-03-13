import { useState, useEffect } from 'react';
import WhatIfLab from '../explainers/WhatIfLab';
import LabHomeLink from './LabHomeLink';
import LabConfidenceStrip from './LabConfidenceStrip';
import DrawOffWorkbench from './DrawOffWorkbench';
import CondensingIndicator from './CondensingIndicator';
import ConfidenceScoreBar from './ConfidenceScoreBar';
import PerformanceEnablersPanel from '../performance/PerformanceEnablersPanel';
import CondensingRuntimePanel from '../summary/CondensingRuntimePanel';
import AtlasTour from '../tour/AtlasTour';
import { resetAtlasTourSeen } from '../../lib/tourStorage';
import SystemBuilder from '../builder/SystemBuilder';
import {
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabTab = 'visual' | 'summary' | 'whatif' | 'builder';

interface Props {
  onHome: () => void;
}

// ─── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab() {
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
          </div>
        ))}
      </div>

      {/* PR 4 — Performance Enablers Panel */}
      <div className="lab-summary__enablers">
        <PerformanceEnablersPanel />
      </div>

      {/* PR 7 — Condensing Runtime Panel (null = no engine result in standalone lab) */}
      <div className="lab-summary__enablers">
        <CondensingRuntimePanel condensingRuntime={null} condensingState={null} />
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
  const [activeTab, setActiveTab] = useState<LabTab>('visual');
  /** PR 1 — Replay tour state. */
  const [replayTour, setReplayTour] = useState(false);

  const TAB_LABELS: Record<LabTab, string> = {
    visual:   'Simulator',
    summary:  'Summary',
    whatif:   'What if…?',
    builder:  'Builder',
  };

  /** PR 2 — Tab IDs mapped from tab key to DOM id required by the tour. */
  const TAB_IDS: Record<LabTab, string | undefined> = {
    visual:   'visual-tab',
    summary:  'system-lab-tab',
    whatif:   'what-if-tab',
    builder:  'builder-tab',
  };

  /** PR 1 — Maps tab key to its data-tour attribute value (tour targets). */
  const TAB_TOUR_ATTRS: Record<LabTab, string | undefined> = {
    visual:   'visual-tab',
    summary:  undefined,
    whatif:   'what-if-tab',
    builder:  'builder-tab',
  };

  return (
    <div className="lab-wrap">

      {/* PR 1 — First-run tour: lab phase (steps 3–6) */}
      <AtlasTour
        context="lab"
        run={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />

      {/* ── Branded header ─────────────────────────────────────────────────── */}
      <header className="lab-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-title">
          <div className="lab-brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lab-h1">System Lab</h1>
          <p className="lab-subtitle">Compare heating systems using real operating constraints.</p>
        </div>

        {/* PR 5 — Condensing efficiency indicator (null = no engine result in standalone lab) */}
        <CondensingIndicator condensingState={null} />

        {/* PR 1 — Replay tour action */}
        <button
          className="tour-replay-link"
          onClick={() => {
            resetAtlasTourSeen();
            setReplayTour(true);
          }}
          aria-label="Replay the Atlas tour"
        >
          ? Tour
        </button>
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

      {/* PR 1 — Export buttons (tour target) */}
      {/* ── Print views ────────────────────────────────────────────────────── */}
      <div id="export-buttons" data-tour="export-actions" className="lab-print-nav" aria-label="Print views">
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
      <div className="lab-tabs" role="tablist" aria-label="Lab views" data-tour="system-lab-tabs">
        {(Object.keys(TAB_LABELS) as LabTab[]).map(tab => (
          <button
            key={tab}
            id={TAB_IDS[tab]}
            data-tour={TAB_TOUR_ATTRS[tab]}
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
        {activeTab === 'visual'   && <VisualTab />}
        {activeTab === 'summary'  && <SummaryTab />}
        {activeTab === 'whatif'   && <WhatIfLab />}
        {activeTab === 'builder'  && <SystemBuilder />}
      </div>

    </div>
  );
}
