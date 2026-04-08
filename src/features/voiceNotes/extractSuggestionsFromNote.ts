/**
 * extractSuggestionsFromNote.ts
 *
 * Pattern-based extraction of survey suggestions from a voice-note transcript.
 *
 * Rules:
 *  - NEVER auto-fill hard measured fields (room dimensions, heat loss, exact
 *    clearances, measured flow rate / pressure, exact appliance specs).
 *  - Good candidates: customer preferences, install constraints, access risks,
 *    DHW usage clues, disruption tolerance, room usage notes, follow-up questions.
 *  - All returned suggestions have:
 *      status    = 'suggested'
 *      provenance = 'inferred_from_voice_note'
 *  - These must be reviewed and accepted by the engineer before they influence
 *    the recommendation engine.
 */

import type { VoiceNoteSuggestion, SuggestionCategory } from './voiceNoteTypes';

// ─── Extraction rule ──────────────────────────────────────────────────────────

interface ExtractionRule {
  /** Unique survey key for this suggestion. */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Category for grouping in the suggestions panel. */
  category: SuggestionCategory;
  /** Ordered list of patterns — first match wins. */
  patterns: RegExp[];
  /**
   * Derives the suggestedValue from the match.
   * Return null to skip this rule (no useful value could be extracted).
   */
  extractValue: (match: RegExpMatchArray, transcript: string) => string | null;
  /** Confidence band applied to all suggestions from this rule. */
  confidence: 'high' | 'medium' | 'low';
}

// ─── Extraction rule table ────────────────────────────────────────────────────

