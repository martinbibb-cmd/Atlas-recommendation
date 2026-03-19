/**
 * ReportQrFooter.test.tsx
 *
 * Tests for the QR code footer component in the report.
 *
 * Coverage:
 *   - Renders the QR code image after generation
 *   - Renders the caption text
 *   - Renders the sub-caption text
 *   - Has the correct data-testid
 *   - Shows fallback reference text when QR generation fails
 *   - Renders nothing until portal URL is resolved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ReportQrFooter from '../ReportQrFooter';

// ─── Mock qrcode ──────────────────────────────────────────────────────────────

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,FAKEQR'),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportQrFooter — rendering', () => {
  it('renders the QR footer container', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="report-qr-footer"]')).not.toBeNull();
    });
  });

  it('renders the QR code image', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      const img = document.querySelector('.rv-qr-footer__img') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.src).toContain('data:image/png');
    });
  });

  it('renders the caption text', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      expect(
        screen.getByText('Scan to open your interactive home heating plan'),
      ).toBeTruthy();
    });
  });

  it('renders the sub-caption text', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      expect(
        screen.getByText(
          'Explore your options and see why this system was recommended',
        ),
      ).toBeTruthy();
    });
  });

  it('has accessible label', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      expect(
        screen.getByLabelText(/open your interactive home heating plan/i),
      ).toBeTruthy();
    });
  });

  it('renders the fallback reference ID text', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      expect(screen.getByText('test-ref-123')).toBeTruthy();
    });
  });
});

describe('ReportQrFooter — QR generation failure', () => {
  it('still renders footer with fallback reference when QR generation fails', async () => {
    const qrcode = await import('qrcode');
    vi.mocked(qrcode.default.toDataURL).mockRejectedValueOnce(
      new Error('QR generation failed'),
    );
    render(<ReportQrFooter reportReference="fail-ref" />);
    // Footer should appear with the fallback reference text even without a QR image.
    await waitFor(() => {
      expect(document.querySelector('[data-testid="report-qr-footer"]')).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText('fail-ref')).toBeTruthy();
    });
    // No QR image should be present.
    expect(document.querySelector('.rv-qr-footer__img')).toBeNull();
  });
});
