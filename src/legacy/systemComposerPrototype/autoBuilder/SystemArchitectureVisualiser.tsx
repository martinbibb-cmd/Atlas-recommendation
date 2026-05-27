/**
 * SystemArchitectureVisualiser.tsx
 *
 * Schematic block visualiser that shows a heating system as a four-layer
 * module grid (heat source → controls → DHW storage → emitters).
 *
 * Three view modes:
 *
 *   current        — shows the customer's existing system
 *   recommendation — shows the recommended replacement / upgrade system
 *   compare        — side-by-side diff with kept/removed/added/future_ready overlays
 *
 * Design rules (from Atlas terminology guidelines):
 *   - Schematic, modular, professional — not toy-like
 *   - Calm colour palette; state overlays carry semantic meaning only
 *   - No Math.random() — entirely deterministic
 *   - All data from SystemConceptModel (derived from EngineOutputV1 or survey)
 *
 * Usage:
 *   // Current system from survey:
 *   const concept = systemBuilderToConceptModel(surveyState.systemBuilder);
 *   <SystemArchitectureVisualiser mode="current" currentSystem={concept} />
 *
 *   // Recommended system:
 *   const concept = optionToConceptModel('stored_unvented', true);
 *   <SystemArchitectureVisualiser mode="recommendation" recommendedSystem={concept} />
 *
 *   // Compare:
 *   <SystemArchitectureVisualiser
 *     mode="compare"
 *     currentSystem={current}
 *     recommendedSystem={recommended}
 *     futurePathways={[{ id: 'solar_connection' }]}
 *   />
 */

import React from 'react';
import type { SystemConceptModel } from '../model/types';
import {
  conceptToCurrentModules,
  conceptToRecommendedModules,
  diffConcepts,
  type FuturePathwayItem,
} from './diffSystemModules';
import type { SystemModule, ModuleState, ModuleVisualId, VisualiserMode } from './autoBuilderTypes';
import './SystemArchitectureVisualiser.css';

// ─── SVG palette ──────────────────────────────────────────────────────────────

const STROKE       = '#334155';   // primary structural stroke (dark slate)
const STROKE_LIGHT = '#94a3b8';   // detail / secondary stroke
const FILL_BODY    = '#f1f5f9';   // boiler / appliance body
const FILL_ACCENT  = '#cbd5e1';   // secondary component fill
const FILL_WATER   = '#bfdbfe';   // water / cylinder fill (light blue)
const FILL_FLAME   = '#fde68a';   // flame / burner glow
const FILL_GREEN   = '#bbf7d0';   // future-ready / green accent
const FILL_SOLAR   = '#fef9c3';   // solar panel fill
const SVG_SIZE     = 64;          // pixel dimensions of each module icon

const svgProps = {
  width:   SVG_SIZE,
  height:  SVG_SIZE,
  viewBox: `0 0 ${SVG_SIZE} ${SVG_SIZE}`,
  style:   { display: 'block' } as React.CSSProperties,
  'aria-hidden': true as const,
};

// ─── SVG primitives ───────────────────────────────────────────────────────────

/** Rectangular appliance body with rounded corners. */
function SvgBoilerBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={3} fill={FILL_BODY} stroke={STROKE} strokeWidth={2} />;
}

/** Stylised flame — teardrop path, clearly readable at small sizes. */
function SvgFlame({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M${cx} ${cy + 5} C${cx - 4} ${cy + 2} ${cx - 4} ${cy - 2} ${cx} ${cy - 6} C${cx + 4} ${cy - 2} ${cx + 4} ${cy + 2} ${cx} ${cy + 5}Z`}
      fill={FILL_FLAME}
      stroke={STROKE}
      strokeWidth={1}
    />
  );
}

/** Circulator pump circle with an inner arrow suggesting rotation. */
function SvgPump({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${cx - 2} ${cy - 2} L${cx + 2} ${cy} L${cx - 2} ${cy + 2}`} fill="none" stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

/** Expansion vessel — pill/capsule shape with bladder divider line. */
function SvgExpansion({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={4.5} ry={6} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 4.5} y1={cy} x2={cx + 4.5} y2={cy} stroke={STROKE} strokeWidth={1} />
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy - 9} stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

/**
 * Upright cylinder — rounded rectangle body with elliptical top and bottom caps
 * to give depth/3-D feel.
 */
function SvgCylinder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const rx = w / 2;
  const ry = Math.max(2.5, w * 0.12);
  const cx = x + rx;
  return (
    <>
      {/* Body */}
      <rect x={x} y={y + ry} width={w} height={h - ry} rx={1} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
      {/* Top cap */}
      <ellipse cx={cx} cy={y + ry} rx={rx} ry={ry} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
      {/* Bottom cap (over body bottom) */}
      <ellipse cx={cx} cy={y + h} rx={rx} ry={ry} fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
    </>
  );
}

