import { useMemo, useState } from 'react';
import {
  LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1,
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  runLegoTechnixScenarioV1,
} from '..';
import { buildDebugProjectionTimelineV1 } from './buildDebugProjectionTimelineV1';
import type { ProjectionFrameV1 } from './ProjectionContractsV1';

interface LegoTechnixDebugProjectionPageProps {
  readonly onBack: () => void;
}

const OVERLAY_ORDER = ['hydraulic', 'thermal', 'confidence', 'explainability'] as const;

type OverlayToggle = Record<(typeof OVERLAY_ORDER)[number], boolean>;

function buildShortScenarioDuration(durationSeconds: number): number {
  return Math.min(Math.max(durationSeconds, 300), 900);
}

export function LegoTechnixDebugProjectionPage({ onBack }: LegoTechnixDebugProjectionPageProps) {
  const [templateId, setTemplateId] = useState(LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0]?.id ?? '');
  const [frameIndex, setFrameIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>();
  const [overlayToggles, setOverlayToggles] = useState<OverlayToggle>({
    hydraulic: true,
    thermal: true,
    confidence: true,
    explainability: true,
  });

  const template = useMemo(
    () => LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.find((entry) => entry.id === templateId)
      ?? LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1[0],
    [templateId],
  );

  const projectionTimeline = useMemo(() => {
    if (!template) {
      return undefined;
    }

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: template.graph,
      initialState: JSON.parse(JSON.stringify(template.initialState)),
      ...template.scenario,
      durationSeconds: buildShortScenarioDuration(template.scenario.durationSeconds),
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
    const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(template.graph, {
      ...scenarioResult,
      dhwRecoveryMetrics,
    });
    const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
      graph: template.graph,
      scenarioResult,
      dhwRecoveryMetrics,
      hydraulicConfidenceReport,
    });

    return buildDebugProjectionTimelineV1({
      graph: template.graph,
      scenarioResult,
      hydraulicConfidenceReport,
      explainabilityReport,
      templateId: template.id,
    });
  }, [template]);

  const clampedFrameIndex = Math.max(0, Math.min(frameIndex, (projectionTimeline?.frameCount ?? 1) - 1));
  const frame = projectionTimeline?.frames[clampedFrameIndex];

  const selectedNode = frame?.nodes.find((node) => node.componentId === selectedNodeId);
  const selectedEdge = frame?.edges.find((edge) => edge.connectionId === selectedEdgeId);

  if (!template || !projectionTimeline || !frame) {
    return (
      <div style={{ padding: 16 }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <p>Debug projection unavailable.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: 16 }}>
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 style={{ marginBottom: 4 }}>LegoTechnix debug projection surface</h1>
      <p style={{ marginTop: 0, color: '#475569' }}>
        Engineering-only projection renderer for deterministic frame inspection.
      </p>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Canonical template</span>
          <select
            value={template.id}
            onChange={(event) => {
              setTemplateId(event.target.value);
              setFrameIndex(0);
              setSelectedNodeId(undefined);
              setSelectedEdgeId(undefined);
            }}
          >
            {LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Timeline frame ({clampedFrameIndex + 1} / {projectionTimeline.frameCount})</span>
          <input
            type="range"
            min={0}
            max={Math.max(projectionTimeline.frameCount - 1, 0)}
            step={1}
            value={clampedFrameIndex}
            onChange={(event) => setFrameIndex(Number(event.target.value))}
          />
          <small>Tick {frame.tickIndex} · t={frame.offsetSeconds}s</small>
        </label>

        <div style={{ display: 'grid', gap: 6 }}>
          <span>Overlay toggles</span>
          {OVERLAY_ORDER.map((overlayId) => (
            <label key={overlayId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={overlayToggles[overlayId]}
                onChange={(event) => {
                  setOverlayToggles((previous) => ({
                    ...previous,
                    [overlayId]: event.target.checked,
                  }));
                }}
              />
              {overlayId}
            </label>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 8, overflow: 'auto' }}>
          <svg width={2200} height={1100} role="img" aria-label="LegoTechnix debug projection graph">
            {frame.edges.map((edge) => {
              const source = frame.nodes.find((node) => node.componentId === edge.fromNodeId);
              const target = frame.nodes.find((node) => node.componentId === edge.toNodeId);
              if (!source || !target) {
                return null;
              }
              const overlayWarning = frame.overlays
                .find((overlay) => overlay.overlayId === 'hydraulic')
                ?.entries.find((entry) => entry.targetId === edge.connectionId && entry.status === 'warning');
              return (
                <g key={edge.connectionId}>
                  <line
                    x1={source.x + 48}
                    y1={source.y + 20}
                    x2={target.x - 48}
                    y2={target.y + 20}
                    stroke={edge.active ? '#2563eb' : '#94a3b8'}
                    strokeWidth={edge.active ? 4 : 2}
                    strokeDasharray={edge.active ? '0' : '6 4'}
                    onClick={() => {
                      setSelectedEdgeId(edge.connectionId);
                      setSelectedNodeId(undefined);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  {overlayWarning && overlayToggles.hydraulic && (
                    <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 8} fill="#b45309" fontSize={11}>
                      ⚠ bottleneck
                    </text>
                  )}
                </g>
              );
            })}

            {frame.nodes.map((node) => {
              const isSelected = node.componentId === selectedNodeId;
              const hasWarning = node.warnings.length > 0;
              return (
                <g key={node.componentId} onClick={() => {
                  setSelectedNodeId(node.componentId);
                  setSelectedEdgeId(undefined);
                }} style={{ cursor: 'pointer' }}>
                  <rect
                    x={node.x - 48}
                    y={node.y}
                    rx={8}
                    width={120}
                    height={44}
                    fill={node.engineeringMetadata.isActive ? '#dbeafe' : '#f8fafc'}
                    stroke={isSelected ? '#1d4ed8' : hasWarning ? '#b45309' : '#94a3b8'}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  <text x={node.x - 40} y={node.y + 18} fill="#0f172a" fontSize={11}>{node.label}</text>
                  <text x={node.x - 40} y={node.y + 33} fill="#475569" fontSize={10}>{node.operatingMode}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <aside style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Frame overlays</h2>
            {frame.overlays
              .filter((overlay) => overlayToggles[overlay.overlayId])
              .map((overlay) => (
                <details key={overlay.overlayId} open>
                  <summary>{overlay.label} ({overlay.entries.length})</summary>
                  <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
                    {overlay.entries.slice(0, 8).map((entry) => (
                      <li key={entry.id}>{entry.label}</li>
                    ))}
                  </ul>
                </details>
              ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Inspector</h2>
            {!selectedNode && !selectedEdge && <p style={{ margin: 0 }}>Select a node or edge to inspect metadata.</p>}
            {selectedNode && (
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(selectedNode, null, 2)}</pre>
            )}
            {selectedEdge && (
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(selectedEdge, null, 2)}</pre>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

export default LegoTechnixDebugProjectionPage;

export function getVisibleOverlayEntries(
  frame: ProjectionFrameV1,
  toggles: OverlayToggle,
): readonly ProjectionFrameV1['overlays'][number]['entries'][number][] {
  return frame.overlays
    .filter((overlay) => toggles[overlay.overlayId])
    .flatMap((overlay) => overlay.entries);
}
