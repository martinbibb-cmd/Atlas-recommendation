import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceReviewControls } from '../EvidenceReviewControls';

describe('EvidenceReviewControls', () => {
  it('renders confirm, needs-review, and reject buttons', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-001"
        kind="object_pin"
        onDecide={onDecide}
      />,
    );

    expect(screen.getByTestId('evidence-review-confirm-pin-001')).toBeTruthy();
    expect(screen.getByTestId('evidence-review-needs-review-pin-001')).toBeTruthy();
    expect(screen.getByTestId('evidence-review-reject-pin-001')).toBeTruthy();
  });

  it('does not show a clear button when no currentStatus is provided', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-001"
        kind="object_pin"
        onDecide={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('evidence-review-clear-pin-001')).toBeNull();
  });

  it('shows a clear button when currentStatus is set and onClear is provided', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-001"
        kind="object_pin"
        currentStatus="confirmed"
        onDecide={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId('evidence-review-clear-pin-001')).toBeTruthy();
  });

  it('opens the note area when confirm button is clicked', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-001"
        kind="object_pin"
        onDecide={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-confirm-pin-001'));
    expect(screen.getByTestId('evidence-review-note-area-pin-001')).toBeTruthy();
    expect(screen.getByTestId('evidence-review-note-input-pin-001')).toBeTruthy();
  });

  it('calls onDecide with confirmed status and note when Save is clicked', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-002"
        kind="object_pin"
        onDecide={onDecide}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-confirm-pin-002'));
    const noteInput = screen.getByTestId('evidence-review-note-input-pin-002');
    fireEvent.change(noteInput, { target: { value: 'Visually confirmed' } });
    fireEvent.click(screen.getByTestId('evidence-review-save-pin-002'));

    expect(onDecide).toHaveBeenCalledOnce();
    expect(onDecide).toHaveBeenCalledWith('pin-002', 'object_pin', 'confirmed', 'Visually confirmed');
  });

  it('calls onDecide with rejected status', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-003"
        kind="object_pin"
        onDecide={onDecide}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-reject-pin-003'));
    fireEvent.click(screen.getByTestId('evidence-review-save-pin-003'));

    expect(onDecide).toHaveBeenCalledWith('pin-003', 'object_pin', 'rejected', '');
  });

  it('calls onDecide with needs_review status', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-004"
        kind="object_pin"
        onDecide={onDecide}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-needs-review-pin-004'));
    fireEvent.click(screen.getByTestId('evidence-review-save-pin-004'));

    expect(onDecide).toHaveBeenCalledWith('pin-004', 'object_pin', 'needs_review', '');
  });

  it('cancels the note area when Cancel is clicked', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-005"
        kind="object_pin"
        onDecide={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-confirm-pin-005'));
    expect(screen.getByTestId('evidence-review-note-area-pin-005')).toBeTruthy();

    fireEvent.click(screen.getByTestId('evidence-review-cancel-pin-005'));
    expect(screen.queryByTestId('evidence-review-note-area-pin-005')).toBeNull();
  });

  it('shows the existing note when currentNote is provided', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-006"
        kind="object_pin"
        currentStatus="confirmed"
        currentNote="Worcester Bosch 30i confirmed"
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByTestId('evidence-review-saved-note-pin-006')).toBeTruthy();
    expect(screen.getByText(/Worcester Bosch 30i confirmed/)).toBeTruthy();
  });

  it('shows the ReviewStatusBadge when currentStatus is confirmed', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-007"
        kind="object_pin"
        currentStatus="confirmed"
        onDecide={vi.fn()}
      />,
    );
    expect(screen.getByTestId('review-status-badge-confirmed')).toBeTruthy();
  });

  it('shows the ReviewStatusBadge when currentStatus is rejected', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-008"
        kind="object_pin"
        currentStatus="rejected"
        onDecide={vi.fn()}
      />,
    );
    expect(screen.getByTestId('review-status-badge-rejected')).toBeTruthy();
  });

  it('shows the ReviewStatusBadge when currentStatus is needs_review', () => {
    render(
      <EvidenceReviewControls
        itemId="pin-009"
        kind="object_pin"
        currentStatus="needs_review"
        onDecide={vi.fn()}
      />,
    );
    expect(screen.getByTestId('review-status-badge-needs_review')).toBeTruthy();
  });

  it('works with photo kind', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="photo-001"
        kind="photo"
        onDecide={onDecide}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-confirm-photo-001'));
    fireEvent.click(screen.getByTestId('evidence-review-save-photo-001'));

    expect(onDecide).toHaveBeenCalledWith('photo-001', 'photo', 'confirmed', '');
  });

  it('calls onClear when clear button is pressed', () => {
    const onClear = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-010"
        kind="object_pin"
        currentStatus="needs_review"
        onDecide={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByTestId('evidence-review-clear-pin-010'));
    expect(onClear).toHaveBeenCalledWith('pin-010');
  });

  it('saves immediately on second click of same action button (no Save needed)', () => {
    const onDecide = vi.fn();
    render(
      <EvidenceReviewControls
        itemId="pin-011"
        kind="object_pin"
        onDecide={onDecide}
      />,
    );

    // First click opens the note area
    fireEvent.click(screen.getByTestId('evidence-review-confirm-pin-011'));
    // Second click on same button saves immediately
    fireEvent.click(screen.getByTestId('evidence-review-confirm-pin-011'));

    expect(onDecide).toHaveBeenCalledOnce();
    expect(onDecide).toHaveBeenCalledWith('pin-011', 'object_pin', 'confirmed', '');
  });
});
