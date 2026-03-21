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

// ─── PR3 — Customer-chosen option copy ───────────────────────────────────────

import {
  CHOOSE_OPTION_LABEL,
  CHOSEN_OPTION_CONFIRMED_LABEL,
  CHOSEN_OPTION_FRAMING,
  CHOSEN_OPTION_BEHAVIOUR_NOTES,
} from '../customerCopy';

describe('PR3 — CHOOSE_OPTION_LABEL', () => {
  it('is defined and non-empty', () => {
    expect(CHOOSE_OPTION_LABEL).toBeTruthy();
    expect(CHOOSE_OPTION_LABEL.length).toBeGreaterThan(0);
  });

  it('does not use "override" language', () => {
    expect(CHOOSE_OPTION_LABEL).not.toMatch(/override/i);
  });
});

describe('PR3 — CHOSEN_OPTION_CONFIRMED_LABEL', () => {
  it('is defined and non-empty', () => {
    expect(CHOSEN_OPTION_CONFIRMED_LABEL).toBeTruthy();
  });

  it('does not use confrontational phrasing', () => {
    expect(CHOSEN_OPTION_CONFIRMED_LABEL).not.toMatch(/override|against advice|not recommended/i);
  });
});

describe('PR3 — CHOSEN_OPTION_FRAMING', () => {
  it('has an affirm phrase that opens positively', () => {
    expect(CHOSEN_OPTION_FRAMING.affirm).toMatch(/I can see why/i);
  });

  it('has an align phrase', () => {
    expect(CHOSEN_OPTION_FRAMING.align).toBeTruthy();
  });

  it('has a guide phrase that steers back to the recommendation', () => {
    expect(CHOSEN_OPTION_FRAMING.guide).toMatch(/recommended option/i);
  });

  it('has a heading', () => {
    expect(CHOSEN_OPTION_FRAMING.heading).toBeTruthy();
  });

  it('has a "recommended still available" note', () => {
    expect(CHOSEN_OPTION_FRAMING.recommendedStillAvailable).toMatch(/recommended/i);
  });

  it('no phrase uses confrontational language', () => {
    const allPhrases = Object.values(CHOSEN_OPTION_FRAMING).join(' ');
    expect(allPhrases).not.toMatch(/override|not suitable|does not meet|you chose against/i);
  });
});

describe('PR3 — CHOSEN_OPTION_BEHAVIOUR_NOTES', () => {
  it('has entries for common behaviour scenarios', () => {
    expect(CHOSEN_OPTION_BEHAVIOUR_NOTES.simultaneous_demand).toBeTruthy();
    expect(CHOSEN_OPTION_BEHAVIOUR_NOTES.stored_vs_combi).toBeTruthy();
    expect(CHOSEN_OPTION_BEHAVIOUR_NOTES.lighter_demand).toBeTruthy();
  });

  it('all notes describe behaviour without judgement-first phrasing', () => {
    for (const note of Object.values(CHOSEN_OPTION_BEHAVIOUR_NOTES)) {
      expect(note).not.toMatch(/not suitable|fail|rejected|cannot meet/i);
    }
  });
});

describe('PR3 — BANNED_CUSTOMER_PHRASES includes override language', () => {
  it('contains "Override"', () => {
    expect(BANNED_CUSTOMER_PHRASES).toContain('Override');
  });

  it('contains "You chose against advice"', () => {
    expect(BANNED_CUSTOMER_PHRASES).toContain('You chose against advice');
  });
});

describe('PR5 — BANNED_CUSTOMER_PHRASES includes DHW terminology guardrail', () => {
  it('contains "instantaneous hot water"', () => {
    expect(BANNED_CUSTOMER_PHRASES).toContain('instantaneous hot water');
  });
});

// ─── PR4 — Real-world behaviour card copy ─────────────────────────────────────

import {
  BEHAVIOUR_OUTCOME_LABEL,
  BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE,
  BEHAVIOUR_OUTCOME_CHOSEN_NOTE,
  BEHAVIOUR_LIMITING_FACTOR_LABEL,
} from '../customerCopy';

describe('PR4 — BEHAVIOUR_OUTCOME_LABEL', () => {
  it('has entries for all three outcome tiers', () => {
    expect(BEHAVIOUR_OUTCOME_LABEL.works_well).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_LABEL.works_with_limits).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_LABEL.best_for_lighter_use).toBeTruthy();
  });

  it('no tier label uses banned phrases', () => {
    for (const label of Object.values(BEHAVIOUR_OUTCOME_LABEL)) {
      for (const phrase of BANNED_CUSTOMER_PHRASES) {
        expect(label.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

describe('PR4 — BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE', () => {
  it('has notes for all four BehaviourOutcome values', () => {
    expect(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE.strong).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE.acceptable).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE.limited).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE.poor).toBeTruthy();
  });

  it('no recommended note contains banned phrases', () => {
    for (const note of Object.values(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE)) {
      for (const phrase of BANNED_CUSTOMER_PHRASES) {
        expect(note.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it('no recommended note uses harsh engineering language', () => {
    const combined = Object.values(BEHAVIOUR_OUTCOME_RECOMMENDED_NOTE).join(' ');
    expect(combined).not.toMatch(/not suitable|fail|rejected|cannot meet|insufficient/i);
  });
});

describe('PR4 — BEHAVIOUR_OUTCOME_CHOSEN_NOTE', () => {
  it('has notes for all four BehaviourOutcome values', () => {
    expect(BEHAVIOUR_OUTCOME_CHOSEN_NOTE.strong).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_CHOSEN_NOTE.acceptable).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_CHOSEN_NOTE.limited).toBeTruthy();
    expect(BEHAVIOUR_OUTCOME_CHOSEN_NOTE.poor).toBeTruthy();
  });

  it('no chosen note contains banned phrases', () => {
    for (const note of Object.values(BEHAVIOUR_OUTCOME_CHOSEN_NOTE)) {
      for (const phrase of BANNED_CUSTOMER_PHRASES) {
        expect(note.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it('no chosen note uses harsh engineering language', () => {
    const combined = Object.values(BEHAVIOUR_OUTCOME_CHOSEN_NOTE).join(' ');
    expect(combined).not.toMatch(/not suitable|fail|rejected|cannot meet|insufficient/i);
  });

  it('chosen note for "limited" outcome uses consequence-led language', () => {
    expect(BEHAVIOUR_OUTCOME_CHOSEN_NOTE.limited).toMatch(/more limited|busier times/i);
  });
});

describe('PR4 — BEHAVIOUR_LIMITING_FACTOR_LABEL', () => {
  it('has entries for mains, storage, instantaneous_output, recovery, distribution', () => {
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.mains).toBeTruthy();
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.storage).toBeTruthy();
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.instantaneous_output).toBeTruthy();
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.recovery).toBeTruthy();
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.distribution).toBeTruthy();
  });

  it('mains label references the incoming supply', () => {
    expect(BEHAVIOUR_LIMITING_FACTOR_LABEL.mains).toMatch(/mains supply/i);
  });

  it('no limiting factor label contains banned phrases', () => {
    for (const label of Object.values(BEHAVIOUR_LIMITING_FACTOR_LABEL)) {
      for (const phrase of BANNED_CUSTOMER_PHRASES) {
        expect(label.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
