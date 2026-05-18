import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology } from '../topologies';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

describe('hydraulic truth regression checks', () => {
  it('sealed unvented topology includes a D2 discharge route with continuous fall', () => {
    const { container } = render(renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS));
    const d2 = container.querySelector('[data-testid="d2-discharge-pipe"]');
    expect(d2).toBeTruthy();
    expect(Number(d2?.getAttribute('y2'))).toBeGreaterThan(Number(d2?.getAttribute('y1')));
    expect(Number(d2?.getAttribute('x2'))).toBeGreaterThan(Number(d2?.getAttribute('x1')));
  });

  it('ABV stays downstream of pump location in ABV-protected layout', () => {
    const { container } = render(renderVisualTopology('abv_protected_heating_loop', DEFAULT_OPTIONS));
    const pump = container.querySelector('[aria-label="Circulation pump"]');
    const abv = container.querySelector('[aria-label="Automatic bypass valve"]');
    expect(pump).toBeTruthy();
    expect(abv).toBeTruthy();

    const pumpParent = pump?.parentElement as HTMLElement | null;
    const abvParent = abv?.parentElement as HTMLElement | null;
    const pumpLeft = Number.parseFloat(pumpParent?.style.left ?? '0');
    const abvLeft = Number.parseFloat(abvParent?.style.left ?? '0');
    expect(abvLeft).toBeGreaterThan(pumpLeft);
  });

  it('magnetic filter remains on return side before boiler entry', () => {
    const { container } = render(renderVisualTopology('magnetic_filter_on_return', DEFAULT_OPTIONS));
    const boiler = container.querySelector('[aria-label="System boiler"]');
    const filter = container.querySelector('[aria-label="Magnetic filter on heating return pipe"]');
    expect(boiler).toBeTruthy();
    expect(filter).toBeTruthy();

    const boilerParent = boiler?.parentElement as HTMLElement | null;
    const filterParent = filter?.parentElement as HTMLElement | null;
    const boilerLeft = Number.parseFloat(boilerParent?.style.left ?? '0');
    const filterLeft = Number.parseFloat(filterParent?.style.left ?? '0');
    expect(filterLeft).toBeGreaterThan(boilerLeft);
  });

  it('filling loop defaults to disconnected/ghosted presentation', () => {
    const { container } = render(renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS));
    expect(container.querySelector('[data-testid="filling-loop-ghost-link-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-ghost-link-right"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-disconnect-gap"]')).toBeTruthy();
  });
});
