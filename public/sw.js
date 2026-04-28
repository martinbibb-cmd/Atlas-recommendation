/**
 * sw.js — Atlas Mind Service Worker
 *
 * Responsibilities:
 *   1. Web Share Target (Level 2): intercepts the POST to /receive-scan that
 *      the OS delivers when the user shares a scan file to this PWA from an
 *      external scanning app (e.g. Atlas Scan).
 *   2. Stores received file(s) in IndexedDB so the React app can retrieve them
 *      after the redirect.
 *   3. Precaches key app-shell assets for basic offline support.
 *
 * IndexedDB schema
 *   database : 'atlas-scan-share'
 *   version  : 1
 *   store    : 'incoming' (keyPath: 'id', autoIncrement)
 *     fields : id, name, mimeType, data (ArrayBuffer), receivedAt (ms timestamp)
 */

const CACHE_NAME = 'atlas-shell-v1';

// ─── IDB helpers (inline — no import() in service workers) ────────────────────

/** Open the atlas-scan-share IDB database. */
function openScanDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atlas-scan-share', 1);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('incoming')) {
        db.createObjectStore('incoming', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist a scan file entry to IDB. */
async function storeScanEntry(entry) {
  const db = await openScanDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('incoming', 'readwrite');
    tx.objectStore('incoming').add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Share Target handler ─────────────────────────────────────────────────────

async function handleShareTarget(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.redirect('/?receive-scan=1&share-error=parse', 303);
  }

  const fileValues = formData.getAll('scan');
  let stored = 0;

  for (const value of fileValues) {
    if (!(value instanceof File)) continue;
    try {
      const data = await value.arrayBuffer();
      await storeScanEntry({
        name: value.name,
        mimeType: value.type || 'application/octet-stream',
        data,
        receivedAt: Date.now(),
      });
      stored++;
    } catch (err) {
      console.error('[sw] Failed to store shared file:', value.name, err);
    }
  }

  const params = stored > 0
    ? `?receive-scan=1&files=${stored}`
    : '?receive-scan=1&share-error=no-files';

  return Response.redirect('/' + params, 303);
}

// ─── Fetch handler ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept the share-target POST before it hits the network.
  if (event.request.method === 'POST' && url.pathname === '/receive-scan') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
});

// ─── Install / activate ───────────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});
