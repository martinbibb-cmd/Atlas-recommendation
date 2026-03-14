/**
 * AtlasExplorerPage.tsx
 *
 * Atlas System Explorer — main page.
 *
 * System selector at the top switches between all 6 system types.
 * Everything below responds: house diagram, hydraulic schematic,
 * heat source panel, timeline, physics console, footer strip.
 *
 * All assumptions that drive the displayed data are shown explicitly
 * in the AssumptionsBanner and are editable by the user.
 */

import { useState, useCallback } from 'react';
import HouseExplorer from './HouseExplorer';
import RoomPanel from './RoomPanel';
import SystemDiagram from './SystemDiagram';
import HeatSourcePanel from './HeatSourcePanel';
import BehaviourTimeline from './BehaviourTimeline';
import PhysicsConsole from './PhysicsConsole';
import SystemTypeSelector from './SystemTypeSelector';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';

import type { ExplorerSelection, ExplorerLayer, SystemTypeId, ExplorerAssumptions, ConstraintLabel } from './explorerTypes';
import { CONSTRAINT_LABEL_DISPLAY } from './explorerTypes';
import {
  DEMO_ROOMS,
  getSystemConfig,
  getRoomById,
  getEmitterById,
  getPhysicsForRoom,
  deriveAssumptions,
  deriveConstraintLabels,
} from './systemConfigs';

import './explorer.css';

// ── Assumptions banner ────────────────────────────────────────────────────────

const EMITTER_STATE_LABELS: Record<ExplorerAssumptions['emitterState'], string> = {
  existing:  'Existing',
  oversized: 'Oversized',
  upgraded:  'Upgraded',
};

const HP_FLOW_TEMPS = [35, 45, 55] as const;

/**
 * Displays all assumptions that drive the currently shown data.
 * Every field is visible; heat-pump assumptions are also editable.
 * Gas boiler assumptions are shown as read-only informational chips.
 */
