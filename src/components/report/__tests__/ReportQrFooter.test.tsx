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
 *   - Shows a fallback portal link when QR generation fails
 *   - Always renders the handover block when a report reference is present
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

  it('renders the fallback portal link (containing the reference ID)', async () => {
    render(<ReportQrFooter reportReference="test-ref-123" />);
    await waitFor(() => {
      // The fallback section now renders a link containing the portal URL; the
      // reference ID is part of the href rather than plain text.
      const link = document.querySelector('.rv-qr-footer__fallback a') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.href).toContain('test-ref-123');
    });
  });
});

describe('ReportQrFooter — QR generation failure', () => {
  it('still renders footer with fallback portal link when QR generation fails', async () => {
    const qrcode = await import('qrcode');
    vi.mocked(qrcode.default.toDataURL).mockRejectedValueOnce(
      new Error('QR generation failed'),
    );
    render(<ReportQrFooter reportReference="fail-ref" />);
    // Footer should appear with a portal link even without a QR image.
    await waitFor(() => {
      expect(document.querySelector('[data-testid="report-qr-footer"]')).not.toBeNull();
    });
    await waitFor(() => {
      const link = document.querySelector('.rv-qr-footer__fallback a') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.href).toContain('fail-ref');
    });
    // No QR image should be present.
    expect(document.querySelector('.rv-qr-footer__img')).toBeNull();
  });
});

describe('ReportQrFooter — Fix 1 regression: handover block always visible', () => {
  it('renders the handover block immediately (before async token completes) when reportReference is present', () => {
    // Synchronous assertion — component must render the block on first paint,
    // not after an async effect resolves.  This guards against the original bug
    // where !portalUrl caused the entire block to be suppressed.
    render(<ReportQrFooter reportReference="immediate-ref" />);
    expect(document.querySelector('[data-testid="report-qr-footer"]')).not.toBeNull();
  });

  it('the fallback link href includes the report reference in the portal path', async () => {
    render(<ReportQrFooter reportReference="my-report-id" />);
    await waitFor(() => {
      const link = document.querySelector('.rv-qr-footer__fallback a') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.href).toContain('/portal/my-report-id');
    });
  });
});
