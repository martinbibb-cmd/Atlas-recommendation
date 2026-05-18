/**
 * PrimitiveMotion.test.tsx
 *
 * Tests for the motion semantics added by primitiveMotion.ts.
 *
 * Covers:
 * 1. Animation class names are applied when `animateFlow=true`
 * 2. Animation class names are NOT applied when `animateFlow=false` (default)
 * 3. Animation class names are NOT applied in printSafe mode
 *    (print output should never include motion markup)
 * 4. Reduced-motion parity — CSS declares `animation: none` under
 *    `prefers-reduced-motion: reduce` (structural check via CSS string)
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  FLOW_PULSE_CLASS,
  COOLING_TRANSITION_CLASS,
  DRAW_OFF_PULSE_CLASS,
  BYPASS_ACTIVATION_CLASS,
  SLUDGE_SETTLE_CLASS,
  getPrimitiveMotionCss,
} from '../primitiveMotion';
import { BoilerPrimitive } from '../primitives/BoilerPrimitive';
import { RadiatorPrimitive } from '../primitives/RadiatorPrimitive';
import { CylinderPrimitive } from '../primitives/CylinderPrimitive';
import { ABVPrimitive } from '../primitives/ABVPrimitive';
import { MagneticFilterPrimitive } from '../primitives/MagneticFilterPrimitive';

// ─── Animation class presence ────────────────────────────────────────────────

describe('animateFlow=true applies animation classes', () => {
  it('BoilerPrimitive: flow pipe has atlas-flow-pulse-flow class', () => {
    const { container } = render(<BoilerPrimitive animateFlow={true} />);
    const flowPipes = container.querySelectorAll(`.${FLOW_PULSE_CLASS.flow}`);
    expect(flowPipes.length).toBeGreaterThan(0);
  });

  it('BoilerPrimitive: return pipe has atlas-flow-pulse-return class', () => {
    const { container } = render(<BoilerPrimitive animateFlow={true} />);
    const returnPipes = container.querySelectorAll(`.${FLOW_PULSE_CLASS.return}`);
    expect(returnPipes.length).toBeGreaterThan(0);
  });

  it('RadiatorPrimitive: panel body has cooling-transition class', () => {
    const { container } = render(<RadiatorPrimitive animateFlow={true} />);
    const coolEls = container.querySelectorAll(`.${COOLING_TRANSITION_CLASS}`);
    expect(coolEls.length).toBeGreaterThan(0);
  });

  it('CylinderPrimitive: draw-off arrow has draw-off-pulse class', () => {
    const { container } = render(<CylinderPrimitive animateFlow={true} />);
    const pulseEls = container.querySelectorAll(`.${DRAW_OFF_PULSE_CLASS}`);
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it('ABVPrimitive: valve body has bypass-activation class', () => {
    const { container } = render(<ABVPrimitive animateFlow={true} />);
    const bypassEls = container.querySelectorAll(`.${BYPASS_ACTIVATION_CLASS}`);
    expect(bypassEls.length).toBeGreaterThan(0);
  });

  it('MagneticFilterPrimitive: sludge dots have sludge-settle class', () => {
    const { container } = render(<MagneticFilterPrimitive animateFlow={true} />);
    const sludgeEls = container.querySelectorAll(`.${SLUDGE_SETTLE_CLASS}`);
    expect(sludgeEls.length).toBeGreaterThan(0);
  });
});

// ─── Static default (animateFlow=false) ─────────────────────────────────────

describe('animateFlow=false (default) produces no animation classes', () => {
  it('BoilerPrimitive: no animation classes by default', () => {
    const { container } = render(<BoilerPrimitive />);
    expect(container.querySelectorAll(`.${FLOW_PULSE_CLASS.flow}`).length).toBe(0);
    expect(container.querySelectorAll(`.${FLOW_PULSE_CLASS.return}`).length).toBe(0);
  });

  it('RadiatorPrimitive: no cooling-transition class by default', () => {
    const { container } = render(<RadiatorPrimitive />);
    expect(container.querySelectorAll(`.${COOLING_TRANSITION_CLASS}`).length).toBe(0);
  });

  it('CylinderPrimitive: no draw-off-pulse class by default', () => {
    const { container } = render(<CylinderPrimitive />);
    expect(container.querySelectorAll(`.${DRAW_OFF_PULSE_CLASS}`).length).toBe(0);
  });

  it('ABVPrimitive: no bypass-activation class by default', () => {
    const { container } = render(<ABVPrimitive />);
    expect(container.querySelectorAll(`.${BYPASS_ACTIVATION_CLASS}`).length).toBe(0);
  });

  it('MagneticFilterPrimitive: no sludge-settle class by default', () => {
    const { container } = render(<MagneticFilterPrimitive />);
    expect(container.querySelectorAll(`.${SLUDGE_SETTLE_CLASS}`).length).toBe(0);
  });
});

// ─── printSafe guard ──────────────────────────────────────────────────────────

describe('printSafe=true suppresses animation classes even when animateFlow=true', () => {
  it('BoilerPrimitive printSafe: no flow-pulse classes', () => {
    const { container } = render(<BoilerPrimitive printSafe={true} animateFlow={true} />);
    expect(container.querySelectorAll(`.${FLOW_PULSE_CLASS.flow}`).length).toBe(0);
    expect(container.querySelectorAll(`.${FLOW_PULSE_CLASS.return}`).length).toBe(0);
  });

  it('RadiatorPrimitive printSafe: no cooling-transition class', () => {
    const { container } = render(<RadiatorPrimitive printSafe={true} animateFlow={true} />);
    expect(container.querySelectorAll(`.${COOLING_TRANSITION_CLASS}`).length).toBe(0);
  });

  it('CylinderPrimitive printSafe: no draw-off-pulse class', () => {
    const { container } = render(<CylinderPrimitive printSafe={true} animateFlow={true} />);
    expect(container.querySelectorAll(`.${DRAW_OFF_PULSE_CLASS}`).length).toBe(0);
  });

  it('ABVPrimitive printSafe: no bypass-activation class', () => {
    const { container } = render(<ABVPrimitive printSafe={true} animateFlow={true} />);
    expect(container.querySelectorAll(`.${BYPASS_ACTIVATION_CLASS}`).length).toBe(0);
  });

  it('MagneticFilterPrimitive printSafe: no sludge-settle class', () => {
    const { container } = render(<MagneticFilterPrimitive printSafe={true} animateFlow={true} />);
    expect(container.querySelectorAll(`.${SLUDGE_SETTLE_CLASS}`).length).toBe(0);
  });
});

// ─── Reduced-motion CSS structural check ─────────────────────────────────────

describe('primitiveMotion CSS respects prefers-reduced-motion', () => {
  it('CSS contains prefers-reduced-motion: reduce override', () => {
    const css = getPrimitiveMotionCss();
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('CSS sets animation: none inside the reduced-motion block', () => {
    const css = getPrimitiveMotionCss();
    // Confirm the override block contains animation: none
    const reducedMotionBlock = css.substring(
      css.indexOf('prefers-reduced-motion: reduce'),
    );
    expect(reducedMotionBlock).toContain('animation: none');
  });

  it('all five animation class names are listed inside the reduced-motion block', () => {
    const css = getPrimitiveMotionCss();
    const reducedMotionBlock = css.substring(
      css.indexOf('prefers-reduced-motion: reduce'),
    );
    expect(reducedMotionBlock).toContain(`.${FLOW_PULSE_CLASS.flow}`);
    expect(reducedMotionBlock).toContain(`.${FLOW_PULSE_CLASS.return}`);
    expect(reducedMotionBlock).toContain(`.${COOLING_TRANSITION_CLASS}`);
    expect(reducedMotionBlock).toContain(`.${DRAW_OFF_PULSE_CLASS}`);
    expect(reducedMotionBlock).toContain(`.${BYPASS_ACTIVATION_CLASS}`);
    expect(reducedMotionBlock).toContain(`.${SLUDGE_SETTLE_CLASS}`);
  });
});
