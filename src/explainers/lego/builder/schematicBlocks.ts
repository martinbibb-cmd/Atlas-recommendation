/**
 * schematicBlocks — shared schematic component definitions.
 *
 * Single source of truth for:
 *  - component dimensions (width / height in canvas units)
 *  - port positions expressed as normalised offsets on a named side
 *  - semantic port roles used by smart-attach, validation and the Play renderer
 *
 * Both the builder token renderer and the Play mode renderer derive their port
 * positions from the same SchematicComponentDefinition records, ensuring that
 * what the user builds is exactly what Play later animates.
 *
 * Canonical visible grammar
 * ─────────────────────────
 *  Regular / system boiler : flow_out (R), return_in (L)
 *  Combi                   : flow_out (R), return_in (L), cold_in (L, bottom), hot_out (R, bottom)
 *  Cylinder                : coil_flow (L, top), coil_return (L, bottom), hot_out (T, centre), cold_in (B, centre)
 *  Emitters                : flow_in (L), return_out (R)
 *  Y-plan valve            : flow_in (L), hw_out (R, top), ch_out (R, bottom)
 *  S-plan zone valve       : flow_in (L), flow_out (R)
 *  S-plan+ zone manifold   : flow_in (L), zone_out_n (R, evenly spaced)
 *  HP diverter             : flow_in (L), ch_out (R, top), dhw_out (R, bottom)
 */

import { TOKEN_W, TOKEN_H } from './ports'

// ─── Axis types ───────────────────────────────────────────────────────────────

export type HeatSourceKind = 'regular' | 'system' | 'combi' | 'heat_pump'
export type StorageKind = 'standard' | 'mixergy'
export type SupplyKind = 'vented' | 'unvented'

// ─── Two-axis cylinder model ──────────────────────────────────────────────────

/**
 * Two independent axes of variation for hot-water storage vessels.
 *
 * storageKind (thermal / structural)
 *   standard — side coil through body; no internal stratification pump
 *   mixergy  — top-entry heat exchanger covering the top 20 %; internal
 *              stratification pump; cold diffuser at bottom
 *
 * supplyKind (supply-pressure domain)
 *   vented   — tank-fed supply from a CWS cistern (gravity head)
 *   unvented — mains-fed supply (sealed pressurised vessel)
 *
 * These axes are independent: all four combinations are valid.
 * The PartKind union maps them as follows:
 *   dhw_vented_cylinder   → storageKind:'standard', supplyKind:'vented'
 *   dhw_unvented_cylinder → storageKind:'standard', supplyKind:'unvented'
 *   dhw_mixergy           → storageKind:'mixergy',  supplyKind:'unvented' (default)
 * The fourth combination (mixergy + vented) is valid but rare; no separate PartKind
 * is used for it — it is expressed via CylinderModel directly when needed.
 */
export interface CylinderModel {
  storageKind: StorageKind;
  supplyKind: SupplyKind;
}

// ─── Shared port definition ───────────────────────────────────────────────────

/**
 * Port definition in terms of side and normalised position along that side.
 *
 * `side`   — which face of the component the port sits on
 * `x`      — for top/bottom: normalised 0–1 along the width (0=left, 1=right)
 *            for left/right: normalised 0–1 along the height (0=top, 1=bottom)
 * `y`      — reserved; always 0 in the current layout (no stacking within a face)
 * `direction` — the flow direction through this port from the component's perspective
 * `semanticRole` — the hydraulic/thermal domain this port belongs to
 */
export interface SchematicPortDef {
  id: string;
  label: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Normalised position along the named side (0–1). */
  x: number;
  /** Reserved for future stacking; currently always 0. */
  y: number;
  direction: 'in' | 'out' | 'bidirectional';
  semanticRole?: 'flow' | 'return' | 'hot' | 'cold' | 'vent' | 'feed' | 'unknown';
}

/**
 * Visual hierarchy tier for a schematic component.
 *
 * large  — major plant (heat source, cylinder, buffer/LLH, emitters).
 *          Rendered as full schematic blocks that dominate the canvas.
 *
 * medium — routing / control devices (pump, zone valve, 3-port valve).
 *          Rendered as compact inline schematic symbols.  Hit area keeps
 *          the full TOKEN_W × TOKEN_H rectangle for touch usability.
 *
 * small  — support accessories (sealed system kit, open vent, F&E tank).
 *          Rendered as minimal annotation symbols attached to the flow
 *          spine.  Still fully interactive.
 */
export type ComponentVisualSize = 'large' | 'medium' | 'small';

/**
 * Shared component contract used by both the builder token renderer and the
 * Play mode renderer.  Width and height are in canvas units (px at 1×).
 */
export interface SchematicComponentDefinition {
  kind: string;
  width: number;
  height: number;
  ports: SchematicPortDef[];
  /** Visual hierarchy tier — controls rendering weight and token styling. */
  visualSize: ComponentVisualSize;
}

// ─── Canonical component registry ─────────────────────────────────────────────

