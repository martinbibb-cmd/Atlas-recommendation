import { describe, expect, it } from 'vitest';
import {
  getContentByConceptId,
  getContentByContentId,
  getContentForConcepts,
  getContentMissingAnalogyOptions,
  getContentMissingDangerousOversimplification,
  getContentMissingPrintSummary,
  getPrintableContentForConcepts,
} from '../content/contentLookup';

describe('contentLookup', () => {
  it('looks up by conceptId and contentId', () => {
    const byConcept = getContentByConceptId('CON-01');
    expect(byConcept?.contentId).toBe('EC-CON-01');

    const byContent = getContentByContentId('EC-SAF-01');
    expect(byContent?.conceptId).toBe('SAF-01');
  });

  it('returns ordered unique content for concept lists', () => {
    const entries = getContentForConcepts(['CON-01', 'CON-01', 'SIZ-02', 'unknown']);
    expect(entries.map((entry) => entry.contentId)).toEqual(['EC-CON-01', 'EC-SIZ-02']);
  });

  it('returns printable content for known concept IDs', () => {
    const entries = getPrintableContentForConcepts(['HYD-01', 'HYD-02']);
    expect(entries.map((entry) => entry.contentId)).toEqual(['EC-HYD-01', 'EC-HYD-02']);
  });

  it('reports no missing mandatory MVP fields in the seeded registry', () => {
    expect(getContentMissingPrintSummary()).toEqual([]);
    expect(getContentMissingAnalogyOptions()).toEqual([]);
    expect(getContentMissingDangerousOversimplification()).toEqual([]);
  });
});
