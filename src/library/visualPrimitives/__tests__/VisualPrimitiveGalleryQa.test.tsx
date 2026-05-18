import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VISUAL_PRIMITIVE_REGISTRY } from '../visualPrimitiveRegistry';
import {
  GALLERY_RENDERED_REGISTRY_IDS,
  NO_LABEL_ARIA_REQUIRED_IDS,
  VISUAL_PRIMITIVE_GALLERY_COVERAGE,
  buildVisualPrimitiveQaSummary,
} from '../galleryQa';
import { VisualPrimitiveGallery } from '../VisualPrimitiveGallery';
import {
  BoilerPrimitive,
  CylinderPrimitive,
  RadiatorPrimitive,
  PumpPrimitive,
  PowerflushMachinePrimitive,
  PressureGaugePrimitive,
  HeaderTankPrimitive,
} from '../primitives';

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

  it('NO_LABEL_ARIA_REQUIRED_IDS only contains immediately_recognisable primitives', () => {
    const immediatelyRecognisable = new Set(
      VISUAL_PRIMITIVE_REGISTRY
        .filter(e => e.recognisability === 'immediately_recognisable')
        .map(e => e.id),
    );
    for (const id of NO_LABEL_ARIA_REQUIRED_IDS) {
      expect(immediatelyRecognisable.has(id)).toBe(true);
    }
  });
});

describe('VisualPrimitiveGallery QA surface', () => {
  it('renders a primary no-label fixture section', () => {
    render(<VisualPrimitiveGallery />);

    expect(screen.getByTestId('vp-gallery-primary-no-label-fixture')).toBeTruthy();
    expect(screen.getByText(/Primary fixture — no-label recognisability/i)).toBeTruthy();
    expect(screen.getByTestId('vp-gallery-physical-fidelity-callouts').textContent).toContain('Primitive fidelity rule');
  });

  it('renders the human reviewer checklist and tracks answered questions', () => {
    render(<VisualPrimitiveGallery />);

    expect(screen.getByTestId('vp-gallery-human-review')).toBeTruthy();
    expect(screen.getByText(/Can I name the object with labels hidden\?/i)).toBeTruthy();
    expect(screen.getByTestId('vp-gallery-human-review-status').textContent).toContain('0 of 7 answered');

    fireEvent.click(screen.getByTestId('vp-gallery-human-review-name_without_labels-yes'));

    expect(screen.getByTestId('vp-gallery-human-review-status').textContent).toContain('1 of 7 answered');
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

describe('no-label aria-label comprehension — immediately_recognisable primitives', () => {
  it('combi_boiler has aria-label when showLabel=false', () => {
    const { container } = render(<BoilerPrimitive variant="combi" showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
    expect((root?.getAttribute('aria-label') ?? '').trim().length).toBeGreaterThan(0);
  });

  it('system_boiler has aria-label when showLabel=false', () => {
    const { container } = render(<BoilerPrimitive variant="system" showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('regular_boiler has aria-label when showLabel=false', () => {
    const { container } = render(<BoilerPrimitive variant="regular" showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('unvented_cylinder has aria-label when showLabel=false', () => {
    const { container } = render(<CylinderPrimitive variant="unvented" showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('vented_cylinder has aria-label when showLabel=false', () => {
    const { container } = render(<CylinderPrimitive variant="vented" showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('panel_radiator has aria-label when showLabel=false', () => {
    const { container } = render(<RadiatorPrimitive showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('circulation_pump has aria-label when showLabel=false', () => {
    const { container } = render(<PumpPrimitive showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('powerflush_machine has aria-label when showLabel=false', () => {
    const { container } = render(<PowerflushMachinePrimitive showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('pressure_gauge has aria-label when showLabel=false', () => {
    const { container } = render(<PressureGaugePrimitive showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });

  it('cold_water_storage_tank has aria-label when showLabel=false', () => {
    const { container } = render(<HeaderTankPrimitive showLabel={false} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });
});
