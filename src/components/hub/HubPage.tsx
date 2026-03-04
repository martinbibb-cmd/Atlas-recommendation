/**
 * HubPage — iPad-first "Control Room" shell.
 *
 * Renders a tile menu of available panels. When a tile is selected,
 * the corresponding panel is shown in full-page view with a Back button.
 *
 * Currently implements "Physics constraints"; other tiles are placeholders.
 */
import { useState } from 'react';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import PhysicsConstraintsPanel from './panels/PhysicsConstraintsPanel';
import ExplainersHubPage from '../../explainers/ExplainersHubPage';

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelId = 'physics_constraints' | 'system_sizing' | 'hydraulic_limits' | 'explainers';

interface HubTile {
  id: PanelId;
  icon: string;
  title: string;
  subtitle: string;
  available: boolean;
}

const HUB_TILES: HubTile[] = [
  {
    id: 'physics_constraints',
    icon: '💧',
    title: 'Physics constraints',
    subtitle: 'Limits that cap performance',
    available: true,
  },
  {
    id: 'system_sizing',
    icon: '📐',
    title: 'System sizing',
    subtitle: 'Boiler output vs heat loss',
    available: false,
  },
  {
    id: 'hydraulic_limits',
    icon: '🔧',
    title: 'Hydraulic limits',
    subtitle: 'Pipe & pressure constraints',
    available: false,
  },
  {
    id: 'explainers',
    icon: '🧱',
    title: 'Demo Lab',
    subtitle: 'Physics explainers & sandbox',
    available: true,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface HubPageProps {
  result: FullEngineResult;
  input: EngineInputV2_3;
  onBack?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HubPage({ result, input, onBack }: HubPageProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  if (activePanel === 'physics_constraints') {
    return (
      <div className="hub-page">
        <div className="hub-page__header">
          <button className="hub-back-btn" onClick={() => setActivePanel(null)}>
            ← Back to Hub
          </button>
          <h2 className="hub-page__panel-title">Physics constraints</h2>
        </div>
        <PhysicsConstraintsPanel result={result} input={input} onBack={() => setActivePanel(null)} />
      </div>
    );
  }

  if (activePanel === 'explainers') {
    return <ExplainersHubPage onBack={() => setActivePanel(null)} />;
  }

  return (
    <div className="hub-page">
      <div className="hub-page__header">
        {onBack && (
          <button className="hub-back-btn" onClick={onBack}>
            ← Back
          </button>
        )}
        <div>
          <h1 className="hub-page__title">Control Room</h1>
          <p className="hub-page__subtitle">Physics-driven analysis panels</p>
        </div>
      </div>

      <div className="hub-tile-grid">
        {HUB_TILES.map(tile => (
          <button
            key={tile.id}
            className={`hub-tile${tile.available ? '' : ' hub-tile--disabled'}`}
            onClick={() => tile.available && setActivePanel(tile.id)}
            disabled={!tile.available}
            aria-disabled={!tile.available}
          >
            <span className="hub-tile__icon">{tile.icon}</span>
            <span className="hub-tile__title">{tile.title}</span>
            <span className="hub-tile__subtitle">{tile.subtitle}</span>
            {!tile.available && <span className="hub-tile__badge">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
