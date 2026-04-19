import React, { useCallback, useEffect, useRef } from 'react';
import { SpatialTwinProvider, useSpatialTwin } from '../state/spatialTwin.store';
import { SpatialTwinLeftRail } from '../components/SpatialTwinLeftRail';
import { SpatialTwinTopBar } from '../components/SpatialTwinTopBar';
import { SpatialTwinModeToggle } from '../components/SpatialTwinModeToggle';
import { SpatialTwinLegend } from '../components/SpatialTwinLegend';
import { SpatialTwinCanvas2D } from '../canvas/SpatialTwinCanvas2D';
import { SpatialTwinInspector } from '../inspector/SpatialTwinInspector';
import { SpatialTwinComparePanel } from '../compare/SpatialTwinComparePanel';
import { ScenarioShortlistPanel } from '../components/ScenarioShortlistPanel';
import { SpatialTwinDollhouseView } from '../scene/viewer/SpatialTwinDollhouseView';
import { SpatialTwinSceneModeToggle } from '../scene/viewer/SpatialTwinSceneModeToggle';
import { AlignmentViewPanel } from '../../spatialAlignment/AlignmentViewPanel';
import {
  initTwin,
  importStarted,
  selectEntity,
  hoverEntity,
  deselectEntity,
  setMode,
  setLeftRailSection,
  toggleOverlay,
  setViewDimension,
  setScenarioSelectedByUser,
} from '../state/spatialTwin.actions';
import { selectOverlayIsActive } from '../state/spatialTwin.selectors';
import { getAllOverlays } from '../overlays/overlayRegistry';
import { runScenariosFromSpatialTwin } from '../synthesis/runScenariosFromSpatialTwin';
import { buildScenarioSynthesis } from '../synthesis/buildScenarioSynthesis';
// Ensure overlays are registered
import '../overlays/roomHeatLossOverlay';
import '../overlays/emitterAdequacyOverlay';
import '../overlays/pipeStressOverlay';

interface SpatialTwinPageInnerProps {
  visitId: string;
  onBack: () => void;
}

