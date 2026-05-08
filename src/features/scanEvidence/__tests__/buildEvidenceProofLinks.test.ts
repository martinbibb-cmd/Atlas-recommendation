import { describe, it, expect } from 'vitest';
import { buildEvidenceProofLinks } from '../buildEvidenceProofLinks';

describe('buildEvidenceProofLinks', () => {
  it('maps structured boiler and cylinder pins to heat-source and hot-water evidence sections', () => {
    const links = buildEvidenceProofLinks({
      rooms: [
        {
          capturePoints: [
            {
              capturePointId: 'cp-1',
              objectPins: [
                {
                  objectCategory: 'heat_source',
                  selectedTemplateId: 'boiler_condensing',
                  reviewStatus: 'confirmed',
                  provenance: 'scan_confirmed',
                  label: 'Main boiler',
                },
                {
                  objectCategory: 'hot_water_storage',
                  selectedTemplateId: 'cylinder_unvented',
                  reviewStatus: 'confirmed',
                  provenance: 'scan_confirmed',
                  label: 'Cylinder',
                },
              ],
            },
          ],
        },
      ],
    });

    const boiler = links.find((l) => l.section === 'boiler');
    const cylinder = links.find((l) => l.section === 'cylinder');
    expect(boiler?.captureRefs[0]?.label).toContain('Main boiler');
    expect(cylinder?.captureRefs[0]?.label).toContain('Cylinder');
  });

  it('surfaces manual boiler identity details (manufacturer/model/type/dimensions)', () => {
    const links = buildEvidenceProofLinks({
      rooms: [
        {
          capturePoints: [
            {
              capturePointId: 'cp-2',
              objectPins: [
                {
                  objectCategory: 'heat_source',
                  selectedTemplateId: 'manual_boiler',
                  reviewStatus: 'confirmed',
                  provenance: 'manual',
                  manualEntry: {
                    manufacturer: 'Worcester Bosch',
                    model: 'Greenstar 4000',
                    type: 'Combi',
                    dimensions: '724x400x300 mm',
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const boiler = links.find((l) => l.section === 'boiler');
    const label = boiler?.captureRefs[0]?.label ?? '';
    expect(label).toContain('Worcester Bosch');
    expect(label).toContain('Greenstar 4000');
    expect(label).toContain('type: Combi');
    expect(label).toContain('dimensions: 724x400x300 mm');
  });

  it('marks unknown/manual placeholders as needs review', () => {
    const links = buildEvidenceProofLinks({
      rooms: [
        {
          capturePoints: [
            {
              capturePointId: 'cp-3',
              objectPins: [
                {
                  objectCategory: 'heat_source',
                  selectedTemplateId: 'unknown_boiler_placeholder',
                  provenance: 'unknown',
                  reviewStatus: 'pending',
                  manualEntry: {},
                },
              ],
            },
          ],
        },
      ],
    });

    const boiler = links.find((l) => l.section === 'boiler');
    expect(boiler?.reviewStatus).toBe('unresolved');
    expect(boiler?.captureRefs[0]?.isResolved).toBe(false);
  });
});

// ─── reviewOverlay tests ──────────────────────────────────────────────────────

describe('buildEvidenceProofLinks with reviewOverlay', () => {
  const graph = {
    rooms: [
      {
        capturePoints: [
          {
            capturePointId: 'cp-boiler',
            objectPins: [
              {
                objectCategory: 'heat_source',
                selectedTemplateId: 'boiler_condensing',
                provenance: 'scan_confirmed',
                reviewStatus: 'confirmed',
                label: 'Vaillant EcoTec',
              },
            ],
          },
          {
            capturePointId: 'cp-cylinder',
            objectPins: [
              {
                objectCategory: 'hot_water_storage',
                selectedTemplateId: 'cylinder_unvented',
                provenance: 'scan_confirmed',
                reviewStatus: 'pending',
                label: 'Mixergy cylinder',
              },
            ],
          },
        ],
      },
    ],
  };

  it('promotes a needs-review capture point to confirmed via overlay', () => {
    const links = buildEvidenceProofLinks(graph, { 'cp-cylinder': 'confirmed' });
    const cylinder = links.find((l) => l.section === 'cylinder');
    expect(cylinder?.captureRefs[0]?.isResolved).toBe(true);
    expect(cylinder?.reviewStatus).toBe('confirmed');
  });

  it('excludes a capture point entirely when overlay status is rejected', () => {
    const links = buildEvidenceProofLinks(graph, { 'cp-boiler': 'rejected' });
    const boiler = links.find((l) => l.section === 'boiler');
    // boiler section should have no capture refs for cp-boiler
    const hasBoilerRef = boiler?.captureRefs.some((r) => r.capturePointId === 'cp-boiler');
    expect(hasBoilerRef).toBeFalsy();
  });

  it('keeps isResolved false for needs_review overlay even if pin was previously resolved', () => {
    const links = buildEvidenceProofLinks(graph, { 'cp-boiler': 'needs_review' });
    const boiler = links.find((l) => l.section === 'boiler');
    expect(boiler?.captureRefs[0]?.isResolved).toBe(false);
  });

  it('falls back to graph-derived value when capture point not in overlay', () => {
    const links = buildEvidenceProofLinks(graph, { 'cp-other': 'confirmed' });
    // cp-boiler should still be resolved (scan_confirmed + confirmed status in pin)
    const boiler = links.find((l) => l.section === 'boiler');
    expect(boiler?.captureRefs[0]?.isResolved).toBe(true);
  });

  it('returns empty array when all capture points are rejected via overlay', () => {
    const links = buildEvidenceProofLinks(graph, {
      'cp-boiler': 'rejected',
      'cp-cylinder': 'rejected',
    });
    // boiler and cylinder sections should be absent or have no refs
    const boiler = links.find((l) => l.section === 'boiler');
    const cylinder = links.find((l) => l.section === 'cylinder');
    expect(boiler).toBeUndefined();
    expect(cylinder).toBeUndefined();
  });
});
