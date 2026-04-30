/**
 * VisitHandoffReviewPage.test.tsx
 *
 * PR11 — Component tests for the shared handoff review shell.
 *
 * Tests:
 *   - Tab switching between customer and engineer views
 *   - Error state for invalid packs
 *   - Empty / missing pack state
 *   - Read-only notice is visible
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VisitHandoffReviewPage from '../components/VisitHandoffReviewPage';
import { SAMPLE_VISIT_HANDOFF_PACK } from '../fixtures/sampleVisitHandoffPack';

describe('VisitHandoffReviewPage', () => {

  describe('tab switching', () => {
    it('shows customer view by default', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      expect(screen.getByText('Survey complete')).toBeTruthy();
    });

    it('switches to engineer view when engineer tab is clicked', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      const engineerTab = screen.getByText('Engineer view');
      fireEvent.click(engineerTab);
      expect(screen.getByText('Rooms')).toBeTruthy();
    });

    it('switches back to customer view', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      const engineerTab = screen.getByText('Engineer view');
      fireEvent.click(engineerTab);
      const customerTab = screen.getByText('Customer view');
      fireEvent.click(customerTab);
      expect(screen.getByText('Survey complete')).toBeTruthy();
    });
  });

  describe('header', () => {
    it('shows address in the header', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      expect(screen.getByText('14 Acacia Road, London, SW1A 1AA')).toBeTruthy();
    });

    it('shows the read-only notice', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      expect(screen.getByText('Read only')).toBeTruthy();
    });

    it('renders back button when onBack is provided', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} onBack={() => {}} />);
      expect(screen.getByText('← Back')).toBeTruthy();
    });

    it('does not render back button when onBack is absent', () => {
      render(<VisitHandoffReviewPage initialPack={SAMPLE_VISIT_HANDOFF_PACK} />);
      expect(screen.queryByText('← Back')).toBeNull();
    });
  });

  describe('no pack / error states', () => {
    it('shows a meaningful empty state when no initialPack is provided', () => {
      render(<VisitHandoffReviewPage />);
      expect(screen.getByTestId('handoff-no-result-state')).toBeTruthy();
    });

    it('shows a meaningful empty state when initialPack is null', () => {
      render(<VisitHandoffReviewPage initialPack={null} />);
      expect(screen.getByTestId('handoff-no-result-state')).toBeTruthy();
    });

    it('shows "Visit Review" title when no pack is loaded', () => {
      render(<VisitHandoffReviewPage />);
      expect(screen.getByText('Visit Review')).toBeTruthy();
    });
  });
});
