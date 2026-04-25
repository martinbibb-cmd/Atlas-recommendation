/**
 * ResetSessionButton.tsx
 *
 * In-app PWA cache reset control.
 *
 * Gives installed PWA users a reliable way to clear Atlas local session state
 * without editing the URL (which is unavailable in installed PWA mode).
 *
 * Rules:
 *   - Calls clearAtlasCache() — never localStorage.clear()
 *   - Unregisters all service worker caches if a service worker is registered
 *   - Shows a confirm dialog before performing any destructive action
 *   - Reloads the app after clearing so the clean state is immediately active
 *   - ?cacheBust=1 is preserved as a developer fallback (see App.tsx)
 */

import { useState } from 'react';
import { clearAtlasCache } from '../lib/storage/atlasCacheKeys';

// ─── Cache unregistration ─────────────────────────────────────────────────────

/**
 * Unregisters all service worker caches owned by this origin.
 *
 * Best-effort: any failure is swallowed — if caches cannot be cleared
 * the app still reloads cleanly from network.
 */
async function unregisterServiceWorkerCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch {
    // Best-effort — do not block the reset if cache API is unavailable
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Additional CSS classes applied to the trigger button. */
  className?: string;
}

/**
 * ResetSessionButton
 *
 * Renders a button labelled "Reset saved session".
 * On click, shows a confirm dialog warning the user that local Atlas data
 * will be cleared. On confirmation, clears the Atlas-owned cache, unregisters
 * service worker caches, and reloads the app.
 *
 * Safe to mount in any footer or support drawer.
 */
export function ResetSessionButton({ className }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  function handleOpen() {
    setConfirming(true);
  }

  function handleCancel() {
    setConfirming(false);
  }

  async function handleConfirm() {
    setClearing(true);
    clearAtlasCache();
    await unregisterServiceWorkerCaches();
    // Reload without query params so the app starts cleanly
    window.location.replace(window.location.pathname);
  }

  return (
    <>
      <button
        type="button"
        className={className ?? 'footer-link footer-link--reset'}
        onClick={handleOpen}
        data-testid="reset-session-button"
        aria-haspopup="dialog"
      >
        Reset saved session
      </button>

      {confirming && (
        <div
          className="reset-session-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-session-dialog-title"
          data-testid="reset-session-dialog"
        >
          <div className="reset-session-dialog">
            <h2
              id="reset-session-dialog-title"
              className="reset-session-dialog__title"
            >
              Clear saved data?
            </h2>
            <p className="reset-session-dialog__body">
              This clears saved Atlas survey/session data on this device. It
              will not delete anything already submitted.
            </p>
            <div className="reset-session-dialog__actions">
              <button
                type="button"
                className="reset-session-dialog__cancel"
                onClick={handleCancel}
                disabled={clearing}
                data-testid="reset-session-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="reset-session-dialog__confirm"
                onClick={handleConfirm}
                disabled={clearing}
                data-testid="reset-session-confirm"
              >
                {clearing ? 'Clearing…' : 'Clear and restart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ResetSessionButton;
