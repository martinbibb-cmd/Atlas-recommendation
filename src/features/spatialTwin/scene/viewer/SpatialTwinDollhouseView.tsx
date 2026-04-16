/**
 * SpatialTwinDollhouseView.tsx
 *
 * Top-level 3D dollhouse view container.
 *
 * Responsibilities:
 *  - Build the SpatialTwinSceneGraph from the canonical model (read-only).
 *  - Apply visibility filters.
 *  - Handle selection bridge (3D click → canonical entityId → store dispatch).
 *  - Manage local camera state (scale, pan offset).
 *  - Render the canvas, toolbar, legend, and visibility toggles.
 *
 * The store, mode, and selectedEntityId all come from the Spatial Twin store —
 * this component never duplicates them.
 */

import { useState, useMemo, useCallback } from 'react';
import type { SpatialTwinModelV1, SpatialTwinMode } from '../../state/spatialTwin.types';
import { buildSceneGraphFromSpatialTwin } from '../buildSceneGraphFromSpatialTwin';
import { applyVisibilityFilters } from '../adapters/spatialTwinToSceneFilters';
import { selectSpatialTwinEntityFromSceneNode } from '../adapters/sceneSelectionBridge';
import { SpatialTwinSceneCanvas } from './SpatialTwinSceneCanvas';
import { SpatialTwinSceneToolbar } from './SpatialTwinSceneToolbar';
import { SpatialTwinSceneLegend } from './SpatialTwinSceneLegend';
import {
  DEFAULT_SCENE_VISIBILITY,
  toggleVisibilityCategory,
} from '../sceneVisibility.types';
import type { SceneVisibilityCategory } from '../sceneVisibility.types';

const ZOOM_STEP = 0.15;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const DEFAULT_SCALE = 0.55;

const VISIBILITY_CATEGORIES: Array<{ id: SceneVisibilityCategory; label: string }> = [
  { id: 'rooms', label: 'Rooms' },
  { id: 'objects', label: 'Objects' },
  { id: 'pipes', label: 'Pipes' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'labels', label: 'Labels' },
];

interface SpatialTwinDollhouseViewProps {
  model: SpatialTwinModelV1;
  mode: SpatialTwinMode;
  selectedEntityId: string | null;
  width: number;
  height: number;
  onSelectEntity: (entityId: string) => void;
}

export function SpatialTwinDollhouseView({
  model,
  mode,
  selectedEntityId,
  width,
  height,
  onSelectEntity,
}: SpatialTwinDollhouseViewProps) {
  // ── Local camera state ─────────────────────────────────────────────────────
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; ox: number; oy: number } | null>(null);
  const [visibility, setVisibility] = useState(DEFAULT_SCENE_VISIBILITY);

  // ── Build and filter scene graph ───────────────────────────────────────────
  const rawGraph = useMemo(
    () => buildSceneGraphFromSpatialTwin(model, mode),
    [model, mode],
  );

  const graph = useMemo(
    () => applyVisibilityFilters(rawGraph, visibility),
    [rawGraph, visibility],
  );

  // ── Selection bridge ───────────────────────────────────────────────────────
  const handleSelectSceneNode = useCallback(
    (sceneNodeId: string) => {
      const entityId = selectSpatialTwinEntityFromSceneNode(graph, sceneNodeId);
      if (entityId != null) {
        onSelectEntity(entityId);
      }
    },
    [graph, onSelectEntity],
  );

  // ── Camera handlers ────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    setScale((s) => Math.min(s + ZOOM_STEP, MAX_SCALE));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - ZOOM_STEP, MIN_SCALE));
  };

  const handleResetCamera = () => {
    setScale(DEFAULT_SCALE);
    setOffsetX(0);
    setOffsetY(0);
  };

  // ── Pan via mouse drag ─────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ mouseX: e.clientX, mouseY: e.clientY, ox: offsetX, oy: offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStart == null) return;
    setOffsetX(dragStart.ox + (e.clientX - dragStart.mouseX));
    setOffsetY(dragStart.oy + (e.clientY - dragStart.mouseY));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // ── Visibility toggles ─────────────────────────────────────────────────────
  const handleToggleVisibility = (cat: SceneVisibilityCategory) => {
    setVisibility((v) => toggleVisibilityCategory(v, cat));
  };

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: '#f8fafc' }}>
      {/* Canvas with pan support */}
      <div
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <SpatialTwinSceneCanvas
          graph={graph}
          selectedEntityId={selectedEntityId}
          width={width}
          height={height}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          showLabels={visibility.labels}
          onSelectSceneNode={handleSelectSceneNode}
        />
      </div>

      {/* Camera controls */}
      <SpatialTwinSceneToolbar
        onResetCamera={handleResetCamera}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Legend */}
      <SpatialTwinSceneLegend mode={mode} />

      {/* Visibility toggles */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 11,
        }}
      >
        {VISIBILITY_CATEGORIES.map(({ id, label }) => (
          <label
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, cursor: 'pointer' }}
          >
            <input
              type='checkbox'
              checked={visibility[id]}
              onChange={() => { handleToggleVisibility(id); }}
              style={{ margin: 0 }}
            />
            <span style={{ color: '#374151' }}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
