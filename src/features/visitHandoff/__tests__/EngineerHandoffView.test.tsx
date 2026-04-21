/**
 * EngineerHandoffView.test.tsx
 *
 * PR11 — Component tests for the engineer-facing handoff review surface.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EngineerHandoffView from '../components/EngineerHandoffView';
import type { EngineerVisitSummary } from '../types/visitHandoffPack';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_SUMMARY: EngineerVisitSummary = {
  rooms: [
    { id: 'r1', name: 'Living Room', areaM2: 22, notes: 'Double radiator.' },
    { id: 'r2', name: 'Kitchen', areaM2: 15 },
  ],
  keyObjects: [
    {
      type: 'Boiler',
      make: 'Worcester Bosch 30i',
      installYear: 2008,
      condition: 'End of life',
      notes: 'Replacement required.',
    },
  ],
  proposedEmitters: [
    { roomId: 'r1', roomName: 'Living Room', emitterType: 'Radiator', outputWatts: 1800 },
    { roomId: 'r2', roomName: 'Kitchen', emitterType: 'Radiator', outputWatts: 900, notes: 'New TRV' },
  ],
  accessNotes: [
    { location: 'Boiler cupboard', note: 'Narrow — 600 mm clearance.' },
  ],
  roomPlanNotes: 'Two-storey semi-detached.',
  specNotes: '22 mm primary pipework.',
  fieldNotesSummary: 'Clean install, no obstructions.',
};

const EMPTY_SUMMARY: EngineerVisitSummary = {
  rooms: [],
  keyObjects: [],
  proposedEmitters: [],
  accessNotes: [],
};

describe('EngineerHandoffView', () => {

  describe('renders technical sections', () => {
    it('renders room names', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getAllByText('Living Room').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Kitchen').length).toBeGreaterThanOrEqual(1);
    });

    it('renders room area when provided', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('22 m²')).toBeTruthy();
    });

    it('renders key object type and make', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('Boiler')).toBeTruthy();
      expect(screen.getByText('Worcester Bosch 30i')).toBeTruthy();
    });

    it('renders proposed emitters table rows', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getAllByText('Radiator').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('1800 W')).toBeTruthy();
      expect(screen.getByText('New TRV')).toBeTruthy();
    });

    it('renders access note location and note text', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('Boiler cupboard')).toBeTruthy();
      expect(screen.getByText('Narrow — 600 mm clearance.')).toBeTruthy();
    });

    it('renders room plan notes', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('Two-storey semi-detached.')).toBeTruthy();
    });

    it('renders spec notes', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('22 mm primary pipework.')).toBeTruthy();
    });

    it('renders field notes summary', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('Clean install, no obstructions.')).toBeTruthy();
    });

    it('renders engineer name when provided', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
          engineerName="A. Technician"
        />,
      );
      expect(screen.getByText('A. Technician')).toBeTruthy();
    });
  });

  describe('empty states show correctly', () => {
    it('shows empty state for rooms', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No rooms recorded.')).toBeTruthy();
    });

    it('shows empty state for key objects', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No key objects recorded.')).toBeTruthy();
    });

    it('shows empty state for proposed emitters', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No proposed emitters recorded.')).toBeTruthy();
    });

    it('shows empty state for access notes', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No access notes recorded.')).toBeTruthy();
    });

    it('shows empty state for room plan notes', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No room plan notes recorded.')).toBeTruthy();
    });

    it('shows empty state for spec notes', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No spec notes recorded.')).toBeTruthy();
    });

    it('shows empty state for field notes', () => {
      render(
        <EngineerHandoffView
          summary={EMPTY_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('No field notes available.')).toBeTruthy();
    });
  });

  describe('section headings', () => {
    it('renders all engineer section headings', () => {
      render(
        <EngineerHandoffView
          summary={FULL_SUMMARY}
          completedAt="2025-10-14T14:32:00Z"
        />,
      );
      expect(screen.getByText('Rooms')).toBeTruthy();
      expect(screen.getByText('Key objects')).toBeTruthy();
      expect(screen.getByText('Proposed emitters')).toBeTruthy();
      expect(screen.getByText('Access notes')).toBeTruthy();
      expect(screen.getByText('Room plan notes')).toBeTruthy();
      expect(screen.getByText('Spec notes')).toBeTruthy();
      expect(screen.getByText('Field notes')).toBeTruthy();
      expect(screen.getByText('Completed at')).toBeTruthy();
    });
  });
});
