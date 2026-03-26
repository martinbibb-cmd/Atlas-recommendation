/**
 * cylinderChargeVisual.audit.test.tsx
 *
 * Audit checks for the CylinderChargeVisual component and its selection logic:
 *
 *   1. Standard cylinder renders with .ccv--standard class
 *   2. Standard cylinder does NOT render a thermocline boundary element
 *      (.ccv__mx-boundary) — no boundary-based semantics allowed
 *   3. Mixergy cylinder renders with .ccv--mixergy class
 *   4. Mixergy cylinder DOES render the sharp thermocline boundary element
 *   5. Placeholder content ("Mixergy: charges from top down") is gone
 *   6. Correct behaviour notes are present for each mode
 *   7. resolveShortlistVisualId only returns cylinder_charge_mixergy when
 *      dhwStorageType === 'mixergy'
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CylinderChargeVisual from '../visuals/CylinderChargeVisual';
import { resolveShortlistVisualId } from '../../presentation/presentationVisualMapping';

// ─── Standard cylinder — no boundary semantics ────────────────────────────────

describe('CylinderChargeVisual — standard mode audit', () => {
  it('renders with ccv--standard class', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    const root = container.querySelector('.ccv');
    expect(root?.classList.contains('ccv--standard')).toBe(true);
  });

  it('does NOT render a thermocline boundary element (.ccv__mx-boundary)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-boundary')).toBeNull();
  });

  it('does NOT render a Mixergy hot-zone element (.ccv__mx-hot)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-hot')).toBeNull();
  });

  it('does NOT render a Mixergy cold-zone element (.ccv__mx-cold)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-cold')).toBeNull();
  });

  it('renders the diffuse warm overlay element (.ccv__std-warm-overlay)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__std-warm-overlay')).not.toBeNull();
  });

  it('renders the standard behaviour note — not a placeholder', () => {
    render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(screen.getByText('Whole body warms — top first')).toBeTruthy();
  });

  it('does not render the old placeholder Mixergy note text', () => {
    render(<CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />);
    expect(screen.queryByText(/Mixergy: charges from top down/i)).toBeNull();
  });
});

// ─── Mixergy cylinder — boundary semantics required ───────────────────────────

describe('CylinderChargeVisual — Mixergy mode audit', () => {
  it('renders with ccv--mixergy class', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    const root = container.querySelector('.ccv');
    expect(root?.classList.contains('ccv--mixergy')).toBe(true);
  });

  it('renders the sharp thermocline boundary element (.ccv__mx-boundary)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-boundary')).not.toBeNull();
  });

  it('renders the hot-zone element (.ccv__mx-hot)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-hot')).not.toBeNull();
  });

  it('renders the cold-zone element (.ccv__mx-cold)', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__mx-cold')).not.toBeNull();
  });

  it('does NOT render a diffuse warm overlay — boundary-based only', () => {
    const { container } = render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(container.querySelector('.ccv__std-warm-overlay')).toBeNull();
  });

  it('renders the correct Mixergy behaviour note — not a placeholder', () => {
    render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(screen.getByText('Usable hot water builds from the top down')).toBeTruthy();
  });

  it('does not render the old placeholder Mixergy text', () => {
    render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />);
    expect(screen.queryByText(/Mixergy: charges from top down/i)).toBeNull();
  });

  it('hot zone percentage label shows charge percentage', () => {
    render(<CylinderChargeVisual mixergyMode={true} fillLevel={0.4} />);
    expect(screen.getByText(/Hot zone: 40%/i)).toBeTruthy();
  });
});

// ─── Visual distinguishability ────────────────────────────────────────────────

describe('CylinderChargeVisual — standard vs Mixergy distinguishability', () => {
  it('standard and Mixergy render different root classes', () => {
    const { container: stdContainer } = render(
      <CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />,
    );
    const { container: mxContainer } = render(
      <CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />,
    );
    const stdClasses = stdContainer.querySelector('.ccv')?.className ?? '';
    const mxClasses = mxContainer.querySelector('.ccv')?.className ?? '';
    expect(stdClasses).not.toBe(mxClasses);
  });

  it('standard has no Mixergy-specific elements; Mixergy has all three zone elements', () => {
    const { container: stdContainer } = render(
      <CylinderChargeVisual mixergyMode={false} fillLevel={0.6} />,
    );
    const { container: mxContainer } = render(
      <CylinderChargeVisual mixergyMode={true} fillLevel={0.6} />,
    );

    // Standard: no Mixergy elements
    expect(stdContainer.querySelector('.ccv__mx-hot')).toBeNull();
    expect(stdContainer.querySelector('.ccv__mx-boundary')).toBeNull();
    expect(stdContainer.querySelector('.ccv__mx-cold')).toBeNull();

    // Mixergy: all three zone elements present
    expect(mxContainer.querySelector('.ccv__mx-hot')).not.toBeNull();
    expect(mxContainer.querySelector('.ccv__mx-boundary')).not.toBeNull();
    expect(mxContainer.querySelector('.ccv__mx-cold')).not.toBeNull();
  });
});

// ─── Shortlist visual selection — Mixergy gate ────────────────────────────────

describe('Shortlist Mixergy gate — resolveShortlistVisualId audit', () => {
  it('cylinder_charge_mixergy is returned ONLY for dhwStorageType mixergy', () => {
    // Only mixergy storage → mixergy visual
    expect(resolveShortlistVisualId('high', 0, 'mixergy')).toBe('cylinder_charge_mixergy');
  });

  it('cylinder_charge_standard is returned for open_vented, not mixergy visual', () => {
    expect(resolveShortlistVisualId('high', 0, 'open_vented')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 0, 'open_vented')).not.toBe('cylinder_charge_mixergy');
  });

  it('cylinder_charge_standard is returned for unvented, not mixergy visual', () => {
    expect(resolveShortlistVisualId('high', 0, 'unvented')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('high', 0, 'unvented')).not.toBe('cylinder_charge_mixergy');
  });

  it('null is returned for unknown storage type — never shows wrong cylinder visual', () => {
    expect(resolveShortlistVisualId('high', 0, 'unknown')).toBeNull();
    expect(resolveShortlistVisualId('high', 0)).toBeNull();
  });

  it('null is returned for thermal_store — legacy type excluded from shortlist', () => {
    expect(resolveShortlistVisualId('high', 0, 'thermal_store')).toBeNull();
  });

  it('storageBenefitSignal=high + mixergy → cylinder_charge_mixergy', () => {
    expect(resolveShortlistVisualId('low', 0, 'mixergy', 'high')).toBe('cylinder_charge_mixergy');
    expect(resolveShortlistVisualId('none', 1, 'mixergy', 'high')).toBe('cylinder_charge_mixergy');
  });

  it('storageBenefitSignal=high + non-mixergy storage → cylinder_charge_standard, never mixergy', () => {
    expect(resolveShortlistVisualId('low', 0, 'unvented', 'high')).toBe('cylinder_charge_standard');
    expect(resolveShortlistVisualId('low', 0, 'unvented', 'high')).not.toBe('cylinder_charge_mixergy');
  });
});
