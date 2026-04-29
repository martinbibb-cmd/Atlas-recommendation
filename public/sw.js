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
 * IndexedDB schema  (must stay in sync with src/lib/storage/atlasDb.ts)
 *   database : 'atlas-scan-share'
 *   version  : 2
 *   stores:
 *     incoming    (keyPath: 'id', autoIncrement) — scan files from share target
 *     sessions    (keyPath: 'id')                — PropertyScanSession records
 *     asset_queue (keyPath: 'id', autoIncrement) — pending asset uploads
 */

const CACHE_NAME = 'atlas-shell-v1';

// ─── IDB helpers (inline — no import() in service workers) ────────────────────

/** Open the atlas-scan-share IDB database at the current schema version. */
function openScanDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atlas-scan-share', 2);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Version 1 — incoming file cache
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('incoming')) {
          db.createObjectStore('incoming', { keyPath: 'id', autoIncrement: true });
        }
      }

      // Version 2 — scan sessions + asset upload queue
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('sessions')) {
          const sessStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessStore.createIndex('updatedAt', 'updatedAt');
          sessStore.createIndex('dirty', 'dirty');
          sessStore.createIndex('syncState', 'syncState');
        }
        if (!db.objectStoreNames.contains('asset_queue')) {
          const aqStore = db.createObjectStore('asset_queue', { keyPath: 'id', autoIncrement: true });
          aqStore.createIndex('sessionId', 'sessionId');
          aqStore.createIndex('attempts', 'attempts');
        }
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

  const params = new URLSearchParams();
  params.set('receive-scan', '1');
  if (stored > 0) {
    params.set('files', String(stored));
  } else {
    params.set('share-error', 'no-files');
  }

  return Response.redirect('/?' + params.toString(), 303);
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
