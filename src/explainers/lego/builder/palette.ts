import type { PaletteItem } from './types';

export const PALETTE: PaletteItem[] = [
  { kind: 'heat_source_combi', label: 'Combi Boiler', emoji: '🔥' },
  { kind: 'heat_source_system_boiler', label: 'System Boiler', emoji: '♨️' },
  { kind: 'heat_source_regular_boiler', label: 'Regular Boiler', emoji: '🏠' },
  { kind: 'heat_source_heat_pump', label: 'Heat Pump', emoji: '🌿' },
  { kind: 'dhw_unvented_cylinder', label: 'Unvented Cylinder', emoji: '💧' },
  { kind: 'dhw_mixergy', label: 'Mixergy', emoji: '🟦' },
  { kind: 'dhw_vented_cylinder', label: 'Vented Cylinder', emoji: '🪣' },
  { kind: 'feed_and_expansion', label: 'Feed & Expansion', emoji: '🫙' },
  { kind: 'open_vent', label: 'Open Vent', emoji: '🫧' },
  { kind: 'pump', label: 'Pump', emoji: '🌀' },
  { kind: 'zone_valve', label: 'Zone Valve', emoji: '🚪' },
  { kind: 'three_port_valve', label: '3-Port Valve', emoji: '🔀' },
  { kind: 'buffer', label: 'Buffer', emoji: '🧱' },
  { kind: 'low_loss_header', label: 'LLH', emoji: '🧯' },
  { kind: 'radiator_loop', label: 'Radiators', emoji: '🌡️' },
  { kind: 'ufh_loop', label: 'UFH', emoji: '🦶' },
  { kind: 'tap_outlet', label: 'Tap', emoji: '🚰' },
  { kind: 'bath_outlet', label: 'Bath', emoji: '🛁' },
  { kind: 'shower_outlet', label: 'Shower', emoji: '🚿' },
];
