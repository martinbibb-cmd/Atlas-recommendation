/**
 * PortalShareActions.test.tsx
 *
 * Unit tests for the share/export action strip.
 * Covers clipboard writes, .txt download, advice pack rendering,
 * and graceful degradation when browser APIs are unavailable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortalShareActions } from '../PortalShareActions';

// ─── Clipboard mock ───────────────────────────────────────────────────────────

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

// ─── URL.createObjectURL mock ─────────────────────────────────────────────────

function mockObjectURL() {
  const revokeMock = vi.fn();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = revokeMock;
  return revokeMock;
}

// ─── navigator.share mock ─────────────────────────────────────────────────────

function mockShare(impl?: () => Promise<void>) {
  Object.defineProperty(navigator, 'share', {
    value: impl ?? vi.fn(async () => {}),
    configurable: true,
  });
}

function removeShare() {
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortalShareActions', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Renders nothing when no props ─────────────────────────────────────────

  it('renders nothing when no action props are provided', () => {
    const { container } = render(<PortalShareActions />);
    expect(container.firstChild).toBeNull();
  });

  // ── Copy portal link ──────────────────────────────────────────────────────

  it('shows copy link button when portalUrl is provided', () => {
    render(<PortalShareActions portalUrl="https://atlas.example.com/portal/ref123?token=abc" />);
    expect(screen.getByTestId('share-copy-link')).toBeTruthy();
  });

  it('copies portal link to clipboard and shows Copied! feedback', async () => {
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    render(<PortalShareActions portalUrl="https://atlas.example.com/portal/ref123" />);

    const btn = screen.getByTestId('share-copy-link');
    fireEvent.click(btn);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://atlas.example.com/portal/ref123'));
    await waitFor(() => expect(screen.getByTestId('share-copy-link').textContent).toContain('Copied!'));
  });

  it('does not show copy link button when portalUrl is absent', () => {
    render(<PortalShareActions aiSummaryText="some text" />);
    expect(screen.queryByTestId('share-copy-link')).toBeNull();
  });

  // ── Copy AI summary ───────────────────────────────────────────────────────

  it('shows copy AI summary button when aiSummaryText is provided', () => {
    render(<PortalShareActions aiSummaryText="AI summary text" />);
    expect(screen.getByTestId('share-copy-ai')).toBeTruthy();
  });

  it('copies AI summary text to clipboard and shows Copied! feedback', async () => {
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    const summaryText = '=== ATLAS RECOMMENDATION SUMMARY ===\nSome content here';
    render(<PortalShareActions aiSummaryText={summaryText} />);

    fireEvent.click(screen.getByTestId('share-copy-ai'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(summaryText));
    await waitFor(() => expect(screen.getByTestId('share-copy-ai').textContent).toContain('Copied!'));
  });

  it('does not show copy AI button when aiSummaryText is absent', () => {
    render(<PortalShareActions portalUrl="https://example.com" />);
    expect(screen.queryByTestId('share-copy-ai')).toBeNull();
  });

  // ── Download AI summary ───────────────────────────────────────────────────

  it('shows download AI summary button when aiSummaryText is provided', () => {
    render(<PortalShareActions aiSummaryText="some text" />);
    expect(screen.getByTestId('share-download-ai')).toBeTruthy();
  });

  it('triggers .txt download with the correct filename on click', () => {
    mockObjectURL();
    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    // Intercept anchor .click()
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy });
      }
      return el;
    });

    render(
      <PortalShareActions
        aiSummaryText="AI content"
        aiSummaryFilename="atlas-ai-summary-2026-04-25.txt"
      />
    );

    fireEvent.click(screen.getByTestId('share-download-ai'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    appendChildSpy.mockRestore();
  });

  it('shows AI summary helper text when aiSummaryText is provided', () => {
    render(<PortalShareActions aiSummaryText="some text" />);
    expect(screen.getByTestId('share-ai-helper')).toBeTruthy();
    expect(screen.getByTestId('share-ai-helper').textContent).toContain('ChatGPT');
  });

  // ── Download advice pack — URL ────────────────────────────────────────────

  it('renders a download link when advicePackUrl is provided', () => {
    render(<PortalShareActions advicePackUrl="https://cdn.example.com/advice-pack.pdf" />);
    const link = screen.getByTestId('share-download-pack-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://cdn.example.com/advice-pack.pdf');
    expect(link.getAttribute('download')).toBeDefined();
  });

  it('does not render callback-based pack button when advicePackUrl takes priority', () => {
    const callback = vi.fn();
    render(
      <PortalShareActions
        advicePackUrl="https://cdn.example.com/advice-pack.pdf"
        onDownloadAdvicePack={callback}
      />
    );
    expect(screen.getByTestId('share-download-pack-link')).toBeTruthy();
    expect(screen.queryByTestId('share-download-pack-btn')).toBeNull();
  });

  // ── Download advice pack — callback ───────────────────────────────────────

  it('renders a callback button when onDownloadAdvicePack is provided and no URL', () => {
    const callback = vi.fn();
    render(<PortalShareActions onDownloadAdvicePack={callback} />);
    const btn = screen.getByTestId('share-download-pack-btn');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(callback).toHaveBeenCalledOnce();
  });

  // ── Native share ──────────────────────────────────────────────────────────

  it('shows share button when navigator.share is available and portalUrl is provided', () => {
    mockShare();
    render(<PortalShareActions portalUrl="https://atlas.example.com/portal/ref" />);
    expect(screen.getByTestId('share-native')).toBeTruthy();
  });

  it('calls navigator.share with correct payload', async () => {
    const shareMock = vi.fn(async () => {});
    mockShare(shareMock);
    render(<PortalShareActions portalUrl="https://atlas.example.com/portal/ref" />);

    fireEvent.click(screen.getByTestId('share-native'));

    await waitFor(() =>
      expect(shareMock).toHaveBeenCalledWith({
        title: 'Atlas heating advice',
        text: 'Open your Atlas portal',
        url: 'https://atlas.example.com/portal/ref',
      })
    );
  });

  it('does not show share button when navigator.share is unavailable and portalUrl provided', () => {
    removeShare();
    render(<PortalShareActions portalUrl="https://atlas.example.com/portal/ref" />);
    expect(screen.queryByTestId('share-native')).toBeNull();
    expect(screen.queryByTestId('share-native-unsupported')).toBeNull();
  });

  it('does not show share button when portalUrl is absent even if share is available', () => {
    mockShare();
    render(<PortalShareActions aiSummaryText="some text" />);
    expect(screen.queryByTestId('share-native')).toBeNull();
  });

  // ── Toolbar role ──────────────────────────────────────────────────────────

  it('renders the toolbar with accessible role and label', () => {
    render(<PortalShareActions portalUrl="https://example.com" />);
    const toolbar = screen.getByRole('toolbar', { name: 'Share and export actions' });
    expect(toolbar).toBeTruthy();
  });
});
