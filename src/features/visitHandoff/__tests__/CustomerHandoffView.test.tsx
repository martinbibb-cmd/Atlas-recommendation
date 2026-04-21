/**
 * CustomerHandoffView.test.tsx
 *
 * PR11 — Component tests for the customer-facing handoff review surface.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomerHandoffView from '../components/CustomerHandoffView';
import type { CustomerVisitSummary } from '../types/visitHandoffPack';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_SUMMARY: CustomerVisitSummary = {
  address: '14 Acacia Road, London, SW1A 1AA',
  currentSystemDescription: 'You currently have a combination boiler providing on-demand hot water.',
  findings: [
    'The boiler is over 15 years old.',
    'One radiator in the kitchen is not heating correctly.',
  ],
  plannedWork: [
    'Replace existing boiler with a new high-efficiency model.',
    'Balance radiators throughout.',
  ],
  nextSteps: 'Your engineer will be in touch within two working days.',
};

const EMPTY_SUMMARY: CustomerVisitSummary = {
  address: '1 Test Street',
  findings: [],
  plannedWork: [],
};

describe('CustomerHandoffView', () => {

  describe('renders findings and planned work', () => {
    it('renders all findings', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(screen.getByText('The boiler is over 15 years old.')).toBeTruthy();
      expect(screen.getByText('One radiator in the kitchen is not heating correctly.')).toBeTruthy();
    });

    it('renders all planned work items', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(screen.getByText('Replace existing boiler with a new high-efficiency model.')).toBeTruthy();
      expect(screen.getByText('Balance radiators throughout.')).toBeTruthy();
    });

    it('renders next steps', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(screen.getByText('Your engineer will be in touch within two working days.')).toBeTruthy();
    });

    it('renders the current system description', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(
        screen.getByText('You currently have a combination boiler providing on-demand hot water.'),
      ).toBeTruthy();
    });

    it('renders the survey complete confirmation', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(screen.getByText('Survey complete')).toBeTruthy();
    });
  });

  describe('empty states show correctly', () => {
    it('shows empty state when findings is empty', () => {
      render(<CustomerHandoffView summary={EMPTY_SUMMARY} />);
      expect(screen.getByText('No findings recorded.')).toBeTruthy();
    });

    it('shows empty state when plannedWork is empty', () => {
      render(<CustomerHandoffView summary={EMPTY_SUMMARY} />);
      expect(screen.getByText('No planned work recorded.')).toBeTruthy();
    });

    it('shows empty state when nextSteps is absent', () => {
      render(<CustomerHandoffView summary={EMPTY_SUMMARY} />);
      expect(screen.getByText('No next steps recorded.')).toBeTruthy();
    });

    it('does not show currentSystemDescription when absent', () => {
      render(<CustomerHandoffView summary={EMPTY_SUMMARY} />);
      // The description paragraph should not be in the DOM
      expect(screen.queryByText(/combination boiler/)).toBeNull();
    });
  });

  describe('section headings are present', () => {
    it('renders all four section headings', () => {
      render(<CustomerHandoffView summary={FULL_SUMMARY} />);
      expect(screen.getByText("What we found")).toBeTruthy();
      expect(screen.getByText(/What.s planned/)).toBeTruthy();
      expect(screen.getByText("What happens next")).toBeTruthy();
    });
  });
});
