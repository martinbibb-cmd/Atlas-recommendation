import { describe, expect, it } from 'vitest';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { getConceptById } from '../taxonomy/conceptGraph';

describe('educationalContentRegistry', () => {
  it('maps all content entries to known taxonomy concept IDs', () => {
    for (const entry of educationalContentRegistry) {
      expect(getConceptById(entry.conceptId)).toBeDefined();
    }
  });

  it('requires print summaries for all MVP entries', () => {
    for (const entry of educationalContentRegistry) {
      expect(entry.printSummary.trim().length).toBeGreaterThan(0);
    }
  });

  it('requires dangerous oversimplification for all MVP entries', () => {
    for (const entry of educationalContentRegistry) {
      expect(entry.dangerousOversimplification.trim().length).toBeGreaterThan(0);
    }
  });

  it('requires at least one analogy option and one factual no-analogy option', () => {
    for (const entry of educationalContentRegistry) {
      expect(entry.analogyOptions.length).toBeGreaterThan(0);
      expect(entry.analogyOptions.some((option) => option.family !== 'none')).toBe(true);
      expect(entry.analogyOptions.some((option) => option.family === 'none')).toBe(true);
    }
  });
});
