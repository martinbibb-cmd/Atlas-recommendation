-- Migration 0012: add review_status and include_in_customer_report to scan_assets
--
-- Stores the engineer's per-item review decision for each scan asset
-- (photo, floor_plan_snapshot, object_pin_ref).
--
-- review_status:
--   'pending'   — item has not yet been reviewed (default for LiDAR-inferred
--                 pins; other assets default to 'confirmed').
--   'confirmed' — engineer has reviewed and accepted this item.
--   'rejected'  — engineer has explicitly rejected this item; it will not
--                 appear in any downstream output.
--
-- include_in_customer_report:
--   1 (true)  — this asset should be included in customer-facing proof outputs.
--   0 (false) — this asset is engineer-only and must not appear in customer
--               reports.
--
-- SQLite does not support ALTER TABLE ... ADD COLUMN with a CHECK constraint
-- on an existing column, so we use the 12-step rename pattern.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS scan_assets_new (
  id                        TEXT PRIMARY KEY,
  session_id                TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  asset_type                TEXT NOT NULL CHECK (asset_type IN (
                              'photo', 'ply', 'transcript', 'scan_bundle',
                              'floor_plan_snapshot', 'object_pin_ref'
                            )),
  r2_key                    TEXT NOT NULL UNIQUE,
  file_name                 TEXT NOT NULL,
  mime_type                 TEXT NOT NULL,
  captured_at               TEXT,
  metadata_json             TEXT NOT NULL DEFAULT '{}',
  review_status             TEXT NOT NULL DEFAULT 'confirmed'
                              CHECK (review_status IN ('pending', 'confirmed', 'rejected')),
  include_in_customer_report INTEGER NOT NULL DEFAULT 1
);

INSERT INTO scan_assets_new
  SELECT
    id, session_id, asset_type, r2_key, file_name, mime_type, captured_at, metadata_json,
    'confirmed' AS review_status,
    1           AS include_in_customer_report
  FROM scan_assets;

DROP TABLE scan_assets;

ALTER TABLE scan_assets_new RENAME TO scan_assets;

CREATE INDEX IF NOT EXISTS idx_scan_assets_session_id ON scan_assets(session_id);

PRAGMA foreign_keys = ON;
