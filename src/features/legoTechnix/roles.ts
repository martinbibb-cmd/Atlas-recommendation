export const LEGO_TECHNIX_COMPONENT_ROLES = [
  'source',
  'load',
  'inline',
  'branch',
  'store',
  'exchanger',
  'control_sensor',
  'control_logic',
  'control_actuator',
  'safety',
  'meter',
  'environment',
  'pipe_edge',
] as const;

export type LegoTechnixComponentRole = (typeof LEGO_TECHNIX_COMPONENT_ROLES)[number];
