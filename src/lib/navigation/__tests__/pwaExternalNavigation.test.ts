import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleStandaloneExternalLinkClick,
  isStandalonePwa,
  openUrlInSystemBrowser,
  resolveSafeExternalUrl,
} from '../pwaExternalNavigation';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('pwaExternalNavigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
  });

  it('detects standalone mode from display-mode media query', () => {
    mockMatchMedia(true);
    expect(isStandalonePwa()).toBe(true);
  });

  it('blocks unsafe javascript URLs', () => {
    expect(resolveSafeExternalUrl('javascript:alert(1)')).toBeNull();
  });

  it('opens safe URLs in a separate browser window', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openUrlInSystemBrowser('https://atlas.example.com/portal/ref')).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      'https://atlas.example.com/portal/ref',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('intercepts standalone document links and opens them externally', async () => {
    mockMatchMedia(true);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const handled = await handleStandaloneExternalLinkClick(
      { preventDefault, stopPropagation },
      { url: 'https://atlas.example.com/report/abc.pdf' },
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('uses native share in standalone mode when requested', async () => {
    mockMatchMedia(true);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const shareMock = vi.fn(async () => {});
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });

    const handled = await handleStandaloneExternalLinkClick(
      { preventDefault, stopPropagation },
      {
        url: 'https://atlas.example.com/portal/ref',
        preferShare: true,
        title: 'Atlas heating advice',
        text: 'Open your Atlas portal',
      },
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Atlas heating advice',
      text: 'Open your Atlas portal',
      url: 'https://atlas.example.com/portal/ref',
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('leaves browser-tab navigation untouched outside standalone mode', async () => {
    const preventDefault = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const handled = await handleStandaloneExternalLinkClick(
      { preventDefault },
      { url: 'https://atlas.example.com/portal/ref' },
    );

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
