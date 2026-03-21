/**
 * customerCopy.test.ts
 *
 * Regression tests for the centralised customer-facing wording layer.
 *
 * Goals:
 *   1. Verify that banned harsh labels are absent from all exported maps.
 *   2. Verify that agreed customer phrases are present in the correct maps.
 *   3. Ensure the status maps cover all expected keys.
 */

import { describe, it, expect } from 'vitest';
import {
  OPTION_STATUS_LABEL,
  VERDICT_STATUS_LABEL,
  SEVERITY_LABEL,
  LIMITER_GROUP_LABEL,
  COMBI_RISK_LABEL,
  STORED_RISK_LABEL,
  CONSTRAINT_SUMMARY,
  BANNED_CUSTOMER_PHRASES,
} from '../customerCopy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect every string value in an object (shallow). */
function allValues(obj: Record<string, string>): string[] {
  return Object.values(obj);
}

/** Collect every string value across multiple maps. */
function collectAll(...maps: Record<string, string>[]): string[] {
  return maps.flatMap(allValues);
}

// ─── Banned phrases ───────────────────────────────────────────────────────────

describe('BANNED_CUSTOMER_PHRASES', () => {
  it('is non-empty — guardrail list exists', () => {
    expect(BANNED_CUSTOMER_PHRASES.length).toBeGreaterThan(0);
  });

  const allExported = collectAll(
    OPTION_STATUS_LABEL,
    VERDICT_STATUS_LABEL,
    SEVERITY_LABEL,
    LIMITER_GROUP_LABEL,
    COMBI_RISK_LABEL,
    STORED_RISK_LABEL,
    CONSTRAINT_SUMMARY,
  );

  for (const phrase of BANNED_CUSTOMER_PHRASES) {
    it(`no exported label contains banned phrase: "${phrase}"`, () => {
      const match = allExported.find(v =>
        v.toLowerCase().includes(phrase.toLowerCase()),
      );
      expect(match).toBeUndefined();
    });
  }
});

// ─── OPTION_STATUS_LABEL ──────────────────────────────────────────────────────

describe('OPTION_STATUS_LABEL', () => {
  it('covers viable, caution, rejected', () => {
    expect(OPTION_STATUS_LABEL.viable).toBeDefined();
    expect(OPTION_STATUS_LABEL.caution).toBeDefined();
    expect(OPTION_STATUS_LABEL.rejected).toBeDefined();
  });

  it('uses "Less suited" — not "Not suitable" — for rejected', () => {
    expect(OPTION_STATUS_LABEL.rejected).not.toMatch(/not suitable/i);
    expect(OPTION_STATUS_LABEL.rejected).toMatch(/less suited/i);
  });

  it('"viable" maps to a positive phrase', () => {
    expect(OPTION_STATUS_LABEL.viable).toMatch(/best fit/i);
  });
});

// ─── VERDICT_STATUS_LABEL ─────────────────────────────────────────────────────

describe('VERDICT_STATUS_LABEL', () => {
  it('covers good, caution, fail', () => {
    expect(VERDICT_STATUS_LABEL.good).toBeDefined();
    expect(VERDICT_STATUS_LABEL.caution).toBeDefined();
    expect(VERDICT_STATUS_LABEL.fail).toBeDefined();
  });

  it('"fail" does not render the word "Fail"', () => {
    expect(VERDICT_STATUS_LABEL.fail).not.toMatch(/^fail$/i);
  });

  it('"fail" does not render "Not Suitable"', () => {
    expect(VERDICT_STATUS_LABEL.fail).not.toMatch(/not suitable/i);
  });

  it('"fail" uses consequence-led phrasing', () => {
    expect(VERDICT_STATUS_LABEL.fail).toMatch(/less suited|limited|may not|not the strongest/i);
  });

  it('"good" maps to "Recommended"', () => {
    expect(VERDICT_STATUS_LABEL.good).toMatch(/recommended/i);
  });
});

// ─── SEVERITY_LABEL ───────────────────────────────────────────────────────────

describe('SEVERITY_LABEL', () => {
  it('covers fail, warn, info', () => {
    expect(SEVERITY_LABEL.fail).toBeDefined();
    expect(SEVERITY_LABEL.warn).toBeDefined();
    expect(SEVERITY_LABEL.info).toBeDefined();
  });

  it('"fail" severity does not display the word "Fail"', () => {
    expect(SEVERITY_LABEL.fail).not.toMatch(/^fail$/i);
  });

  it('"fail" severity uses a soft consequence phrase', () => {
    expect(SEVERITY_LABEL.fail).toMatch(/needs attention|something to be aware|may be limited/i);
  });
});

// ─── COMBI_RISK_LABEL ─────────────────────────────────────────────────────────

describe('COMBI_RISK_LABEL', () => {
  it('covers fail, warn, pass', () => {
    expect(COMBI_RISK_LABEL.fail).toBeDefined();
    expect(COMBI_RISK_LABEL.warn).toBeDefined();
    expect(COMBI_RISK_LABEL.pass).toBeDefined();
  });

  it('"fail" does not use "Combi cannot meet"', () => {
    expect(COMBI_RISK_LABEL.fail).not.toMatch(/combi cannot meet/i);
  });

  it('"fail" translates to a lived-experience phrase', () => {
    expect(COMBI_RISK_LABEL.fail).toMatch(/may be limited|limited|may struggle|performance/i);
  });
});

// ─── CONSTRAINT_SUMMARY ───────────────────────────────────────────────────────

describe('CONSTRAINT_SUMMARY', () => {
  it('covers blocking, advisory, clear', () => {
    expect(CONSTRAINT_SUMMARY.blocking).toBeDefined();
    expect(CONSTRAINT_SUMMARY.advisory).toBeDefined();
    expect(CONSTRAINT_SUMMARY.clear).toBeDefined();
  });

  it('"blocking" does not use "Constraint failing"', () => {
    expect(CONSTRAINT_SUMMARY.blocking).not.toMatch(/constraint failing/i);
  });

  it('"clear" does not use "No constraint violations"', () => {
    expect(CONSTRAINT_SUMMARY.clear).not.toMatch(/no constraint violations/i);
  });

  it('"clear" uses a positive phrase', () => {
    expect(CONSTRAINT_SUMMARY.clear).toMatch(/no known|all good|within/i);
  });
});
