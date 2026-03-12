/**
 * BehaviourConsolePage.tsx
 *
 * Behaviour Console layout — a single-page presentation of the engine output
 * that replaces the scattered charts with a unified, timeline-first view.
 *
 * Panel order (as specified):
 *   1. PrimaryVerdictPanel
 *   2. BehaviourTimelinePanel
 *   3. LimitersPanel
 *   4. InfluenceBlocks
 *   5. EngineerDetails (collapsible, engineer mode only)
 *
 * Entry: render <BehaviourConsolePage output={engineOutput} /> whenever
 * ?console=1 is in the URL (or when the console feature flag is set).
 *
 * All panels reference the shared `verdict` object — they must never
 * re-derive the verdict from raw engine output.
 */
import { useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import PrimaryVerdictPanel from './PrimaryVerdictPanel';
import BehaviourTimelinePanel from './BehaviourTimelinePanel';
import ConstraintsGrid from '../../ui/panels/ConstraintsGrid';
import InfluenceBlocks from './InfluenceBlocks';
import EngineerDetails from './EngineerDetails';

interface Props {
  output: EngineOutputV1;
  onBack?: () => void;
}

type Mode = 'customer' | 'engineer';

export default function BehaviourConsolePage({ output, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('customer');

  const { verdict, behaviourTimeline, limiters, influenceSummary } = output;

  return (
    <div className="bcp-page">
      {/* Header */}
      <div className="bcp-header">
        <div className="bcp-header__left">
          {onBack && (
            <button className="bcp-back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          <h1 className="bcp-header__title">Behaviour Console</h1>
        </div>

        {/* Customer / Engineer mode toggle */}
        <div className="bcp-mode-toggle">
          {(['customer', 'engineer'] as const).map(m => (
            <button
              key={m}
              className={`bcp-mode-toggle__btn${mode === m ? ' bcp-mode-toggle__btn--active' : ''}`}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Primary Verdict */}
      {verdict ? (
        <PrimaryVerdictPanel verdict={verdict} />
      ) : (
        <div className="bcp-rec-callout">
          <strong>Recommendation:</strong> {output.recommendation.primary}
        </div>
      )}

      {/* 2. Behaviour Timeline */}
      {behaviourTimeline ? (
        <BehaviourTimelinePanel timeline={behaviourTimeline} />
      ) : (
        <div className="bcp-placeholder">
          ⚠ Behaviour timeline not available — provide lifestyle and heat-loss data for a full simulation.
        </div>
      )}

      {/* 3. Constraints Grid (replaces pass/fail tiles — shows observed vs limit + fixes) */}
      {limiters ? (
        <ConstraintsGrid limiters={limiters} />
      ) : (
        <div className="bcp-placeholder" style={{ textAlign: 'left' }}>
          No limiter data available.
        </div>
      )}

      {/* 4. Influence blocks */}
      {influenceSummary ? (
        <InfluenceBlocks summary={influenceSummary} />
      ) : null}

      {/* 5. Engineer details (collapsed by default, only in engineer mode) */}
      {mode === 'engineer' && <EngineerDetails output={output} />}
    </div>
  );
}

