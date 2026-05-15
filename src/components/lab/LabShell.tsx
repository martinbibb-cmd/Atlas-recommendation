import { useState, useEffect } from 'react';
import WhatIfLab from '../explainers/WhatIfLab';
import ExplainerPanel from '../../explainers/educational/ExplainerPanel';
import LabHomeLink from './LabHomeLink';
import LabConfidenceStrip from './LabConfidenceStrip';
import DrawOffWorkbench from './DrawOffWorkbench';
import CondensingIndicator from './CondensingIndicator';
import ConfidenceScoreBar from './ConfidenceScoreBar';
import PerformanceEnablersPanel from '../performance/PerformanceEnablersPanel';
import CondensingRuntimePanel from '../summary/CondensingRuntimePanel';
import AtlasTour from '../tour/AtlasTour';
import { resetAtlasTourSeen } from '../../lib/tourStorage';
import {
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab.css';

type LabTab = 'visual' | 'summary' | 'whatif' | 'explainers';

interface Props {
  onHome: () => void;
  engineInput?: import('../../engine/schema/EngineInputV2_3').EngineInputV2_3;
}

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  combi: 'Gas Combi',
  system: 'Gas System + Cylinder',
  regular: 'Regular Boiler',
  ashp: 'Heat Pump',
  other: 'Other system',
};

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

      <div className="lab-summary__enablers">
        <PerformanceEnablersPanel />
      </div>

      <div className="lab-summary__enablers">
        <CondensingRuntimePanel condensingRuntime={null} condensingState={null} />
      </div>
    </div>
  );
}

const VISUAL_DEMO_KEY = 'atlasVisualDemoSeen';

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
            <strong>Live narration</strong> — select a system profile to inspect heating behaviour and on-demand hot water response.
          </span>
          <button
            className="lab-visual-tab__intro-dismiss"
            onClick={() => {
              localStorage.setItem(VISUAL_DEMO_KEY, 'true');
              setShowIntro(false);
            }}
            aria-label="Dismiss live narration intro"
          >
            ×
          </button>
        </div>
      )}
      <DrawOffWorkbench />
    </div>
  );
}

