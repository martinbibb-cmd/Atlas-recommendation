/**
 * buildShowerCompatibilityNotes.test.ts
 *
 * PR26 — Unit tests for buildShowerCompatibilityNotes.
 *
 * Coverage:
 *   - Electric shower produces an info-severity note.
 *   - electricShowerPresent flag produces an info-severity note.
 *   - Pumped mixer produces an important-severity note.
 *   - Power shower produces an important-severity note.
 *   - pumpedShowerPresent flag produces an important-severity note.
 *   - Mixer shower produces an advisory-severity note.
 *   - Thermostatic shower produces an advisory-severity note.
 *   - Unknown shower type returns null.
 *   - No shower (none) returns null.
 *   - Multiple shower type returns null (no single dominant risk).
 *   - customerSummary matches expected wording from the spec.
 *   - engineerNote is actionable and non-empty for all non-null results.
 *   - warningKey is consistent with the expected key.
 */

import { describe, it, expect } from 'vitest';
import { buildShowerCompatibilityNotes } from '../modules/buildShowerCompatibilityNotes';

describe('buildShowerCompatibilityNotes — electric shower', () => {
  it('returns info severity for electric currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note).not.toBeNull();
    expect(note?.severity).toBe('info');
  });

  it('returns electric_unaffected warningKey', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note?.warningKey).toBe('electric_unaffected');
  });

  it('customer summary mentions boiler hot-water system', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note?.customerSummary).toMatch(/boiler hot-water system/i);
  });

  it('engineer note states no action required', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'electric' });
    expect(note?.engineerNote).toMatch(/no action required/i);
  });

  it('returns info severity when electricShowerPresent is true (regardless of currentShowerType)', () => {
    const note = buildShowerCompatibilityNotes({ electricShowerPresent: true });
    expect(note?.severity).toBe('info');
    expect(note?.warningKey).toBe('electric_unaffected');
  });
});

describe('buildShowerCompatibilityNotes — pumped / power shower', () => {
  it('returns important severity for pumped_mixer currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' });
    expect(note?.severity).toBe('important');
  });

  it('returns pumped_gravity_unvented warningKey for pumped_mixer', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' });
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });

  it('returns important severity for power_shower currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'power_shower' });
    expect(note?.severity).toBe('important');
  });

  it('returns pumped_gravity_unvented warningKey for power_shower', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'power_shower' });
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });

  it('customer summary mentions changing the shower setup before unvented cylinder', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'pumped_mixer' });
    expect(note?.customerSummary).toMatch(/unvented cylinder/i);
  });

  it('engineer note mentions removing or bypassing the pump', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'power_shower' });
    expect(note?.engineerNote).toMatch(/remove or bypass/i);
  });

  it('returns important severity when pumpedShowerPresent is true', () => {
    const note = buildShowerCompatibilityNotes({ pumpedShowerPresent: true });
    expect(note?.severity).toBe('important');
    expect(note?.warningKey).toBe('pumped_gravity_unvented');
  });
});

describe('buildShowerCompatibilityNotes — mixer / thermostatic shower', () => {
  it('returns advisory severity for mixer currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' });
    expect(note?.severity).toBe('advisory');
  });

  it('returns mixer_balanced_supply warningKey for mixer', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' });
    expect(note?.warningKey).toBe('mixer_balanced_supply');
  });

  it('returns advisory severity for thermostatic currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'thermostatic' });
    expect(note?.severity).toBe('advisory');
  });

  it('customer summary mentions balanced hot and cold supplies', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'mixer' });
    expect(note?.customerSummary).toMatch(/balanced hot and cold supplies/i);
  });

  it('engineer note mentions verifying balanced supply pressures', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'thermostatic' });
    expect(note?.engineerNote).toMatch(/balanced/i);
  });
});

describe('buildShowerCompatibilityNotes — null / no-op cases', () => {
  it('returns null for unknown currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'unknown' });
    expect(note).toBeNull();
  });

  it('returns null for none currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'none' });
    expect(note).toBeNull();
  });

  it('returns null for multiple currentShowerType', () => {
    const note = buildShowerCompatibilityNotes({ currentShowerType: 'multiple' });
    expect(note).toBeNull();
  });

  it('returns null when all fields are null', () => {
    const note = buildShowerCompatibilityNotes({});
    expect(note).toBeNull();
  });

  it('returns null when all fields are explicitly null', () => {
    const note = buildShowerCompatibilityNotes({
      currentShowerType: null,
      electricShowerPresent: null,
      pumpedShowerPresent: null,
    });
    expect(note).toBeNull();
  });
});

describe('buildShowerCompatibilityNotes — note completeness', () => {
  const nonNullCases: Array<{ label: string; input: Parameters<typeof buildShowerCompatibilityNotes>[0] }> = [
    { label: 'electric', input: { currentShowerType: 'electric' } },
    { label: 'pumped_mixer', input: { currentShowerType: 'pumped_mixer' } },
    { label: 'power_shower', input: { currentShowerType: 'power_shower' } },
    { label: 'mixer', input: { currentShowerType: 'mixer' } },
    { label: 'thermostatic', input: { currentShowerType: 'thermostatic' } },
  ];

  for (const { label, input } of nonNullCases) {
    it(`${label}: customerSummary is a non-empty string`, () => {
      const note = buildShowerCompatibilityNotes(input);
      expect(typeof note?.customerSummary).toBe('string');
      expect(note!.customerSummary.length).toBeGreaterThan(0);
    });

    it(`${label}: engineerNote is a non-empty string`, () => {
      const note = buildShowerCompatibilityNotes(input);
      expect(typeof note?.engineerNote).toBe('string');
      expect(note!.engineerNote.length).toBeGreaterThan(0);
    });

    it(`${label}: warningKey is not null`, () => {
      const note = buildShowerCompatibilityNotes(input);
      expect(note?.warningKey).not.toBeNull();
    });
  }
});