function AssumptionsBanner({
  systemId,
  assumptions,
  constraintLabels,
  onAssumptionsChange,
}: {
  systemId: SystemTypeId;
  assumptions: ExplorerAssumptions;
  constraintLabels: ConstraintLabel[];
  onAssumptionsChange: (next: ExplorerAssumptions) => void;
}) {
  const cfg   = getSystemConfig(systemId);
  const isHP  = cfg.heatSource.isHeatPump;

  const CONSTRAINT_DISPLAY = CONSTRAINT_LABEL_DISPLAY;

  return (
    <div className="explorer-assumptions" aria-label="System assumptions">
      <span className="explorer-assumptions__label">Assumptions</span>

      {/* Flow temperature */}
      <div className="explorer-assumptions__group">
        <span className="explorer-assumptions__group-label">Flow temp</span>
        {isHP ? (
          <div className="explorer-assumptions__toggle" role="group" aria-label="Assumed flow temperature">
            {HP_FLOW_TEMPS.map(t => (
              <button
                key={t}
                className={`explorer-assumptions__toggle-btn ${assumptions.assumedFlowTempC === t ? 'explorer-assumptions__toggle-btn--active' : ''}`}
                onClick={() => {
                  const emitterState: ExplorerAssumptions['emitterState'] =
                    t <= 35 ? 'upgraded' : t <= 45 ? 'oversized' : 'existing';
                  onAssumptionsChange({ ...assumptions, assumedFlowTempC: t, emitterState });
                }}
                aria-pressed={assumptions.assumedFlowTempC === t}
              >
                {t}°C
              </button>
            ))}
          </div>
        ) : (
          <span className="explorer-assumptions__value" data-testid="assumed-flow-temp">
            {assumptions.assumedFlowTempC}°C
          </span>
        )}
      </div>

      {/* Emitter state */}
      <div className="explorer-assumptions__group">
        <span className="explorer-assumptions__group-label">Emitters</span>
        {isHP ? (
          <div className="explorer-assumptions__toggle" role="group" aria-label="Emitter upgrade state">
            {(['existing', 'oversized', 'upgraded'] as const).map(state => (
              <button
                key={state}
                className={`explorer-assumptions__toggle-btn ${assumptions.emitterState === state ? 'explorer-assumptions__toggle-btn--active' : ''}`}
                onClick={() => onAssumptionsChange({ ...assumptions, emitterState: state })}
                aria-pressed={assumptions.emitterState === state}
              >
                {EMITTER_STATE_LABELS[state]}
              </button>
            ))}
          </div>
        ) : (
          <span className="explorer-assumptions__value">
            {EMITTER_STATE_LABELS[assumptions.emitterState]}
          </span>
        )}
      </div>

      {/* Primary pipe */}
      <div className="explorer-assumptions__group">
        <span className="explorer-assumptions__group-label">Primary pipe</span>
        <span className="explorer-assumptions__value" data-testid="assumed-primary-pipe">
          {assumptions.primaryPipeMm}mm
        </span>
      </div>

      {/* Compensation — editable for HP */}
      {isHP && (
        <div className="explorer-assumptions__group">
          <span className="explorer-assumptions__group-label">Compensation</span>
          <div className="explorer-assumptions__toggle" role="group" aria-label="Compensation state">
            {([false, true] as const).map(on => (
              <button
                key={String(on)}
                className={`explorer-assumptions__toggle-btn ${assumptions.compensationEnabled === on ? 'explorer-assumptions__toggle-btn--active' : ''}`}
                onClick={() => onAssumptionsChange({ ...assumptions, compensationEnabled: on })}
                aria-pressed={assumptions.compensationEnabled === on}
              >
                {on ? 'On' : 'Off'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active constraint labels */}
      {constraintLabels.length > 0 && (
        <div className="explorer-assumptions__constraints" aria-label="Active constraints">
          {constraintLabels.map(label => (
            <span key={label} className="explorer-assumptions__constraint-tag">
              {CONSTRAINT_DISPLAY[label]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Layer breadcrumb ──────────────────────────────────────────────────────────

const LAYER_LABELS: Record<ExplorerLayer, string> = {
  house:      'House',
  room:       'Room',
  emitter:    'Emitter',
  hydraulic:  'Hydraulic path',
  heatSource: 'Heat source',
  physics:    'Physics engine',
};

function LayerBreadcrumb({ state, onNavigate }: {
  state: ExplorerSelection;
  onNavigate: (layer: ExplorerLayer) => void;
}) {
  const layers: ExplorerLayer[] = ['house', 'room', 'emitter', 'hydraulic', 'heatSource', 'physics'];
  const currentIdx = layers.indexOf(state.layer);

  return (
    <nav className="explorer-breadcrumb" aria-label="Explorer layers">
      {layers.slice(0, currentIdx + 1).map((layer, i) => (
        <span key={layer} className="explorer-breadcrumb__item">
          {i > 0 && <span className="explorer-breadcrumb__sep">›</span>}
          <button
            className={`explorer-breadcrumb__btn ${layer === state.layer ? 'explorer-breadcrumb__btn--active' : ''}`}
            onClick={() => onNavigate(layer)}
          >
            {LAYER_LABELS[layer]}
          </button>
        </span>
      ))}
      {currentIdx < layers.length - 1 && (
        <span className="explorer-breadcrumb__item explorer-breadcrumb__item--hint">
          <span className="explorer-breadcrumb__sep">›</span>
          <span className="explorer-breadcrumb__hint">{LAYER_LABELS[layers[currentIdx + 1]]}</span>
        </span>
      )}
    </nav>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusHeader({ state, systemId, liveLoad }: {
  state: ExplorerSelection; systemId: SystemTypeId; liveLoad: number;
}) {
  const cfg    = getSystemConfig(systemId);
  const roomId = 'roomId' in state ? state.roomId : undefined;
  const emitterId = 'emitterId' in state ? state.emitterId : undefined;
  const room   = roomId ? getRoomById(roomId) : null;
  const emitter = emitterId ? getEmitterById(systemId, emitterId) : null;
  const loadLabel = cfg.heatSource.isHeatPump ? 'HP output' : 'Boiler load';

  return (
    <div className="explorer-status">
      <div className="explorer-status__chip" style={{ borderColor: `${cfg.accentColor}30` }}>
        <span className="explorer-status__dot" style={{ background: cfg.accentColor }} />
        System: <strong>{cfg.shortLabel}</strong>
      </div>
      {room && (
        <div className="explorer-status__chip">
          <span className="explorer-status__dot explorer-status__dot--room" />
          Room: <strong>{room.label}</strong> · {room.designTemp}°C
        </div>
      )}
      {emitter && (
        <div className="explorer-status__chip">
          <span className="explorer-status__dot explorer-status__dot--emitter" />
          Emitter: <strong>{emitter.label}</strong> · {emitter.outputKw.toFixed(1)} kW
        </div>
      )}
      <div className="explorer-status__chip">
        <span className="explorer-status__dot explorer-status__dot--boiler" />
        {loadLabel}: <strong>{Math.round(liveLoad * 100)}%</strong>
      </div>
    </div>
  );
}

// ── Footer strip ──────────────────────────────────────────────────────────────

function FooterStrip({ systemId }: { systemId: SystemTypeId }) {
  const cfg     = getSystemConfig(systemId);
  const physics = cfg.physics;
  const hs      = cfg.heatSource;
  const isHP    = hs.isHeatPump;

  const totalLoss = physics.reduce((s, p) => s + p.heatLossKw, 0);
  const outputKw  = isHP ? (hs.ratedOutputKw ?? 7) : (hs.outputKw ?? 24);
  const condensing = !isHP && (hs.condensing ?? false);

  return (
    <div className="explorer-footer-strip">
      <div className="explorer-strip-item">
        <span className="explorer-strip-label">{isHP ? 'SPF' : 'Boiler efficiency'}</span>
        <span className={`explorer-strip-value ${isHP
          ? ((hs.spf ?? 0) >= 3 ? 'explorer-strip-value--success' : 'explorer-strip-value--warning')
          : ((hs.efficiencyPct ?? 0) >= DEFAULT_NOMINAL_EFFICIENCY_PCT ? 'explorer-strip-value--success' : 'explorer-strip-value--warning')
        }`}>
          {isHP ? `SPF ${hs.spf ?? '?'}` : `${hs.efficiencyPct ?? '?'}%`}
        </span>
      </div>
      <div className="explorer-strip-item">
        <span className="explorer-strip-label">Peak demand</span>
        <span className="explorer-strip-value">{totalLoss.toFixed(1)} kW</span>
      </div>
      <div className="explorer-strip-item">
        <span className="explorer-strip-label">{isHP ? 'HP sizing' : 'Boiler sizing'}</span>
        <span className="explorer-strip-value">
          {(outputKw / totalLoss).toFixed(1)}× peak
        </span>
      </div>
      <div className="explorer-strip-item">
        <span className="explorer-strip-label">{isHP ? 'Flow temp' : 'Return temp'}</span>
        <span className={`explorer-strip-value ${isHP
          ? (cfg.designFlowTempC <= 35 ? 'explorer-strip-value--success' : 'explorer-strip-value--warning')
          : ((hs.returnTempC ?? 99) < 55 ? 'explorer-strip-value--success' : 'explorer-strip-value--warning')
        }`}>
          {isHP ? `${cfg.designFlowTempC}°C` : `${hs.returnTempC ?? '?'}°C`}
        </span>
      </div>
      <div className="explorer-strip-item">
        <span className="explorer-strip-label">{isHP ? 'COP' : 'Condensing'}</span>
        <span className={`explorer-strip-value ${isHP
          ? ((hs.cop ?? 0) >= 3.0 ? 'explorer-strip-value--success' : 'explorer-strip-value--warning')
          : condensing ? 'explorer-strip-value--success' : 'explorer-strip-value--danger'
        }`}>
          {isHP ? (hs.cop ?? '?') : (condensing ? 'Yes' : 'No')}
        </span>
      </div>
      {cfg.cylinder && (
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">Cylinder</span>
          <span className={`explorer-strip-value ${cfg.cylinder.g3Required ? 'explorer-strip-value--warning' : 'explorer-strip-value--success'}`}>
            {cfg.cylinder.volumeLitres}L{cfg.cylinder.g3Required ? ' · G3' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function AtlasExplorerPage({ onBack }: Props) {
  const [selectedSystemId, setSelectedSystemId] = useState<SystemTypeId>('combi');
  const [explorerState, setExplorerState] = useState<ExplorerSelection>({ layer: 'house' });
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [liveLoad, setLiveLoad] = useState(0.58);

  const cfg = getSystemConfig(selectedSystemId);

  // ── Assumptions state — derived from system config, then user-editable ──────
  const [assumptions, setAssumptions] = useState<ExplorerAssumptions>(
    () => deriveAssumptions(cfg),
  );
  const constraintLabels = deriveConstraintLabels(cfg, assumptions);

  // ── System switch — reset explorer state and re-derive assumptions ──────────

  function handleSystemChange(id: SystemTypeId) {
    setSelectedSystemId(id);
    setExplorerState({ layer: 'house' });
    setTimelinePlaying(false);
    setLiveLoad(0.58);
    setAssumptions(deriveAssumptions(getSystemConfig(id)));
  }

  // ── Layer navigation ────────────────────────────────────────────────────────

  const setLayer = useCallback((layer: ExplorerLayer, id?: string) => {
    setExplorerState(prev => {
      if (layer === 'house') return { layer: 'house' };

      const prevRoomId = 'roomId' in prev ? prev.roomId : undefined;
      const prevEmitterId = 'emitterId' in prev ? prev.emitterId : undefined;

      if (layer === 'room' && id) return { layer: 'room', roomId: id };
      if (layer === 'emitter') {
        const emitterId = id ?? prevEmitterId;
        const roomId = prevRoomId;
        if (emitterId && roomId) return { layer: 'emitter', roomId, emitterId };
      }
      if (layer === 'hydraulic') {
        const emitterId = id ?? prevEmitterId;
        const roomId = prevRoomId;
        if (emitterId && roomId) {
          const emitter = cfg.emitters.find(e => e.id === emitterId);
          return { layer: 'hydraulic', roomId, emitterId, pipeIds: emitter?.pipeIds ?? [] };
        }
      }
      if (layer === 'heatSource') return { layer: 'heatSource', boilerId: 'primary' };
      if (layer === 'physics') return { layer: 'physics', roomId: prevRoomId };
      return prev;
    });
  }, [cfg.emitters]);

  function handleRoomClick(roomId: string) {
    setExplorerState({ layer: 'room', roomId });
  }

  function handleEmitterClick(emitterId: string) {
    const room = cfg.emitters.find(e => e.id === emitterId)
      ? DEMO_ROOMS.find(r => r.emitterId === emitterId)
      : null;
    setExplorerState(prev => {
      const prevRoomId = 'roomId' in prev ? prev.roomId : undefined;
      const roomId = room?.id ?? prevRoomId ?? '';
      return { layer: 'emitter', roomId, emitterId };
    });
  }

  function handleBreadcrumbNavigate(layer: ExplorerLayer) {
    if (layer === 'house') {
      setExplorerState({ layer: 'house' });
    } else {
      setLayer(layer);
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const selectedRoomId =
    'roomId' in explorerState ? explorerState.roomId : undefined;
  const selectedEmitterId =
    'emitterId' in explorerState ? explorerState.emitterId : undefined;

  const selectedRoom    = selectedRoomId ? getRoomById(selectedRoomId) : null;
  const selectedEmitter = selectedEmitterId
    ? getEmitterById(selectedSystemId, selectedEmitterId)
    : selectedRoom
    ? getEmitterById(selectedSystemId, selectedRoom.emitterId)
    : null;
  const selectedPhysics = selectedRoom ? getPhysicsForRoom(selectedSystemId, selectedRoom.id) : null;

  const showRoomPanel   = (explorerState.layer === 'room' || explorerState.layer === 'emitter') && !!selectedRoom;
  const showSourcePanel = explorerState.layer === 'heatSource';

  const diagramHighlight = {
    roomId:    selectedRoomId,
    emitterId: selectedEmitterId,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="explorer-page">
      {/* Page header */}
      <div className="explorer-page__header">
        <button className="explorer-page__back" onClick={onBack} aria-label="Back">← Back</button>
        <div className="explorer-page__title-block">
          <h1 className="explorer-page__title">
            <span className="explorer-page__brand">Atlas</span> System Explorer
          </h1>
          <p className="explorer-page__subtitle">
            Tap any room to reveal the heating system layer by layer
          </p>
        </div>
      </div>

      {/* System type selector */}
      <SystemTypeSelector selectedId={selectedSystemId} onChange={handleSystemChange} />

      {/* Assumptions banner — all assumptions visible, HP assumptions editable */}
      <AssumptionsBanner
        systemId={selectedSystemId}
        assumptions={assumptions}
        constraintLabels={constraintLabels}
        onAssumptionsChange={setAssumptions}
      />

      {/* Status bar */}
      <StatusHeader state={explorerState} systemId={selectedSystemId} liveLoad={liveLoad} />

      {/* Breadcrumb */}
      <LayerBreadcrumb state={explorerState} onNavigate={handleBreadcrumbNavigate} />

      {/* ── Hero: House + optional detail panel ─────────────────────── */}
      <div className="explorer-hero">
        <div className={`explorer-hero__house ${showRoomPanel || showSourcePanel ? 'explorer-hero__house--panel-open' : ''}`}>
          <HouseExplorer
            rooms={DEMO_ROOMS}
            systemConfig={cfg}
            selectedRoomId={selectedRoomId}
            onRoomClick={handleRoomClick}
          />
        </div>

        {/* Room panel */}
        <div className={`explorer-hero__panel ${showRoomPanel ? 'explorer-hero__panel--visible' : ''}`}
          aria-hidden={!showRoomPanel}>
          {showRoomPanel && selectedRoom && selectedEmitter && selectedPhysics && (
            <RoomPanel
              room={selectedRoom}
              emitter={selectedEmitter}
              physics={selectedPhysics}
              onEmitterClick={() => handleEmitterClick(selectedEmitter.id)}
              onClose={() => setLayer('house')}
            />
          )}
        </div>

        {/* Heat source panel */}
        <div className={`explorer-hero__panel ${showSourcePanel ? 'explorer-hero__panel--visible' : ''}`}
          aria-hidden={!showSourcePanel}>
          {showSourcePanel && (
            <HeatSourcePanel
              systemConfig={cfg}
              assumptions={assumptions}
              constraintLabels={constraintLabels}
              onClose={() => setLayer('house')}
            />
          )}
        </div>
      </div>

      {/* ── System diagram + Behaviour timeline ─────────────────────── */}
      <div className="explorer-mid">
        <div className="explorer-mid__diagram">
          <h2 className="explorer-section-title">System diagram</h2>
          <SystemDiagram
            rooms={DEMO_ROOMS}
            emitters={cfg.emitters}
            pipes={[]}
            systemConfig={cfg}
            highlight={diagramHighlight}
            onSourceClick={() => setLayer('heatSource')}
            onEmitterClick={handleEmitterClick}
            animating={timelinePlaying}
          />
        </div>

        <div className="explorer-mid__timeline">
          <BehaviourTimeline
            events={cfg.behaviourEvents}
            onLoadChange={(frac) => {
              setLiveLoad(frac);
              setTimelinePlaying(frac > 0);
            }}
          />
        </div>
      </div>

      {/* ── Physics console ──────────────────────────────────────────── */}
      <div className="explorer-physics">
        <PhysicsConsole
          rooms={DEMO_ROOMS}
          systemConfig={cfg}
          selectedRoomId={selectedRoomId}
        />
      </div>

      {/* ── Footer strip ─────────────────────────────────────────────── */}
      <FooterStrip systemId={selectedSystemId} />
    </div>
  );
}
