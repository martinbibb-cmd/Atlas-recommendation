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
    <div
      className="behaviour-console-page"
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '16px 16px 40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#4a5568',
              }}
            >
              ← Back
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: 22, color: '#2d3748' }}>Behaviour Console</h1>
        </div>

        {/* Customer / Engineer mode toggle */}
        <div
          style={{
            display: 'flex',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {(['customer', 'engineer'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? '#2d3748' : '#fff',
                color: mode === m ? '#fff' : '#4a5568',
                border: 'none',
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: mode === m ? 700 : 400,
                transition: 'background 0.15s',
              }}
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
        <div
          style={{
            background: '#ebf8ff',
            border: '1px solid #90cdf4',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 20,
            fontSize: 14,
            color: '#2b6cb0',
          }}
        >
          <strong>Recommendation:</strong> {output.recommendation.primary}
        </div>
      )}

      {/* 2. Behaviour Timeline */}
      {behaviourTimeline ? (
        <BehaviourTimelinePanel timeline={behaviourTimeline} />
      ) : (
        <div
          style={{
            background: '#f7fafc',
            border: '1px dashed #cbd5e0',
            borderRadius: 10,
            padding: '20px',
            textAlign: 'center',
            color: '#718096',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          ⚠ Behaviour timeline not available — provide lifestyle and heat-loss data for a full simulation.
        </div>
      )}

      {/* 3. Constraints Grid (replaces pass/fail tiles — shows observed vs limit + fixes) */}
      {limiters ? (
        <ConstraintsGrid limiters={limiters} />
      ) : (
        <div
          style={{
            background: '#f7fafc',
            border: '1px dashed #cbd5e0',
            borderRadius: 10,
            padding: '14px 18px',
            color: '#718096',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
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
