import { useState } from 'react';
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
import HouseSimulatorCanvas from './HouseSimulatorCanvas';
import { resetAtlasTourSeen } from '../../lib/tourStorage';
import {
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab.css';

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

/** Engineering detail panel shown in the right slide-over. */
function EngineeringPanel() {
  return (
    <div className="lab-engineering-panel">
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

      <hr style={{ margin: '1.25rem 0', borderColor: '#e2e8f0' }} />

      {/* Full draw-off workbench remains accessible here for detailed inspection */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.65rem' }}>
          Draw-off workbench
        </p>
        <DrawOffWorkbench />
      </div>
    </div>
  );
}

export default function LabShell({ onHome, engineInput }: Props) {
  const [replayTour, setReplayTour]       = useState(false);
  const [leftOpen, setLeftOpen]           = useState(false);
  const [rightOpen, setRightOpen]         = useState(false);
  const [topSheetOpen, setTopSheetOpen]   = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(true);

  return (
    <div className="lab-wrap lab-wrap--house-first">
      <AtlasTour
        context="lab"
        run={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="lab-house-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-house-title">
          <h1 className="lab-h1">System Simulator</h1>
          <p className="lab-subtitle">House-first · draw-off behaviour · live system response</p>
        </div>
        <div className="lab-house-header-actions">
          <button
            className="lab-house-action"
            onClick={() => { setLeftOpen(v => !v); setRightOpen(false); }}
            aria-expanded={leftOpen}
            aria-label="Open setup panel"
          >
            ⚙ Setup
          </button>
          <button
            className="lab-house-action"
            onClick={() => { setRightOpen(v => !v); setLeftOpen(false); }}
            aria-expanded={rightOpen}
            aria-label="Open engineering detail panel"
          >
            🔧 Engineering
          </button>
          <button
            className="lab-house-action"
            onClick={() => setTopSheetOpen(v => !v)}
            aria-expanded={topSheetOpen}
            aria-label="Open warnings and explainers"
          >
            ⚠ Warnings
          </button>
          <button
            className="tour-replay-link"
            onClick={() => { resetAtlasTourSeen(); setReplayTour(true); }}
            aria-label="Replay the guided tour"
          >
            ? Tour
          </button>
        </div>
      </header>

      {/* ── Toast narration ──────────────────────────────────────────────────── */}
      <div className="lab-house-toast" role="status" aria-live="polite">
        <strong>{PLACEHOLDER_VERDICT.system}</strong>
        <span>{PLACEHOLDER_VERDICT.note}</span>
      </div>

      {/* ── Context strip ────────────────────────────────────────────────────── */}
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

      {/* ── House-first simulator stage ───────────────────────────────────────── */}
      <section className="lab-house-stage" aria-label="House-first simulator surface">
        {/* Roof-side widgets */}
        <aside className="lab-roof-widget lab-roof-widget--left" aria-label="Heat source status">
          <span className="lab-roof-widget__label">Heat source</span>
          <strong className="lab-roof-widget__value">
            {engineInput?.currentHeatSourceType
              ? SYSTEM_TYPE_LABELS[engineInput.currentHeatSourceType] ?? PLACEHOLDER_CURRENT_SYSTEM
              : PLACEHOLDER_CURRENT_SYSTEM}
          </strong>
          <p className="lab-roof-widget__note">Outlet chips show live temperature and flow beside each active draw.</p>
        </aside>
        <aside className="lab-roof-widget lab-roof-widget--right" aria-label="Efficiency status">
          <span className="lab-roof-widget__label">Efficiency</span>
          <CondensingIndicator condensingState={null} />
        </aside>

        {/* Central house canvas — primary interaction surface */}
        <div className="lab-house-canvas" id="visual-tab" data-tour="visual-tab">
          <HouseSimulatorCanvas />
        </div>
      </section>

      {/* ── Warnings / explainers top sheet ──────────────────────────────────── */}
      {topSheetOpen && (
        <section className="lab-top-sheet" role="region" aria-label="Warnings and explainers">
          <div className="lab-top-sheet__header">
            <h2>Warnings and explainers</h2>
            <button className="lab-house-action" onClick={() => setTopSheetOpen(false)}>Close</button>
          </div>
          <ExplainerPanel />
        </section>
      )}

      {/* ── Setup slide-over (left) ───────────────────────────────────────────── */}
      {leftOpen && (
        <aside className="lab-slide-over lab-slide-over--left" role="region" aria-label="Setup and configuration">
          <div className="lab-slide-over__header">
            <h2>Setup and configuration</h2>
            <button className="lab-house-action" onClick={() => setLeftOpen(false)}>Close</button>
          </div>
          <WhatIfLab />
        </aside>
      )}

      {/* ── Engineering slide-over (right) ───────────────────────────────────── */}
      {rightOpen && (
        <aside
          className="lab-slide-over lab-slide-over--right"
          role="region"
          aria-label="Engineering and efficiency detail"
          id="system-lab-tab"
          data-tour="system-lab-tab"
        >
          <div className="lab-slide-over__header">
            <h2>Engineering and efficiency detail</h2>
            <button className="lab-house-action" onClick={() => setRightOpen(false)}>Close</button>
          </div>
          <EngineeringPanel />
        </aside>
      )}

      {/* ── Timeline / scenarios bottom sheet ────────────────────────────────── */}
      <section
        className={`lab-bottom-sheet${bottomSheetOpen ? ' lab-bottom-sheet--open' : ''}`}
        aria-label="Timeline and scenarios"
      >
        <div className="lab-bottom-sheet__header">
          <h2>Timeline and scenarios</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div id="export-buttons" data-tour="export-actions" className="lab-print-nav" style={{ margin: 0, border: 'none', background: 'none', padding: 0 }} aria-label="Demo print views">
              <a className="lab-print-nav__link" href="?print=technical"  target="_blank" rel="noopener noreferrer" aria-label="Open engineering detail demo print view">Engineering Detail</a>
              <a className="lab-print-nav__link" href="?print=comparison" target="_blank" rel="noopener noreferrer" aria-label="Open technical comparison demo print view">Comparison</a>
            </div>
            <button className="lab-house-action" onClick={() => setBottomSheetOpen(v => !v)}>
              {bottomSheetOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
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
