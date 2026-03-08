import type { PaletteItem, PaletteCategory, PaletteSection } from './types';

// ─── Categorised component palette ───────────────────────────────────────────

/** All palette items with their category assignment. */
export const PALETTE: PaletteItem[] = [
  // Heat sources
  { kind: 'heat_source_combi',         label: 'Combi Boiler',       emoji: '🔥', category: 'heat_sources'     },
  { kind: 'heat_source_system_boiler', label: 'System Boiler',       emoji: '♨️', category: 'heat_sources'     },
  { kind: 'heat_source_regular_boiler',label: 'Regular Boiler',      emoji: '🏠', category: 'heat_sources'     },
  { kind: 'heat_source_heat_pump',     label: 'Heat Pump',           emoji: '🌿', category: 'heat_sources'     },
  // Cylinders / storage
  { kind: 'dhw_unvented_cylinder',     label: 'Unvented Cylinder',   emoji: '💧', category: 'cylinders'        },
  { kind: 'dhw_mixergy',               label: 'Mixergy',             emoji: '🟦', category: 'cylinders'        },
  { kind: 'dhw_vented_cylinder',       label: 'Vented Cylinder',     emoji: '🪣', category: 'cylinders'        },
  // Controls (zone valves, motorised valves)
  { kind: 'three_port_valve',          label: 'Y-Plan Valve',        emoji: '🔀', category: 'controls'         },
  { kind: 'zone_valve',                label: 'S-Plan Zone Valve',   emoji: '🚪', category: 'controls'         },
  // Emitters
  { kind: 'radiator_loop',             label: 'Radiators',           emoji: '🌡️', category: 'emitters'         },
  { kind: 'ufh_loop',                  label: 'UFH',                 emoji: '🦶', category: 'emitters'         },
  // System support
  { kind: 'pump',                      label: 'Pump',                emoji: '🌀', category: 'system_support'   },
  { kind: 'buffer',                    label: 'Buffer',              emoji: '🧱', category: 'system_support'   },
  { kind: 'low_loss_header',           label: 'LLH',                 emoji: '🧯', category: 'system_support'   },
  { kind: 'sealed_system_kit',         label: 'Sealed System Kit',   emoji: '🔒', category: 'system_support'   },
  { kind: 'open_vent',                 label: 'Open Vent (safety)',  emoji: '🫧', category: 'system_support'   },
  { kind: 'feed_and_expansion',        label: 'Feed & Expansion',    emoji: '🫙', category: 'system_support'   },
  { kind: 'cws_cistern',               label: 'CWS Cistern',         emoji: '🛢️', category: 'system_support'   },
  // Outlets
  { kind: 'tap_outlet',                label: 'Tap',                 emoji: '🚰', category: 'outlets'          },
  { kind: 'bath_outlet',               label: 'Bath',                emoji: '🛁', category: 'outlets'          },
  { kind: 'shower_outlet',             label: 'Shower',              emoji: '🚿', category: 'outlets'          },
  { kind: 'cold_tap_outlet',           label: 'Cold tap',            emoji: '🧊', category: 'outlets'          },
];

/** Tee nodes are auto-inserted by drag-connect; they can also be placed manually. */
export const PALETTE_ADVANCED: PaletteItem[] = [
  { kind: 'tee_hot',       label: 'Hot Tee',        emoji: '🔱', category: 'system_support' },
  { kind: 'tee_cold',      label: 'Cold Tee',       emoji: '❄️', category: 'system_support' },
  { kind: 'tee_ch_flow',   label: 'CH Flow Tee',    emoji: '↗️', category: 'system_support' },
  { kind: 'tee_ch_return', label: 'CH Return Tee',  emoji: '↙️', category: 'system_support' },
];

// ─── Palette sections (ordered) ───────────────────────────────────────────────

/** The ordered list of palette sections shown in the component palette. */
export const PALETTE_SECTIONS: PaletteSection[] = [
  {
    category: 'heat_sources',
    label: 'Heat Sources',
    items: PALETTE.filter(p => p.category === 'heat_sources'),
  },
  {
    category: 'cylinders',
    label: 'Cylinders / Storage',
    items: PALETTE.filter(p => p.category === 'cylinders'),
  },
  {
    category: 'controls',
    label: 'Controls',
    items: PALETTE.filter(p => p.category === 'controls'),
  },
  {
    category: 'emitters',
    label: 'Emitters',
    items: PALETTE.filter(p => p.category === 'emitters'),
  },
  {
    category: 'system_support',
    label: 'System Support',
    items: PALETTE.filter(p => p.category === 'system_support'),
  },
  {
    category: 'outlets',
    label: 'Outlets',
    items: PALETTE.filter(p => p.category === 'outlets'),
  },
];

/** Convenience: all palette items (PALETTE + PALETTE_ADVANCED) in one flat list. */
export const ALL_PALETTE_ITEMS: PaletteItem[] = [...PALETTE, ...PALETTE_ADVANCED];

// ─── Category display names ───────────────────────────────────────────────────

export const PALETTE_CATEGORY_LABELS: Record<PaletteCategory, string> = {
  heat_sources:   'Heat Sources',
  cylinders:      'Cylinders / Storage',
  controls:       'Controls',
  emitters:       'Emitters',
  system_support: 'System Support',
  outlets:        'Outlets',
};
