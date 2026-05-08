/**
 * evidenceExplainers.test.ts
 *
 * Unit tests for getExplainerForSection and groupLinksBySection.
 */

import { describe, it, expect } from 'vitest';
import {
  getExplainerForSection,
  groupLinksBySection,
  SECTION_HEADING_LABELS,
} from '../evidenceExplainers';
import type { EvidenceProofLinkV1 } from '../EvidenceProofLinkV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLink(
  section: EvidenceProofLinkV1['section'],
  resolved: boolean,
  cardKey: 'key-objects' | 'measurements' | 'ghost-appliances' | 'what-scanned' | 'open-review' = 'key-objects',
): EvidenceProofLinkV1 {
  return {
    section,
    captureRefs: [
      {
        capturePointId: `cp-${section}`,
        storyboardCardKey: cardKey,
        label: section,
        isResolved: resolved,
      },
    ],
    reviewStatus: resolved ? 'confirmed' : 'unresolved',
  };
}

// ─── getExplainerForSection ────────────────────────────────────────────────────

describe('getExplainerForSection', () => {
  it('returns null when links array is empty', () => {
    expect(getExplainerForSection('boiler', [], false)).toBeNull();
    expect(getExplainerForSection('boiler', [], true)).toBeNull();
  });

  it('returns the boiler explainer in engineer mode regardless of resolved status', () => {
    const result = getExplainerForSection('boiler', [makeLink('boiler', false)], false);
    expect(result).not.toBeNull();
    expect(result!.customerText).toContain('boiler location');
    expect(result!.engineerNotes).toContain('Boiler position');
  });

  it('returns null in customer mode when no refs are confirmed', () => {
    const unresolvedLink = makeLink('boiler', false);
    expect(getExplainerForSection('boiler', [unresolvedLink], true)).toBeNull();
  });

  it('returns the explainer in customer mode when at least one ref is confirmed', () => {
    const resolvedLink = makeLink('cylinder', true);
    const result = getExplainerForSection('cylinder', [resolvedLink], true);
    expect(result).not.toBeNull();
    expect(result!.customerText).toContain('storage location');
  });

  it('returns the flue explainer with engineer notes', () => {
    const result = getExplainerForSection('flue', [makeLink('flue', true)], false);
    expect(result!.customerText).toContain('flue route');
    expect(result!.engineerNotes).toContain('Part J');
  });

  it('returns the radiators explainer', () => {
    const result = getExplainerForSection('radiators', [makeLink('radiators', true)], false);
    expect(result!.customerText).toContain('emitter');
  });

  it('returns ghost-appliance explainer when general section has ghost-appliance refs', () => {
    const ghostLink = makeLink('general', true, 'ghost-appliances');
    const result = getExplainerForSection('general', [ghostLink], false);
    expect(result!.customerText).toContain('overlaid the proposed appliance');
    expect(result!.engineerNotes).toContain('Ghost appliance');
  });

  it('returns ghost-appliance explainer in customer mode when resolved', () => {
    const ghostLink = makeLink('general', true, 'ghost-appliances');
    const result = getExplainerForSection('general', [ghostLink], true);
    expect(result!.customerText).toContain('overlaid the proposed appliance');
  });

  it('returns default general explainer when no ghost-appliance refs', () => {
    const measurementLink = makeLink('general', true, 'measurements');
    const result = getExplainerForSection('general', [measurementLink], false);
    expect(result!.customerText).toContain('overall recommendation');
  });

  it('all sections have both customerText and engineerNotes', () => {
    const sections = ['boiler', 'cylinder', 'flue', 'radiators', 'general'] as const;
    for (const section of sections) {
      const result = getExplainerForSection(section, [makeLink(section, true)], false);
      expect(result!.customerText.length).toBeGreaterThan(10);
      expect(result!.engineerNotes.length).toBeGreaterThan(10);
    }
  });
});

// ─── groupLinksBySection ───────────────────────────────────────────────────────

describe('groupLinksBySection', () => {
  it('returns empty map when no links provided', () => {
    expect(groupLinksBySection([])).toEqual(new Map());
  });

  it('groups links by section and preserves canonical order', () => {
    const links: EvidenceProofLinkV1[] = [
      makeLink('general', true),
      makeLink('boiler', true),
      makeLink('cylinder', false),
    ];
    const grouped = groupLinksBySection(links);
    const keys = Array.from(grouped.keys());
    expect(keys).toEqual(['boiler', 'cylinder', 'general']);
  });

  it('accumulates multiple links for the same section', () => {
    const links: EvidenceProofLinkV1[] = [
      makeLink('boiler', true),
      makeLink('boiler', false),
    ];
    const grouped = groupLinksBySection(links);
    expect(grouped.get('boiler')!.length).toBe(2);
  });

  it('omits sections with no links', () => {
    const links = [makeLink('flue', true)];
    const grouped = groupLinksBySection(links);
    expect(grouped.has('boiler')).toBe(false);
    expect(grouped.has('flue')).toBe(true);
  });
});

// ─── SECTION_HEADING_LABELS ────────────────────────────────────────────────────

describe('SECTION_HEADING_LABELS', () => {
  it('has a heading for every proposal section', () => {
    const sections = ['boiler', 'cylinder', 'flue', 'radiators', 'general'] as const;
    for (const section of sections) {
      expect(SECTION_HEADING_LABELS[section]).toBeTruthy();
    }
  });
});
