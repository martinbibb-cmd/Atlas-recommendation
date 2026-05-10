export const EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS = 220;
/** Keep paragraphs short enough to reduce cognitive load in calm explanatory surfaces. */
export const EDUCATIONAL_MAX_PARAGRAPH_SENTENCES = 3;

export const educationalTypographyTokens = {
  fontFamily:
    '"Atkinson Hyperlegible", "Segoe UI", "Arial", sans-serif',
  headingFontFamily:
    '"Atkinson Hyperlegible", "Segoe UI", "Arial", sans-serif',
  headingScale: {
    section: '1.5rem',
    subsection: '1.2rem',
    card: '1rem',
  },
  lineHeight: 1.6,
  paragraphMaxWidthCh: 68,
  maxParagraphCharacters: EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS,
  maxParagraphSentences: EDUCATIONAL_MAX_PARAGRAPH_SENTENCES,
  spacing: {
    compact: '0.75rem',
    regular: '1rem',
    spacious: '1.5rem',
  },
} as const;
