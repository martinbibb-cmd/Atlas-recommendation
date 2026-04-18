/**
 * HeatLossCalculator — canvas-based whole-house heat loss sketch tool.
 *
 * Ported from https://github.com/martinbibb-cmd/Quick-heat-loss
 *
 * Calculation method (simplified shell model):
 *   Fabric heat loss  = Σ (area × U-value) × ΔT
 *   Ventilation loss  = volume × ACH × 0.33 × ΔT
 *   Design ΔT = 20 °C (indoor 21 °C / outdoor 1 °C)
 *   ACH = 0.75 (typical UK existing dwelling)
 *
 * Layers:
 *   Drawings are organised into named layers — each with its own polygon,
 *   colour, kind (original / extension / upper_floor / reference), and
 *   visibility flag.  The heat-loss calculation runs on the active layer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import './heatloss.css';
import type { ShellModel } from '../../features/survey/heatLoss/heatLossTypes';

export type { ShellModel };

// ── U-values (W/m²K) ─────────────────────────────────────────────────────────

const U_WALL: Record<string, number> = {
  solidBrick:        2.1,
  cavityUninsulated: 2.1,  // treated as high heat-loss band — same as solid masonry (per project physics rules)
  cavityPartialFill: 0.5,
  cavityFullFill:    0.28,
  timberFrame:       0.25,
  solidStone:        1.7,
};

const U_LOFT: Record<string, number> = {
  none:           2.3,
  mm100:          0.35,
  mm200:          0.18,
  mm270plus:      0.13,
  neighbourHeated: 0.10,  // inter-flat ceiling — heated flat above (reduced ΔT effect included)
};

const U_GLAZING: Record<string, number> = {
  single:       4.8,
  doubleOld:    2.8,
  doubleArated: 1.4,
  triple:       0.8,
};

const U_FLOOR: Record<string, number> = {
  solidUninsulated:     0.70,
  suspendedUninsulated: 0.80,
  insulated:            0.20,
  neighbourHeated:      0.10,  // inter-flat floor — heated flat below (reduced ΔT effect included)
};

const GLAZING_FRACTION: Record<string, number> = { low: 0.12, medium: 0.18, high: 0.25 };
const PARTY_WALL_FACTOR = 0.1;
const DELTA_T = 20;
const ACH = 0.75;
const SNAP = 0.5;
const CLOSE_PX = 14;

/** Default per-layer storey count (matches the Quick-heat-loss reference tool). */
const DEFAULT_STOREYS       = 2;
/** Default per-layer ceiling height in metres. */
const DEFAULT_CEILING_HEIGHT = 2.4;

// ── Layer constants ───────────────────────────────────────────────────────────

type LayerKind = 'original' | 'extension' | 'upper_floor' | 'reference';

const LAYER_COLOURS: Record<LayerKind, string> = {
  original:    '#1a56db',
  extension:   '#059669',
  upper_floor: '#7c3aed',
  reference:   '#9ca3af',
};

const FLOOR_ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

let _layerCounter = 0;
function generateLayerId(): string {
  // Counter-only ID — deterministic and unique within the page lifetime.
  // No Math.random() per project "No Theatre" rule.
  return 'layer-' + (++_layerCounter).toString(36);
}

/**
 * When restoring layers from a saved ShellModel, advance the module-level
 * counter past the highest saved ID so that newly created layers never get
 * an ID that collides with a restored layer.
 * IDs follow the pattern 'layer-<base36 counter>' so we parse the numeric
 * part and keep _layerCounter > max(parsed values).
 */
