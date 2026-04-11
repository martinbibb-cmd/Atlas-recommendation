/**
 * readCanonicalReportPayload.test.ts
 *
 * PR3 — Tests for:
 *   - readCanonicalReportPayload()
 *   - extractAtlasPropertyFromPayload()
 *   - extractEngineRunFromPayload()
 *   - extractPresentationStateFromPayload()
 *   - isCanonicalReportPayloadV1() / isLegacyReportPayloadV1() type guards
 */

import { describe, it, expect } from 'vitest';
import { readCanonicalReportPayload } from '../adapters/readCanonicalReportPayload';
import { extractAtlasPropertyFromPayload } from '../adapters/extractAtlasPropertyFromPayload';
import { extractEngineRunFromPayload } from '../adapters/extractEngineRunFromPayload';
import { extractPresentationStateFromPayload } from '../adapters/extractPresentationStateFromPayload';
import {
  isCanonicalReportPayloadV1,
  isLegacyReportPayloadV1,
} from '../types/reportPayload.types';
import type { CanonicalReportPayloadV1, LegacyReportPayloadV1 } from '../types/reportPayload.types';
import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUB_ENGINE_OUTPUT: EngineOutputV1 = { options: [] } as unknown as EngineOutputV1;

const STUB_ATLAS_PROPERTY: AtlasPropertyV1 = { propertyId: 'prop-1' } as unknown as AtlasPropertyV1;

const CANONICAL_PAYLOAD: CanonicalReportPayloadV1 = {
  schemaVersion: '2.0',
  atlasProperty: STUB_ATLAS_PROPERTY,
  engineRun: {
    engineOutput: STUB_ENGINE_OUTPUT,
    runMeta: { source: 'atlas_mind' },
  },
  presentationState: { recommendedOptionId: 'opt-1', chosenByCustomer: false },
  decisionSynthesis: null,
  legacy: {
    surveyData: { postcode: 'SW1A 1AA' } as LegacyReportPayloadV1['surveyData'],
    engineOutput: STUB_ENGINE_OUTPUT,
  },
};

const LEGACY_PAYLOAD: LegacyReportPayloadV1 = {
  surveyData: { postcode: 'SW1A 1AA' } as LegacyReportPayloadV1['surveyData'],
  engineInput: { postcode: 'SW1A 1AA' } as LegacyReportPayloadV1['engineInput'],
  engineOutput: STUB_ENGINE_OUTPUT,
  decisionSynthesis: null,
  presentationState: { recommendedOptionId: 'opt-2', chosenByCustomer: true },
};

const LEGACY_PAYLOAD_NO_SURVEY: LegacyReportPayloadV1 = {
  engineOutput: STUB_ENGINE_OUTPUT,
};

// ─── Type guards ──────────────────────────────────────────────────────────────

describe('isCanonicalReportPayloadV1', () => {
  it('returns true for a valid canonical payload', () => {
    expect(isCanonicalReportPayloadV1(CANONICAL_PAYLOAD)).toBe(true);
  });

  it('returns false for a legacy payload', () => {
    expect(isCanonicalReportPayloadV1(LEGACY_PAYLOAD)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isCanonicalReportPayloadV1(null)).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isCanonicalReportPayloadV1('string')).toBe(false);
    expect(isCanonicalReportPayloadV1(42)).toBe(false);
  });

  it('returns false when schemaVersion is present but atlasProperty is missing', () => {
    expect(isCanonicalReportPayloadV1({ schemaVersion: '2.0' })).toBe(false);
  });

  it('returns false when atlasProperty is present but schemaVersion is wrong', () => {
    expect(isCanonicalReportPayloadV1({ schemaVersion: '1.0', atlasProperty: {} })).toBe(false);
  });
});

describe('isLegacyReportPayloadV1', () => {
  it('returns true when surveyData is present', () => {
    expect(isLegacyReportPayloadV1({ surveyData: {} })).toBe(true);
  });

  it('returns true when engineOutput is present', () => {
    expect(isLegacyReportPayloadV1({ engineOutput: {} })).toBe(true);
  });

  it('returns false for canonical payload (no surveyData/engineOutput at top level)', () => {
    // The canonical payload does not have top-level surveyData or engineOutput
    const canonical = { schemaVersion: '2.0', atlasProperty: {}, engineRun: { engineOutput: {} } };
    expect(isLegacyReportPayloadV1(canonical)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isLegacyReportPayloadV1(null)).toBe(false);
  });
});

// ─── readCanonicalReportPayload ───────────────────────────────────────────────

