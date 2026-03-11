import { useState } from 'react';
import ExplainersHubPage from '../../explainers/ExplainersHubPage';
import LabHomeLink from './LabHomeLink';
import LabConfidenceStrip from './LabConfidenceStrip';
import DrawOffWorkbench from './DrawOffWorkbench';
import {
  PLACEHOLDER_CURRENT_SYSTEM,
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_CONFIDENCE_STRIP,
  PLACEHOLDER_VERDICT,
  COMPARISON_HEADINGS,
  CANDIDATE_SYSTEMS,
} from './labSharedData';
import './lab.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabTab = 'summary' | 'physics' | 'visual';

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
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Visual tab ───────────────────────────────────────────────────────────────

function VisualTab() {
  return <DrawOffWorkbench />;
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function LabShell({ onHome }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('summary');

  const TAB_LABELS: Record<LabTab, string> = {
    summary: 'Summary',
    physics: 'Physics',
    visual:  'Visual',
  };

  return (
    <div className="lab-wrap">

      {/* ── Branded header ─────────────────────────────────────────────────── */}
      <header className="lab-header">
        <LabHomeLink onHome={onHome} />
        <div className="lab-title">
          <div className="lab-brand" aria-label="Atlas">ATLAS</div>
          <h1 className="lab-h1">System Lab</h1>
          <p className="lab-subtitle">Compare heating systems using real operating constraints.</p>
        </div>
      </header>

      {/* ── Context row ────────────────────────────────────────────────────── */}
      <div className="lab-context-row" aria-label="Comparison context">
        <span className="lab-context-label">Current:</span>
        <span className="lab-context-chip lab-context-chip--current">{PLACEHOLDER_CURRENT_SYSTEM}</span>
        <span className="lab-context-label">Comparing:</span>
        {CANDIDATE_SYSTEMS.map(s => (
          <span key={s.id} className="lab-context-chip">{s.label}</span>
        ))}
        <span className="lab-confidence-badge">Confidence: {PLACEHOLDER_CONFIDENCE}</span>
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

      {/* ── Print views ────────────────────────────────────────────────────── */}
      <div className="lab-print-nav" aria-label="Print views">
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
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'physics' && <ExplainersHubPage />}
        {activeTab === 'visual'  && <VisualTab />}
      </div>

    </div>
  );
}
