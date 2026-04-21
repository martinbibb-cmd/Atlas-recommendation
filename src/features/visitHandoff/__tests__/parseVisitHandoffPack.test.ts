/**
 * parseVisitHandoffPack.test.ts
 *
 * PR11 — Tests for the VisitHandoffPack safe parser.
 */

import { describe, it, expect } from 'vitest';
import { safeParseVisitHandoffPack } from '../parser/parseVisitHandoffPack';
import { SAMPLE_VISIT_HANDOFF_PACK } from '../fixtures/sampleVisitHandoffPack';

// ─── Minimal valid pack ───────────────────────────────────────────────────────

const MINIMAL_VALID: unknown = {
  schemaVersion: '1.0',
  visitId: 'visit_001',
  completedAt: '2025-10-14T14:32:00Z',
  customerSummary: {
    address: '14 Acacia Road, London, SW1A 1AA',
    findings: [],
    plannedWork: [],
  },
  engineerSummary: {
    rooms: [],
    keyObjects: [],
    proposedEmitters: [],
    accessNotes: [],
  },
};

describe('safeParseVisitHandoffPack', () => {

  describe('valid pack', () => {
    it('parses a minimal valid pack', () => {
      const result = safeParseVisitHandoffPack(MINIMAL_VALID);
      expect(result).not.toBeNull();
      expect(result?.schemaVersion).toBe('1.0');
      expect(result?.visitId).toBe('visit_001');
      expect(result?.completedAt).toBe('2025-10-14T14:32:00Z');
    });

    it('parses the full sample fixture', () => {
      const result = safeParseVisitHandoffPack(SAMPLE_VISIT_HANDOFF_PACK);
      expect(result).not.toBeNull();
      expect(result?.visitId).toBe('visit_demo_001');
      expect(result?.engineerName).toBe('J. Smith');
      expect(result?.customerSummary.address).toBe('14 Acacia Road, London, SW1A 1AA');
      expect(result?.customerSummary.findings.length).toBeGreaterThan(0);
      expect(result?.customerSummary.plannedWork.length).toBeGreaterThan(0);
      expect(result?.engineerSummary.rooms.length).toBeGreaterThan(0);
      expect(result?.engineerSummary.proposedEmitters.length).toBeGreaterThan(0);
    });

    it('preserves optional fields when present', () => {
      const pack = {
        ...MINIMAL_VALID as object,
        engineerName: 'A. Technician',
        customerSummary: {
          address: '1 Test Street',
          currentSystemDescription: 'A combination boiler.',
          findings: ['Finding A'],
          plannedWork: ['Task B'],
          nextSteps: 'We will call you.',
        },
        engineerSummary: {
          rooms: [{ id: 'r1', name: 'Kitchen', areaM2: 12, notes: 'South wall' }],
          keyObjects: [{ type: 'Boiler', make: 'Worcester', installYear: 2010, condition: 'Good', notes: 'Checked' }],
          proposedEmitters: [{
            roomId: 'r1',
            roomName: 'Kitchen',
            emitterType: 'Radiator',
            outputWatts: 900,
            notes: 'Like-for-like',
          }],
          accessNotes: [{ location: 'Loft', note: 'Accessible' }],
          roomPlanNotes: 'Two storey',
          specNotes: '22mm primary',
          fieldNotesSummary: 'Clean job',
        },
      };
      const result = safeParseVisitHandoffPack(pack);
      expect(result).not.toBeNull();
      expect(result?.engineerName).toBe('A. Technician');
      expect(result?.customerSummary.currentSystemDescription).toBe('A combination boiler.');
      expect(result?.customerSummary.nextSteps).toBe('We will call you.');
      expect(result?.engineerSummary.rooms[0].areaM2).toBe(12);
      expect(result?.engineerSummary.keyObjects[0].make).toBe('Worcester');
      expect(result?.engineerSummary.proposedEmitters[0].outputWatts).toBe(900);
      expect(result?.engineerSummary.roomPlanNotes).toBe('Two storey');
      expect(result?.engineerSummary.specNotes).toBe('22mm primary');
      expect(result?.engineerSummary.fieldNotesSummary).toBe('Clean job');
    });
  });

  describe('missing optional arrays normalise safely', () => {
    it('normalises missing findings to empty array', () => {
      const input = {
        ...MINIMAL_VALID as object,
        customerSummary: { address: '1 Test St' },
        engineerSummary: {},
      };
      const result = safeParseVisitHandoffPack(input);
      expect(result).not.toBeNull();
      expect(result?.customerSummary.findings).toEqual([]);
      expect(result?.customerSummary.plannedWork).toEqual([]);
      expect(result?.engineerSummary.rooms).toEqual([]);
      expect(result?.engineerSummary.keyObjects).toEqual([]);
      expect(result?.engineerSummary.proposedEmitters).toEqual([]);
      expect(result?.engineerSummary.accessNotes).toEqual([]);
    });

    it('filters out non-string items from findings array', () => {
      const input = {
        ...MINIMAL_VALID as object,
        customerSummary: {
          address: '1 Test St',
          findings: ['Valid finding', 42, null, 'Another finding'],
          plannedWork: [],
        },
      };
      const result = safeParseVisitHandoffPack(input);
      expect(result?.customerSummary.findings).toEqual(['Valid finding', 'Another finding']);
    });

    it('filters out malformed room objects', () => {
      const input = {
        ...MINIMAL_VALID as object,
        engineerSummary: {
          rooms: [
            { id: 'r1', name: 'Living Room' },
            { name: 'Missing ID room' },
            'not an object',
            null,
          ],
        },
      };
      const result = safeParseVisitHandoffPack(input);
      expect(result?.engineerSummary.rooms).toHaveLength(1);
      expect(result?.engineerSummary.rooms[0].id).toBe('r1');
    });

    it('filters out malformed proposed emitters', () => {
      const input = {
        ...MINIMAL_VALID as object,
        engineerSummary: {
          proposedEmitters: [
            { roomId: 'r1', roomName: 'Hall', emitterType: 'Radiator' },
            { roomId: 'r2', emitterType: 'Radiator' },
          ],
        },
      };
      const result = safeParseVisitHandoffPack(input);
      expect(result?.engineerSummary.proposedEmitters).toHaveLength(1);
    });
  });

  describe('invalid top-level shape fails gracefully', () => {
    it('returns null for null', () => {
      expect(safeParseVisitHandoffPack(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(safeParseVisitHandoffPack(undefined)).toBeNull();
    });

    it('returns null for a string', () => {
      expect(safeParseVisitHandoffPack('{"schemaVersion":"1.0"}')).toBeNull();
    });

    it('returns null for an array', () => {
      expect(safeParseVisitHandoffPack([])).toBeNull();
    });

    it('returns null for an empty object', () => {
      expect(safeParseVisitHandoffPack({})).toBeNull();
    });

    it('returns null for wrong schemaVersion', () => {
      const input = { ...MINIMAL_VALID as object, schemaVersion: '2.0' };
      expect(safeParseVisitHandoffPack(input)).toBeNull();
    });

    it('returns null when visitId is missing', () => {
      const { visitId: _, ...rest } = MINIMAL_VALID as Record<string, unknown>;
      expect(safeParseVisitHandoffPack(rest)).toBeNull();
    });

    it('returns null when visitId is empty string', () => {
      const input = { ...MINIMAL_VALID as object, visitId: '' };
      expect(safeParseVisitHandoffPack(input)).toBeNull();
    });

    it('returns null when completedAt is missing', () => {
      const { completedAt: _, ...rest } = MINIMAL_VALID as Record<string, unknown>;
      expect(safeParseVisitHandoffPack(rest)).toBeNull();
    });

    it('returns null when customerSummary is missing', () => {
      const { customerSummary: _, ...rest } = MINIMAL_VALID as Record<string, unknown>;
      expect(safeParseVisitHandoffPack(rest)).toBeNull();
    });

    it('returns null when customerSummary has no address', () => {
      const input = {
        ...MINIMAL_VALID as object,
        customerSummary: { findings: [], plannedWork: [] },
      };
      expect(safeParseVisitHandoffPack(input)).toBeNull();
    });

    it('returns null when engineerSummary is missing', () => {
      const { engineerSummary: _, ...rest } = MINIMAL_VALID as Record<string, unknown>;
      expect(safeParseVisitHandoffPack(rest)).toBeNull();
    });

    it('never throws on deeply malformed input', () => {
      const malformed = [
        { schemaVersion: '1.0', visitId: 'x', completedAt: 'y', customerSummary: null, engineerSummary: null },
        { schemaVersion: '1.0', visitId: 'x', completedAt: 'y', customerSummary: 42, engineerSummary: [] },
        { schemaVersion: '1.0' },
        42,
        'hello',
        true,
        null,
        undefined,
        [],
      ];
      for (const input of malformed) {
        expect(() => safeParseVisitHandoffPack(input)).not.toThrow();
        expect(safeParseVisitHandoffPack(input)).toBeNull();
      }
    });
  });
});