describe('readCanonicalReportPayload', () => {
  describe('canonical_v2', () => {
    it('detects canonical_v2 payloads', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.payloadVersion).toBe('canonical_v2');
    });

    it('returns atlasProperty', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.atlasProperty).toBe(STUB_ATLAS_PROPERTY);
    });

    it('returns engineRun', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.engineRun?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    });

    it('returns presentationState', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.presentationState?.recommendedOptionId).toBe('opt-1');
    });

    it('returns decisionSynthesis', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.decisionSynthesis).toBeNull();
    });

    it('returns legacy block when present in canonical payload', () => {
      const result = readCanonicalReportPayload(CANONICAL_PAYLOAD);
      expect(result.legacy?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    });
  });

  describe('legacy_v1', () => {
    it('detects legacy_v1 payloads', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD);
      expect(result.payloadVersion).toBe('legacy_v1');
    });

    it('does not return atlasProperty for legacy payload', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD);
      expect(result.atlasProperty).toBeUndefined();
    });

    it('does not return engineRun for legacy payload', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD);
      expect(result.engineRun).toBeUndefined();
    });

    it('populates legacy block from legacy payload fields', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD);
      expect(result.legacy?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
      expect(result.legacy?.engineInput).toBeDefined();
    });

    it('returns presentationState from legacy payload', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD);
      expect(result.presentationState?.recommendedOptionId).toBe('opt-2');
    });

    it('accepts legacy payload without surveyData', () => {
      const result = readCanonicalReportPayload(LEGACY_PAYLOAD_NO_SURVEY);
      expect(result.payloadVersion).toBe('legacy_v1');
      expect(result.legacy?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    });
  });

  describe('unknown', () => {
    it('returns unknown for null', () => {
      expect(readCanonicalReportPayload(null).payloadVersion).toBe('unknown');
    });

    it('returns unknown for undefined', () => {
      expect(readCanonicalReportPayload(undefined).payloadVersion).toBe('unknown');
    });

    it('returns unknown for empty object', () => {
      expect(readCanonicalReportPayload({}).payloadVersion).toBe('unknown');
    });

    it('returns unknown for a string', () => {
      expect(readCanonicalReportPayload('not a payload').payloadVersion).toBe('unknown');
    });

    it('never throws on partial or malformed payloads', () => {
      expect(() => readCanonicalReportPayload({ partial: true })).not.toThrow();
      expect(() => readCanonicalReportPayload([])).not.toThrow();
      expect(() => readCanonicalReportPayload(42)).not.toThrow();
    });
  });
});

// ─── extractAtlasPropertyFromPayload ─────────────────────────────────────────

describe('extractAtlasPropertyFromPayload', () => {
  it('returns atlasProperty from a canonical payload', () => {
    expect(extractAtlasPropertyFromPayload(CANONICAL_PAYLOAD)).toBe(STUB_ATLAS_PROPERTY);
  });

  it('derives atlasProperty from legacy surveyData when only legacy payload is available', () => {
    const result = extractAtlasPropertyFromPayload(LEGACY_PAYLOAD);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returns null for legacy payload without surveyData', () => {
    expect(extractAtlasPropertyFromPayload(LEGACY_PAYLOAD_NO_SURVEY)).toBeNull();
  });

  it('returns null for unknown payload', () => {
    expect(extractAtlasPropertyFromPayload(null)).toBeNull();
    expect(extractAtlasPropertyFromPayload({})).toBeNull();
  });
});

// ─── extractEngineRunFromPayload ──────────────────────────────────────────────

describe('extractEngineRunFromPayload', () => {
  it('returns engineRun from a canonical payload', () => {
    const result = extractEngineRunFromPayload(CANONICAL_PAYLOAD);
    expect(result?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    expect(result?.runMeta?.source).toBe('atlas_mind');
  });

  it('assembles engineRun from legacy engineOutput', () => {
    const result = extractEngineRunFromPayload(LEGACY_PAYLOAD);
    expect(result?.engineOutput).toBe(STUB_ENGINE_OUTPUT);
    expect(result?.engineInput).toBeDefined();
  });

  it('returns null for legacy payload without engineOutput', () => {
    expect(extractEngineRunFromPayload({ surveyData: {} })).toBeNull();
  });

  it('returns null for unknown payload', () => {
    expect(extractEngineRunFromPayload(null)).toBeNull();
    expect(extractEngineRunFromPayload({})).toBeNull();
  });
});

// ─── extractPresentationStateFromPayload ──────────────────────────────────────

describe('extractPresentationStateFromPayload', () => {
  it('returns presentationState from a canonical payload', () => {
    const result = extractPresentationStateFromPayload(CANONICAL_PAYLOAD);
    expect(result?.recommendedOptionId).toBe('opt-1');
  });

  it('returns presentationState from a legacy payload', () => {
    const result = extractPresentationStateFromPayload(LEGACY_PAYLOAD);
    expect(result?.recommendedOptionId).toBe('opt-2');
  });

  it('returns null when presentationState is absent', () => {
    expect(extractPresentationStateFromPayload(LEGACY_PAYLOAD_NO_SURVEY)).toBeNull();
    expect(extractPresentationStateFromPayload(null)).toBeNull();
    expect(extractPresentationStateFromPayload({})).toBeNull();
  });
});
