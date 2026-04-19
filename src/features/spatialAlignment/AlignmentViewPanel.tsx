/**
 * AlignmentViewPanel.tsx
 *
 * 2-D "Structure View" — the fallback/desktop mode of the Spatial Alignment
 * View feature.  Renders a split-screen panel with:
 *
 *   Left  — SIDE VIEW (east-elevation): shows vertical stacking of anchors
 *   Right — TOP VIEW (plan): shows horizontal layout and inferred routes
 *
 * Visual encoding (matches AR overlay conventions):
 *   solid marker / line  = confirmed anchor (confidence: 'confirmed')
 *   dashed marker / line = inferred anchor  (confidence: 'inferred')
 *   faded opacity        = low-confidence or derived position
 *
 * SAFETY RULES:
 *   - Inferred data is NEVER labelled as confirmed.
 *   - Tooltips always show derivationReason for inferred insights.
 *   - No random positioning — all coordinates derived from engine output.
 */

import React, { useMemo } from 'react';
import type { AtlasSpatialModelV1 } from '../atlasSpatial/atlasSpatialModel.types';
import type { AlignmentInsight } from './spatialAlignment.types';
import { buildAlignmentInsights } from './spatialAlignment.engine';
import {
  selectConfirmedAnchors,
  selectInferredAnchors,
  selectAnchorByLabel,
} from './spatialAlignment.selectors';

// ─── Constants ────────────────────────────────────────────────────────────────

/** SVG viewport dimensions in pixels. */
const VIEW_W = 320;
const VIEW_H = 280;
/** Margin inside the SVG viewport. */
const MARGIN = 32;
/** Available drawing area. */
const DRAW_W = VIEW_W - MARGIN * 2;
const DRAW_H = VIEW_H - MARGIN * 2;

// ─── Colour tokens ────────────────────────────────────────────────────────────

const COLOUR_CONFIRMED = '#2563eb'; // blue-600
const COLOUR_INFERRED  = '#9ca3af'; // grey-400
const COLOUR_ROUTE     = '#f59e0b'; // amber-500
const COLOUR_RELATION  = '#6366f1'; // indigo-500

// ─── Helper: scale world coords → SVG coords ─────────────────────────────────

interface WorldBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

