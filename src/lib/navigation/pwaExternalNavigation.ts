export interface ExternalSharePayload {
  title?: string;
  text?: string;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const iosStandalone = Boolean((window.navigator as NavigatorWithStandalone).standalone);
  return standaloneMedia || iosStandalone;
}

export function resolveSafeExternalUrl(url: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === 'https:' || (import.meta.env.DEV && parsed.protocol === 'http:')) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function openUrlInSystemBrowser(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const safeUrl = resolveSafeExternalUrl(url);
  if (!safeUrl) return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}

export async function shareUrlWithDevice(url: string, payload: ExternalSharePayload = {}): Promise<boolean> {
  const safeUrl = resolveSafeExternalUrl(url);
  if (!safeUrl || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: safeUrl,
    });
    return true;
  } catch {
    return false;
  }
}

export async function handleStandaloneExternalLinkClick(
  event: { preventDefault: () => void; stopPropagation?: () => void },
  options: {
    url: string;
    preferShare?: boolean;
    title?: string;
    text?: string;
  },
): Promise<boolean> {
  if (!isStandalonePwa()) return false;
  event.preventDefault();
  event.stopPropagation?.();
  if (options.preferShare) {
    const shared = await shareUrlWithDevice(options.url, {
      title: options.title,
      text: options.text,
    });
    if (shared) return true;
  }
  return openUrlInSystemBrowser(options.url);
}
