export const ATLAS_VISUAL_TOKENS = {
  surface: '#ffffff',
  surfaceMuted: '#f8fbff',
  ink: '#0f172a',
  body: '#334155',
  line: '#dbe4f0',
  lineStrong: '#94a3b8',
  warmthStrong: '#f97316',
  warmthSoft: '#fdba74',
  coolStrong: '#0ea5e9',
  coolSoft: '#bfdbfe',
  good: '#15803d',
  warn: '#b45309',
  danger: '#b91c1c',
  neutral: '#475569',
} as const;

export type AtlasVisualTone = 'good' | 'warn' | 'danger' | 'neutral';

export function getAtlasToneInk(tone: AtlasVisualTone): string {
  switch (tone) {
    case 'good':
      return ATLAS_VISUAL_TOKENS.good;
    case 'warn':
      return ATLAS_VISUAL_TOKENS.warn;
    case 'danger':
      return ATLAS_VISUAL_TOKENS.danger;
    default:
      return ATLAS_VISUAL_TOKENS.neutral;
  }
}