function computeBounds(model: AtlasSpatialModelV1): WorldBounds {
  const anchors = model.anchors ?? [];
  if (anchors.length === 0) {
    return { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const a of anchors) {
    const { x, y, z } = a.worldPosition;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // Ensure minimum span so single-anchor views render sensibly.
  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  const spanZ = Math.max(maxZ - minZ, 2);

  return {
    minX: minX - spanX * 0.1, maxX: maxX + spanX * 0.1,
    minY: minY - spanY * 0.1, maxY: maxY + spanY * 0.1,
    minZ: minZ - spanZ * 0.1, maxZ: maxZ + spanZ * 0.1,
  };
}

/** Map a world x-coord to SVG x for the TOP VIEW. */
function worldToSvgX(worldX: number, bounds: WorldBounds): number {
  const t = (worldX - bounds.minX) / (bounds.maxX - bounds.minX);
  return MARGIN + t * DRAW_W;
}

/** Map a world y-coord to SVG y for the TOP VIEW (y increases downward in SVG). */
function worldToSvgY_top(worldY: number, bounds: WorldBounds): number {
  const t = 1 - (worldY - bounds.minY) / (bounds.maxY - bounds.minY);
  return MARGIN + t * DRAW_H;
}

/** Map a world x-coord to SVG x for the SIDE VIEW (elevation, x = east). */
function worldToSvgX_side(worldX: number, bounds: WorldBounds): number {
  const t = (worldX - bounds.minX) / (bounds.maxX - bounds.minX);
  return MARGIN + t * DRAW_W;
}

/** Map a world z-coord to SVG y for the SIDE VIEW (z increases upward, SVG y downward). */
function worldToSvgY_side(worldZ: number, bounds: WorldBounds): number {
  const t = 1 - (worldZ - bounds.minZ) / (bounds.maxZ - bounds.minZ);
  return MARGIN + t * DRAW_H;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AnchorDotProps {
  cx: number;
  cy: number;
  label: string;
  confirmed: boolean;
  insight?: AlignmentInsight;
}

function AnchorDot({ cx, cy, label, confirmed, insight }: AnchorDotProps) {
  const colour  = confirmed ? COLOUR_CONFIRMED : COLOUR_INFERRED;
  const opacity = confirmed ? 1 : 0.6;
  const r       = 6;

  const tooltipLines: string[] = [`${label}`];
  if (insight) {
    tooltipLines.push(
      `${insight.relation} · ${insight.verticalDistanceM.toFixed(1)} m vertical`,
      `${insight.horizontalOffsetM.toFixed(1)} m horizontal`,
    );
    if (insight.derivationReason) {
      tooltipLines.push(`⚠ Inferred: ${insight.derivationReason}`);
    }
  }

  return (
    <g opacity={opacity}>
      {!confirmed && (
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={colour} strokeWidth={1} strokeDasharray="3 2" />
      )}
      <circle cx={cx} cy={cy} r={r} fill={colour} />
      <title>{tooltipLines.join('\n')}</title>
      <text
        x={cx + r + 3}
        y={cy + 4}
        fontSize={9}
        fill={colour}
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

// ─── Side View (elevation) ────────────────────────────────────────────────────

interface SideViewProps {
  model: AtlasSpatialModelV1;
  bounds: WorldBounds;
  insights: AlignmentInsight[];
}

function SideView({ model, bounds, insights }: SideViewProps) {
  const anchors   = model.anchors ?? [];
  const confirmed = selectConfirmedAnchors(model);
  const inferred  = selectInferredAnchors(model);
  const confirmedIds = new Set(confirmed.map((a) => a.id));

  const insightMap = useMemo(
    () => new Map(insights.map((i) => [i.anchorId, i])),
    [insights],
  );

  // Vertical relation lines
  const relations = model.verticalRelations ?? [];

  return (
    <svg width={VIEW_W} height={VIEW_H} aria-label="Side view — vertical elevation">
      {/* Axis labels */}
      <text x={MARGIN} y={MARGIN - 6} fontSize={9} fill="#6b7280" fontFamily="system-ui, sans-serif">
        SIDE VIEW  ↑ height (m)
      </text>
      {/* Ground line */}
      <line
        x1={MARGIN} y1={worldToSvgY_side(bounds.minZ, bounds) + 1}
        x2={MARGIN + DRAW_W} y2={worldToSvgY_side(bounds.minZ, bounds) + 1}
        stroke="#e5e7eb" strokeWidth={1}
      />

      {/* Vertical relation lines */}
      {relations.map((rel) => {
        const from = anchors.find((a) => a.id === rel.fromAnchorId);
        const to   = anchors.find((a) => a.id === rel.toAnchorId);
        if (!from || !to) return null;

        const x1 = worldToSvgX_side(from.worldPosition.x, bounds);
        const y1 = worldToSvgY_side(from.worldPosition.z, bounds);
        const x2 = worldToSvgX_side(to.worldPosition.x, bounds);
        const y2 = worldToSvgY_side(to.worldPosition.z, bounds);

        return (
          <line
            key={`vrel-${rel.fromAnchorId}-${rel.toAnchorId}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={COLOUR_RELATION} strokeWidth={1} strokeDasharray="4 2" opacity={0.5}
          />
        );
      })}

      {/* Inferred route paths (side view: x vs z) */}
      {(model.inferredRoutes ?? []).filter((r) => r.type === 'pipe').map((route) => {
        const points = route.path
          .map((p) => `${worldToSvgX_side(p.x, bounds)},${worldToSvgY_side(p.z, bounds)}`)
          .join(' ');
        return (
          <polyline
            key={`route-side-${route.id}`}
            points={points}
            fill="none"
            stroke={COLOUR_ROUTE}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            opacity={0.7}
          >
            <title>{'⚠ Inferred pipe route\n' + route.reason}</title>
          </polyline>
        );
      })}

      {/* Anchor dots */}
      {anchors.map((anchor) => {
        const cx = worldToSvgX_side(anchor.worldPosition.x, bounds);
        const cy = worldToSvgY_side(anchor.worldPosition.z, bounds);
        return (
          <AnchorDot
            key={anchor.id}
            cx={cx} cy={cy}
            label={anchor.label}
            confirmed={confirmedIds.has(anchor.id)}
            insight={insightMap.get(anchor.id)}
          />
        );
      })}

      {/* Legend */}
      <g transform={`translate(${MARGIN}, ${VIEW_H - 18})`}>
        <circle cx={6} cy={0} r={4} fill={COLOUR_CONFIRMED} />
        <text x={14} y={4} fontSize={8} fill="#6b7280" fontFamily="system-ui, sans-serif">confirmed</text>
        <circle cx={74} cy={0} r={4} fill={COLOUR_INFERRED} opacity={0.6} />
        <text x={82} y={4} fontSize={8} fill="#6b7280" fontFamily="system-ui, sans-serif">inferred</text>
        <line x1={140} y1={-2} x2={154} y2={-2} stroke={COLOUR_ROUTE} strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={158} y={4} fontSize={8} fill="#6b7280" fontFamily="system-ui, sans-serif">pipe route (inferred)</text>
      </g>
    </svg>
  );
}

// ─── Top View (plan) ──────────────────────────────────────────────────────────

interface TopViewProps {
  model: AtlasSpatialModelV1;
  bounds: WorldBounds;
  insights: AlignmentInsight[];
}

function TopView({ model, bounds, insights }: TopViewProps) {
  const anchors      = model.anchors ?? [];
  const confirmed    = selectConfirmedAnchors(model);
  const confirmedIds = new Set(confirmed.map((a) => a.id));

  const insightMap = useMemo(
    () => new Map(insights.map((i) => [i.anchorId, i])),
    [insights],
  );

  return (
    <svg width={VIEW_W} height={VIEW_H} aria-label="Top view — plan">
      {/* Axis label */}
      <text x={MARGIN} y={MARGIN - 6} fontSize={9} fill="#6b7280" fontFamily="system-ui, sans-serif">
        TOP VIEW  ↑ north
      </text>

      {/* Inferred route paths (top view: x vs y) */}
      {(model.inferredRoutes ?? []).filter((r) => r.type === 'pipe').map((route) => {
        const points = route.path
          .map((p) => `${worldToSvgX(p.x, bounds)},${worldToSvgY_top(p.y, bounds)}`)
          .join(' ');
        return (
          <polyline
            key={`route-top-${route.id}`}
            points={points}
            fill="none"
            stroke={COLOUR_ROUTE}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            opacity={0.7}
          >
            <title>{'⚠ Inferred pipe route\n' + route.reason}</title>
          </polyline>
        );
      })}

      {/* Horizontal relationship lines between anchors */}
      {insights.map((insight) => {
        const ref = selectAnchorByLabel(model, 'boiler') ?? anchors[0];
        if (!ref) return null;
        const target = anchors.find((a) => a.id === insight.anchorId);
        if (!target) return null;

        const x1 = worldToSvgX(ref.worldPosition.x, bounds);
        const y1 = worldToSvgY_top(ref.worldPosition.y, bounds);
        const x2 = worldToSvgX(target.worldPosition.x, bounds);
        const y2 = worldToSvgY_top(target.worldPosition.y, bounds);
        const isInferred = target.worldPosition.confidence === 'inferred';

        return (
          <line
            key={`hrel-${insight.anchorId}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={COLOUR_RELATION}
            strokeWidth={1}
            strokeDasharray={isInferred ? '4 2' : undefined}
            opacity={0.4}
          />
        );
      })}

      {/* Anchor dots */}
      {anchors.map((anchor) => {
        const cx = worldToSvgX(anchor.worldPosition.x, bounds);
        const cy = worldToSvgY_top(anchor.worldPosition.y, bounds);
        return (
          <AnchorDot
            key={anchor.id}
            cx={cx} cy={cy}
            label={anchor.label}
            confirmed={confirmedIds.has(anchor.id)}
            insight={insightMap.get(anchor.id)}
          />
        );
      })}
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface AlignmentViewPanelProps {
  /** The spatial model with anchors and optional routes/relations. */
  model: AtlasSpatialModelV1;
  /** Optional CSS class name for the outer container. */
  className?: string;
}

/**
 * AlignmentViewPanel
 *
 * Renders the 2-D "Structure View" split-screen panel for the Spatial
 * Alignment View feature.  Shows a side elevation on the left and a top
 * plan view on the right.
 *
 * Requirements:
 *  - model.anchors must be populated for anything to render.
 *  - Inferred anchors are shown with dashed outlines and faded opacity.
 *  - Inferred routes are shown with amber dashed polylines and tooltips.
 *  - No random data — all positions come from the model.
 */
export function AlignmentViewPanel({ model, className }: AlignmentViewPanelProps) {
  const anchors  = model.anchors ?? [];
  const insights = useMemo(() => buildAlignmentInsights(model), [model]);
  const bounds   = useMemo(() => computeBounds(model), [model]);

  if (anchors.length === 0) {
    return (
      <div
        className={className}
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#9ca3af',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
        aria-label="Alignment View — no anchors placed"
      >
        <p style={{ margin: 0 }}>
          No anchors placed yet. Add a boiler, cylinder, or other object
          position in the Atlas editor to see the Alignment View.
        </p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'system-ui, sans-serif',
      }}
      aria-label="Alignment View — Structure View"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          borderRadius: '6px 6px 0 0',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
          Structure View — Behind the Walls
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {anchors.length} anchor{anchors.length !== 1 ? 's' : ''}
          {(model.inferredRoutes ?? []).length > 0 &&
            ` · ${(model.inferredRoutes ?? []).length} inferred route${(model.inferredRoutes ?? []).length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Inferred-data notice */}
      {anchors.some((a) => a.worldPosition.confidence === 'inferred') && (
        <div
          style={{
            margin: '0 12px',
            padding: '6px 10px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 4,
            fontSize: 11,
            color: '#92400e',
          }}
          role="status"
        >
          ⚠ Some positions are <strong>inferred</strong> from geometry. Verify
          on-site before use.
        </div>
      )}

      {/* Split-screen views */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: '0 12px 12px',
        }}
      >
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <SideView model={model} bounds={bounds} insights={insights} />
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <TopView model={model} bounds={bounds} insights={insights} />
        </div>
      </div>

      {/* Insight list */}
      {insights.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Alignment relative to{' '}
            {(model.anchors?.find((a) => a.label.toLowerCase() === 'boiler') ??
              model.anchors?.[0])?.label ?? 'reference'}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {insights.map((insight) => (
              <li
                key={insight.anchorId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#374151',
                  padding: '4px 8px',
                  background: '#f9fafb',
                  borderRadius: 4,
                  border: '1px solid #f3f4f6',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background:
                      insight.confidence === 'confirmed'
                        ? COLOUR_CONFIRMED
                        : COLOUR_INFERRED,
                    flexShrink: 0,
                    opacity: insight.confidence === 'confirmed' ? 1 : 0.6,
                  }}
                />
                <span style={{ fontWeight: 500, minWidth: 80 }}>{insight.label}</span>
                <span style={{ color: '#6b7280' }}>
                  {insight.relation === 'same_level'
                    ? 'same level'
                    : `${insight.verticalDistanceM.toFixed(1)} m ${insight.relation}`}
                  {insight.horizontalOffsetM > 0 &&
                    ` · ${insight.horizontalOffsetM.toFixed(1)} m offset`}
                </span>
                {insight.confidence === 'inferred' && (
                  <span
                    title={insight.derivationReason}
                    style={{ color: '#f59e0b', fontSize: 11, marginLeft: 'auto', cursor: 'help' }}
                  >
                    inferred ⓘ
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
