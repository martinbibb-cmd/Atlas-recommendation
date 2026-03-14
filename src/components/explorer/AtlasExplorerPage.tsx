/**
 * AtlasExplorerPage.tsx
 *
 * Atlas System Explorer — main page.
 *
 * Layout:
 *   ┌─ Header: breadcrumb / layer indicator ───────────────────────────┐
 *   ├─ House Explorer (hero, always visible)                           │
 *   ├─ [RoomPanel | HeatSourcePanel]   ← slides in when selected      │
 *   ├─ System Diagram  |  Behaviour Timeline                          │
 *   └─ Physics Console                                                 │
 *
 * State drives which panel is visible and which elements are highlighted.
 */

import { useState, useCallback } from 'react';
import HouseExplorer from './HouseExplorer';
import RoomPanel from './RoomPanel';
import SystemDiagram from './SystemDiagram';
import HeatSourcePanel from './HeatSourcePanel';
import BehaviourTimeline from './BehaviourTimeline';
import PhysicsConsole from './PhysicsConsole';

import type { ExplorerState, ExplorerLayer } from './explorerTypes';
import {
  DEMO_ROOMS,
  DEMO_EMITTERS,
  DEMO_PIPES,
  DEMO_BOILER,
  DEMO_BEHAVIOUR_EVENTS,
  DEMO_PHYSICS,
  getRoomById,
  getEmitterById,
  getPhysicsForRoom,
} from './explorerData';

import './explorer.css';

// ── Layer breadcrumb ──────────────────────────────────────────────────────────

const LAYER_LABELS: Record<ExplorerLayer, string> = {
  house:      'House',
  room:       'Room',
  emitter:    'Emitter',
  hydraulic:  'Hydraulic path',
  heatSource: 'Heat source',
  physics:    'Physics engine',
};

function LayerBreadcrumb({
  state,
  onNavigate,
}: {
  state: ExplorerState;
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
      {/* Show next available layer as a ghost hint */}
      {currentIdx < layers.length - 1 && (
        <span className="explorer-breadcrumb__item explorer-breadcrumb__item--hint">
          <span className="explorer-breadcrumb__sep">›</span>
          <span className="explorer-breadcrumb__hint">{LAYER_LABELS[layers[currentIdx + 1]]}</span>
        </span>
      )}
    </nav>
  );
}

// ── Status header ─────────────────────────────────────────────────────────────

