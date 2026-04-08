/**
 * extractSuggestionsFromNote.test.ts
 *
 * Unit tests for the voice-note suggestion extraction pipeline.
 */

import { describe, it, expect } from 'vitest';
import { extractSuggestionsFromNote } from '../extractSuggestionsFromNote';
import type { VoiceNoteSuggestion } from '../voiceNoteTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTE_ID = 'test-note-001';

function extract(transcript: string): VoiceNoteSuggestion[] {
  return extractSuggestionsFromNote(NOTE_ID, transcript);
}

function findByKey(suggestions: VoiceNoteSuggestion[], key: string): VoiceNoteSuggestion | undefined {
  return suggestions.find(s => s.key === key);
}

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('extractSuggestionsFromNote — invariants', () => {
  it('returns an empty array for an empty string', () => {
    expect(extractSuggestionsFromNote(NOTE_ID, '')).toEqual([]);
  });

  it('returns an empty array for a whitespace-only string', () => {
    expect(extractSuggestionsFromNote(NOTE_ID, '   \n\t  ')).toEqual([]);
  });

  it('every suggestion has provenance = inferred_from_voice_note', () => {
    const results = extract('likely sludge and microbore pipework');
    expect(results.length).toBeGreaterThan(0);
    for (const s of results) {
      expect(s.provenance).toBe('inferred_from_voice_note');
    }
  });

  it('every suggestion starts with status = suggested', () => {
    const results = extract('likely sludge and narrow stairs');
    expect(results.length).toBeGreaterThan(0);
    for (const s of results) {
      expect(s.status).toBe('suggested');
    }
  });

  it('every suggestion has a non-empty sourceSnippet', () => {
    const results = extract('narrow stairs and probable asbestos concern');
    for (const s of results) {
      expect(s.sourceSnippet.trim().length).toBeGreaterThan(0);
    }
  });

  it('every suggestion has sourceNoteId matching the provided noteId', () => {
    const results = extractSuggestionsFromNote('my-note-xyz', 'narrow stairs');
    for (const s of results) {
      expect(s.sourceNoteId).toBe('my-note-xyz');
    }
  });

  it('does not produce duplicate keys for the same transcript', () => {
    const results = extract('mostly old microbore and microbore pipework everywhere');
    const keys = results.map(s => s.key);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('suggestion id is <noteId>_<key>', () => {
    const results = extract('narrow stairs');
    const s = findByKey(results, 'constraint.narrow_stairs');
    expect(s).toBeDefined();
    expect(s!.id).toBe(`${NOTE_ID}_constraint.narrow_stairs`);
  });
});

// ─── Customer preferences ─────────────────────────────────────────────────────

describe('preference.avoid_cylinder', () => {
  it('detects "cylinder removed"', () => {
    const s = findByKey(extract('customer wants the cylinder removed'), 'preference.avoid_cylinder');
    expect(s).toBeDefined();
    expect(s!.category).toBe('preferences');
    expect(s!.suggestedValue).toBe('true');
    expect(s!.confidence).toBe('high');
  });

  it('detects "cylinder gone"', () => {
    const s = findByKey(extract('wants the cylinder gone if possible'), 'preference.avoid_cylinder');
    expect(s).toBeDefined();
  });

  it('detects "get rid of the cylinder"', () => {
    const s = findByKey(extract('they want to get rid of the hot water cylinder'), 'preference.avoid_cylinder');
    expect(s).toBeDefined();
  });

  it('detects "no cylinder"', () => {
    const s = findByKey(extract('they want no cylinder'), 'preference.avoid_cylinder');
    expect(s).toBeDefined();
  });

  it('is case-insensitive', () => {
    const s = findByKey(extract('CYLINDER REMOVED please'), 'preference.avoid_cylinder');
    expect(s).toBeDefined();
  });
});

describe('preference.simple_controls', () => {
  it('detects "simple controls"', () => {
    const s = findByKey(extract('customer wants simple controls'), 'preference.simple_controls');
    expect(s).toBeDefined();
    expect(s!.suggestedValue).toBe('true');
  });

  it('detects "elderly occupant"', () => {
    const s = findByKey(extract('elderly occupant, wants easy setup'), 'preference.simple_controls');
    expect(s).toBeDefined();
  });

  it('detects "keep it simple"', () => {
    const s = findByKey(extract('please keep it simple for them'), 'preference.simple_controls');
    expect(s).toBeDefined();
  });
});

describe('preference.no_bath_use', () => {
  it("detects \"doesn't use the bath\"", () => {
    const s = findByKey(extract("customer doesn't use the bath"), 'preference.no_bath_use');
    expect(s).toBeDefined();
    expect(s!.suggestedValue).toBe('true');
  });

  it('detects "rarely used bath"', () => {
    const s = findByKey(extract('bath is rarely used'), 'preference.no_bath_use');
    expect(s).toBeDefined();
  });

  it('detects "hardly use the bath"', () => {
    const s = findByKey(extract('they hardly use the bath'), 'preference.no_bath_use');
    expect(s).toBeDefined();
  });
});

describe('preference.night_worker', () => {
  it('detects "works nights"', () => {
    const s = findByKey(extract('the customer works nights so heating pattern is unusual'), 'preference.night_worker');
    expect(s).toBeDefined();
    expect(s!.category).toBe('preferences');
  });

  it('detects "night worker"', () => {
    const s = findByKey(extract('night worker in the house'), 'preference.night_worker');
    expect(s).toBeDefined();
  });
});

// ─── Install constraints ──────────────────────────────────────────────────────

describe('constraint.flue_route_difficult', () => {
  it('detects "awkward flue route"', () => {
    const s = findByKey(extract('there is an awkward flue route at the back'), 'constraint.flue_route_difficult');
    expect(s).toBeDefined();
    expect(s!.category).toBe('constraints');
    expect(s!.confidence).toBe('high');
  });

  it('detects "flue route is difficult"', () => {
    const s = findByKey(extract('flue route is difficult due to extension'), 'constraint.flue_route_difficult');
    expect(s).toBeDefined();
  });
});

describe('constraint.loft_access_poor', () => {
  it('detects "loft access is poor"', () => {
    const s = findByKey(extract('loft access is poor — tight hatch'), 'constraint.loft_access_poor');
    expect(s).toBeDefined();
    expect(s!.confidence).toBe('high');
  });

  it('detects "poor loft access"', () => {
    const s = findByKey(extract('poor loft access mentioned'), 'constraint.loft_access_poor');
    expect(s).toBeDefined();
  });
});

describe('constraint.narrow_stairs', () => {
  it('detects "narrow stairs"', () => {
    const s = findByKey(extract('narrow stairs to first floor'), 'constraint.narrow_stairs');
    expect(s).toBeDefined();
    expect(s!.category).toBe('constraints');
  });

  it('detects "stairs are narrow"', () => {
    const s = findByKey(extract('stairs are narrow, getting cylinder up will be a problem'), 'constraint.narrow_stairs');
    expect(s).toBeDefined();
  });
});

describe('constraint.cupboard_tight', () => {
  it('detects "cupboard is too tight"', () => {
    const s = findByKey(extract('the cupboard is too tight for a large unit'), 'constraint.cupboard_tight');
    expect(s).toBeDefined();
    expect(s!.confidence).toBe('high');
  });

  it('detects "pretty cramped"', () => {
    const s = findByKey(extract('boiler cupboard is pretty cramped'), 'constraint.cupboard_tight');
    expect(s).toBeDefined();
  });

  it('detects "cramped boiler space"', () => {
    const s = findByKey(extract('there is a cramped boiler space'), 'constraint.cupboard_tight');
    expect(s).toBeDefined();
  });
});

describe('constraint.storage_clearance_fail', () => {
  it('detects "too tight for unvented"', () => {
    const s = findByKey(extract('cupboard is too tight for unvented'), 'constraint.storage_clearance_fail');
    expect(s).toBeDefined();
  });

  it('detects "too tight for an unvented"', () => {
    const s = findByKey(extract('space is too tight for an unvented cylinder'), 'constraint.storage_clearance_fail');
    expect(s).toBeDefined();
  });
});

describe('constraint.pipe_route_difficult', () => {
  it('detects "pipe route is difficult"', () => {
    const s = findByKey(extract('pipe route is difficult through the solid walls'), 'constraint.pipe_route_difficult');
    expect(s).toBeDefined();
  });
});

describe('constraint.parking_scaffold_issue', () => {
  it('detects "parking issues"', () => {
    const s = findByKey(extract('there will be parking issues on this street'), 'constraint.parking_scaffold_issue');
    expect(s).toBeDefined();
  });

  it('detects "no parking"', () => {
    const s = findByKey(extract('no parking available near the property'), 'constraint.parking_scaffold_issue');
    expect(s).toBeDefined();
  });
});

// ─── DHW usage signals ────────────────────────────────────────────────────────

describe('usage.high_shower_concurrency', () => {
  it('detects "two showers"', () => {
    const s = findByKey(extract('two showers and hardly any baths'), 'usage.high_shower_concurrency');
    expect(s).toBeDefined();
    expect(s!.category).toBe('usage');
    expect(s!.suggestedValue).toBe('medium_high');
  });

  it('detects "multiple showers"', () => {
    const s = findByKey(extract('multiple showers in use daily'), 'usage.high_shower_concurrency');
    expect(s).toBeDefined();
  });

  it('detects "2 showers"', () => {
    const s = findByKey(extract('they have 2 showers'), 'usage.high_shower_concurrency');
    expect(s).toBeDefined();
  });
});

describe('usage.bath_infrequent', () => {
  it('detects "hardly any baths"', () => {
    const s = findByKey(extract('hardly any baths taken in this house'), 'usage.bath_infrequent');
    expect(s).toBeDefined();
    expect(s!.suggestedValue).toBe('true');
  });

  it('detects "never uses the bath"', () => {
    const s = findByKey(extract('customer never uses the bath'), 'usage.bath_infrequent');
    expect(s).toBeDefined();
  });
});

// ─── Risk / condition flags ───────────────────────────────────────────────────

describe('risk.likely_sludge', () => {
  it('detects "likely sludge"', () => {
    const s = findByKey(extract('there is likely sludge in the system'), 'risk.likely_sludge');
    expect(s).toBeDefined();
    expect(s!.category).toBe('risks');
    expect(s!.confidence).toBe('medium');
  });

  it('detects "probable sludge"', () => {
    const s = findByKey(extract('probable sludge based on bleed water'), 'risk.likely_sludge');
    expect(s).toBeDefined();
  });

  it("detects \"looks like there's sludge\"", () => {
    const s = findByKey(extract("looks like there's sludge in the circuit"), 'risk.likely_sludge');
    expect(s).toBeDefined();
  });
});

describe('risk.microbore_pipework', () => {
  it('detects "microbore"', () => {
    const s = findByKey(extract('radiators mostly old microbore, one room never gets hot'), 'risk.microbore_pipework');
    expect(s).toBeDefined();
    expect(s!.confidence).toBe('high');
  });
});

describe('risk.low_pressure_poor_flow', () => {
  it('detects "low pressure"', () => {
    const s = findByKey(extract('suspicious low pressure at the mains'), 'risk.low_pressure_poor_flow');
    expect(s).toBeDefined();
    expect(s!.category).toBe('risks');
  });

  it('detects "poor flow"', () => {
    const s = findByKey(extract('poor mains flow from the stopcock'), 'risk.low_pressure_poor_flow');
    expect(s).toBeDefined();
  });

  it('detects "suspected low pressure"', () => {
    const s = findByKey(extract('suspected low pressure — needs test'), 'risk.low_pressure_poor_flow');
    expect(s).toBeDefined();
  });
});

describe('risk.probable_asbestos', () => {
  it('detects "probable asbestos"', () => {
    const s = findByKey(extract('probable asbestos on the pipework lagging'), 'risk.probable_asbestos');
    expect(s).toBeDefined();
    expect(s!.confidence).toBe('high');
  });

  it('detects "suspected asbestos"', () => {
    const s = findByKey(extract('there is suspected asbestos on the ceiling tiles'), 'risk.probable_asbestos');
    expect(s).toBeDefined();
  });
});

describe('risk.radiator_imbalance', () => {
  it('detects "one room never gets hot"', () => {
    const s = findByKey(extract('one room never gets hot, probably microbore'), 'risk.radiator_imbalance');
    expect(s).toBeDefined();
    expect(s!.category).toBe('risks');
  });
});

// ─── Follow-up prompts ────────────────────────────────────────────────────────

describe('followup.confirm_bath_shower_count', () => {
  it('creates a follow-up when two showers are mentioned', () => {
    const results = extract('two showers and the bath is rarely used');
    const followUp = findByKey(results, 'followup.confirm_bath_shower_count');
    expect(followUp).toBeDefined();
    expect(followUp!.category).toBe('follow_ups');
    expect(followUp!.confidence).toBe('low');
  });
});

describe('followup.confirm_boiler_location', () => {
  it('creates a follow-up when customer wants boiler moved to loft', () => {
    const s = findByKey(
      extract('customer wants to move the boiler into the loft'),
      'followup.confirm_boiler_location',
    );
    expect(s).toBeDefined();
    expect(s!.category).toBe('follow_ups');
  });
});

// ─── Hard facts must NOT be extracted ────────────────────────────────────────

describe('hard measured fields are never extracted', () => {
  it('does not extract room dimension mentions', () => {
    // A note purely about geometry should yield zero suggestions
    const results = extract('the living room is about 3 metres wide and 4 metres long');
    expect(results).toEqual([]);
  });

  it('does not extract pure heat loss number mentions', () => {
    const results = extract('heat loss is approximately 8 kW based on the calculator');
    expect(results).toEqual([]);
  });

  it('does not extract exact appliance spec mentions without a risk/preference pattern', () => {
    const results = extract('the boiler output is 24kW and has an ErP class of A');
    expect(results).toEqual([]);
  });
});

// ─── Multi-signal transcript ──────────────────────────────────────────────────

describe('multi-signal transcript', () => {
  it('extracts all matching signals from a rich note', () => {
    const transcript =
      'Customer wants the hot water cylinder gone if possible. ' +
      'Boiler cupboard is pretty cramped, and there are two showers. ' +
      'Likely sludge in the system based on bleed water colour.';

    const results = extract(transcript);

    expect(findByKey(results, 'preference.avoid_cylinder')).toBeDefined();
    expect(findByKey(results, 'constraint.cupboard_tight')).toBeDefined();
    expect(findByKey(results, 'usage.high_shower_concurrency')).toBeDefined();
    expect(findByKey(results, 'risk.likely_sludge')).toBeDefined();
  });

  it('groups suggestions into expected categories', () => {
    const transcript =
      'Customer wants the hot water cylinder gone. ' +
      'Narrow stairs. ' +
      'Two showers used daily. ' +
      'Probable sludge.';

    const results = extract(transcript);

    const categories = new Set(results.map(s => s.category));
    expect(categories.has('preferences')).toBe(true);
    expect(categories.has('constraints')).toBe(true);
    expect(categories.has('usage')).toBe(true);
    expect(categories.has('risks')).toBe(true);
  });
});