/**
 * Convert a SchematicPortDef to absolute (dx, dy) pixel offsets on a
 * TOKEN_W × TOKEN_H block, for compatibility with the builder's PortDef type.
 *
 * Normalised position 0 on the left/right side = top edge; 1 = bottom edge.
 * Normalised position 0 on the top/bottom side = left edge; 1 = right edge.
 */
export function schematicPortToDxDy(
  port: SchematicPortDef,
  width: number,
  height: number,
): { dx: number; dy: number } {
  switch (port.side) {
    case 'left':
      return { dx: 0, dy: port.x * height }
    case 'right':
      return { dx: width, dy: port.x * height }
    case 'top':
      return { dx: port.x * width, dy: 0 }
    case 'bottom':
      return { dx: port.x * width, dy: height }
  }
}

/**
 * Registry of canonical SchematicComponentDefinitions.
 *
 * All components that appear in both the builder palette and the Play renderer
 * must have an entry here.  Components absent from this registry fall back to
 * the legacy portsForKind() definition in ports.ts.
 */
export const SCHEMATIC_REGISTRY: Record<string, SchematicComponentDefinition> = {
  // ── Heat sources ──────────────────────────────────────────────────────────

  heat_source_combi: {
    kind: 'heat_source_combi',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // CH circuit — both ports on right (system side): flow near top, return near bottom
      { id: 'flow_out',  label: 'flow',    side: 'right', x: 18 / TOKEN_H,            y: 0, direction: 'out', semanticRole: 'flow'    },
      { id: 'return_in', label: 'return',  side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return'  },
      // DHW circuit — cold in on left, hot out on right
      { id: 'cold_in',   label: 'dcw in',  side: 'left',  x: 1.0,                      y: 0, direction: 'in',  semanticRole: 'cold'    },
      { id: 'hot_out',   label: 'dhw out', side: 'right', x: 1.0,                      y: 0, direction: 'out', semanticRole: 'hot'     },
    ],
  },

  heat_source_system_boiler: {
    kind: 'heat_source_system_boiler',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // Both CH ports on right (system side): flow near top, return near bottom
      { id: 'flow_out',  label: 'flow',   side: 'right', x: 18 / TOKEN_H,             y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'return_in', label: 'return', side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return' },
    ],
  },

  heat_source_regular_boiler: {
    kind: 'heat_source_regular_boiler',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // Both CH ports on right (system side): flow near top, return near bottom
      { id: 'flow_out',  label: 'flow',   side: 'right', x: 18 / TOKEN_H,             y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'return_in', label: 'return', side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return' },
    ],
  },

  heat_source_heat_pump: {
    kind: 'heat_source_heat_pump',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // Both CH ports on right (system side): flow near top, return near bottom
      { id: 'flow_out',  label: 'flow',   side: 'right', x: 18 / TOKEN_H,             y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'return_in', label: 'return', side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return' },
    ],
  },

  // ── Cylinders / storage ───────────────────────────────────────────────────

  dhw_unvented_cylinder: {
    kind: 'dhw_unvented_cylinder',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // Primary heating circuit on left (coil)
      { id: 'coil_flow',   label: 'flow',    side: 'left',   x: 18 / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'coil_return', label: 'return',  side: 'left',   x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'return' },
      // Domestic circuit: hot out top-centre, cold in bottom-centre
      { id: 'hot_out',     label: 'hot out', side: 'top',    x: 0.5, y: 0, direction: 'out', semanticRole: 'hot'    },
      { id: 'cold_in',     label: 'cold in', side: 'bottom', x: 0.5, y: 0, direction: 'in',  semanticRole: 'cold'   },
    ],
  },

  dhw_vented_cylinder: {
    kind: 'dhw_vented_cylinder',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'coil_flow',   label: 'flow',    side: 'left',   x: 18 / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'coil_return', label: 'return',  side: 'left',   x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'return' },
      { id: 'hot_out',     label: 'hot out', side: 'top',    x: 0.5, y: 0, direction: 'out', semanticRole: 'hot'    },
      { id: 'cold_in',     label: 'cold in', side: 'bottom', x: 0.5, y: 0, direction: 'in',  semanticRole: 'cold'   },
    ],
  },

  dhw_mixergy: {
    kind: 'dhw_mixergy',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      // Mixergy top-entry heat exchanger: coil ports on left, near top
      { id: 'coil_flow',   label: 'flow',    side: 'left',   x: 18 / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'coil_return', label: 'return',  side: 'left',   x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'return' },
      // Domestic: hot out top-centre, cold diffuser at bottom-centre
      { id: 'hot_out',     label: 'hot out', side: 'top',    x: 0.5, y: 0, direction: 'out', semanticRole: 'hot'    },
      { id: 'cold_in',     label: 'cold in', side: 'bottom', x: 0.5, y: 0, direction: 'in',  semanticRole: 'cold'   },
    ],
  },

  // ── Controls ──────────────────────────────────────────────────────────────

  /** Y-plan: single 3-port motorised valve routing flow to CH or HW. */
  three_port_valve: {
    kind: 'three_port_valve',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'medium',
    ports: [
      { id: 'in',    label: 'flow in', side: 'left',  x: 0.5,            y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'out_a', label: 'hw out',  side: 'right', x: 18 / TOKEN_H,   y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'out_b', label: 'ch out',  side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'flow' },
    ],
  },

  /** S-plan: independent 2-port zone valve (one per zone). */
  zone_valve: {
    kind: 'zone_valve',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'medium',
    ports: [
      { id: 'in',    label: 'flow in',  side: 'left',  x: 0.5, y: 0, direction: 'in',  semanticRole: 'flow' },
      { id: 'out_a', label: 'flow out', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'flow' },
    ],
  },

  // ── Emitters ──────────────────────────────────────────────────────────────

  radiator_loop: {
    kind: 'radiator_loop',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'flow_in',    label: 'flow',   side: 'left',  x: 0.5, y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'return_out', label: 'return', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'return' },
    ],
  },

  ufh_loop: {
    kind: 'ufh_loop',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'flow_in',    label: 'flow',   side: 'left',  x: 0.5, y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'return_out', label: 'return', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'return' },
    ],
  },

  // ── System support ────────────────────────────────────────────────────────

  /** Buffer tank / low-loss header: two-sided separator (source ↔ load). */
  buffer: {
    kind: 'buffer',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'primary_flow',     label: 'src flow',    side: 'left',  x: 18 / TOKEN_H,            y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'primary_return',   label: 'src return',  side: 'left',  x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'return' },
      { id: 'secondary_flow',   label: 'load flow',   side: 'right', x: 18 / TOKEN_H,            y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'secondary_return', label: 'load return', side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return' },
    ],
  },

  low_loss_header: {
    kind: 'low_loss_header',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'primary_flow',     label: 'src flow',    side: 'left',  x: 18 / TOKEN_H,            y: 0, direction: 'in',  semanticRole: 'flow'   },
      { id: 'primary_return',   label: 'src return',  side: 'left',  x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'out', semanticRole: 'return' },
      { id: 'secondary_flow',   label: 'load flow',   side: 'right', x: 18 / TOKEN_H,            y: 0, direction: 'out', semanticRole: 'flow'   },
      { id: 'secondary_return', label: 'load return', side: 'right', x: (TOKEN_H - 18) / TOKEN_H, y: 0, direction: 'in',  semanticRole: 'return' },
    ],
  },

  pump: {
    kind: 'pump',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'medium',
    ports: [
      { id: 'in',  label: 'in',  side: 'left',  x: 0.5, y: 0, direction: 'in',  semanticRole: 'flow' },
      { id: 'out', label: 'out', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'flow' },
    ],
  },

  /**
   * Sealed system kit (expansion vessel + pressure relief valve + filling loop).
   * Single connection port on the heating flow circuit.
   */
  sealed_system_kit: {
    kind: 'sealed_system_kit',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'small',
    ports: [
      { id: 'circuit_in', label: 'circuit', side: 'right', x: 0.5, y: 0, direction: 'in', semanticRole: 'flow' },
    ],
  },

  open_vent: {
    kind: 'open_vent',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'small',
    ports: [
      { id: 'vent_in',  label: 'vent in',  side: 'left',  x: 0.5, y: 0, direction: 'in',  semanticRole: 'vent' },
      { id: 'vent_out', label: 'vent out', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'vent' },
    ],
  },

  feed_and_expansion: {
    kind: 'feed_and_expansion',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'small',
    ports: [
      { id: 'feed_in', label: 'feed', side: 'right', x: 0.5, y: 0, direction: 'in', semanticRole: 'feed' },
    ],
  },

  cws_cistern: {
    kind: 'cws_cistern',
    width: TOKEN_W,
    height: TOKEN_H,
    visualSize: 'large',
    ports: [
      { id: 'cold_out', label: 'cold', side: 'right', x: 0.5, y: 0, direction: 'out', semanticRole: 'cold' },
    ],
  },
}

// ─── Cylinder model helpers ───────────────────────────────────────────────────

/**
 * Derive a CylinderModel from a PartKind string.
 *
 * Returns null for non-cylinder kinds.
 */
export function cylinderModelFromKind(kind: string): CylinderModel | null {
  switch (kind) {
    case 'dhw_vented_cylinder':
      return { storageKind: 'standard', supplyKind: 'vented' }
    case 'dhw_unvented_cylinder':
      return { storageKind: 'standard', supplyKind: 'unvented' }
    case 'dhw_mixergy':
      return { storageKind: 'mixergy', supplyKind: 'unvented' }
    default:
      return null
  }
}

/**
 * Derive the canonical PartKind from a CylinderModel.
 *
 * mixergy+vented is mapped to the nearest standard PartKind ('dhw_mixergy')
 * with the supplyKind retained in the model for downstream logic.
 */
export function kindFromCylinderModel(model: CylinderModel): string {
  if (model.storageKind === 'mixergy') return 'dhw_mixergy'
  return model.supplyKind === 'vented' ? 'dhw_vented_cylinder' : 'dhw_unvented_cylinder'
}
