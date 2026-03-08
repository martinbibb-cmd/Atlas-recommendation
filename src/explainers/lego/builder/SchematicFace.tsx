/**
 * SchematicFace — shared schematic component face renderer.
 *
 * Exports three forms of the same component face:
 *
 *   SchematicFaceContent   Inner SVG elements only (no <svg> wrapper).
 *                          Use when embedding inside a parent <svg> or <g>.
 *
 *   SchematicFace          Standalone 170×74 SVG element.
 *                          Used by the builder token renderer (WorkbenchCanvas).
 *
 *   SchematicFaceToken     Positioned nested <svg> for embedding inside the
 *                          Play mode LabCanvas SVG at a given (x, y, w, h).
 *                          The 170×74 viewBox is preserved; content is scaled
 *                          to fit the requested dimensions.
 *
 * Both Builder and Play must render the same face for a given component kind so
 * that "Play" looks like "running the built schematic", not a separate diagram.
 */

import React from 'react';
import type { PartKind } from './types';
import { PALETTE } from './palette';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kindEmoji(kind: PartKind): string {
  return PALETTE.find(p => p.kind === kind)?.emoji ?? '🧩';
}

// ─── SchematicFaceContent ─────────────────────────────────────────────────────

interface SchematicFaceProps {
  kind: PartKind;
  label: string;
  slot?: string;
}

/**
 * Inner SVG content for a component schematic face.
 * Returns SVG child elements only — no outer <svg> wrapper.
 * The coordinate space is 170×74 (TOKEN_W × TOKEN_H).
 */
export function SchematicFaceContent({
  kind,
  label,
  slot,
}: SchematicFaceProps): React.ReactElement {
  const slotBadge = slot ? (
    <text x="85" y="69" textAnchor="middle" fontSize="7" fill="#805ad5" fontWeight="700">
      Outlet {slot}
    </text>
  ) : null;

  // ── Combi boiler: split CH / DHW zones ──────────────────────────────────
  if (kind === 'heat_source_combi') {
    return (
      <>
        {/* CH / DHW zone divider */}
        <line x1="8" y1="42" x2="162" y2="42" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 3" opacity="0.65"/>
        {/* Boiler casing outline */}
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#c05621" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="20" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7b341e">CH</text>
        <text x="85" y="36" textAnchor="middle" fontSize="15">🔥</text>
        <text x="85" y="58" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2c5282">DCW / DHW</text>
        {slotBadge}
      </>
    )
  }

  // ── System / regular boiler: simple 2-port heat source ──────────────────
  if (kind === 'heat_source_system_boiler' || kind === 'heat_source_regular_boiler') {
    const shortLabel = kind === 'heat_source_system_boiler' ? 'SYSTEM' : 'REGULAR';
    return (
      <>
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#c05621" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="30" textAnchor="middle" fontSize="18">🔥</text>
        <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7b341e">{shortLabel} BOILER</text>
        {slotBadge}
      </>
    )
  }

  // ── Heat pump: 2-port heat source with efficiency focus ──────────────────
  if (kind === 'heat_source_heat_pump') {
    return (
      <>
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#276749" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="30" textAnchor="middle" fontSize="18">♻️</text>
        <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#22543d">HEAT PUMP</text>
        {slotBadge}
      </>
    )
  }

  // ── Cylinder: left coil, top hot, bottom cold ────────────────────────────
  if (
    kind === 'dhw_unvented_cylinder' ||
    kind === 'dhw_vented_cylinder' ||
    kind === 'dhw_mixergy'
  ) {
    const typeLabel =
      kind === 'dhw_mixergy' ? 'MIXERGY' :
      kind === 'dhw_unvented_cylinder' ? 'UNVENTED' : 'VENTED';
    return (
      <>
        {/* Cylinder body — inset left to leave room for coil path */}
        <rect x="26" y="3" width="120" height="68" rx="20" fill="none" stroke="#2b6cb0" strokeWidth="1.5" opacity="0.55"/>
        {/* Mixergy top-entry HX band */}
        {kind === 'dhw_mixergy' && (
          <rect x="26" y="3" width="120" height="16" rx="12" fill="none"
                stroke="#c05621" strokeWidth="1" strokeDasharray="3 2" opacity="0.55"/>
        )}
        {/* Coil indicator on the left face: matches coil_flow (T+18) / coil_return (B-18) ports */}
        <path d="M26,20 Q13,24 26,30 Q13,35 26,40 Q13,45 26,52"
              fill="none" stroke="#c05621" strokeWidth="2" opacity="0.65"/>
        {/* Type label */}
        <text x="86" y="30" textAnchor="middle" fontSize="8" fontWeight="800" fill="#2c5282">{typeLabel}</text>
        <text x="86" y="48" textAnchor="middle" fontSize="13">💧</text>
        {slotBadge}
      </>
    )
  }

  // ── Three-port valve (Y-plan): visually distinct routing device ──────────
  if (kind === 'three_port_valve') {
    return (
      <>
        {/* Valve body ellipse */}
        <ellipse cx="82" cy="37" rx="42" ry="28" fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.55"/>
        {/* Flow paths */}
        <line x1="0"   y1="37" x2="40"  y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="124" y1="37" x2="170" y2="18" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="124" y1="37" x2="170" y2="56" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        {/* Junction node */}
        <circle cx="124" cy="37" r="3" fill="#6b46c1" opacity="0.5"/>
        <text x="82" y="32" textAnchor="middle" fontSize="8"  fontWeight="800" fill="#553c9a">Y-PLAN</text>
        <text x="82" y="43" textAnchor="middle" fontSize="7"  fill="#553c9a">3-port valve</text>
        {slotBadge}
      </>
    )
  }

  // ── Zone valve (S-plan): simple through-flow valve with actuator ─────────
  if (kind === 'zone_valve') {
    return (
      <>
        {/* Pipe stubs */}
        <line x1="0"   y1="37" x2="57"  y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="113" y1="37" x2="170" y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        {/* Valve disc */}
        <circle cx="85" cy="37" r="26" fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.55"/>
        {/* Actuator stem */}
        <line x1="85" y1="11" x2="85" y2="4"  stroke="#6b46c1" strokeWidth="2"   opacity="0.5"/>
        <rect  x="75" y="2"  width="20" height="7" rx="2" fill="none" stroke="#6b46c1" strokeWidth="1.2" opacity="0.5"/>
        <text x="85" y="33" textAnchor="middle" fontSize="8" fontWeight="800" fill="#553c9a">ZONE</text>
        <text x="85" y="44" textAnchor="middle" fontSize="7" fill="#553c9a">VALVE</text>
        {slotBadge}
      </>
    )
  }

  // ── Radiator loop: fin-panel emitter ────────────────────────────────────
  if (kind === 'radiator_loop') {
    return (
      <>
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <rect key={i} x={22 + i * 18} y="14" width="12" height="44" rx="3"
                fill="none" stroke="#6b46c1" strokeWidth="1.2" opacity="0.5"/>
        ))}
        <text x="85" y="68" textAnchor="middle" fontSize="7" fontWeight="800" fill="#553c9a">RADIATORS</text>
        {slotBadge}
      </>
    )
  }

  // ── UFH loop: serpentine emitter ─────────────────────────────────────────
  if (kind === 'ufh_loop') {
    return (
      <>
        <path d="M20,20 H150 V37 H20 V54 H150"
              fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <text x="85" y="70" textAnchor="middle" fontSize="7" fontWeight="800" fill="#553c9a">UNDERFLOOR HEATING</text>
        {slotBadge}
      </>
    )
  }

  // ── Generic fallback: emoji + label in SVG ───────────────────────────────
  const emoji = kindEmoji(kind)
  return (
    <>
      <text x="85" y="30" textAnchor="middle" fontSize="20">{emoji}</text>
      <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2d3748">{label}</text>
      {slotBadge}
    </>
  )
}

