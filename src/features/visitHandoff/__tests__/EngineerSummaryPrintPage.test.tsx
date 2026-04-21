/**
 * EngineerSummaryPrintPage.test.tsx
 *
 * PR13 — Component tests for the engineer share / print handoff page.
 *
 * Tests
 * ─────
 *   - All eight engineer-facing sections render
 *   - Proposed emitters table renders correctly
 *   - Key objects table renders correctly
 *   - Access notes table renders correctly
 *   - Room plan notes, spec notes, field notes render
 *   - Empty / sparse states appear correctly per section
 *   - Print and Share action buttons render when a pack is loaded
 *   - Error / missing-pack state renders when no valid pack is provided
 *   - Customer-only sections ("What happens next", survey complete banner) are absent
 *   - Raw debug controls are absent (no "Show raw JSON")
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EngineerSummaryPrintPage from '../components/EngineerSummaryPrintPage';
import type { VisitHandoffPack } from '../types/visitHandoffPack';
import { SAMPLE_VISIT_HANDOFF_PACK } from '../fixtures/sampleVisitHandoffPack';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_PACK: VisitHandoffPack = {
  ...SAMPLE_VISIT_HANDOFF_PACK,
  engineerName: 'J. Smith',
  engineerSummary: {
    rooms: [
      { id: 'r1', name: 'Living Room', areaM2: 22, notes: 'Double radiator.' },
      { id: 'r2', name: 'Kitchen', areaM2: 15 },
    ],
    keyObjects: [
      {
        type: 'Boiler',
        make: 'Worcester Bosch 30i',
        installYear: 2009,
        condition: 'End of life',
        notes: 'Replacement required.',
      },
    ],
    proposedEmitters: [
      {
        roomId: 'r1',
        roomName: 'Living Room',
        emitterType: 'Radiator',
        outputWatts: 1800,
        notes: 'Like-for-like replacement.',
      },
      {
        roomId: 'r2',
        roomName: 'Kitchen',
        emitterType: 'Radiator',
        outputWatts: 900,
        notes: 'New TRV',
      },
    ],
    accessNotes: [
      { location: 'Boiler cupboard', note: 'Narrow — 600 mm clearance.' },
    ],
    roomPlanNotes: 'Two-storey semi-detached.',
    specNotes: '22 mm primary pipework.',
    fieldNotesSummary: 'Clean install, no obstructions.',
  },
};

const SPARSE_PACK: VisitHandoffPack = {
  ...SAMPLE_VISIT_HANDOFF_PACK,
  engineerSummary: {
    rooms: [],
    keyObjects: [],
    proposedEmitters: [],
    accessNotes: [],
  },
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('EngineerSummaryPrintPage', () => {

  // ── Section rendering with a full pack ──────────────────────────────────────

  describe('renders all engineer sections', () => {
    it('renders the Visit complete banner', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-completion')).toBeTruthy();
      expect(screen.getByText('Visit complete')).toBeTruthy();
    });

    it('renders the address in the page header', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText(FULL_PACK.customerSummary.address)).toBeTruthy();
    });

    it('renders engineer name in header when present', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      // Appears at least once (header + completion row)
      expect(screen.getAllByText(/J\. Smith/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders the Read only badge', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Read only')).toBeTruthy();
    });

    it('renders the Rooms section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-rooms')).toBeTruthy();
    });

    it('renders the Key objects section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-key-objects')).toBeTruthy();
    });

    it('renders the Proposed emitters section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-proposed-emitters')).toBeTruthy();
    });

    it('renders the Access notes section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-access-notes')).toBeTruthy();
    });

    it('renders the Room plan notes section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-room-plan-notes')).toBeTruthy();
    });

    it('renders the Spec notes section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-spec-notes')).toBeTruthy();
    });

    it('renders the Field notes summary section', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-section-field-notes')).toBeTruthy();
    });
  });

  // ── Proposed emitters table ─────────────────────────────────────────────────

  describe('proposed emitters table', () => {
    it('renders proposed emitters table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-emitters-table')).toBeTruthy();
    });

    it('renders room names in emitters table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getAllByText('Living Room').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Kitchen').length).toBeGreaterThanOrEqual(1);
    });

    it('renders emitter types in table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getAllByText('Radiator').length).toBeGreaterThanOrEqual(2);
    });

    it('renders output wattage in table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('1800 W')).toBeTruthy();
      expect(screen.getByText('900 W')).toBeTruthy();
    });

    it('renders emitter notes in table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Like-for-like replacement.')).toBeTruthy();
      expect(screen.getByText('New TRV')).toBeTruthy();
    });
  });

  // ── Key objects table ───────────────────────────────────────────────────────

  describe('key objects table', () => {
    it('renders key objects table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-key-objects-table')).toBeTruthy();
    });

    it('renders key object type', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Boiler')).toBeTruthy();
    });

    it('renders key object make and model', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Worcester Bosch 30i')).toBeTruthy();
    });

    it('renders key object install year', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('2009')).toBeTruthy();
    });

    it('renders key object condition', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('End of life')).toBeTruthy();
    });
  });

  // ── Access notes ────────────────────────────────────────────────────────────

  describe('access notes table', () => {
    it('renders access notes table', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-access-notes-table')).toBeTruthy();
    });

    it('renders access note location', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Boiler cupboard')).toBeTruthy();
    });

    it('renders access note text', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Narrow — 600 mm clearance.')).toBeTruthy();
    });
  });

  // ── Notes blocks ────────────────────────────────────────────────────────────

  describe('notes block sections', () => {
    it('renders room plan notes', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Two-storey semi-detached.')).toBeTruthy();
    });

    it('renders spec notes', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('22 mm primary pipework.')).toBeTruthy();
    });

    it('renders field notes summary', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Clean install, no obstructions.')).toBeTruthy();
    });
  });

  // ── Rooms list ──────────────────────────────────────────────────────────────

  describe('rooms list', () => {
    it('renders room names', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getAllByText('Living Room').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Kitchen').length).toBeGreaterThanOrEqual(1);
    });

    it('renders room area when provided', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('22 m²')).toBeTruthy();
    });

    it('renders room notes when provided', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Double radiator.')).toBeTruthy();
    });
  });

  // ── Empty states per section ────────────────────────────────────────────────

  describe('empty state messages when pack is sparse', () => {
    it('shows "No rooms recorded." when rooms is empty', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No rooms recorded.')).toBeTruthy();
    });

    it('shows "No key objects recorded." when keyObjects is empty', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No key objects recorded.')).toBeTruthy();
    });

    it('shows "No proposed emitters recorded." when proposedEmitters is empty', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No proposed emitters recorded.')).toBeTruthy();
    });

    it('shows "No access notes recorded." when accessNotes is empty', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No access notes recorded.')).toBeTruthy();
    });

    it('shows "No room plan notes recorded." when roomPlanNotes is absent', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No room plan notes recorded.')).toBeTruthy();
    });

    it('shows "No spec notes recorded." when specNotes is absent', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No spec notes recorded.')).toBeTruthy();
    });

    it('shows "No field notes available." when fieldNotesSummary is absent', () => {
      render(<EngineerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No field notes available.')).toBeTruthy();
    });
  });

  // ── Print and Share action buttons ──────────────────────────────────────────

  describe('action buttons', () => {
    it('renders the Print handoff button when a pack is loaded', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-print-button')).toBeTruthy();
    });

    it('renders the Share handoff button when a pack is loaded', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-share-button')).toBeTruthy();
    });

    it('does not render Print or Share buttons when no pack is available', () => {
      render(<EngineerSummaryPrintPage initialPack={null} />);
      expect(screen.queryByTestId('esp-print-button')).toBeNull();
      expect(screen.queryByTestId('esp-share-button')).toBeNull();
    });
  });

  // ── Back button ─────────────────────────────────────────────────────────────

  describe('back button', () => {
    it('renders back button when onBack is provided', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} onBack={() => {}} />);
      expect(screen.getByText('← Back')).toBeTruthy();
    });

    it('does not render back button when onBack is absent', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('← Back')).toBeNull();
    });
  });

  // ── Error / missing-pack state ──────────────────────────────────────────────

  describe('missing or invalid pack', () => {
    it('shows missing-pack message when initialPack is null', () => {
      render(<EngineerSummaryPrintPage initialPack={null} />);
      expect(screen.getByTestId('esp-missing-pack')).toBeTruthy();
      expect(screen.getByText('No handoff available')).toBeTruthy();
    });

    it('shows missing-pack message when no initialPack is provided', () => {
      render(<EngineerSummaryPrintPage />);
      expect(screen.getByTestId('esp-missing-pack')).toBeTruthy();
    });

    it('does not show Visit complete banner on missing-pack state', () => {
      render(<EngineerSummaryPrintPage initialPack={null} />);
      expect(screen.queryByText('Visit complete')).toBeNull();
    });
  });

  // ── Customer-only sections must be absent ───────────────────────────────────

  describe('no customer-only framing leaks into engineer page', () => {
    it('does not render "What we found" customer section heading', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('What we found')).toBeNull();
    });

    it('does not render "What\'s planned" customer section heading', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText("What's planned")).toBeNull();
    });

    it('does not render "What happens next" customer section heading', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('What happens next')).toBeNull();
    });

    it('does not render "Survey complete" customer banner text', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('Survey complete')).toBeNull();
    });

    it('does not render customer next steps copy', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/engineer will be in touch/i)).toBeNull();
    });

    it('does not render raw JSON debug controls', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/Show raw JSON/)).toBeNull();
    });
  });

  // ── Print container structure ───────────────────────────────────────────────

  describe('print container structure', () => {
    it('renders the esp-page container', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-page')).toBeTruthy();
    });

    it('renders the esp-toolbar container', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-toolbar')).toBeTruthy();
    });

    it('renders the esp-wrap outer element with correct class', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      const toolbar = screen.getByTestId('esp-toolbar');
      const wrap = toolbar.parentElement;
      expect(wrap?.className).toContain('esp-wrap');
    });

    it('renders the "Generated from Atlas handoff pack" footer', () => {
      render(<EngineerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('esp-footer')).toBeTruthy();
      expect(screen.getByText('Generated from Atlas handoff pack')).toBeTruthy();
    });
  });
});
