/**
 * nativeBridge.ts
 *
 * Thin abstraction layer that detects the runtime environment and routes
 * incoming scan payloads to the correct source:
 *
 *   Native (iOS Capacitor shell)
 *     Atlas-scans-ios calls the app via a deep-link URL of the form
 *     atlasapp://receive-scan?payload=<base64-json>
 *     The App plugin fires an `appUrlOpen` event which this module listens to
 *     and decodes into a ScanFileEntry that callers consume identically to the
 *     browser share-target path.
 *
 *   Browser / PWA
 *     The service worker already handles Web Share Target POST and stores
 *     files in IndexedDB.  Callers use the existing scanFileCache helpers.
 *
 * Usage:
 *   import { isNative, listenForIncomingScan } from './nativeBridge';
 *
 *   if (isNative()) {
 *     listenForIncomingScan((entry) => { … });
 *   } else {
 *     const entry = await getLatestScanFile();
 *   }
 */

import type { ScanFileEntry } from './storage/scanFileCache';

// ─── Runtime detection ────────────────────────────────────────────────────────

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (i.e. an iOS or Android WebView).  Always false in a regular browser.
 */
export function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    // Capacitor injects a global `Capacitor` object on native platforms.
    'Capacitor' in window &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

// ─── Deep-link → ScanFileEntry decoder ───────────────────────────────────────

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  // Replace URL-safe chars, then pad.
  const std = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '=='.slice(0, (4 - (std.length % 4)) % 4);
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}

function deepLinkUrlToEntry(url: string): ScanFileEntry | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Must be an atlasapp:// deep-link targeting the receive-scan host/path.
  if (parsed.protocol !== 'atlasapp:' || parsed.hostname !== 'receive-scan') {
    return null;
  }

  const params = parsed.searchParams;
  const now = Date.now();

  // ── Preferred: base64 scan bundle JSON ──
  const payload = params.get('payload');
  if (payload) {
    try {
      const data = base64ToArrayBuffer(payload);
      const name = params.get('name') ?? 'scan_bundle.json';
      return { name, mimeType: 'application/json', data, receivedAt: now };
    } catch {
      return null;
    }
  }

  // ── Alternative: raw file bytes ──
  const file = params.get('file');
  const name = params.get('name') ?? 'scan.bin';
  const mime = params.get('mime') ?? 'application/octet-stream';
  if (file) {
    try {
      const data = base64ToArrayBuffer(file);
      return { name, mimeType: mime, data, receivedAt: now };
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Listener ─────────────────────────────────────────────────────────────────

type ScanEntryCallback = (entry: ScanFileEntry) => void;

let _appPluginImport: Promise<typeof import('@capacitor/app')> | null = null;

function getAppPlugin() {
  if (!_appPluginImport) {
    _appPluginImport = import('@capacitor/app');
  }
  return _appPluginImport;
}

/**
 * Register a one-time listener for an incoming scan payload delivered via
 * a deep-link from Atlas-scans-ios.
 *
 * Should only be called when `isNative()` returns true.  Safely no-ops in
 * a browser environment.
 *
 * Returns an async cleanup function that removes the listener.
 */
export async function listenForIncomingScan(
  onEntry: ScanEntryCallback,
): Promise<() => void> {
  if (!isNative()) return () => { /* noop in browser */ };

  const { App } = await getAppPlugin();

  const handle = await App.addListener('appUrlOpen', (event: { url: string }) => {
    const entry = deepLinkUrlToEntry(event.url);
    if (entry) {
      onEntry(entry);
    }
  });

  return () => {
    void handle.remove();
  };
}

/**
 * Read the URL that opened the app on cold-start (i.e. when the user tapped
 * a deep-link before the app was running).
 *
 * Returns null if no launch URL is present or if running in a browser.
 */
export async function getLaunchScanEntry(): Promise<ScanFileEntry | null> {
  if (!isNative()) return null;

  try {
    const { App } = await getAppPlugin();
    const result = await App.getLaunchUrl();
    if (!result?.url) return null;
    return deepLinkUrlToEntry(result.url);
  } catch {
    return null;
  }
}
