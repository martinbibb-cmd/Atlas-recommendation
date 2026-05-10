export const educationalMotionTokens = {
  reducedMotionDefault: true,
  calmDurationMs: 160,
  emphasisDurationMs: 220,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  disableAnimationAttribute: 'data-motion',
} as const;

export type EducationalMotionMode = 'system' | 'reduce' | 'off';