/** Plate heat exchanger — narrow rectangle with vertical flow lines. */
function SvgPlateHex({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={12} height={18} rx={2} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      {[3, 6, 9].map(dx => (
        <line key={dx} x1={x + dx} y1={y + 3} x2={x + dx} y2={y + 15} stroke={STROKE} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Small open cistern / loft F&E tank — open-top rectangle. */
function SvgLoftTank({ x, y }: { x: number; y: number }) {
  // Open-top: three sides only
  return (
    <g>
      <path d={`M${x} ${y} L${x} ${y + 9} L${x + 16} ${y + 9} L${x + 16} ${y}`} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
      {/* Water surface line */}
      <line x1={x + 2} y1={y + 5} x2={x + 14} y2={y + 5} stroke={STROKE_LIGHT} strokeWidth={1} strokeDasharray="2 1" />
    </g>
  );
}

/** Heat pump outdoor unit — landscape cabinet with prominent fan circle. */
function SvgHeatPumpUnit({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fr = h * 0.32;
  return (
    <g>
      {/* Cabinet */}
      <rect x={x} y={y} width={w} height={h} rx={3} fill={FILL_BODY} stroke={STROKE} strokeWidth={2} />
      {/* Fan grille circle */}
      <circle cx={cx} cy={cy} r={fr} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      {/* Fan cross blades */}
      <line x1={cx - fr * 0.7} y1={cy - fr * 0.7} x2={cx + fr * 0.7} y2={cy + fr * 0.7} stroke={STROKE} strokeWidth={1} />
      <line x1={cx + fr * 0.7} y1={cy - fr * 0.7} x2={cx - fr * 0.7} y2={cy + fr * 0.7} stroke={STROKE} strokeWidth={1} />
      <line x1={cx} y1={cy - fr} x2={cx} y2={cy + fr} stroke={STROKE} strokeWidth={1} />
      <line x1={cx - fr} y1={cy} x2={cx + fr} y2={cy} stroke={STROKE} strokeWidth={1} />
      {/* Hub */}
      <circle cx={cx} cy={cy} r={fr * 0.18} fill={FILL_BODY} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

/** Y-plan 3-port valve — round body with 3 clearly-spaced pipe stubs. */
function SvgThreePortValve({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={2} />
      {/* Left pipe */}
      <line x1={cx - 10} y1={cy} x2={cx - 17} y2={cy} stroke={STROKE} strokeWidth={2} />
      {/* Right pipe */}
      <line x1={cx + 10} y1={cy} x2={cx + 17} y2={cy} stroke={STROKE} strokeWidth={2} />
      {/* Bottom pipe */}
      <line x1={cx} y1={cy + 10} x2={cx} y2={cy + 17} stroke={STROKE} strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill={STROKE}>Y</text>
    </g>
  );
}

/** S-plan — two side-by-side 2-port zone valves. */
function SvgTwoZoneValves({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Left valve */}
      <circle cx={cx - 10} cy={cy} r={8} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 10} y1={cy - 8} x2={cx - 10} y2={cy - 15} stroke={STROKE} strokeWidth={2} />
      <text x={cx - 10} y={cy + 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={STROKE}>S</text>
      {/* Right valve */}
      <circle cx={cx + 10} cy={cy} r={8} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx + 10} y1={cy - 8} x2={cx + 10} y2={cy - 15} stroke={STROKE} strokeWidth={2} />
      <text x={cx + 10} y={cy + 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={STROKE}>S</text>
    </g>
  );
}

/** HP buffer / low-loss header — tall rectangle with horizontal pipe stubs. */
function SvgBufferDiverter({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Header vessel */}
      <rect x={cx - 9} y={cy - 16} width={18} height={32} rx={3} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={2} />
      {/* Left connection */}
      <line x1={cx - 9} y1={cy - 7} x2={cx - 16} y2={cy - 7} stroke={STROKE} strokeWidth={2} />
      {/* Right connection */}
      <line x1={cx + 9} y1={cy + 7} x2={cx + 16} y2={cy + 7} stroke={STROKE} strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="6" fontWeight="700" fill={STROKE}>LLH</text>
    </g>
  );
}

/** Panel radiator — five fins with horizontal header pipes. */
function SvgRadiators({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Header pipes */}
      <line x1={x} y1={y + 2} x2={x + 32} y2={y + 2} stroke={STROKE} strokeWidth={2} />
      <line x1={x} y1={y + 20} x2={x + 32} y2={y + 20} stroke={STROKE} strokeWidth={2} />
      {/* Fins */}
      {[2, 8, 14, 20, 26].map(i => (
        <rect key={i} x={x + i} y={y + 2} width={4} height={18} rx={1} fill={FILL_BODY} stroke={STROKE} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Underfloor heating — serpentine pipe loops above a slab line. */
function SvgUFH({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Slab / floor */}
      <rect x={x} y={y + 14} width={36} height={4} rx={1} fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
      {/* Serpentine loops */}
      <path
        d={`M${x + 4} ${y + 14} Q${x + 4} ${y + 4} ${x + 12} ${y + 4} Q${x + 20} ${y + 4} ${x + 20} ${y + 14}`}
        fill="none" stroke={STROKE} strokeWidth={1.5}
      />
      <path
        d={`M${x + 20} ${y + 14} Q${x + 20} ${y + 4} ${x + 28} ${y + 4} Q${x + 36} ${y + 4} ${x + 36} ${y + 14}`}
        fill="none" stroke={STROKE} strokeWidth={1.5}
      />
    </g>
  );
}

/** Solar / PV panel — grid-divided rectangle with dashed border. */
function SvgSolarPanel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={FILL_SOLAR} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 2" />
      <line x1={x + w / 3} y1={y} x2={x + w / 3} y2={y + h} stroke={STROKE_LIGHT} strokeWidth={1} />
      <line x1={x + (w * 2) / 3} y1={y} x2={x + (w * 2) / 3} y2={y + h} stroke={STROKE_LIGHT} strokeWidth={1} />
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={STROKE_LIGHT} strokeWidth={1} />
    </g>
  );
}

/** Heat-pump-ready placeholder — dashed circle, prominent "HP" label. */
function SvgHeatPumpReady({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={16} fill={FILL_GREEN} stroke={STROKE} strokeWidth={1.5} strokeDasharray="5 3" />
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="9" fontWeight="700" fill={STROKE}>HP</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="6" fill={STROKE}>ready</text>
    </g>
  );
}

// ─── Module graphic ────────────────────────────────────────────────────────────

function ModuleGraphic({ visualId }: { visualId: ModuleVisualId }) {
  switch (visualId) {

    // ── Regular boiler ─────────────────────────────────────────────────────
    // Open-vented: F&E cistern top-right, open vent pipe stub, boiler body left
    case 'regular_boiler':
      return (
        <svg {...svgProps}>
          {/* Boiler body */}
          <SvgBoilerBox x={6} y={12} w={28} h={36} />
          <SvgFlame cx={20} cy={34} />
          {/* Open-vent / flow pipe stub out of the top */}
          <line x1={20} y1={12} x2={20} y2={6} stroke={STROKE} strokeWidth={2} />
          {/* F&E cistern — open at top, top-right area */}
          <SvgLoftTank x={38} y={8} />
          {/* Feed pipe down from cistern to boiler */}
          <line x1={46} y1={17} x2={46} y2={26} stroke={STROKE} strokeWidth={1.5} />
          <line x1={34} y1={26} x2={46} y2={26} stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── System boiler ──────────────────────────────────────────────────────
    // Sealed system: expansion vessel top-right, pump bottom-right, no cistern
    case 'system_boiler':
      return (
        <svg {...svgProps}>
          {/* Boiler body */}
          <SvgBoilerBox x={6} y={12} w={28} h={36} />
          <SvgFlame cx={20} cy={34} />
          {/* Expansion vessel — sealed system marker */}
          <SvgExpansion cx={48} cy={20} />
          {/* Circulator pump */}
          <SvgPump cx={48} cy={38} />
          {/* Connection pipes */}
          <line x1={34} y1={20} x2={43} y2={20} stroke={STROKE} strokeWidth={1.5} />
          <line x1={34} y1={38} x2={43} y2={38} stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Combi boiler ───────────────────────────────────────────────────────
    // Sealed + integrated plate HEX visible, pump, expansion vessel
    case 'combi_boiler':
      return (
        <svg {...svgProps}>
          {/* Boiler body — slightly wider to show integrated components */}
          <SvgBoilerBox x={4} y={8} w={30} h={40} />
          <SvgFlame cx={19} cy={30} />
          {/* Plate HEX inside the body — key differentiator */}
          <SvgPlateHex x={24} y={18} />
          {/* Expansion vessel */}
          <SvgExpansion cx={50} cy={18} />
          {/* Pump */}
          <SvgPump cx={50} cy={38} />
          {/* Connection pipes */}
          <line x1={34} y1={18} x2={45} y2={18} stroke={STROKE} strokeWidth={1.5} />
          <line x1={34} y1={38} x2={45} y2={38} stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Storage combi boiler ───────────────────────────────────────────────
    // Like combi but with a small integral store attached (visible as mini cylinder)
    case 'storage_combi_boiler':
      return (
        <svg {...svgProps}>
          {/* Boiler body */}
          <SvgBoilerBox x={4} y={10} w={26} h={38} />
          <SvgFlame cx={17} cy={32} />
          {/* Plate HEX inside */}
          <SvgPlateHex x={20} y={16} />
          {/* Integral small store — mini cylinder to the right of the boiler */}
          <rect x={34} y={18} width={14} height={22} rx={2} fill={FILL_WATER} stroke={STROKE} strokeWidth={1.5} />
          <ellipse cx={41} cy={18} rx={7} ry={2.5} fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
          <ellipse cx={41} cy={40} rx={7} ry={2.5} fill={FILL_WATER} stroke={STROKE} strokeWidth={1} />
          {/* Connection between boiler and store */}
          <line x1={30} y1={26} x2={34} y2={26} stroke={STROKE} strokeWidth={1.5} />
          <line x1={30} y1={34} x2={34} y2={34} stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Heat pump ──────────────────────────────────────────────────────────
    // Landscape outdoor unit with prominent fan
    case 'heat_pump':
      return (
        <svg {...svgProps}>
          <SvgHeatPumpUnit x={4} y={12} w={56} h={40} />
        </svg>
      );

    // ── Y-plan controls ────────────────────────────────────────────────────
    case 'y_plan':
      return (
        <svg {...svgProps}>
          <SvgThreePortValve cx={32} cy={32} />
        </svg>
      );

    // ── S-plan controls ────────────────────────────────────────────────────
    case 's_plan':
      return (
        <svg {...svgProps}>
          <SvgTwoZoneValves cx={32} cy={32} />
        </svg>
      );

    // ── S-plan multi-zone ──────────────────────────────────────────────────
    case 's_plan_multi_zone':
      return (
        <svg {...svgProps}>
          <SvgTwoZoneValves cx={32} cy={28} />
          {/* Extra zone indicator */}
          <circle cx={32} cy={52} r={6} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={1.5} />
          <text x={32} y={55} textAnchor="middle" fontSize="6" fontWeight="700" fill={STROKE}>+Z</text>
        </svg>
      );

    // ── HP buffer / low-loss header ────────────────────────────────────────
    case 'hp_diverter':
      return (
        <svg {...svgProps}>
          <SvgBufferDiverter cx={32} cy={32} />
        </svg>
      );

    // ── Integral controls (combi, no external zone valve) ──────────────────
    // Wall thermostat / room stat silhouette
    case 'controls_integral':
      return (
        <svg {...svgProps}>
          {/* Thermostat housing */}
          <rect x={16} y={14} width={32} height={36} rx={4} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={2} />
          {/* Dial circle */}
          <circle cx={32} cy={32} r={11} fill={FILL_BODY} stroke={STROKE} strokeWidth={1.5} />
          {/* Temperature needle */}
          <line x1={32} y1={32} x2={32} y2={23} stroke={STROKE} strokeWidth={1.5} />
          {/* Tick marks — 12 evenly spaced positions around the dial, sorted 0°→330° */}
          {[0, 30, 60, 90, 120, 150, 180, -150, -120, -90, -60, -30].map(angle => {
            const r1 = 8;
            const r2 = 10;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={32 + r1 * Math.sin(rad)}
                y1={32 - r1 * Math.cos(rad)}
                x2={32 + r2 * Math.sin(rad)}
                y2={32 - r2 * Math.cos(rad)}
                stroke={STROKE_LIGHT}
                strokeWidth={1}
              />
            );
          })}
        </svg>
      );

    // ── Vented (open-vented) cylinder ──────────────────────────────────────
    // Cold-water cistern above the cylinder, vent pipe over the top
    case 'vented_cylinder':
      return (
        <svg {...svgProps}>
          {/* Cold water cistern — open at top, sits above cylinder */}
          <SvgLoftTank x={22} y={4} />
          {/* Feed pipe from cistern to cylinder */}
          <line x1={30} y1={13} x2={30} y2={20} stroke={STROKE} strokeWidth={1.5} />
          {/* Cylinder */}
          <SvgCylinder x={18} y={20} w={28} h={38} />
          {/* Open vent pipe out of the top — key differentiator */}
          <line x1={38} y1={20} x2={38} y2={10} stroke={STROKE} strokeWidth={2} />
          <line x1={35} y1={10} x2={42} y2={10} stroke={STROKE} strokeWidth={2} />
        </svg>
      );

    // ── Unvented cylinder ──────────────────────────────────────────────────
    // Sealed dome, pressure-relief (tundish) stub at side — no cistern
    case 'unvented_cylinder':
      return (
        <svg {...svgProps}>
          {/* Cylinder — taller, starts higher — no cistern above */}
          <SvgCylinder x={18} y={8} w={28} h={46} />
          {/* Pressure relief / tundish stub — key differentiator */}
          <line x1={46} y1={46} x2={54} y2={46} stroke={STROKE} strokeWidth={2} />
          <path d={`M54 42 L58 46 L54 50`} fill="none" stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Thermal store ──────────────────────────────────────────────────────
    // Cylinder with visible internal HEX coil — distinct from unvented
    case 'thermal_store': {
      // Cylinder positioned at x=16, y=8, w=32, h=48 — coil loops centred within it
      const coilCx = 32;   // horizontal centre of cylinder
      const coilRx = 12;   // half-width of each coil loop
      const coilRy = 4;    // half-height of each loop
      const coilRows = [24, 36] as const;  // y-centres for the two coil rows
      return (
        <svg {...svgProps}>
          <SvgCylinder x={16} y={8} w={32} h={48} />
          {/* Internal HEX coil loops — key differentiator vs unvented cylinder */}
          {coilRows.map(cy => (
            <path
              key={cy}
              d={`M${coilCx - coilRx} ${cy} Q${coilCx} ${cy - coilRy * 2} ${coilCx + coilRx} ${cy} Q${coilCx + coilRx * 1.5} ${cy + coilRy} ${coilCx + coilRx} ${cy + coilRy * 2} Q${coilCx} ${cy + coilRy * 4} ${coilCx - coilRx} ${cy + coilRy * 2} Q${coilCx - coilRx * 1.5} ${cy + coilRy} ${coilCx - coilRx} ${cy}Z`}
              fill="none"
              stroke={STROKE}
              strokeWidth={1.5}
            />
          ))}
        </svg>
      );
    }

    // ── Mixergy stratified cylinder ────────────────────────────────────────
    // Like unvented but with gradient stratification bands
    case 'mixergy_cylinder':
      return (
        <svg {...svgProps}>
          <SvgCylinder x={18} y={8} w={28} h={46} />
          {/* Stratification gradient bands */}
          <rect x={19} y={9}  width={26} height={10} rx={1} fill="#bfdbfe" opacity={0.95} />
          <rect x={19} y={19} width={26} height={10} rx={0} fill="#93c5fd" opacity={0.75} />
          <rect x={19} y={29} width={26} height={10} rx={0} fill="#60a5fa" opacity={0.55} />
          {/* Pressure relief stub */}
          <line x1={46} y1={46} x2={54} y2={46} stroke={STROKE} strokeWidth={2} />
          <path d={`M54 42 L58 46 L54 50`} fill="none" stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Combi on-demand hot water ──────────────────────────────────────────
    // Plate HEX with mains-in/hot-out flow arrows
    case 'combi_on_demand':
      return (
        <svg {...svgProps}>
          <SvgPlateHex x={26} y={16} />
          {/* Mains cold in — top arrow downward */}
          <line x1={32} y1={16} x2={32} y2={8} stroke={STROKE} strokeWidth={2} />
          <path d={`M29 10 L32 6 L35 10`} fill="none" stroke={STROKE} strokeWidth={1.5} />
          {/* Hot out — bottom arrow downward */}
          <line x1={32} y1={34} x2={32} y2={48} stroke={STROKE} strokeWidth={2} />
          <path d={`M29 46 L32 50 L35 46`} fill="none" stroke={STROKE} strokeWidth={1.5} />
        </svg>
      );

    // ── Radiators ─────────────────────────────────────────────────────────
    case 'radiators':
      return (
        <svg {...svgProps}>
          <SvgRadiators x={14} y={22} />
        </svg>
      );

    // ── Underfloor heating ─────────────────────────────────────────────────
    case 'ufh':
      return (
        <svg {...svgProps}>
          <SvgUFH x={14} y={22} />
        </svg>
      );

    // ── Mixed emitters ─────────────────────────────────────────────────────
    case 'mixed_emitters':
      return (
        <svg {...svgProps}>
          {/* Left side: radiator fins */}
          <SvgRadiators x={4} y={20} />
          {/* Divider */}
          <line x1={36} y1={14} x2={36} y2={50} stroke={STROKE_LIGHT} strokeWidth={1} strokeDasharray="3 2" />
          {/* Right side: UFH loops */}
          <SvgUFH x={38} y={26} />
        </svg>
      );

    // ── Solar / PV connection ──────────────────────────────────────────────
    case 'solar_connection':
      return (
        <svg {...svgProps}>
          <SvgSolarPanel x={8} y={8} w={48} h={32} />
          <line x1={32} y1={40} x2={32} y2={54} stroke={STROKE} strokeWidth={2} strokeDasharray="4 2" />
        </svg>
      );

    // ── Heat-pump-ready future pathway ────────────────────────────────────
    case 'heat_pump_ready':
      return (
        <svg {...svgProps}>
          <SvgHeatPumpReady cx={32} cy={32} />
        </svg>
      );

    default:
      return <svg {...svgProps} />;
  }
}

// ─── Module block ─────────────────────────────────────────────────────────────

function ModuleBlock({ module }: { module: SystemModule }) {
  const stateClass = `sav-module--${module.state}`;
  const stateLabel: Record<ModuleState, string | null> = {
    current:     null,
    recommended: null,
    kept:        null,
    removed:     'Removed',
    added:       'Added',
    future_ready:'Future-ready',
  };
  const badge = stateLabel[module.state];
  const ariaLabel = `${module.label}${badge ? ` (${badge})` : ''}`;

  return (
    <div className={`sav-module ${stateClass}`} role="figure" aria-label={ariaLabel}>
      <div className="sav-module__graphic" aria-hidden="true">
        <ModuleGraphic visualId={module.visualId} />
      </div>
      <div className="sav-module__text">
        <span className="sav-module__label">{module.label}</span>
        {module.sublabel && (
          <span className="sav-module__sublabel">{module.sublabel}</span>
        )}
      </div>
      {badge && (
        <span className="sav-module__badge" aria-hidden="true">{badge}</span>
      )}
    </div>
  );
}

// ─── Layer row ────────────────────────────────────────────────────────────────

function LayerRow({
  heading,
  modules,
}: {
  heading: string;
  modules: SystemModule[];
}) {
  if (modules.length === 0) return null;
  return (
    <div className="sav-layer">
      <p className="sav-layer__heading" aria-hidden="true">{heading}</p>
      <div className="sav-layer__blocks">
        {modules.map(m => <ModuleBlock key={m.id} module={m} />)}
      </div>
    </div>
  );
}

// ─── Role heading map ─────────────────────────────────────────────────────────

const ROLE_HEADINGS: Record<string, string> = {
  heat_source:  'Heat source',
  controls:     'Controls',
  dhw_storage:  'Hot water',
  emitters:     'Emitters',
};

// ─── Group modules by role ────────────────────────────────────────────────────

function groupModulesByRole(modules: SystemModule[]): Record<string, SystemModule[]> {
  const groups: Record<string, SystemModule[]> = {
    heat_source: [],
    controls:    [],
    dhw_storage: [],
    emitters:    [],
  };
  for (const m of modules) {
    if (groups[m.role]) groups[m.role].push(m);
    else groups[m.role] = [m];
  }
  return groups;
}

// ─── Single system panel ──────────────────────────────────────────────────────

function SystemPanel({
  title,
  modules,
  className,
}: {
  title: string;
  modules: SystemModule[];
  className?: string;
}) {
  // Separate future-ready items from architecture layers
  const futureModules   = modules.filter(m => m.state === 'future_ready');
  const standardModules = modules.filter(m => m.state !== 'future_ready');

  const byRoleStd = groupModulesByRole(standardModules);

  return (
    <div className={`sav-panel ${className ?? ''}`}>
      <p className="sav-panel__title">{title}</p>
      <div className="sav-panel__layers">
        {(['heat_source', 'controls', 'dhw_storage', 'emitters'] as const).map(role => (
          <LayerRow
            key={role}
            heading={ROLE_HEADINGS[role]}
            modules={byRoleStd[role] ?? []}
          />
        ))}
        {futureModules.length > 0 && (
          <LayerRow heading="Future pathway" modules={futureModules} />
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SystemArchitectureVisualiserProps {
  /**
   * Display mode.
   *
   *  current        — render the customer's existing system only
   *  recommendation — render the recommended system only
   *  compare        — side-by-side diff with state overlays
   */
  mode: VisualiserMode;
  /**
   * The customer's current system concept model (required for 'current'
   * and 'compare' modes).
   */
  currentSystem?: SystemConceptModel;
  /**
   * The recommended system concept model (required for 'recommendation'
   * and 'compare' modes).
   */
  recommendedSystem?: SystemConceptModel;
  /**
   * Future-ready pathway items shown at the bottom of the recommended panel
   * (compare mode only) or recommendation panel (recommendation mode only).
   * Each item is tagged 'future_ready' and rendered with a dashed blue overlay.
   */
  futurePathways?: FuturePathwayItem[];
  /**
   * Optional heading to display above the visualiser.
   * Defaults to a mode-appropriate string if not provided.
   */
  title?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * SystemArchitectureVisualiser
 *
 * Renders a heating system as a schematic four-layer block diagram.
 * Supports three display modes (current / recommendation / compare).
 */
export default function SystemArchitectureVisualiser({
  mode,
  currentSystem,
  recommendedSystem,
  futurePathways = [],
  title,
}: SystemArchitectureVisualiserProps) {

  if (mode === 'current') {
    if (!currentSystem) return null;
    const modules = conceptToCurrentModules(currentSystem);
    return (
      <div className="sav sav--current" data-testid="sav-current">
        {title && <p className="sav__heading">{title}</p>}
        <SystemPanel title="Current system" modules={modules} />
      </div>
    );
  }

  if (mode === 'recommendation') {
    if (!recommendedSystem) return null;
    const modules = conceptToRecommendedModules(recommendedSystem, futurePathways);
    return (
      <div className="sav sav--recommendation" data-testid="sav-recommendation">
        {title && <p className="sav__heading">{title}</p>}
        <SystemPanel title="Recommended system" modules={modules} />
      </div>
    );
  }

  // compare mode
  if (!currentSystem || !recommendedSystem) return null;
  const diff = diffConcepts(currentSystem, recommendedSystem, futurePathways);

  return (
    <div className="sav sav--compare" data-testid="sav-compare">
      {title && <p className="sav__heading">{title}</p>}
      <div className="sav__compare-grid">
        <SystemPanel
          title="Your current system"
          modules={diff.current}
          className="sav-panel--current"
        />
        <div className="sav__compare-arrow" aria-hidden="true">→</div>
        <SystemPanel
          title="Recommended system"
          modules={diff.recommended}
          className="sav-panel--recommended"
        />
      </div>
      <div className="sav__legend" aria-label="Diff legend">
        <span className="sav-legend-item sav-legend-item--kept">No change</span>
        <span className="sav-legend-item sav-legend-item--removed">Removed</span>
        <span className="sav-legend-item sav-legend-item--added">Added</span>
        {futurePathways.length > 0 && (
          <span className="sav-legend-item sav-legend-item--future_ready">Future-ready</span>
        )}
      </div>
    </div>
  );
}
