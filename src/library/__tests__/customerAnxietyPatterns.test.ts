import { describe, expect, it } from 'vitest';
import { customerAnxietyPatterns, resolveCustomerAnxietyPatterns } from '../emotionalRouting';

describe('customer anxiety pattern registry', () => {
  it('contains the expected initial pattern IDs', () => {
    const ids = customerAnxietyPatterns.map((pattern) => pattern.anxietyId);
    expect(ids).toContain('worried_about_disruption');
    expect(ids).toContain('worried_about_running_costs');
    expect(ids).toContain('worried_about_heat_pumps');
    expect(ids).toContain('worried_about_complex_controls');
    expect(ids).toContain('worried_about_pressure_changes');
    expect(ids).toContain('worried_about_safety');
    expect(ids).toContain('skeptical_of_sales');
    expect(ids).toContain('worried_about_noise');
    expect(ids).toContain('worried_about_hot_water');
  });
});

describe('resolveCustomerAnxietyPatterns', () => {
  it('resolves pattern matches from concern tags', () => {
    const resolved = resolveCustomerAnxietyPatterns({
      concernTags: ['heat_pump', 'noise'],
    });

    expect(resolved.activePatternIds).toContain('worried_about_heat_pumps');
    expect(resolved.activePatternIds).toContain('worried_about_noise');
    expect(resolved.sequencingPolicy.preferWhatToExpectCard).toBe(true);
  });

  it('supports manual include and exclude overrides', () => {
    const resolved = resolveCustomerAnxietyPatterns({
      concernTags: [],
      manualOverrides: {
        includeAnxietyIds: ['worried_about_safety'],
        excludeAnxietyIds: ['worried_about_safety'],
      },
    });

    expect(resolved.activePatternIds).toHaveLength(0);
  });
});
