/**
 * QuadrantDashboardPage.tsx
 *
 * PR8a — 4-quadrant visual dashboard for the first presentation page.
 *
 * Layout: fixed 2 × 2 grid (no scrolling on iPad).
 * Each tile is tappable to expand an inline detail panel.
 *
 * Quadrant content:
 *   Your House    — perimeter snapshot · house type · heat loss · solar hint
 *   Your Home     — demand profile · daily litres · peak outlets
 *   Your System   — current system type · age badge · strengths / weaknesses
 *   Your Priorities — priority chips
 *
 * Rules:
 *   - No Math.random()
 *   - All strings sourced from canonical model signals or PrioritiesState
 *   - shellSnapshotUrl shown when available; heat-particles fallback otherwise
 */

import { useState } from 'react';
import type { HouseSignal, HomeSignal, CurrentSystemSignal } from './buildCanonicalPresentation';
import type { HeatLossState } from '../../features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState, PriorityKey } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';
import PresentationVisualSlot from './PresentationVisualSlot';
import { resolveCurrentSystemVisualId } from './presentationVisualMapping';
import './QuadrantDashboardPage.css';

// ─── House quadrant ───────────────────────────────────────────────────────────

function HouseQuadrant({
  house,
  heatLossState,
  expanded,
  onToggle,
}: {
  house: HouseSignal;
  heatLossState?: HeatLossState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const snapshot = heatLossState?.shellSnapshotUrl;
  const roofOrientation = heatLossState?.roofOrientation;
  const solarHint = house.pvPotentialLabel;

  return (
    <button
      type="button"
      className={`qdp-quadrant qdp-quadrant--house${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label="Your House — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🏠</span>
        <span className="qdp-quadrant__title">Your House</span>
        <span className="qdp-quadrant__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Visual: perimeter snapshot if available, heat-particles fallback */}
      <div className="qdp-quadrant__visual">
        {snapshot ? (
          <img
            src={snapshot}
            alt="House perimeter sketch"
            className="qdp-quadrant__snapshot"
          />
        ) : (
          <PresentationVisualSlot
            visualId="heat_particles"
            visualData={{ wallType: house.wallTypeKey }}
            hideExplainer
          />
        )}
      </div>

      {/* Summary row */}
      <div className="qdp-quadrant__summary">
        <span className="qdp-quadrant__badge">{house.heatLossLabel}</span>
        {roofOrientation && roofOrientation !== 'unknown' && (
          <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">
            Roof {roofOrientation}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="House details">
          <p className="qdp-detail__row"><strong>Heat loss:</strong> {house.heatLossLabel} — {house.heatLossBand}</p>
          <p className="qdp-detail__row"><strong>Walls:</strong> {house.wallTypeLabel}</p>
          <p className="qdp-detail__row"><strong>Insulation:</strong> {house.insulationLabel}</p>
          {solarHint && <p className="qdp-detail__row"><strong>Solar:</strong> {solarHint}</p>}
          {house.notes.map((note, i) => (
            <p key={i} className="qdp-detail__note">{note}</p>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Home quadrant ────────────────────────────────────────────────────────────

function HomeQuadrant({
  home,
  expanded,
  onToggle,
}: {
  home: HomeSignal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const outletsActive = Math.max(1, Math.min(home.peakSimultaneousOutlets, 3)) as 1 | 2 | 3;

  return (
    <button
      type="button"
      className={`qdp-quadrant qdp-quadrant--home${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label="Your Home — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">👥</span>
        <span className="qdp-quadrant__title">Your Home</span>
        <span className="qdp-quadrant__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="qdp-quadrant__visual">
        <PresentationVisualSlot
          visualId="flow_split"
          visualData={{ outletsActive }}
          hideExplainer
        />
      </div>

      <div className="qdp-quadrant__summary">
        <span className="qdp-quadrant__badge">{home.demandProfileLabel}</span>
      </div>

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="Home details">
          <p className="qdp-detail__row"><strong>Daily hot water:</strong> {home.dailyHotWaterLabel}</p>
          <p className="qdp-detail__row"><strong>Peak outlets:</strong> {home.peakOutletsLabel}</p>
          <p className="qdp-detail__row"><strong>Bath use:</strong> {home.bathUseIntensityLabel}</p>
          <p className="qdp-detail__row"><strong>Occupancy timing:</strong> {home.occupancyTimingLabel}</p>
          <p className="qdp-detail__row"><strong>Storage benefit:</strong> {home.storageBenefitLabel}</p>
          {home.narrativeSignals.map((sig, i) => (
            <p key={i} className="qdp-detail__note">{sig}</p>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── System quadrant ──────────────────────────────────────────────────────────

function SystemQuadrant({
  sys,
  expanded,
  onToggle,
}: {
  sys: CurrentSystemSignal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const visualId = resolveCurrentSystemVisualId(sys.dhwArchitecture);

  return (
    <button
      type="button"
      className={`qdp-quadrant qdp-quadrant--system${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label="Your System — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🔧</span>
        <span className="qdp-quadrant__title">Your System</span>
        <span className="qdp-quadrant__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="qdp-quadrant__visual">
        {visualId === 'thermal_store' ? (
          <PresentationVisualSlot visualId="thermal_store" visualData={{ flowTempBand: 'high' }} hideExplainer />
        ) : visualId === 'cylinder_charge_mixergy' ? (
          <PresentationVisualSlot visualId="cylinder_charge_mixergy" hideExplainer />
        ) : visualId === 'cylinder_charge_standard' ? (
          <PresentationVisualSlot visualId="cylinder_charge_standard" hideExplainer />
        ) : (
          <PresentationVisualSlot visualId="driving_style" visualData={{ mode: sys.drivingStyleMode }} hideExplainer />
        )}
      </div>

      <div className="qdp-quadrant__summary">
        <span className="qdp-quadrant__badge">{sys.systemTypeLabel}</span>
        <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">{sys.ageLabel}</span>
      </div>

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="System details">
          <p className="qdp-detail__row"><strong>Type:</strong> {sys.systemTypeLabel}</p>
          <p className="qdp-detail__row"><strong>Age:</strong> {sys.ageLabel}</p>
          <p className="qdp-detail__row qdp-detail__row--muted">{sys.ageContext}</p>
          {sys.makeModelText && (
            <p className="qdp-detail__row"><strong>Make / model:</strong> {sys.makeModelText}</p>
          )}
          {sys.outputLabel && (
            <p className="qdp-detail__row"><strong>Output:</strong> {sys.outputLabel}</p>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Priorities quadrant ──────────────────────────────────────────────────────

/** Label map for priority keys (used as fallback when meta lookup fails). */
const PRIORITY_LABEL: Record<PriorityKey, string> = Object.fromEntries(
  PRIORITY_META.map(m => [m.key, `${m.emoji} ${m.label}`])
) as Record<PriorityKey, string>;

function PrioritiesQuadrant({
  prioritiesState,
  expanded,
  onToggle,
}: {
  prioritiesState?: PrioritiesState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const selected = prioritiesState?.selected ?? [];

  return (
    <button
      type="button"
      className={`qdp-quadrant qdp-quadrant--priorities${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label="Your Priorities — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🎯</span>
        <span className="qdp-quadrant__title">Your Priorities</span>
        <span className="qdp-quadrant__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="qdp-quadrant__chips">
        {selected.length > 0 ? (
          selected.map(key => (
            <span key={key} className="qdp-chip">
              {PRIORITY_LABEL[key] ?? key}
            </span>
          ))
        ) : (
          <span className="qdp-chip qdp-chip--empty">No priorities selected yet</span>
        )}
      </div>

      {expanded && selected.length > 0 && (
        <div className="qdp-quadrant__detail" role="region" aria-label="Priority details">
          {PRIORITY_META.filter(m => selected.includes(m.key)).map(m => (
            <p key={m.key} className="qdp-detail__priority-row">
              <span className="qdp-detail__priority-label">{m.emoji} {m.label}</span>
              <span className="qdp-detail__priority-sub">{m.sub}</span>
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface QuadrantDashboardPageProps {
  house: HouseSignal;
  home: HomeSignal;
  currentSystem: CurrentSystemSignal;
  heatLossState?: HeatLossState;
  prioritiesState?: PrioritiesState;
}

type QuadrantId = 'house' | 'home' | 'system' | 'priorities';

/**
 * QuadrantDashboardPage
 *
 * Fixed 2×2 grid of tappable tiles. Tapping a tile expands its inline
 * detail panel. Only one tile can be expanded at a time.
 */
export default function QuadrantDashboardPage({
  house,
  home,
  currentSystem,
  heatLossState,
  prioritiesState,
}: QuadrantDashboardPageProps) {
  const [expanded, setExpanded] = useState<QuadrantId | null>(null);

  function toggle(id: QuadrantId) {
    setExpanded(prev => (prev === id ? null : id));
  }

  return (
    <div
      className="qdp"
      data-testid="quadrant-dashboard-page"
      aria-label="Summary dashboard — Your House, Home, System and Priorities"
    >
      <HouseQuadrant
        house={house}
        heatLossState={heatLossState}
        expanded={expanded === 'house'}
        onToggle={() => toggle('house')}
      />
      <HomeQuadrant
        home={home}
        expanded={expanded === 'home'}
        onToggle={() => toggle('home')}
      />
      <SystemQuadrant
        sys={currentSystem}
        expanded={expanded === 'system'}
        onToggle={() => toggle('system')}
      />
      <PrioritiesQuadrant
        prioritiesState={prioritiesState}
        expanded={expanded === 'priorities'}
        onToggle={() => toggle('priorities')}
      />
    </div>
  );
}
