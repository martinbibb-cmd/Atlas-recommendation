-- Migration 0002: create visits table
--
-- Stores top-level Atlas visit/case records.
-- A visit is the canonical case record; reports are child outputs of a visit.
-- working_payload_json holds the current in-progress survey/engine state.

CREATE TABLE IF NOT EXISTS visits (
  id                   TEXT PRIMARY KEY,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft',
  customer_name        TEXT,
  address_line_1       TEXT,
  postcode             TEXT,
  current_step         TEXT,
  working_payload_json TEXT NOT NULL DEFAULT '{}'
);
