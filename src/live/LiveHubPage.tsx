/**
 * LiveHubPage — iPad-first live output control room.
 *
 * Replaces Step 8 as the primary results surface. Displays a sticky verdict
 * strip at the top and a tile grid that routes to individual section pages.
 *
 * Layout:
 *  - 2-column grid in portrait
 *  - 3-column grid in landscape
 *  - Large tiles (min 160px height) with generous tap targets (≥ 56px)
 */
import { useState } from 'react';
import type { FullEngineResult } from '../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import LiveSectionPage from './LiveSectionPage';
import VerdictStrip from '../components/live/VerdictStrip';
import './LiveHubPage.css';

export type LiveSection =
  | 'current'
  | 'water'
  | 'usage'
  | 'evidence'
  | 'constraints'
  | 'chemistry'
  | 'glassbox';

interface Props {
  result: FullEngineResult;
  input: FullSurveyModelV1;
  onBack: () => void;
}

/** Derive a status chip value from engine output for each section. */
function sectionStatus(
  section: LiveSection,
  result: FullEngineResult,
): 'ok' | 'watch' | 'missing' {
  const { engineOutput } = result;
  switch (section) {
    case 'current': {
      const hasRejected = engineOutput.eligibility.some(e => e.status === 'rejected');
      const hasCaution = engineOutput.eligibility.some(e => e.status === 'caution');
      return hasRejected ? 'watch' : hasCaution ? 'watch' : 'ok';
    }
    case 'water': {
      const combiRisk = result.combiDhwV1.verdict.combiRisk;
      return combiRisk === 'fail' ? 'watch' : combiRisk === 'warn' ? 'watch' : 'ok';
    }
    case 'usage': {
      const storedRisk = result.storedDhwV1.verdict.storedRisk;
      return storedRisk === 'warn' ? 'watch' : 'ok';
    }
    case 'evidence': {
      if (!engineOutput.evidence || engineOutput.evidence.length === 0) return 'missing';
      const hasLow = engineOutput.evidence.some(e => e.confidence === 'low');
      return hasLow ? 'watch' : 'ok';
    }
    case 'constraints': {
      if (!engineOutput.limiters) return 'missing';
      const hasFail = engineOutput.limiters.limiters.some(l => l.severity === 'fail');
      return hasFail ? 'watch' : 'ok';
    }
    case 'chemistry': {
      const decay = result.normalizer.tenYearEfficiencyDecayPct;
      return decay > 8 ? 'watch' : 'ok';
    }
    case 'glassbox':
      return 'ok';
  }
}

const TILE_CONFIG: Array<{
  id: LiveSection;
  icon: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'current',
    icon: '🏠',
    title: 'Current System',
    subtitle: 'Situation summary & transition architecture',
  },
  {
    id: 'water',
    icon: '💧',
    title: 'Water Power',
    subtitle: 'DHW flow capacity & concurrency analysis',
  },
  {
    id: 'usage',
    icon: '👥',
    title: 'Usage Model',
    subtitle: 'Daily demand, peak draw & sizing verdict',
  },
  {
    id: 'evidence',
    icon: '🔬',
    title: 'Evidence',
    subtitle: 'What the engine knows and how confident it is',
  },
  {
    id: 'constraints',
    icon: '⚖️',
    title: 'Constraints',
    subtitle: 'Physics limiters — observed vs allowed',
  },
  {
    id: 'chemistry',
    icon: '🧪',
    title: 'Chemistry',
    subtitle: 'Geochemical analysis — scale & silicate tax',
  },
  {
    id: 'glassbox',
    icon: '🔭',
    title: 'Glass Box',
    subtitle: 'Full physics trace & raw calculation detail',
  },
];

const STATUS_LABEL: Record<'ok' | 'watch' | 'missing', string> = {
  ok: 'OK',
  watch: 'Watch',
  missing: 'Missing',
};

export default function LiveHubPage({ result, input, onBack }: Props) {
  const [activeSection, setActiveSection] = useState<LiveSection | null>(null);

  const { engineOutput } = result;

  if (activeSection) {
    return (
      <LiveSectionPage
        section={activeSection}
        result={result}
        input={input}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  return (
    <div className="live-hub">
      {/* ── Sticky verdict strip ─────────────────────────────────────── */}
      <div className="live-hub__verdict-strip">
        <div className="live-hub__verdict-strip-inner">
          <button
            className="live-hub__back-btn"
            onClick={onBack}
            aria-label="Back to survey"
          >
            ← Back
          </button>
          <div className="live-hub__verdict-chips">
            <VerdictStrip result={result} />
            <div className="live-hub__verdict-chip live-hub__verdict-chip--recommendation">
              <span className="live-hub__verdict-label">Recommendation</span>
              <span className="live-hub__verdict-value live-hub__verdict-value--recommendation">
                {engineOutput.recommendation.primary}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hub title ────────────────────────────────────────────────── */}
      <div className="live-hub__header">
        <h1 className="live-hub__title">📡 Live Output Hub</h1>
        <p className="live-hub__subtitle">
          Physics-driven results for this home. Tap a panel to inspect the detail.
        </p>
      </div>

      {/* ── Tile grid ────────────────────────────────────────────────── */}
      <div className="live-hub__grid">
        {TILE_CONFIG.map(tile => {
          const status = sectionStatus(tile.id, result);
          return (
            <button
              key={tile.id}
              className={`live-hub__tile live-hub__tile--${status}`}
              onClick={() => setActiveSection(tile.id)}
            >
              <div className="live-hub__tile-icon">{tile.icon}</div>
              <div className="live-hub__tile-title">{tile.title}</div>
              <div className="live-hub__tile-subtitle">{tile.subtitle}</div>
              <div className={`live-hub__tile-chip live-hub__tile-chip--${status}`}>
                {STATUS_LABEL[status]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