export default function LabShell({ onHome, engineInput }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('visual');
  const [replayTour, setReplayTour] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [topSheetOpen, setTopSheetOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(true);

  const TAB_LABELS: Record<LabTab, string> = {
    visual: 'Behaviour Preview',
    summary: 'Summary',
    whatif: 'What if…?',
    explainers: 'Physics Explainers',
  };

  const TAB_IDS: Record<LabTab, string | undefined> = {
    visual: 'visual-tab',
    summary: 'system-lab-tab',
    whatif: 'what-if-tab',
    explainers: 'explainers-tab',
  };

  const TAB_TOUR_ATTRS: Record<LabTab, string | undefined> = {
    visual: 'visual-tab',
    summary: undefined,
    whatif: 'what-if-tab',
    explainers: undefined,
  };

  const selectTab = (tab: LabTab) => {
    setActiveTab(tab);
    if (tab === 'visual') {
      setLeftOpen(false);
      setRightOpen(false);
      return;
    }
    if (tab === 'summary') {
      setRightOpen(true);
      setLeftOpen(false);
      return;
    }
    if (tab === 'whatif') {
      setLeftOpen(true);
      setRightOpen(false);
      return;
    }
    setTopSheetOpen(true);
  };

  return (
    <div className="lab-wrap lab-wrap--house-first">
      <AtlasTour
        context="lab"
        run={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />

      <header className="lab-house-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-house-title">
          <h1 className="lab-h1">System Simulator</h1>
          <p className="lab-subtitle">House-first interaction surface with live heating behaviour and system response.</p>
        </div>
        <div className="lab-house-header-actions">
          <button className="lab-house-action" onClick={() => setLeftOpen(v => !v)} aria-expanded={leftOpen}>
            Setup
          </button>
          <button className="lab-house-action" onClick={() => setRightOpen(v => !v)} aria-expanded={rightOpen}>
            Engineering
          </button>
          <button className="lab-house-action" onClick={() => setTopSheetOpen(v => !v)} aria-expanded={topSheetOpen}>
            Warnings
          </button>
          <button
            className="tour-replay-link"
            onClick={() => {
              resetAtlasTourSeen();
              setReplayTour(true);
            }}
            aria-label="Replay the guided tour"
          >
            ? Tour
          </button>
        </div>
      </header>

      <div className="lab-house-toast" role="status" aria-live="polite">
        <strong>{PLACEHOLDER_VERDICT.system}</strong>
        <span>{PLACEHOLDER_VERDICT.note}</span>
      </div>

      <div className="lab-context-row" aria-label="Comparison context">
        <span className="lab-context-label">Current:</span>
        <span className="lab-context-chip lab-context-chip--current">
          {engineInput?.currentHeatSourceType
            ? SYSTEM_TYPE_LABELS[engineInput.currentHeatSourceType] ?? PLACEHOLDER_CURRENT_SYSTEM
            : PLACEHOLDER_CURRENT_SYSTEM}
        </span>
        <span className="lab-context-label">Comparing:</span>
        {CANDIDATE_SYSTEMS.map(s => (
          <span key={s.id} className="lab-context-chip">{s.label}</span>
        ))}
        <ConfidenceScoreBar data={PLACEHOLDER_CONFIDENCE_STRIP} />
      </div>

      <div id="export-buttons" data-tour="export-actions" className="lab-print-nav" aria-label="Demo print views">
        <span className="lab-print-nav__label">Demo exports:</span>
        <a
          className="lab-print-nav__link"
          href="?print=technical"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open engineering detail demo print view"
        >
          Engineering Detail
        </a>
        <a
          className="lab-print-nav__link"
          href="?print=comparison"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open technical comparison demo print view"
        >
          Technical Comparison
        </a>
      </div>

      <div className="lab-tabs" role="tablist" aria-label="Lab views" data-tour="system-lab-tabs">
        {(Object.keys(TAB_LABELS) as LabTab[]).map(tab => (
          <button
            key={tab}
            id={TAB_IDS[tab]}
            data-tour={TAB_TOUR_ATTRS[tab]}
            role="tab"
            aria-selected={activeTab === tab}
            className={`lab-tab${activeTab === tab ? ' lab-tab--active' : ''}`}
            onClick={() => selectTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <section className="lab-house-stage" aria-label="House-first simulator surface">
        <aside className="lab-roof-widget lab-roof-widget--left" aria-label="Heat source status">
          <span className="lab-roof-widget__label">Heat source status</span>
          <strong className="lab-roof-widget__value">
            {engineInput?.currentHeatSourceType
              ? SYSTEM_TYPE_LABELS[engineInput.currentHeatSourceType] ?? PLACEHOLDER_CURRENT_SYSTEM
              : PLACEHOLDER_CURRENT_SYSTEM}
          </strong>
          <p className="lab-roof-widget__note">Live draw-off telemetry appears on outlet chips beside active draws.</p>
        </aside>

        <aside className="lab-roof-widget lab-roof-widget--right" aria-label="Efficiency status">
          <span className="lab-roof-widget__label">Efficiency</span>
          <CondensingIndicator condensingState={null} />
        </aside>

        <div className="lab-house-canvas">
          <VisualTab />
        </div>
      </section>

      {topSheetOpen && (
        <section className="lab-top-sheet" role="region" aria-label="Warnings and explainers">
          <div className="lab-top-sheet__header">
            <h2>Warnings and explainers</h2>
            <button className="lab-house-action" onClick={() => setTopSheetOpen(false)}>Close</button>
          </div>
          <LabConfidenceStrip data={PLACEHOLDER_CONFIDENCE_STRIP} />
          <ExplainerPanel />
        </section>
      )}

      {leftOpen && (
        <aside className="lab-slide-over lab-slide-over--left" role="region" aria-label="Setup and configuration">
          <div className="lab-slide-over__header">
            <h2>Setup and configuration</h2>
            <button className="lab-house-action" onClick={() => setLeftOpen(false)}>Close</button>
          </div>
          <WhatIfLab />
        </aside>
      )}

      {rightOpen && (
        <aside className="lab-slide-over lab-slide-over--right" role="region" aria-label="Engineering and efficiency detail">
          <div className="lab-slide-over__header">
            <h2>Engineering and efficiency detail</h2>
            <button className="lab-house-action" onClick={() => setRightOpen(false)}>Close</button>
          </div>
          <SummaryTab />
        </aside>
      )}

      <section className={`lab-bottom-sheet${bottomSheetOpen ? ' lab-bottom-sheet--open' : ''}`} aria-label="Timeline and scenarios">
        <div className="lab-bottom-sheet__header">
          <h2>Timeline and scenarios</h2>
          <button className="lab-house-action" onClick={() => setBottomSheetOpen(v => !v)}>
            {bottomSheetOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {bottomSheetOpen && (
          <div className="lab-bottom-sheet__body">
            <LabConfidenceStrip data={PLACEHOLDER_CONFIDENCE_STRIP} />
          </div>
        )}
      </section>
    </div>
  );
}
