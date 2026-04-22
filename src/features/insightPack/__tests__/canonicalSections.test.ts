/**
 * canonicalSections.test.ts
 *
 * Verifies the integrity of the canonical presentation structure:
 *   - All CANONICAL_SECTIONS have unique IDs.
 *   - SECTIONS_BY_MODE only references valid CanonicalSectionId values.
 *   - customer-pack sections are a strict subset of in-room sections.
 *   - technical-pack sections are identical to in-room sections.
 *   - sectionsForMode returns sections in canonical catalogue order.
 *   - sectionsForMode returns no duplicate IDs.
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_SECTIONS,
  SECTIONS_BY_MODE,
  sectionsForMode,
  type CanonicalSectionId,
} from '../canonicalSections';

const ALL_IDS = CANONICAL_SECTIONS.map(s => s.id);

describe('CANONICAL_SECTIONS', () => {
  it('has unique IDs', () => {
    const unique = new Set(ALL_IDS);
    expect(unique.size).toBe(ALL_IDS.length);
  });

  it('has non-empty label and icon for every section', () => {
    for (const section of CANONICAL_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      expect(section.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('has a valid tier for every section', () => {
    const validTiers = ['recommendation', 'explanation', 'technical'];
    for (const section of CANONICAL_SECTIONS) {
      expect(validTiers).toContain(section.tier);
    }
  });
});

describe('SECTIONS_BY_MODE', () => {
  it('only references valid CanonicalSectionId values', () => {
    const validIds = new Set<CanonicalSectionId>(ALL_IDS as CanonicalSectionId[]);
    for (const [mode, ids] of Object.entries(SECTIONS_BY_MODE)) {
      for (const id of ids) {
        expect(validIds.has(id as CanonicalSectionId), `${mode}: unknown section id "${id}"`).toBe(true);
      }
    }
  });

  it('customer-pack is a strict subset of in-room', () => {
    const inRoomIds = new Set(SECTIONS_BY_MODE['in-room']);
    for (const id of SECTIONS_BY_MODE['customer-pack']) {
      expect(inRoomIds.has(id), `customer-pack contains "${id}" which is not in in-room`).toBe(true);
    }
    // customer-pack must not show everything — it must be trimmed
    expect(SECTIONS_BY_MODE['customer-pack'].length).toBeLessThan(SECTIONS_BY_MODE['in-room'].length);
  });

  it('technical-pack has the same sections as in-room', () => {
    const inRoomSorted = [...SECTIONS_BY_MODE['in-room']].sort();
    const technicalSorted = [...SECTIONS_BY_MODE['technical-pack']].sort();
    expect(technicalSorted).toEqual(inRoomSorted);
  });

  it('in-room contains all 11 canonical sections', () => {
    expect(SECTIONS_BY_MODE['in-room'].length).toBe(CANONICAL_SECTIONS.length);
  });

  it('has no duplicate IDs within any mode', () => {
    for (const [mode, ids] of Object.entries(SECTIONS_BY_MODE)) {
      const unique = new Set(ids);
      expect(unique.size, `${mode} has duplicate section IDs`).toBe(ids.length);
    }
  });
});

describe('sectionsForMode', () => {
  it('returns sections in canonical catalogue order', () => {
    for (const mode of ['in-room', 'customer-pack', 'technical-pack'] as const) {
      const result = sectionsForMode(mode);
      const resultIds = result.map(s => s.id);
      // Filter canonical order to the expected IDs and compare
      const expectedOrder = ALL_IDS.filter(id =>
        (SECTIONS_BY_MODE[mode] as readonly string[]).includes(id),
      );
      expect(resultIds).toEqual(expectedOrder);
    }
  });

  it('returns no duplicate IDs', () => {
    for (const mode of ['in-room', 'customer-pack', 'technical-pack'] as const) {
      const ids = sectionsForMode(mode).map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('returns full CanonicalSection objects with all required fields', () => {
    for (const mode of ['in-room', 'customer-pack', 'technical-pack'] as const) {
      for (const section of sectionsForMode(mode)) {
        expect(section.id).toBeTruthy();
        expect(section.label).toBeTruthy();
        expect(section.icon).toBeTruthy();
        expect(section.tier).toBeTruthy();
      }
    }
  });

  it('customer-pack returns 6 sections', () => {
    expect(sectionsForMode('customer-pack').length).toBe(6);
  });

  it('in-room returns 11 sections', () => {
    expect(sectionsForMode('in-room').length).toBe(11);
  });
});
