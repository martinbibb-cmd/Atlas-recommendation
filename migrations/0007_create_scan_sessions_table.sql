-- Migration 0007: create scan_sessions table
--
-- Mirrors the scalar fields of PropertyScanSession so that sessions
-- reviewed in the PWA can be persisted to D1 and referenced by visit.

CREATE TABLE IF NOT EXISTS scan_sessions (
  id               TEXT PRIMARY KEY,
  job_reference    TEXT NOT NULL,
  property_address TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  scan_state       TEXT NOT NULL DEFAULT 'scanned',
  review_state     TEXT NOT NULL DEFAULT 'scanned',
  sync_state       TEXT NOT NULL DEFAULT 'uploaded',
  visit_id         TEXT REFERENCES visits(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_visit_id ON scan_sessions(visit_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_updated_at ON scan_sessions(updated_at DESC);