const EXTRACTION_RULES: ExtractionRule[] = [
  // ── Customer preferences ────────────────────────────────────────────────────

  {
    key: 'preference.avoid_cylinder',
    label: 'Avoid cylinder if suitable',
    category: 'preferences',
    confidence: 'high',
    patterns: [
      /cylinder\s+(?:removed?|gone|get\s+rid\s+of)/i,
      /(?:wants?|would\s+like)\s+(?:the\s+)?cylinder\s+(?:removed?|gone|out)/i,
      /(?:no|without)\s+(?:hot\s+water\s+)?cylinder/i,
      /get\s+rid\s+of\s+(?:the\s+)?(?:hot\s+water\s+)?cylinder/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'preference.preferred_boiler_location',
    label: 'Preferred boiler location noted',
    category: 'preferences',
    confidence: 'medium',
    patterns: [
      /(?:wants?|move|moved?|relocate)\s+(?:the\s+)?boiler\s+(?:in(?:to)?|to)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
      /boiler\s+(?:in(?:to)?|to)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    ],
    extractValue: (match) => {
      const location = match[1]?.trim().toLowerCase();
      if (!location) return null;
      // Filter out function words that aren't useful location names
      const stopWords = new Set(['a', 'an', 'the', 'be', 'is', 'was']);
      if (stopWords.has(location)) return null;
      return location;
    },
  },

  {
    key: 'preference.simple_controls',
    label: 'Simple controls preferred',
    category: 'preferences',
    confidence: 'high',
    patterns: [
      /(?:simple|easy|straightforward)\s+controls?/i,
      /elderly\s+(?:occupant|resident|customer|person)/i,
      /(?:doesn'?t|don'?t)\s+(?:want|like)\s+(?:complicated|complex)\s+controls?/i,
      /keep\s+(?:it|controls?|things?)\s+simple/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'preference.no_bath_use',
    label: 'Bath rarely or never used',
    category: 'preferences',
    confidence: 'medium',
    patterns: [
      /(?:doesn'?t|don'?t|hardly|rarely|never)\s+use[sd]?\s+(?:the\s+)?bath/i,
      /(?:no|without)\s+bath\s+use/i,
      /bath\s+(?:is\s+)?rarely\s+used/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'preference.night_worker',
    label: 'Night worker — unusual daytime heating pattern',
    category: 'preferences',
    confidence: 'medium',
    patterns: [
      /works?\s+nights?/i,
      /night\s+worker/i,
      /daytime\s+(?:heating|occupancy)\s+(?:pattern\s+)?(?:odd|unusual|different)/i,
    ],
    extractValue: () => 'true',
  },

  // ── Install constraints ─────────────────────────────────────────────────────

  {
    key: 'constraint.flue_route_difficult',
    label: 'Awkward flue route',
    category: 'constraints',
    confidence: 'high',
    patterns: [
      /(?:awkward|difficult|tricky|problematic)\s+flue(?:\s+route)?/i,
      /flue\s+(?:route\s+)?(?:is\s+)?(?:awkward|difficult|problematic|tricky)/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.loft_access_poor',
    label: 'Poor loft access',
    category: 'constraints',
    confidence: 'high',
    patterns: [
      /loft\s+access\s+(?:is\s+)?(?:poor|difficult|limited|restricted)/i,
      /(?:poor|difficult|limited)\s+loft\s+access/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.narrow_stairs',
    label: 'Narrow stairs (access constraint)',
    category: 'constraints',
    confidence: 'high',
    patterns: [
      /narrow\s+stairs?/i,
      /stairs?\s+are\s+narrow/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.cupboard_tight',
    label: 'Tight cupboard / boiler space',
    category: 'constraints',
    confidence: 'high',
    patterns: [
      /cupboard\s+(?:is\s+)?(?:too\s+)?(?:tight|small|cramped|restricted)/i,
      /(?:too\s+)?tight\s+(?:cupboard|space)/i,
      /(?:cramped|small)\s+(?:boiler\s+)?(?:cupboard|space)/i,
      /(?:pretty|very|quite)\s+cramped/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.storage_clearance_fail',
    label: 'Cupboard too tight for unvented storage',
    category: 'constraints',
    confidence: 'high',
    patterns: [
      /(?:cupboard|space)\s+(?:is\s+)?too\s+tight\s+for\s+(?:unvented|cylinder|storage)/i,
      /too\s+tight\s+for\s+(?:an?\s+)?unvented/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.pipe_route_difficult',
    label: 'Difficult pipe route',
    category: 'constraints',
    confidence: 'medium',
    patterns: [
      /pipe\s+(?:route|run|routing)\s+(?:is\s+)?(?:difficult|awkward|tricky)/i,
      /(?:difficult|awkward|tricky)\s+pipe\s+(?:route|run)/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'constraint.parking_scaffold_issue',
    label: 'Parking / scaffold concern',
    category: 'constraints',
    confidence: 'medium',
    patterns: [
      /(?:parking|scaffold(?:ing)?)\s+(?:issues?|problems?|concerns?)/i,
      /(?:no|limited)\s+parking/i,
    ],
    extractValue: () => 'true',
  },

  // ── DHW usage signals ───────────────────────────────────────────────────────

  {
    key: 'usage.high_shower_concurrency',
    label: 'Multiple showers — high DHW concurrency risk',
    category: 'usage',
    confidence: 'medium',
    patterns: [
      /(?:two|2|multiple|both)\s+showers?/i,
      /showers?\s+(?:running\s+)?(?:at\s+once|simultaneously|at\s+the\s+same\s+time)/i,
    ],
    extractValue: () => 'medium_high',
  },

  {
    key: 'usage.bath_infrequent',
    label: 'Bath rarely or never used',
    category: 'usage',
    confidence: 'medium',
    patterns: [
      /hardly\s+any\s+baths?/i,
      /(?:never|rarely|seldom)\s+(?:uses?|used?)\s+(?:the\s+)?bath/i,
      /bath\s+(?:is\s+)?rarely\s+used/i,
    ],
    extractValue: () => 'true',
  },

  // ── Risk / condition flags ──────────────────────────────────────────────────

  {
    key: 'risk.likely_sludge',
    label: 'Likely sludge / system contamination',
    category: 'risks',
    confidence: 'medium',
    patterns: [
      /(?:likely|probable|suspect(?:ed)?)\s+sludge/i,
      /sludge\s+(?:is\s+)?(?:likely|probable|suspected)/i,
      /looks?\s+like\s+(?:there'?s?\s+)?sludge/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'risk.microbore_pipework',
    label: 'Microbore pipework present',
    category: 'risks',
    confidence: 'high',
    patterns: [
      /microbore/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'risk.low_pressure_poor_flow',
    label: 'Suspected low pressure / poor flow',
    category: 'risks',
    confidence: 'medium',
    patterns: [
      /(?:suspicious\s+)?low\s+pressure/i,
      /(?:poor|low)\s+(?:mains\s+)?flow/i,
      /suspect(?:ed)?\s+(?:low|poor)\s+(?:pressure|flow)/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'risk.probable_asbestos',
    label: 'Probable asbestos concern',
    category: 'risks',
    confidence: 'high',
    patterns: [
      /(?:probable|possible|suspect(?:ed)?)\s+asbestos/i,
      /asbestos\s+(?:concern|risk|possible|probable)/i,
    ],
    extractValue: () => 'true',
  },

  {
    key: 'risk.radiator_imbalance',
    label: 'Radiator imbalance / emitter concern',
    category: 'risks',
    confidence: 'medium',
    patterns: [
      /one\s+room\s+(?:never|doesn'?t|not)\s+(?:gets?\s+)?hot/i,
      /(?:radiators?|rads?)\s+(?:not\s+)?heating\s+(?:unevenly|unevenl?y|inconsistently)/i,
      /(?:cold\s+)?room\s+(?:that\s+)?(?:never|doesn'?t)\s+(?:heat|warm)/i,
    ],
    extractValue: () => 'true',
  },

  // ── Follow-up prompts ───────────────────────────────────────────────────────

  {
    key: 'followup.confirm_bath_shower_count',
    label: 'Confirm bath count and simultaneous shower use',
    category: 'follow_ups',
    confidence: 'low',
    patterns: [
      /(?:two|2|multiple)\s+showers?/i,
    ],
    extractValue: () => 'Confirm exact bathroom count and peak simultaneous shower use',
  },

  {
    key: 'followup.confirm_boiler_location',
    label: 'Confirm proposed boiler location with customer',
    category: 'follow_ups',
    confidence: 'low',
    patterns: [
      /(?:wants?|move|moved?|relocate)\s+(?:the\s+)?boiler\s+(?:in(?:to)?|to)\s+(?:the\s+)?(?:loft|kitchen|utility|garage|airing\s+cupboard)/i,
    ],
    extractValue: () => 'Confirm preferred boiler location and check flue route feasibility',
  },

  {
    key: 'followup.mark_install_constraint',
    label: 'Mark access or clearance concern in survey',
    category: 'follow_ups',
    confidence: 'low',
    patterns: [
      /(?:poor|difficult|limited)\s+(?:access|loft\s+access|boiler\s+access)/i,
    ],
    extractValue: () => 'Mark as install constraint and review during site survey',
  },

  {
    key: 'followup.combi_preference_confirm',
    label: 'Customer prefers combi — confirm suitability',
    category: 'follow_ups',
    confidence: 'low',
    patterns: [
      /(?:customer|homeowner|they)\s+(?:wants?|prefers?)\s+(?:a\s+)?combi/i,
      /prefer(?:s|red)?\s+(?:a\s+)?combi/i,
    ],
    extractValue: () => 'Confirm combi suitability given pressure, bathroom count, and demand profile',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a ~80-character snippet centred on the match position. */
function extractSnippet(transcript: string, match: RegExpMatchArray): string {
  const index = match.index ?? 0;
  const CONTEXT = 40;
  const start = Math.max(0, index - CONTEXT);
  const end   = Math.min(transcript.length, index + match[0].length + CONTEXT);
  let snippet = transcript.slice(start, end).trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < transcript.length) snippet += '…';
  return snippet;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * extractSuggestionsFromNote
 *
 * Extracts survey-input suggestions from a voice-note transcript using
 * keyword / pattern matching.
 *
 * Rules:
 *  - Only "good-candidate" fields are extracted: preferences, constraints,
 *    usage signals, risk flags, and follow-up questions.
 *  - Hard measured fields (room dimensions, heat loss, exact specs, measured
 *    flow rate / pressure) are never extracted — those must be measured or
 *    confirmed manually.
 *  - All suggestions have:
 *      status    = 'suggested'
 *      provenance = 'inferred_from_voice_note'
 *
 * @param noteId     Stable ID of the VoiceNote being processed.
 * @param transcript Raw transcript text from the voice note.
 */
export function extractSuggestionsFromNote(
  noteId: string,
  transcript: string,
): VoiceNoteSuggestion[] {
  if (!transcript || transcript.trim().length === 0) return [];

  const seen = new Set<string>();
  const suggestions: VoiceNoteSuggestion[] = [];

  for (const rule of EXTRACTION_RULES) {
    if (seen.has(rule.key)) continue;

    for (const pattern of rule.patterns) {
      const match = transcript.match(pattern);
      if (!match) continue;

      const value = rule.extractValue(match, transcript);
      if (value === null) continue;

      suggestions.push({
        id:             `${noteId}_${rule.key}`,
        key:            rule.key,
        label:          rule.label,
        suggestedValue: value,
        confidence:     rule.confidence,
        sourceNoteId:   noteId,
        sourceSnippet:  extractSnippet(transcript, match),
        provenance:     'inferred_from_voice_note',
        status:         'suggested',
        category:       rule.category,
      });
      seen.add(rule.key);
      break; // First matching pattern for this rule is sufficient
    }
  }

  return suggestions;
}
