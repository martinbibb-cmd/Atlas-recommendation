export const LEGO_TECHNIX_CONFIDENCE = [
  'measured',
  'user_entered',
  'manufacturer',
  'derived',
  'estimated',
  'assumed',
  'unknown',
] as const;

export type LegoTechnixConfidence = (typeof LEGO_TECHNIX_CONFIDENCE)[number];