function SpatialTwinPageInner({ visitId, onBack }: SpatialTwinPageInnerProps) {
  const [state, dispatch] = useSpatialTwin();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 800, height: 600 });

  useEffect(() => {
    dispatch(initTwin(visitId));
    dispatch(importStarted());
    // In production, session would be loaded here; for now show idle state
  }, [visitId, dispatch]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (el == null) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry != null) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(el);
    return () => { obs.disconnect(); };
  }, []);

  const activeOverlays = getAllOverlays().filter((o) =>
    selectOverlayIsActive(state, o.id) && o.isAvailable(state),
  );
  const firstActiveOverlay = activeOverlays[0] ?? null;
  const overlayMetadata =
    firstActiveOverlay != null ? firstActiveOverlay.getMetadata(state) : null;

  const includedScenarios = React.useMemo(
    () => state.scenarios.filter((s) => s.includeInReport !== false),
    [state.scenarios],
  );

  const scenarioNames = React.useMemo(
    () => Object.fromEntries(state.scenarios.map((s) => [s.scenarioId, s.name])),
    [state.scenarios],
  );

  const scenarioSynthesis = React.useMemo(() => {
    if (
      state.activeLeftRailSection !== 'compare' ||
      includedScenarios.length === 0 ||
      state.model == null
    ) {
      return null;
    }
    const envelopes = runScenariosFromSpatialTwin(state);
    return buildScenarioSynthesis(envelopes, state.scenarios);
  }, [state, includedScenarios.length]);

  const handleSelectScenario = useCallback(
    (id: string) => { dispatch(setScenarioSelectedByUser(id, true)); },
    [dispatch],
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left rail */}
      <SpatialTwinLeftRail
        activeSection={state.activeLeftRailSection}
        onSelectSection={(section) => { dispatch(setLeftRailSection(section)); }}
      />

      {/* Center column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SpatialTwinTopBar
          visitId={state.visitId}
          dirty={state.dirty}
          onBack={onBack}
        />

        {/* Toolbar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <SpatialTwinModeToggle
            mode={state.mode}
            onSetMode={(m) => { dispatch(setMode(m)); }}
          />
          <SpatialTwinSceneModeToggle
            viewDimension={state.viewDimension}
            onSetViewDimension={(v) => { dispatch(setViewDimension(v)); }}
          />
          {overlayMetadata != null && (
            <SpatialTwinLegend
              overlayMetadata={overlayMetadata}
              overlayLabel={firstActiveOverlay?.label ?? ''}
            />
          )}
        </div>

        {/* Canvas or panel */}
        {state.activeLeftRailSection === 'compare' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {scenarioSynthesis != null ? (
              <div style={{ padding: 16 }}>
                <ScenarioShortlistPanel
                  synthesis={scenarioSynthesis}
                  scenarioNames={scenarioNames}
                  onSelectScenario={handleSelectScenario}
                />
              </div>
            ) : (
              <SpatialTwinComparePanel model={state.model} />
            )}
          </div>
        ) : state.activeLeftRailSection === 'overlays' ? (
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Overlays</h3>
            {getAllOverlays().map((overlay) => {
              const available = overlay.isAvailable(state);
              const active = selectOverlayIsActive(state, overlay.id);
              return (
                <div key={overlay.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type='checkbox'
                    id={`overlay-${overlay.id}`}
                    checked={active}
                    disabled={!available}
                    onChange={() => { dispatch(toggleOverlay(overlay.id)); }}
                  />
                  <label
                    htmlFor={`overlay-${overlay.id}`}
                    style={{ fontSize: 13, color: available ? '#374151' : '#94a3b8', cursor: available ? 'pointer' : 'not-allowed' }}
                  >
                    {overlay.label}
                    {!available && ' (unavailable)'}
                  </label>
                </div>
              );
            })}
          </div>
        ) : state.activeLeftRailSection === 'alignment' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {state.model != null ? (
              <AlignmentViewPanel model={state.model.spatial} />
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 14 }}>
                No spatial model loaded. Import a capture to see the Structure View.
              </div>
            )}
          </div>
        ) : (
          <div ref={canvasContainerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {state.importState === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 14 }}>
                No session loaded. Use the import pipeline to load a capture.
              </div>
            )}
            {state.importState === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 14 }}>
                Loading spatial model…
              </div>
            )}
            {state.importState === 'failed' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#dc2626', fontSize: 14 }}>
                Import failed: {state.lastError ?? 'Unknown error'}
              </div>
            )}
            {state.importState === 'ready' && state.viewDimension === '3d' && state.model != null && (
              <SpatialTwinDollhouseView
                model={state.model}
                mode={state.mode}
                selectedEntityId={state.selectedEntityId}
                width={canvasSize.width}
                height={canvasSize.height}
                onSelectEntity={(id) => { dispatch(selectEntity(id)); }}
              />
            )}
            {state.importState === 'ready' && state.viewDimension === '2d' && (
              <SpatialTwinCanvas2D
                model={state.model}
                selectedEntityId={state.selectedEntityId}
                hoveredEntityId={state.hoveredEntityId}
                width={canvasSize.width}
                height={canvasSize.height}
                onSelectEntity={(id) => { dispatch(selectEntity(id)); }}
                onHoverEntity={(id) => { dispatch(hoverEntity(id)); }}
              />
            )}
          </div>
        )}
      </div>

      {/* Right inspector */}
      <div
        style={{
          width: 280,
          borderLeft: '1px solid #e2e8f0',
          background: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#64748b' }}>
          Inspector
        </div>
        <SpatialTwinInspector
          state={state}
          onDeselect={() => { dispatch(deselectEntity()); }}
        />
      </div>
    </div>
  );
}

interface SpatialTwinPageProps {
  visitId: string;
  onBack: () => void;
}

export function SpatialTwinPage({ visitId, onBack }: SpatialTwinPageProps) {
  return (
    <SpatialTwinProvider>
      <SpatialTwinPageInner visitId={visitId} onBack={onBack} />
    </SpatialTwinProvider>
  );
}
