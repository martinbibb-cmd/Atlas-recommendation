export type ReadingColorOverlayV1 = 'none' | 'warm' | 'cool' | 'rose';
export type ReadingContrastModeV1 = 'default' | 'high';

export interface ReadingPreferencesV1 {
  fontScale: number;
  lineHeight: number;
  paragraphSpacing: number;
  letterSpacing: number;
  colorOverlay: ReadingColorOverlayV1;
  contrastMode: ReadingContrastModeV1;
  readingRulerEnabled: boolean;
  rulerOpacity: number;
  rulerLineCount: number;
  wordHighlighting: boolean;
  reducedMotion: boolean;
  textToSpeechEnabled: boolean;
}

export type AccessibilityReadingProfileV1 = ReadingPreferencesV1;

export const DEFAULT_READING_PREFERENCES_V1: ReadingPreferencesV1 = {
  fontScale: 1,
  lineHeight: 1.6,
  paragraphSpacing: 0.3,
  letterSpacing: 0,
  colorOverlay: 'none',
  contrastMode: 'default',
  readingRulerEnabled: false,
  rulerOpacity: 0.18,
  rulerLineCount: 2,
  wordHighlighting: false,
  reducedMotion: false,
  textToSpeechEnabled: false,
};
