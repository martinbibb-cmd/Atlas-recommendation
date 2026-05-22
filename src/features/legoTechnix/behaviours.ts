export const LEGO_TECHNIX_BEHAVIOURS = [
  'generates_heat',
  'passes_through',
  'splits',
  'merges',
  'blocks_or_routes',
  'transfers_heat',
  'stores_energy',
  'accepts_expansion',
  'protects',
  'measures',
  'adds_pressure',
  'loses_heat',
  'contains_volume',
  'senses',
  'commands',
  'emits_heat_to_room',
] as const;

export type LegoTechnixBehaviour = (typeof LEGO_TECHNIX_BEHAVIOURS)[number];