// ─── SchematicFace (standalone builder token) ─────────────────────────────────

/**
 * Renders a component-specific schematic face inside a standalone 170×74 SVG.
 * Used by the builder token renderer (WorkbenchCanvas) to represent each placed
 * component on the workbench canvas.
 */
export function SchematicFace({
  kind,
  label,
  slot,
}: SchematicFaceProps): React.ReactElement {
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
      <SchematicFaceContent kind={kind} label={label} slot={slot} />
    </svg>
  )
}

// ─── SchematicFaceToken (positioned play-mode token) ─────────────────────────

interface SchematicFaceTokenProps {
  kind: PartKind;
  label: string;
  /** Left edge of the token in the parent SVG coordinate space. */
  x: number;
  /** Top edge of the token in the parent SVG coordinate space. */
  y: number;
  /** Rendered width of the token (content is scaled from 170 to this width). */
  width: number;
  /** Rendered height of the token (content is scaled from 74 to this height). */
  height: number;
}

/**
 * Renders a schematic face as a positioned nested <svg> for embedding inside
 * the Play mode LabCanvas SVG.
 *
 * The face uses the canonical 170×74 viewBox so the visual language is
 * identical to the builder — the token is simply scaled to fit the requested
 * width/height in the play scene coordinate space.
 *
 * Animation / state overlays should be rendered by the caller on top of this
 * element (e.g. glow rects, fill bars, status text).
 */
export function SchematicFaceToken({
  kind,
  label,
  x,
  y,
  width,
  height,
}: SchematicFaceTokenProps): React.ReactElement {
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 170 74"
      overflow="visible"
      aria-hidden="true"
    >
      <SchematicFaceContent kind={kind} label={label} />
    </svg>
  )
}
