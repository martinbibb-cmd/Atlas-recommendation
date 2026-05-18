import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VISUAL_PRIMITIVE_REGISTRY } from '../visualPrimitiveRegistry';
import {
  GALLERY_RENDERED_REGISTRY_IDS,
  VISUAL_PRIMITIVE_GALLERY_COVERAGE,
  buildVisualPrimitiveQaSummary,
} from '../galleryQa';
import { VisualPrimitiveGallery } from '../VisualPrimitiveGallery';

describe('visual primitive gallery QA coverage', () => {
  it('ensures all registry entries are rendered or explicitly marked missing', () => {
    const registryIds = [...new Set(VISUAL_PRIMITIVE_REGISTRY.map(entry => entry.id))].sort();
    const coverageIds = Object.keys(VISUAL_PRIMITIVE_GALLERY_COVERAGE).sort();

    expect(coverageIds).toEqual(registryIds);

    for (const [id, coverage] of Object.entries(VISUAL_PRIMITIVE_GALLERY_COVERAGE)) {
      expect(['rendered', 'missing']).toContain(coverage.status);

      if (coverage.status === 'rendered') {
        expect(GALLERY_RENDERED_REGISTRY_IDS.has(id)).toBe(true);
      }
      if (coverage.status === 'missing') {
        expect(coverage.note?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('enforces immediately recognisable status for critical primitive groups', () => {
    const summary = buildVisualPrimitiveQaSummary(VISUAL_PRIMITIVE_REGISTRY);
    expect(summary.criticalRecognisabilityFailures).toEqual([]);
  });
});

describe('VisualPrimitiveGallery QA surface', () => {
  it('renders a primary no-label fixture section', () => {
    render(<VisualPrimitiveGallery />);

    expect(screen.getByTestId('vp-gallery-primary-no-label-fixture')).toBeTruthy();
    expect(screen.getByText(/Primary fixture — no-label recognisability/i)).toBeTruthy();
    expect(screen.getByTestId('vp-gallery-physical-fidelity-callouts').textContent).toContain('Primitive fidelity rule');
  });

  it('shows fail and warn states in QA banner when failing/warning primitives exist', () => {
    render(<VisualPrimitiveGallery />);
    const banner = screen.getByTestId('vp-gallery-qa-banner');

    expect(banner.textContent).toContain('FAIL');
    expect(banner.textContent).toContain('needs_rebuild');
    expect(banner.textContent).toContain('abstract_placeholder');
    expect(banner.textContent).toContain('WARN');
    expect(banner.textContent).toContain('recognisable_with_context');
  });
});
