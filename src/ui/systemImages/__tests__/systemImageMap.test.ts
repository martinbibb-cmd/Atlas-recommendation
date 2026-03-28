/**
 * systemImageMap.test.ts
 *
 * Unit tests for the system image mapping layer.
 *
 * Verifies:
 * - Known heat source + DHW combinations return the correct image path.
 * - Unknown or ambiguous combinations return null.
 * - All three recommendation IDs return the expected images.
 * - Unsupported rec IDs return null.
 * - Control family mapping returns correct schematics.
 */

import { describe, it, expect } from 'vitest';
import {
  imageForCurrentSystem,
  imageForRecId,
  imageForControlFamily,
} from '../systemImageMap';

// ─── imageForCurrentSystem ────────────────────────────────────────────────────

describe('imageForCurrentSystem', () => {
  it('returns Combination.PNG for combi boiler', () => {
    const result = imageForCurrentSystem('combi');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('Combination.PNG');
    expect(result!.alt).toBeTruthy();
  });

  it('returns Combination.PNG for storage_combi boiler', () => {
    const result = imageForCurrentSystem('storage_combi');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('Combination.PNG');
  });

  it('returns system-boiler.PNG for system boiler with open_vented DHW', () => {
    const result = imageForCurrentSystem('system', 'open_vented');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('system-boiler.PNG');
  });

  it('returns unvented-cylinder.JPG for system boiler with unvented DHW', () => {
    const result = imageForCurrentSystem('system', 'unvented');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('unvented-cylinder.JPG');
  });

  it('returns open-vented-schematic.JPG for regular boiler with open_vented DHW', () => {
    const result = imageForCurrentSystem('regular', 'open_vented');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('open-vented-schematic.JPG');
  });

  it('returns unvented-cylinder.JPG for regular boiler with unvented DHW', () => {
    const result = imageForCurrentSystem('regular', 'unvented');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('unvented-cylinder.JPG');
  });

  it('returns null for regular boiler with thermal_store (ambiguous)', () => {
    expect(imageForCurrentSystem('regular', 'thermal_store')).toBeNull();
  });

  it('returns null for regular boiler with plate_hex (combi-style, no cylinder image)', () => {
    expect(imageForCurrentSystem('regular', 'plate_hex')).toBeNull();
  });

  it('returns null when heatSource is null', () => {
    expect(imageForCurrentSystem(null)).toBeNull();
  });

  it('returns null when heatSource is undefined', () => {
    expect(imageForCurrentSystem(undefined)).toBeNull();
  });

  it('always includes a non-empty alt text when an image is returned', () => {
    const result = imageForCurrentSystem('combi');
    expect(result!.alt.length).toBeGreaterThan(0);
  });
});

// ─── imageForRecId ────────────────────────────────────────────────────────────

describe('imageForRecId', () => {
  it('returns Combination.PNG for combi_upgrade', () => {
    const result = imageForRecId('combi_upgrade');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('Combination.PNG');
  });

  it('returns unvented-cylinder.JPG for system_unvented', () => {
    const result = imageForRecId('system_unvented');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('unvented-cylinder.JPG');
  });

  it('returns ASHP.PNG for heat_pump', () => {
    const result = imageForRecId('heat_pump');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('ASHP.PNG');
  });

  it('returns null for an unknown recommendation ID', () => {
    expect(imageForRecId('some_unknown_rec')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(imageForRecId('')).toBeNull();
  });
});

// ─── imageForControlFamily ────────────────────────────────────────────────────

describe('imageForControlFamily', () => {
  it('returns s-plan.jpg for s_plan', () => {
    const result = imageForControlFamily('s_plan');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('s-plan.jpg');
  });

  it('returns s-plan.jpg for s_plan_plus', () => {
    const result = imageForControlFamily('s_plan_plus');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('s-plan.jpg');
  });

  it('returns y-plan.jpg for y_plan', () => {
    const result = imageForControlFamily('y_plan');
    expect(result).not.toBeNull();
    expect(result!.src).toContain('y-plan.jpg');
  });

  it('returns null for combi_integral (no schematic applicable)', () => {
    expect(imageForControlFamily('combi_integral')).toBeNull();
  });

  it('returns null for unknown control family', () => {
    expect(imageForControlFamily('unknown')).toBeNull();
  });

  it('returns null when controlFamily is null', () => {
    expect(imageForControlFamily(null)).toBeNull();
  });
});
