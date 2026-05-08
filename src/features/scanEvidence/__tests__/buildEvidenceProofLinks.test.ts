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