function advanceCounterPastIds(savedIds: string[]): void {
  for (const id of savedIds) {
    const m = id.match(/^layer-([0-9a-z]+)/);
    if (m) {
      const n = parseInt(m[1], 36);
      if (n >= _layerCounter) _layerCounter = n + 1;
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }
interface Edge  { isPartyWall: boolean; }

interface Layer {
  id:           string;
  name:         string;
  kind:         LayerKind;
  visible:      boolean;
  points:       Point[];
  closed:       boolean;
  edges:        Edge[];
  /** Per-layer storey count — independent of every other layer (CHANGE 2). */
  storeys:      number;
  /** Per-layer ceiling height in metres (CHANGE 2). */
  ceilingHeight: number;
}

interface HeatLossResult {
  floorArea:   number;
  perimeter:   number;
  netWallArea: number;
  glazingArea: number;
  roofArea:    number;
  volume:      number;
  wallHL:      number;
  glazingHL:   number;
  roofHL:      number;
  floorHL:     number;
  ventHL:      number;
  totalHL:     number;
  thermalInertiaTauHours: number;
}

/** View/interaction state — pan, zoom, hover, drag. No polygon data. */
interface ViewState {
  scale:         number;
  panX:          number;
  panY:          number;
  hoverPt:       Point | null;
  isPanning:     boolean;
  lastPointer:   Point | null;
  dragIndex:     number;
  lastPinchDist:   number | null;
  lastPinchCenter: Point | null;
}

interface Settings {
  storeys:        number;
  ceilingHeight:  number;
  /**
   * Dwelling form.
   * Houses: 'detached' | 'semi' | 'endTerrace' | 'midTerrace'
   * Flats:  'flatGround' | 'flatMid' | 'flatPenthouse'
   */
  dwellingType:   'detached' | 'semi' | 'endTerrace' | 'midTerrace'
                | 'flatGround' | 'flatMid' | 'flatPenthouse';
  wallType:       string;
  loftInsulation: string;
  glazingType:    string;
  glazingAmount:  string;
  floorType:      string;
  thermalMass:    'light' | 'medium' | 'heavy';
}

/** Returns true when the given dwelling type is a flat (any floor position). */
function isFlatDwelling(dwellingType: Settings['dwellingType']): boolean {
  return dwellingType === 'flatGround' ||
         dwellingType === 'flatMid' ||
         dwellingType === 'flatPenthouse';
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(pts: Point[]): number {
  let p = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

function round(v: number, dp: number): number {
  const m = Math.pow(10, dp);
  return Math.round(v * m) / m;
}

function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── Heat loss calculation ─────────────────────────────────────────────────────

/**
 * CHANGE 3: Identify which edges of `layer` are shared (collinear + coincident)
 * with any edge of a neighbouring layer.  Shared walls between adjoining sections
 * are interior — they do not lose heat to the outside and must be excluded.
 */
function getSharedEdgeIndices(layer: Layer, neighbours: Layer[]): Set<number> {
  const shared = new Set<number>();
  const EPSILON = 0.01; // metres — sub-snap tolerance
  function near(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y) < EPSILON; }
  const n = layer.points.length;
  for (let i = 0; i < n; i++) {
    const a1 = layer.points[i];
    const a2 = layer.points[(i + 1) % n];
    outer: for (const other of neighbours) {
      if (!other.closed) continue;
      const m = other.points.length;
      for (let j = 0; j < m; j++) {
        const b1 = other.points[j];
        const b2 = other.points[(j + 1) % m];
        if ((near(a1, b1) && near(a2, b2)) || (near(a1, b2) && near(a2, b1))) {
          shared.add(i);
          break outer;
        }
      }
    }
  }
  return shared;
}

/** Intermediate per-layer result (raw watts, not rounded). */
interface LayerHeatLossResult {
  floorArea:   number;
  perimeter:   number;
  netWallArea: number;
  glazingArea: number;
  roofArea:    number;
  volume:      number;
  wallHL:      number;
  glazingHL:   number;
  roofHL:      number;
  floorHL:     number;
  ventHL:      number;
}

/**
 * Calculate heat loss for a single layer, using its own storeys/ceilingHeight
 * (CHANGE 2) and excluding any shared edges with neighbours (CHANGE 3).
 * Returns raw values in watts.
 */
function calculateLayerHeatLoss(
  layer: Layer,
  sharedEdgeIndices: Set<number>,
  settings: Settings,
): LayerHeatLossResult | null {
  if (!layer.closed || layer.points.length < 3 || layer.kind === 'reference') return null;

  const pts = layer.points;
  const floorArea   = polygonArea(pts);
  const perimeter   = polygonPerimeter(pts);
  // CHANGE 2: per-layer height
  const totalHeight = layer.storeys * layer.ceilingHeight;
  const volume      = floorArea * totalHeight;

  let exposedPerimeter = 0;
  let partyPerimeter   = 0;
  layer.edges.forEach((edge, i) => {
    // CHANGE 3: skip shared interior edges
    if (sharedEdgeIndices.has(i)) return;
    const a   = pts[i];
    const b   = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (edge.isPartyWall) partyPerimeter += len;
    else                  exposedPerimeter += len;
  });

  const grossWallArea = exposedPerimeter * totalHeight;
  const glazingFrac   = GLAZING_FRACTION[settings.glazingAmount] ?? GLAZING_FRACTION.medium;
  const glazingArea   = grossWallArea * glazingFrac;
  const netWallArea   = grossWallArea - glazingArea;
  const roofArea      = floorArea;

  const uWall    = U_WALL[settings.wallType]       ?? U_WALL.cavityUninsulated;
  const uLoft    = U_LOFT[settings.loftInsulation] ?? U_LOFT.mm270plus;
  const uGlazing = U_GLAZING[settings.glazingType] ?? U_GLAZING.doubleArated;
  const uFloor   = U_FLOOR[settings.floorType]     ?? U_FLOOR.suspendedUninsulated;

  const partyWallArea = partyPerimeter * totalHeight;
  const wallHL    = (netWallArea * uWall + partyWallArea * uWall * PARTY_WALL_FACTOR) * DELTA_T;
  const glazingHL = glazingArea * uGlazing * DELTA_T;
  const roofHL    = roofArea    * uLoft    * DELTA_T;
  const floorHL   = floorArea   * uFloor   * DELTA_T;
  const ventHL    = volume * ACH * 0.33 * DELTA_T;

  return { floorArea, perimeter, netWallArea, glazingArea, roofArea, volume,
           wallHL, glazingHL, roofHL, floorHL, ventHL };
}

/**
 * CHANGE 1: Sum heat loss across all eligible layers.
 * Eligible = visible, closed, ≥3 points, not a reference layer.
 * Shared edges between adjoining sections are excluded (CHANGE 3).
 */
function calculateHeatLoss(layers: Layer[], settings: Settings): HeatLossResult | null {
  const eligible = layers.filter(l =>
    l.visible && l.closed && l.kind !== 'reference' && l.points.length >= 3
  );
  if (eligible.length === 0) return null;

  let totFloorArea   = 0, totPerimeter   = 0, totNetWallArea = 0;
  let totGlazingArea = 0, totRoofArea    = 0, totVolume      = 0;
  let totWallHL      = 0, totGlazingHL   = 0, totRoofHL      = 0;
  let totFloorHL     = 0, totVentHL      = 0;

  for (const layer of eligible) {
    const neighbours  = eligible.filter(l => l.id !== layer.id);
    const sharedEdges = getSharedEdgeIndices(layer, neighbours);
    const res         = calculateLayerHeatLoss(layer, sharedEdges, settings);
    if (!res) continue;
    totFloorArea   += res.floorArea;
    totPerimeter   += res.perimeter;
    totNetWallArea += res.netWallArea;
    totGlazingArea += res.glazingArea;
    totRoofArea    += res.roofArea;
    totVolume      += res.volume;
    totWallHL      += res.wallHL;
    totGlazingHL   += res.glazingHL;
    totRoofHL      += res.roofHL;
    totFloorHL     += res.floorHL;
    totVentHL      += res.ventHL;
  }

  const totalHL             = totWallHL + totGlazingHL + totRoofHL + totFloorHL + totVentHL;
  const heatLossCoefficient = totalHL / DELTA_T; // W/K
  const thermalCapacityKwhPerK =
    settings.thermalMass === 'light'  ? 2.5 :
    settings.thermalMass === 'medium' ? 4.5 :
    7.0;
  const thermalInertiaTauHours = heatLossCoefficient > 0
    ? (thermalCapacityKwhPerK * 1000) / heatLossCoefficient
    : 0;

  return {
    floorArea:   round(totFloorArea,   1),
    perimeter:   round(totPerimeter,   1),
    netWallArea: round(totNetWallArea, 1),
    glazingArea: round(totGlazingArea, 1),
    roofArea:    round(totRoofArea,    1),
    volume:      round(totVolume,      0),
    wallHL:      round(totWallHL    / 1000, 2),
    glazingHL:   round(totGlazingHL / 1000, 2),
    roofHL:      round(totRoofHL    / 1000, 2),
    floorHL:     round(totFloorHL   / 1000, 2),
    ventHL:      round(totVentHL    / 1000, 2),
    totalHL:     round(totalHL      / 1000, 1),
    thermalInertiaTauHours: round(thermalInertiaTauHours, 1),
  };
}

// ── Party wall auto-assignment ────────────────────────────────────────────────

function applyDefaultExposure(pts: Point[], edges: Edge[], dwellingType: string): void {
  edges.forEach(e => { e.isPartyWall = false; });
  if (dwellingType === 'detached') return;

  const sorted = edges
    .map((_, i) => {
      const j = (i + 1) % pts.length;
      return { i, length: Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) };
    })
    .sort((a, b) => b.length - a.length);

  if (dwellingType === 'semi' || dwellingType === 'endTerrace' || dwellingType === 'flatGround' || dwellingType === 'flatPenthouse') {
    edges[sorted[0].i].isPartyWall = true;
  } else if (dwellingType === 'midTerrace' || dwellingType === 'flatMid') {
    edges[sorted[0].i].isPartyWall = true;
    if (sorted.length > 1) edges[sorted[1].i].isPartyWall = true;
  }
}

// ── Canvas rendering helpers ──────────────────────────────────────────────────

function w2c(mx: number, my: number, scale: number, panX: number, panY: number) {
  return { x: (mx - panX) * scale, y: (my - panY) * scale };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  vs: ViewState,
  layers: Layer[],
  activeLayerId: string,
): void {
  // ctxOrNull/ctx split: TypeScript's control-flow narrowing does not
  // propagate into the nested drawLayerPolygon closure, so we need an
  // explicit non-nullable typed binding that the closure can capture.
  const ctxOrNull  = canvas.getContext('2d');
  if (!ctxOrNull) return;
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;

  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const { scale, panX, panY, hoverPt } = vs;
  ctx.clearRect(0, 0, cssW, cssH);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, cssW, cssH);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const minX = panX, minY = panY;
  const maxX = minX + cssW / scale, maxY = minY + cssH / scale;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  for (let x = Math.floor(minX); x <= maxX; x++) {
    const px = (x - panX) * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, cssH);
  }
  for (let y = Math.floor(minY); y <= maxY; y++) {
    const py = (y - panY) * scale;
    ctx.moveTo(0, py); ctx.lineTo(cssW, py);
  }
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  const x0 = Math.floor(minX / 5) * 5, y0 = Math.floor(minY / 5) * 5;
  for (let x = x0; x <= maxX; x += 5) {
    const px = (x - panX) * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, cssH);
  }
  for (let y = y0; y <= maxY; y += 5) {
    const py = (y - panY) * scale;
    ctx.moveTo(0, py); ctx.lineTo(cssW, py);
  }
  ctx.stroke();

  ctx.fillStyle    = '#9ca3af';
  ctx.font         = '10px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'center';
  for (let x = x0; x <= maxX; x += 5) {
    if (x === 0) continue;
    const px = (x - panX) * scale;
    if (px > 30 && px < cssW - 10) ctx.fillText(x + ' m', px, 4);
  }
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  for (let y = y0; y <= maxY; y += 5) {
    if (y === 0) continue;
    const py = (y - panY) * scale;
    if (py > 14 && py < cssH - 10) ctx.fillText(y + ' m', 28, py);
  }

  // ── Draw all layers ───────────────────────────────────────────────────────
  // Render inactive visible layers behind active layer, then active on top.
  const activeLayer = layers.find(l => l.id === activeLayerId) ?? null;

  function drawLayerPolygon(layer: Layer, isActive: boolean) {
    const pts = layer.points;
    if (pts.length < 2) return;

    const colour      = LAYER_COLOURS[layer.kind] ?? '#1a56db';
    const isRef       = layer.kind === 'reference';
    const strokeAlpha = isActive ? 1 : 0.3;
    const fillAlpha   = isActive ? (isRef ? 0.04 : 0.10) : 0.04;

    if (layer.closed) {
      // Fill
      ctx.beginPath();
      const s = w2c(pts[0].x, pts[0].y, scale, panX, panY);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pts.length; i++) {
        const p = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(colour, fillAlpha);
      ctx.fill();

      // Edges
      for (let i = 0; i < pts.length; i++) {
        const a = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        const b = w2c(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y, scale, panX, panY);
        const isParty = layer.edges[i]?.isPartyWall ?? false;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (isRef) {
          ctx.strokeStyle = hexToRgba(colour, strokeAlpha * 0.7);
          ctx.setLineDash([8, 5]);
        } else if (isParty) {
          ctx.strokeStyle = `rgba(136,136,136,${strokeAlpha})`;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = hexToRgba(colour, strokeAlpha);
          ctx.setLineDash([]);
        }
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Edge length labels on active closed layer
      if (isActive) {
        ctx.font        = '11px system-ui, sans-serif';
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 0.4) continue;
          const ca = w2c(a.x, a.y, scale, panX, panY);
          const cb = w2c(b.x, b.y, scale, panX, panY);
          const mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2;
          let angle = Math.atan2(cb.y - ca.y, cb.x - ca.x);
          if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle);
          const text = len.toFixed(1) + ' m';
          const tw   = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(255,255,255,0.82)';
          ctx.fillRect(-tw / 2 - 3, -14, tw + 6, 14);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#475569';
          ctx.fillText(text, 0, -2);
          ctx.restore();
        }
      }
    } else if (isActive) {
      // Open polygon preview
      ctx.beginPath();
      const s0 = w2c(pts[0].x, pts[0].y, scale, panX, panY);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = w2c(pts[i].x, pts[i].y, scale, panX, panY);
        ctx.lineTo(p.x, p.y);
      }
      if (hoverPt) {
        const hp = w2c(hoverPt.x, hoverPt.y, scale, panX, panY);
        ctx.lineTo(hp.x, hp.y);
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth   = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vertices (only for active layer)
    if (isActive) {
      pts.forEach((pt, i) => {
        const cp = w2c(pt.x, pt.y, scale, panX, panY);
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle   = i === 0 && !layer.closed ? '#10b981' : colour;
        ctx.strokeStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }

  // Inactive layers first
  layers.forEach(layer => {
    if (!layer.visible || layer.id === activeLayerId) return;
    drawLayerPolygon(layer, false);
  });
  // Active layer on top
  if (activeLayer?.visible) {
    drawLayerPolygon(activeLayer, true);
  }

  // ── Cursor snap dot ───────────────────────────────────────────────────────
  if (activeLayer && !activeLayer.closed && hoverPt) {
    const cp = w2c(hoverPt.x, hoverPt.y, scale, panX, panY);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26, 86, 219, 0.35)';
    ctx.fill();

    const label = `${hoverPt.x.toFixed(1)}, ${hoverPt.y.toFixed(1)} m`;
    ctx.font        = '11px system-ui, sans-serif';
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(label).width;
    let lx = cp.x + 12, ly = cp.y - 8;
    if (lx + tw > cssW - 6) lx = cp.x - tw - 12;
    if (ly < 14) ly = cp.y + 18;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(lx - 2, ly - 11, tw + 4, 14);
    ctx.fillStyle = '#1e293b';
    ctx.fillText(label, lx, ly);
  }

  // ── Scale bar ─────────────────────────────────────────────────────────────
  const barM  = 5;
  const barPx = barM * scale;
  if (barPx >= 30 && barPx <= cssW * 0.4) {
    const bx = cssW - barPx - 18;
    const by = cssH - 16;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5);
    ctx.moveTo(bx + barPx, by - 5); ctx.lineTo(bx + barPx, by + 5);
    ctx.stroke();
    ctx.fillStyle    = '#374151';
    ctx.font         = '11px system-ui, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('5 m', bx + barPx / 2, by - 8);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
  /** When provided, a "Use this value" button appears in the results panel.
   *  Receives the calculated totalHL in kW. */
  onComplete?: (totalHL: number) => void;
  /**
   * When true, hides the full-page header and back button so the calculator
   * can be embedded inside a stepper step rather than rendered full-screen.
   */
  embedded?: boolean;
  /**
   * Called whenever the heat-loss result changes (or becomes null).
   * Use this in embedded mode to propagate the value to parent state.
   */
  onHeatLossChange?: (totalKw: number | null) => void;
  /**
   * Optional saved shell snapshot to rehydrate on mount.
   * When present, the calculator restores layers, active layer, and settings
   * so the drawn shape survives step navigation and save/reload.
   */
  initialShell?: ShellModel;
  /**
   * Called whenever the canvas geometry or settings change.
   * Use this to persist the shell state in parent survey state.
   */
  onShellChange?: (shell: ShellModel) => void;
  /**
   * Called whenever the canvas is repainted with a new shell.
   * Receives a PNG data-URL suitable for use as a lightweight snapshot
   * image in the presentation layer (Your House quadrant).
   * Called with null when no closed polygon exists yet.
   */
  onSnapshotChange?: (dataUrl: string | null) => void;
}

function makeLayer(name: string, kind: LayerKind, storeys = DEFAULT_STOREYS, ceilingHeight = DEFAULT_CEILING_HEIGHT): Layer {
  return { id: generateLayerId(), name, kind, visible: true, points: [], closed: false, edges: [], storeys, ceilingHeight };
}

export default function HeatLossCalculator({ onBack, onComplete, embedded, onHeatLossChange, initialShell, onShellChange, onSnapshotChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View/interaction state (pan, zoom, hover, drag) — no polygon data.
  const vsRef = useRef<ViewState>({
    scale:           40,
    panX:            -2,
    panY:            -2,
    hoverPt:         null,
    isPanning:       false,
    lastPointer:     null,
    dragIndex:       -1,
    lastPinchDist:   null,
    lastPinchCenter: null,
  });

  // Compute initial layer data once — lazy useState ensures the layer
  // (and its id) are created only on mount, and re-used by both the
  // mutable ref and the rendered state without accessing .current during render.
  // When `initialShell` is provided, restore the persisted layers instead.
  const [initialLayerData] = useState<{ layers: Layer[]; activeId: string }>(() => {
    if (initialShell && initialShell.layers.length > 0) {
      // Advance the counter so any newly created layers won't collide with
      // the restored IDs.
      advanceCounterPastIds(initialShell.layers.map(l => l.id));
      // Back-fill storeys/ceilingHeight for layers saved before per-layer height was added.
      const layers = initialShell.layers.map(l => ({
        storeys:       DEFAULT_STOREYS,
        ceilingHeight: DEFAULT_CEILING_HEIGHT,
        ...l,
      })) as Layer[];
      return { layers, activeId: initialShell.activeLayerId };
    }
    const layer = makeLayer('Original footprint', 'original');
    return { layers: [layer], activeId: layer.id };
  });

  // Mutable ref for all layers — used by canvas event handlers without
  // triggering re-renders.  Initialised from `initialLayerData.layers`.
  const layersRef = useRef<Layer[]>(initialLayerData.layers);
  // Mutable ref for the active layer ID.
  const activeLayerIdRef = useRef<string>(initialLayerData.activeId);

  const [settings, setSettings] = useState<Settings>(() =>
    initialShell ? { ...initialShell.settings } : {
      storeys:        2,
      ceilingHeight:  2.4,
      dwellingType:   'semi',
      wallType:       'cavityUninsulated',
      loftInsulation: 'mm270plus',
      glazingType:    'doubleArated',
      glazingAmount:  'medium',
      floorType:      'suspendedUninsulated',
      thermalMass:    'medium',
    }
  );

  // Layer panel UI state (mirrors layersRef for rendering).
  const [layers, setLayers] = useState<Layer[]>(initialLayerData.layers);
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerData.activeId);

  // Reactive hint + result derived from drawing state
  const [hint, setHint]     = useState<string>('Click to place first corner point');
  const [result, setResult] = useState<HeatLossResult | null>(null);
  const [closed, setClosed] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Notify parent whenever the shell geometry or settings change so the state
  // can be persisted and rehydrated on step navigation.
  const onShellChangeRef = useRef(onShellChange);
  useEffect(() => { onShellChangeRef.current = onShellChange; }, [onShellChange]);
  useEffect(() => {
    if (onShellChangeRef.current) {
      onShellChangeRef.current({ layers, activeLayerId, settings });
    }
  }, [layers, activeLayerId, settings]);

  // Snapshot callback ref — kept up to date without re-creating repaint().
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  useEffect(() => { onSnapshotChangeRef.current = onSnapshotChange; }, [onSnapshotChange]);

  /** Returns the currently active layer. */
  const getActiveLayer = useCallback((): Layer | null => {
    return layersRef.current.find(l => l.id === activeLayerIdRef.current) ?? null;
  }, []);

  /** Sync layer array to React state so the layer panel re-renders. */
  const syncLayers = useCallback(() => {
    setLayers([...layersRef.current]);
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(canvas, vsRef.current, layersRef.current, activeLayerIdRef.current);
    // Generate a snapshot after painting if any layer has a closed polygon.
    // Only fire if a consumer registered the callback.
    if (onSnapshotChangeRef.current) {
      const hasClosed = layersRef.current.some(l => l.closed && l.points.length >= 3);
      if (hasClosed) {
        try {
          onSnapshotChangeRef.current(canvas.toDataURL('image/png'));
        } catch {
          // Cross-origin canvas taint or unavailable context — silently skip.
        }
      } else {
        onSnapshotChangeRef.current(null);
      }
    }
  }, []);

  const refreshResults = useCallback(() => {
    const res = calculateHeatLoss(layersRef.current, settingsRef.current);
    setResult(res);

    const active = getActiveLayer();
    const closed_ = active?.closed ?? false;
    const pts     = active?.points ?? [];
    setClosed(closed_);
    setPointCount(pts.length);

    if (!active) {
      setHint('Select or create a layer to start drawing');
    } else if (closed_) {
      setHint('Click or tap walls to mark as party walls · Drag corners to adjust');
    } else if (pts.length === 0) {
      setHint('Click to place first corner point');
    } else if (pts.length < 3) {
      setHint(`${pts.length} point${pts.length > 1 ? 's' : ''} — keep clicking to add corners`);
    } else {
      setHint('Click the green point to close, or press Close Shape');
    }
  }, [getActiveLayer]);

  // Recompute results whenever settings change
  useEffect(() => {
    refreshResults();
    repaint();
  }, [settings, refreshResults, repaint]);

  // Propagate heat-loss result to parent (embedded mode)
  useEffect(() => {
    if (onHeatLossChange) {
      onHeatLossChange(result ? result.totalHL : null);
    }
  // onHeatLossChange is omitted intentionally — calling it only when result changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ── Canvas resize ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Wrap repaint() in requestAnimationFrame to avoid the browser warning:
    // "ResizeObserver loop completed with undelivered notifications"
    // Synchronous layout reads inside the ResizeObserver callback can cause
    // the browser to keep re-queuing notifications on the same frame.
    const observer = new ResizeObserver(() => requestAnimationFrame(() => repaint()));
    observer.observe(canvas.parentElement ?? canvas);
    repaint();
    return () => observer.disconnect();
  }, [repaint]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  const client2world = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const { scale, panX, panY } = vsRef.current;
    return {
      x: (clientX - rect.left)  / scale + panX,
      y: (clientY - rect.top)   / scale + panY,
    };
  }, []);

  const snapPt = (wx: number, wy: number): Point => ({
    x: Math.round(wx / SNAP) * SNAP,
    y: Math.round(wy / SNAP) * SNAP,
  });

  const pixelDistToPoint = useCallback((clientX: number, clientY: number, idx: number): number => {
    const layer = getActiveLayer();
    if (!layer) return Infinity;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const { scale, panX, panY } = vsRef.current;
    const cp = {
      x: (layer.points[idx].x - panX) * scale,
      y: (layer.points[idx].y - panY) * scale,
    };
    return Math.hypot(clientX - rect.left - cp.x, clientY - rect.top - cp.y);
  }, [getActiveLayer]);

  const getEdgeAtClient = useCallback((clientX: number, clientY: number): number => {
    const layer = getActiveLayer();
    if (!layer?.closed) return -1;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx = clientX - rect.left, cy = clientY - rect.top;
    const { scale, panX, panY } = vsRef.current;
    const pts = layer.points;
    let best = -1, bestDist = 12;
    for (let i = 0; i < pts.length; i++) {
      const a = { x: (pts[i].x - panX) * scale, y: (pts[i].y - panY) * scale };
      const b = { x: (pts[(i + 1) % pts.length].x - panX) * scale, y: (pts[(i + 1) % pts.length].y - panY) * scale };
      const d = pointToSegmentDist(cx, cy, a.x, a.y, b.x, b.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [getActiveLayer]);

  // ── Polygon operations ─────────────────────────────────────────────────────

  const closePolygon = useCallback(() => {
    const layer = getActiveLayer();
    if (!layer || layer.points.length < 3) return;
    layer.edges  = layer.points.map(() => ({ isPartyWall: false }));
    applyDefaultExposure(layer.points, layer.edges, settingsRef.current.dwellingType);
    layer.closed  = true;
    vsRef.current.hoverPt = null;
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const undoLastPoint = useCallback(() => {
    const layer = getActiveLayer();
    if (!layer) return;
    if (layer.closed) {
      layer.closed = false;
      layer.edges  = [];
      refreshResults();
    } else if (layer.points.length > 0) {
      layer.points.pop();
    }
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const clearAll = useCallback(() => {
    const layer = getActiveLayer();
    if (layer) {
      layer.points    = [];
      layer.closed    = false;
      layer.edges     = [];
    }
    vsRef.current.hoverPt   = null;
    vsRef.current.dragIndex = -1;
    refreshResults();
    syncLayers();
    repaint();
  }, [getActiveLayer, refreshResults, syncLayers, repaint]);

  const fitToView = useCallback(() => {
    const vs     = vsRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    const allPts = layersRef.current
      .filter(l => l.visible)
      .flatMap(l => l.points);
    if (allPts.length === 0) {
      vs.scale = 40; vs.panX = -2; vs.panY = -2;
      repaint(); return;
    }
    const xs = allPts.map(p => p.x), ys = allPts.map(p => p.y);
    const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2;
    const minY = Math.min(...ys) - 2, maxY = Math.max(...ys) + 2;
    const scX  = cssW / (maxX - minX), scY = cssH / (maxY - minY);
    vs.scale   = Math.min(scX, scY, 100);
    vs.panX    = minX; vs.panY = minY;
    repaint();
  }, [repaint]);

  // ── Layer management ───────────────────────────────────────────────────────

  const selectLayer = useCallback((id: string) => {
    activeLayerIdRef.current = id;
    vsRef.current.hoverPt   = null;
    vsRef.current.dragIndex = -1;
    setActiveLayerId(id);
    refreshResults();
    repaint();
  }, [refreshResults, repaint]);

  const addLayer = useCallback((kind: LayerKind = 'extension') => {
    const existingOfKind = layersRef.current.filter(l => l.kind === kind).length;
    let name: string;
    if (kind === 'extension') {
      name = `Extension ${existingOfKind + 1}`;
    } else if (kind === 'upper_floor') {
      const ordinal = FLOOR_ORDINALS[existingOfKind] ?? `Floor ${existingOfKind + 1}`;
      name = `${ordinal} floor`;
    } else if (kind === 'reference') {
      name = existingOfKind === 0 ? 'Reference outline' : `Reference ${existingOfKind + 1}`;
    } else {
      name = 'Original footprint';
    }
    // CHANGE 2: new layers inherit current global storey/height as a starting value.
    const s = settingsRef.current;
    const newLayer = makeLayer(name, kind, s.storeys, s.ceilingHeight);
    layersRef.current = [...layersRef.current, newLayer];
    selectLayer(newLayer.id);
  }, [selectLayer]);

  const removeLayer = useCallback((id: string) => {
    if (layersRef.current.length <= 1) return;
    const idx = layersRef.current.findIndex(l => l.id === id);
    if (idx < 0) return;
    layersRef.current = layersRef.current.filter(l => l.id !== id);
    if (activeLayerIdRef.current === id) {
      selectLayer(layersRef.current[Math.max(0, idx - 1)].id);
    } else {
      syncLayers();
      refreshResults();
      repaint();
    }
  }, [selectLayer, syncLayers, refreshResults, repaint]);

  const toggleLayerVisibility = useCallback((id: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) layer.visible = !layer.visible;
    syncLayers();
    repaint();
  }, [syncLayers, repaint]);

  const renameLayer = useCallback((id: string, name: string) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (layer) layer.name = name.trim() || layer.name;
    syncLayers();
  }, [syncLayers]);

  /** CHANGE 2: Update per-layer storeys or ceilingHeight. */
  const updateLayerHeight = useCallback((id: string, storeys?: number, ceilingHeight?: number) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (!layer) return;
    if (storeys      !== undefined) layer.storeys      = Math.max(1, storeys);
    if (ceilingHeight !== undefined) layer.ceilingHeight = Math.max(2, ceilingHeight);
    syncLayers();
    refreshResults();
  }, [syncLayers, refreshResults]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const cx     = clientX - rect.left, cy = clientY - rect.top;
    const vs     = vsRef.current;
    const wx     = cx / vs.scale + vs.panX;
    const wy     = cy / vs.scale + vs.panY;
    vs.scale     = Math.min(200, Math.max(6, vs.scale * factor));
    vs.panX      = wx - cx / vs.scale;
    vs.panY      = wy - cy / vs.scale;
    repaint();
  }, [repaint]);

  const clientPos = (e: MouseEvent | TouchEvent): Point | null => {
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }
    return { x: e.clientX, y: e.clientY };
  };

  const onPointerDown = useCallback((e: MouseEvent | TouchEvent) => {
    const pos   = clientPos(e);
    if (!pos) return;
    const vs    = vsRef.current;
    const layer = getActiveLayer();

    // Pan: middle-mouse or Alt+drag
    if ('button' in e && (e.button === 1 || (e.button === 0 && e.altKey))) {
      vs.isPanning   = true;
      vs.lastPointer = pos;
      e.preventDefault();
      return;
    }

    if (!layer) return;

    if (layer.closed) {
      // Drag existing vertex?
      for (let i = 0; i < layer.points.length; i++) {
        if (pixelDistToPoint(pos.x, pos.y, i) < 14) {
          vs.dragIndex = i;
          return;
        }
      }
      // Toggle party wall
      const edgeIdx = getEdgeAtClient(pos.x, pos.y);
      if (edgeIdx >= 0 && layer.edges[edgeIdx] != null) {
        layer.edges[edgeIdx].isPartyWall = !layer.edges[edgeIdx].isPartyWall;
        refreshResults();
        repaint();
      }
      return;
    }

    const wp      = client2world(pos.x, pos.y);
    const snapped = snapPt(wp.x, wp.y);

    // Auto-close
    if (layer.points.length >= 3 && pixelDistToPoint(pos.x, pos.y, 0) < CLOSE_PX) {
      closePolygon();
      return;
    }

    layer.points.push(snapped);
    refreshResults();
    repaint();
  }, [getActiveLayer, client2world, pixelDistToPoint, getEdgeAtClient, closePolygon, refreshResults, repaint]);

  const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    const pos   = clientPos(e);
    if (!pos) return;
    const vs    = vsRef.current;
    const layer = getActiveLayer();

    if (vs.isPanning && vs.lastPointer) {
      const dx = (pos.x - vs.lastPointer.x) / vs.scale;
      const dy = (pos.y - vs.lastPointer.y) / vs.scale;
      vs.panX -= dx; vs.panY -= dy;
      vs.lastPointer = pos;
      repaint();
      return;
    }

    if (vs.dragIndex >= 0 && layer) {
      const wp = client2world(pos.x, pos.y);
      layer.points[vs.dragIndex] = snapPt(wp.x, wp.y);
      refreshResults();
      repaint();
      return;
    }

    if (layer && !layer.closed) {
      const wp = client2world(pos.x, pos.y);
      vs.hoverPt = snapPt(wp.x, wp.y);
      repaint();
    }
  }, [getActiveLayer, client2world, refreshResults, repaint]);

  const onPointerUp = useCallback(() => {
    const vs = vsRef.current;
    vs.isPanning = false;
    if (vs.dragIndex >= 0) {
      vs.dragIndex = -1;
      refreshResults();
      repaint();
    }
  }, [refreshResults, repaint]);

  // ── Register canvas event listeners ───────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown  = (e: MouseEvent) => onPointerDown(e);
    const handleMouseMove  = (e: MouseEvent) => onPointerMove(e);
    const handleMouseUp    = () => onPointerUp();
    const handleMouseLeave = () => {
      vsRef.current.hoverPt = null;
      const layer = layersRef.current.find(l => l.id === activeLayerIdRef.current);
      if (!layer?.closed) repaint();
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      undoLastPoint();
    };

    // Touch
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      if (e.touches.length === 1) {
        onPointerDown(e);
      } else if (e.touches.length === 2) {
        vs.isPanning      = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        vs.lastPinchDist   = Math.hypot(dx, dy);
        vs.lastPinchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      if (e.touches.length === 2) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        if (vs.lastPinchDist && vs.lastPinchCenter) {
          const canvas2 = canvasRef.current!;
          const rect    = canvas2.getBoundingClientRect();
          const lc      = vs.lastPinchCenter;
          const wx      = (lc.x - rect.left) / vs.scale + vs.panX;
          const wy      = (lc.y - rect.top)  / vs.scale + vs.panY;
          vs.scale = Math.min(200, Math.max(6, vs.scale * (dist / vs.lastPinchDist)));
          vs.panX  = wx - (center.x - rect.left) / vs.scale;
          vs.panY  = wy - (center.y - rect.top)  / vs.scale;
        }
        vs.lastPinchDist   = dist;
        vs.lastPinchCenter = center;
        repaint();
        return;
      }
      onPointerMove(e);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const vs = vsRef.current;
      onPointerUp();
      vs.lastPinchDist   = null;
      vs.lastPinchCenter = null;
    };

    canvas.addEventListener('mousedown',    handleMouseDown);
    canvas.addEventListener('mousemove',    handleMouseMove);
    canvas.addEventListener('mouseup',      handleMouseUp);
    canvas.addEventListener('mouseleave',   handleMouseLeave);
    canvas.addEventListener('wheel',        handleWheel,        { passive: false });
    canvas.addEventListener('contextmenu',  handleContextMenu);
    canvas.addEventListener('touchstart',   handleTouchStart,   { passive: false });
    canvas.addEventListener('touchmove',    handleTouchMove,    { passive: false });
    canvas.addEventListener('touchend',     handleTouchEnd,     { passive: false });

    return () => {
      canvas.removeEventListener('mousedown',   handleMouseDown);
      canvas.removeEventListener('mousemove',   handleMouseMove);
      canvas.removeEventListener('mouseup',     handleMouseUp);
      canvas.removeEventListener('mouseleave',  handleMouseLeave);
      canvas.removeEventListener('wheel',       handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('touchstart',  handleTouchStart);
      canvas.removeEventListener('touchmove',   handleTouchMove);
      canvas.removeEventListener('touchend',    handleTouchEnd);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, zoomAt, undoLastPoint, repaint]);

  // ── Sync dwellingType change to existing party walls ───────────────────────

  useEffect(() => {
    const layer = getActiveLayer();
    if (layer?.closed && layer.edges.length > 0) {
      applyDefaultExposure(layer.points, layer.edges, settings.dwellingType);
      refreshResults();
      repaint();
    }
  }, [settings.dwellingType, getActiveLayer, refreshResults, repaint]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Compute once per render so IIFE and conditional expressions reuse the result.
  const activeLayerObj = layers.find(l => l.id === activeLayerId) ?? null;

  return (
    <div className={embedded ? 'hlc hlc--embedded' : 'hlc'}>
      {/* Header — hidden in embedded mode */}
      {!embedded && (
        <div className="hlc__header">
          <div className="hlc__header-title">
            <h2>🔥 Heat Loss Calculator</h2>
            <p>Sketch the ground-floor perimeter · set building assumptions · get an instant heat loss estimate</p>
          </div>
          {onBack && <button className="hlc__back-btn" onClick={onBack}>← Back</button>}
        </div>
      )}

      <div className="hlc__body">
        {/* Canvas panel */}
        <div className="hlc__canvas-panel">
          <div className="hlc__toolbar">
            <button
              className="hlc__tool-btn"
              onClick={undoLastPoint}
              disabled={pointCount === 0 && !closed}
              title="Undo last point (or right-click on canvas)"
            >
              ↩ Undo
            </button>
            <button
              className="hlc__tool-btn"
              onClick={closePolygon}
              disabled={pointCount < 3 || closed}
              title="Close the shape"
            >
              ✓ Close Shape
            </button>
            <button
              className="hlc__tool-btn"
              onClick={clearAll}
              title="Clear active layer"
            >
              🗑 Clear
            </button>
            <button
              className="hlc__tool-btn"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
                }
              }}
              title="Zoom in"
            >
              ＋
            </button>
            <button
              className="hlc__tool-btn"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
                }
              }}
              title="Zoom out"
            >
              −
            </button>
            <button
              className="hlc__tool-btn"
              onClick={fitToView}
              title="Fit to view"
            >
              ⊡ Fit
            </button>
          </div>

          <div className="hlc__canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="hlc__canvas"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="hlc__hint">{hint}</div>
          </div>
        </div>

        {/* Settings + results panel */}
        <div className="hlc__side-panel">
          {/* Layer management */}
          <div className="hlc__section">
            <div className="hlc__section-header">
              <h3>Layers</h3>
              <div className="hlc__layer-add-btns">
                <button
                  className="hlc__layer-add-btn"
                  onClick={() => addLayer('extension')}
                  title="Add extension layer"
                >
                  + Extension
                </button>
                <button
                  className="hlc__layer-add-btn"
                  onClick={() => addLayer('upper_floor')}
                  title="Add upper floor layer"
                >
                  + Upper floor
                </button>
                <button
                  className="hlc__layer-add-btn hlc__layer-add-btn--ref"
                  onClick={() => addLayer('reference')}
                  title="Add reference outline (not included in calculation)"
                >
                  + Reference
                </button>
              </div>
            </div>

            <div className="hlc__layer-list" role="list" aria-label="Drawing layers">
              {layers.map(layer => {
                const isActive = layer.id === activeLayerId;
                const colour   = LAYER_COLOURS[layer.kind] ?? '#1a56db';
                return (
                  <div
                    key={layer.id}
                    className={`hlc__layer-item${isActive ? ' hlc__layer-item--active' : ''}`}
                    role="listitem"
                    onClick={() => selectLayer(layer.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <button
                      className="hlc__layer-vis-btn"
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                      aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                      onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    >
                      {layer.visible ? '●' : '○'}
                    </button>
                    <span
                      className="hlc__layer-colour-dot"
                      style={{ background: colour }}
                      aria-hidden="true"
                    />
                    <span
                      className="hlc__layer-name"
                      title={layer.name}
                    >
                      {layer.name}
                    </span>
                    <span className={`hlc__layer-badge hlc__layer-badge--${layer.kind}`}>
                      {layer.kind.replace('_', ' ')}
                    </span>
                    {layers.length > 1 && (
                      <button
                        className="hlc__layer-del-btn"
                        title="Remove layer"
                        aria-label={`Remove layer ${layer.name}`}
                        onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rename + per-layer height for active layer */}
            {activeLayerObj && (
              <div className="hlc__layer-rename">
                <input
                  className="hlc__layer-rename-input"
                  type="text"
                  value={activeLayerObj.name}
                  onChange={e => renameLayer(activeLayerId, e.target.value)}
                  placeholder="Layer name"
                  aria-label="Active layer name"
                />
                {activeLayerObj.kind !== 'reference' && (
                  <div className="hlc__layer-height-row">
                    <div className="hlc__field hlc__field--inline">
                      <label>Storeys</label>
                      <input
                        type="number"
                        min={1} max={5} step={1}
                        value={activeLayerObj.storeys}
                        onChange={e => updateLayerHeight(activeLayerId, parseInt(e.target.value, 10) || DEFAULT_STOREYS, undefined)}
                        aria-label="Storeys for this layer"
                      />
                    </div>
                    <div className="hlc__field hlc__field--inline">
                      <label>Ceiling (m)</label>
                      <input
                        type="number"
                        min={2} max={4} step={0.1}
                        value={activeLayerObj.ceilingHeight}
                        onChange={e => updateLayerHeight(activeLayerId, undefined, parseFloat(e.target.value) || DEFAULT_CEILING_HEIGHT)}
                        aria-label="Ceiling height for this layer in metres"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Building settings */}
          <div className="hlc__section">
            <h3>Building</h3>

            {(() => {
              const isFlat = isFlatDwelling(settings.dwellingType);
              return (
                <>
                  <div className="hlc__field">
                    <label>Dwelling type</label>
                    <select
                      value={settings.dwellingType}
                      onChange={e => {
                        const next = e.target.value as Settings['dwellingType'];
                        setSettings(s => {
                          const updates: Partial<Settings> = { dwellingType: next };
                          if (next === 'flatGround') {
                            // Ground-floor flat: ceiling is neighbour's flat above, floor is ground-contact
                            updates.loftInsulation = 'neighbourHeated';
                            updates.storeys = 1;
                            if (s.floorType === 'neighbourHeated') updates.floorType = 'suspendedUninsulated';
                          } else if (next === 'flatMid') {
                            // Mid-floor flat: both floor and ceiling are neighbour's flats
                            updates.loftInsulation = 'neighbourHeated';
                            updates.floorType = 'neighbourHeated';
                            updates.storeys = 1;
                          } else if (next === 'flatPenthouse') {
                            // Top-floor flat: floor is neighbour's flat below, ceiling is exposed roof
                            updates.floorType = 'neighbourHeated';
                            updates.storeys = 1;
                            if (s.loftInsulation === 'neighbourHeated') updates.loftInsulation = 'mm270plus';
                          } else {
                            // Switching to a house type — reset neighbourHeated values to house defaults
                            if (s.loftInsulation === 'neighbourHeated') updates.loftInsulation = 'mm270plus';
                            if (s.floorType === 'neighbourHeated') updates.floorType = 'suspendedUninsulated';
                          }
                          return { ...s, ...updates };
                        });
                      }}
                    >
                      <optgroup label="Houses">
                        <option value="detached">Detached</option>
                        <option value="semi">Semi-detached</option>
                        <option value="endTerrace">End-terrace</option>
                        <option value="midTerrace">Mid-terrace</option>
                      </optgroup>
                      <optgroup label="Flats">
                        <option value="flatGround">Flat — ground floor</option>
                        <option value="flatMid">Flat — mid floor</option>
                        <option value="flatPenthouse">Flat — top floor / penthouse</option>
                      </optgroup>
                    </select>
                  </div>

                  {isFlat && (
                    <p className="hlc__field-hint" style={{ marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                      {settings.dwellingType === 'flatGround' && 'Ground-floor flat: floor is ground-contact; ceiling is neighbour\'s flat above.'}
                      {settings.dwellingType === 'flatMid' && 'Mid-floor flat: both floor and ceiling are neighbour\'s heated flats.'}
                      {settings.dwellingType === 'flatPenthouse' && 'Top-floor flat: floor is neighbour\'s flat below; ceiling is exposed roof.'}
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Fabric settings */}
          <div className="hlc__section">
            <h3>Fabric</h3>

            {(() => {
              const isFlat = isFlatDwelling(settings.dwellingType);
              return (
                <>
                  <div className="hlc__field">
                    <label>Wall construction</label>
                    <select
                      value={settings.wallType}
                      onChange={e => setSettings(s => ({ ...s, wallType: e.target.value }))}
                    >
                      <option value="solidBrick">Solid brick (U 2.1)</option>
                      <option value="cavityUninsulated">Cavity uninsulated (U 2.1 — high heat-loss band)</option>
                      <option value="cavityPartialFill">Cavity partial fill (U 0.5)</option>
                      <option value="cavityFullFill">Cavity full fill (U 0.28)</option>
                      <option value="timberFrame">Timber frame (U 0.25)</option>
                      <option value="solidStone">Solid stone (U 1.7)</option>
                    </select>
                  </div>

                  <div className="hlc__field">
                    <label>{isFlat ? 'Ceiling / roof insulation' : 'Loft insulation'}</label>
                    <select
                      value={settings.loftInsulation}
                      onChange={e => setSettings(s => ({ ...s, loftInsulation: e.target.value }))}
                    >
                      {isFlat && <option value="neighbourHeated">Neighbour&apos;s heated flat above (U 0.10)</option>}
                      <option value="none">None / exposed (U 2.3)</option>
                      <option value="mm100">100 mm insulation (U 0.35)</option>
                      <option value="mm200">200 mm insulation (U 0.18)</option>
                      <option value="mm270plus">270 mm+ insulation (U 0.13)</option>
                    </select>
                  </div>

                  <div className="hlc__field">
                    <label>Glazing type</label>
                    <select
                      value={settings.glazingType}
                      onChange={e => setSettings(s => ({ ...s, glazingType: e.target.value }))}
                    >
                      <option value="single">Single glazed (U 4.8)</option>
                      <option value="doubleOld">Double old (U 2.8)</option>
                      <option value="doubleArated">Double A-rated (U 1.4)</option>
                      <option value="triple">Triple glazed (U 0.8)</option>
                    </select>
                  </div>

                  <div className="hlc__field">
                    <label>Glazing amount</label>
                    <select
                      value={settings.glazingAmount}
                      onChange={e => setSettings(s => ({ ...s, glazingAmount: e.target.value }))}
                    >
                      <option value="low">Low (12 % of wall)</option>
                      <option value="medium">Medium (18 %)</option>
                      <option value="high">High (25 %)</option>
                    </select>
                  </div>

                  <div className="hlc__field">
                    <label>Floor type</label>
                    <select
                      value={settings.floorType}
                      onChange={e => setSettings(s => ({ ...s, floorType: e.target.value }))}
                    >
                      {isFlat && <option value="neighbourHeated">Neighbour&apos;s heated flat below (U 0.10)</option>}
                      <option value="solidUninsulated">Solid uninsulated (U 0.70)</option>
                      <option value="suspendedUninsulated">Suspended uninsulated (U 0.80)</option>
                      <option value="insulated">Insulated (U 0.20)</option>
                    </select>
                  </div>

                  <div className="hlc__field">
                    <label>Thermal mass</label>
                    <select
                      value={settings.thermalMass}
                      onChange={e => setSettings(s => ({ ...s, thermalMass: e.target.value as Settings['thermalMass'] }))}
                    >
                      <option value="light">Lightweight</option>
                      <option value="medium">Medium</option>
                      <option value="heavy">Heavy masonry</option>
                    </select>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Results */}
          <div className="hlc__section">
            <h3>Results</h3>

            {result == null ? (
              <p className="hlc__result-placeholder">
                {activeLayerObj?.kind === 'reference'
                  ? 'Reference layers are not included in the heat loss calculation.'
                  : 'Sketch the ground-floor perimeter and close the shape to see the heat loss estimate.'}
              </p>
            ) : (
              <>
                <div className="hlc__result-headline">
                  <span className="hlc__result-kw">{result.totalHL}</span>
                  <span className="hlc__result-unit">kW design heat loss</span>
                </div>

                <div className="hlc__geometry-grid">
                  <div className="hlc__geo-item">
                    <label>Floor area</label>
                    <span>{result.floorArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Perimeter</label>
                    <span>{result.perimeter} m</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Net wall area</label>
                    <span>{result.netWallArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Glazing area</label>
                    <span>{result.glazingArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Roof area</label>
                    <span>{result.roofArea} m²</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Volume</label>
                    <span>{result.volume} m³</span>
                  </div>
                  <div className="hlc__geo-item">
                    <label>Thermal inertia τ</label>
                    <span>{result.thermalInertiaTauHours} h</span>
                  </div>
                </div>

                <div className="hlc__breakdown">
                  <div className="hlc__breakdown-row">
                    <span>Walls</span>
                    <span>{result.wallHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Glazing</span>
                    <span>{result.glazingHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Roof</span>
                    <span>{result.roofHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Floor</span>
                    <span>{result.floorHL} kW</span>
                  </div>
                  <div className="hlc__breakdown-row">
                    <span>Ventilation</span>
                    <span>{result.ventHL} kW</span>
                  </div>
                </div>

                {onComplete && (
                  <button
                    className="hlc__use-btn"
                    onClick={() => onComplete(result.totalHL)}
                  >
                    ✓ Use {result.totalHL} kW
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