function StatusHeader({ state, liveBoilerLoad }: { state: ExplorerState; liveBoilerLoad: number }) {
  const room = state.selectedRoom ? getRoomById(state.selectedRoom) : null;
  const emitter = state.selectedEmitter ? getEmitterById(state.selectedEmitter) : null;

  return (
    <div className="explorer-status">
      <div className="explorer-status__chip">
        <span className="explorer-status__dot explorer-status__dot--heat" />
        System: <strong>Gas Combi</strong>
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
        Boiler: <strong>{Math.round(liveBoilerLoad * 100)}% load</strong>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function AtlasExplorerPage({ onBack }: Props) {
  const [explorerState, setExplorerState] = useState<ExplorerState>({ layer: 'house' });
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [liveBoilerLoad, setLiveBoilerLoad] = useState(DEMO_BOILER.currentLoadKw / DEMO_BOILER.outputKw);

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const setLayer = useCallback((layer: ExplorerLayer, id?: string) => {
    setExplorerState(prev => {
      const next: ExplorerState = { ...prev, layer };
      if (layer === 'house') {
        return { layer: 'house' };
      }
      if (layer === 'room' && id) {
        return { layer, selectedRoom: id };
      }
      if (layer === 'emitter' && id) {
        return { ...next, selectedEmitter: id };
      }
      if (layer === 'heatSource') {
        return { ...next };
      }
      return next;
    });
  }, []);

  function handleRoomClick(roomId: string) {
    setLayer('room', roomId);
  }

  function handleEmitterClick(emitterId: string) {
    setLayer('emitter', emitterId);
    // Also highlight this emitter's room
    const room = DEMO_ROOMS.find(r => r.emitterId === emitterId);
    if (room) {
      setExplorerState(prev => ({ ...prev, layer: 'emitter', selectedEmitter: emitterId, selectedRoom: room.id }));
    }
  }

  function handleBoilerClick() {
    setLayer('heatSource');
  }

  function handleBreadcrumbNavigate(layer: ExplorerLayer) {
    if (layer === 'house') {
      setExplorerState({ layer: 'house' });
    } else {
      setExplorerState(prev => ({ ...prev, layer }));
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const selectedRoom    = explorerState.selectedRoom ? getRoomById(explorerState.selectedRoom) : null;
  const selectedEmitter = explorerState.selectedEmitter
    ? getEmitterById(explorerState.selectedEmitter)
    : selectedRoom
    ? getEmitterById(selectedRoom.emitterId)
    : null;
  const selectedPhysics = selectedRoom ? getPhysicsForRoom(selectedRoom.id) : null;

  const showRoomPanel    = (explorerState.layer === 'room' || explorerState.layer === 'emitter') && !!selectedRoom;
  const showBoilerPanel  = explorerState.layer === 'heatSource';

  const diagramHighlight = {
    roomId:    explorerState.selectedRoom,
    emitterId: explorerState.selectedEmitter,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="explorer-page">
      {/* Page header */}
      <div className="explorer-page__header">
        <button className="explorer-page__back" onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className="explorer-page__title-block">
          <h1 className="explorer-page__title">
            <span className="explorer-page__brand">Atlas</span> System Explorer
          </h1>
          <p className="explorer-page__subtitle">
            Tap any room to reveal the heating system layer by layer
          </p>
        </div>
      </div>

      {/* Status bar */}
      <StatusHeader state={explorerState} liveBoilerLoad={liveBoilerLoad} />

      {/* Breadcrumb */}
      <LayerBreadcrumb state={explorerState} onNavigate={handleBreadcrumbNavigate} />

      {/* ── Hero: House + optional detail panel ──────────────────────── */}
      <div className="explorer-hero">
        <div className={`explorer-hero__house ${showRoomPanel || showBoilerPanel ? 'explorer-hero__house--panel-open' : ''}`}>
          <HouseExplorer
            rooms={DEMO_ROOMS}
            selectedRoomId={explorerState.selectedRoom}
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

        {/* Boiler panel */}
        <div className={`explorer-hero__panel ${showBoilerPanel ? 'explorer-hero__panel--visible' : ''}`}
          aria-hidden={!showBoilerPanel}>
          {showBoilerPanel && (
            <HeatSourcePanel
              boiler={DEMO_BOILER}
              onClose={() => setLayer('house')}
            />
          )}
        </div>
      </div>

      {/* ── System diagram + Behaviour timeline (side by side) ─────── */}
      <div className="explorer-mid">
        <div className="explorer-mid__diagram">
          <h2 className="explorer-section-title">System diagram</h2>
          <SystemDiagram
            rooms={DEMO_ROOMS}
            emitters={DEMO_EMITTERS}
            pipes={DEMO_PIPES}
            highlight={diagramHighlight}
            onBoilerClick={handleBoilerClick}
            onEmitterClick={handleEmitterClick}
            animating={timelinePlaying}
          />
        </div>

        <div className="explorer-mid__timeline">
          <BehaviourTimeline
            events={DEMO_BEHAVIOUR_EVENTS}
            onLoadChange={(frac) => {
              setLiveBoilerLoad(frac);
              setTimelinePlaying(frac > 0);
            }}
          />
        </div>
      </div>

      {/* ── Physics console ──────────────────────────────────────────── */}
      <div className="explorer-physics">
        <PhysicsConsole
          rooms={DEMO_ROOMS}
          physics={DEMO_PHYSICS}
          boiler={DEMO_BOILER}
          selectedRoomId={explorerState.selectedRoom}
        />
      </div>

      {/* ── Footer efficiency strip ──────────────────────────────────── */}
      <div className="explorer-footer-strip">
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">System efficiency</span>
          <span className="explorer-strip-value explorer-strip-value--warning">{DEMO_BOILER.efficiencyPct}%</span>
        </div>
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">Peak demand</span>
          <span className="explorer-strip-value">{DEMO_PHYSICS.reduce((s, p) => s + p.heatLossKw, 0).toFixed(1)} kW</span>
        </div>
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">Boiler sizing</span>
          <span className="explorer-strip-value">
            {(DEMO_BOILER.outputKw / DEMO_PHYSICS.reduce((s, p) => s + p.heatLossKw, 0)).toFixed(1)}× peak
          </span>
        </div>
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">Return temp</span>
          <span className="explorer-strip-value explorer-strip-value--warning">{DEMO_BOILER.returnTempC}°C</span>
        </div>
        <div className="explorer-strip-item">
          <span className="explorer-strip-label">Condensing</span>
          <span className="explorer-strip-value explorer-strip-value--danger">No</span>
        </div>
      </div>
    </div>
  );
}
