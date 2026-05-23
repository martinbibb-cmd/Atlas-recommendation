export const INSULATION_STATES_V1 = [
  'insulated',
  'uninsulated',
  'partial',
  'unknown',
] as const;

export type InsulationStateV1 = (typeof INSULATION_STATES_V1)[number];
